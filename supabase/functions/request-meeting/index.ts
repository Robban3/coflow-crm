import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// A salesperson requests an internal meeting with Robert and/or Oliver. Creates
// a meeting_requests row, emails the chosen recipients and drops an in-CRM
// notification for each. verify_jwt = true (only authenticated org members).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED = ["robert@applabbet.com", "oliver@applabbet.com"];
const CATEGORY_LABEL: Record<string, string> = {
  teknisk: "Teknisk fråga",
  salj: "Säljstöd / coachning",
  offert: "Offert & prissättning",
  kund: "Kund & leverans",
  ovrigt: "Övrigt",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const recipientEmails: string[] = (body.recipientEmails || []).filter((e: string) => ALLOWED.includes(e));
    const category: string = body.category || "ovrigt";
    const description: string = (body.description || "").trim();
    const preferredTime: string | null = body.preferredTime || null;
    const urgency: string = body.urgency === "bradskande" ? "bradskande" : "normal";
    const leadId: string | null = body.leadId || null;

    if (!recipientEmails.length) return json({ error: "Välj minst en mottagare" }, 400);
    if (!description) return json({ error: "Beskrivning krävs" }, 400);

    const { data: profile } = await supabase
      .from("profiles").select("full_name, email, organization_id").eq("id", user.id).single();
    const orgId = profile?.organization_id;
    const sellerName = profile?.full_name || profile?.email || "En säljare";

    const { data: inserted, error: insErr } = await supabase
      .from("meeting_requests")
      .insert({
        organization_id: orgId,
        requested_by: user.id,
        recipient_emails: recipientEmails,
        category,
        description,
        preferred_time: preferredTime,
        urgency,
        lead_id: leadId,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // In-CRM notifications for each recipient (resolve email -> user id).
    const { data: recipientProfiles } = await supabase
      .from("profiles").select("id, email").in("email", recipientEmails);
    const catLabel = CATEGORY_LABEL[category] || category;
    for (const rp of recipientProfiles || []) {
      await supabase.from("notifications").insert({
        user_id: rp.id,
        type: "meeting_request",
        title: `Möteförfrågan – ${catLabel}`,
        message: `${sellerName}${urgency === "bradskande" ? " (brådskande)" : ""}: ${description.slice(0, 120)}`,
        link: "/meetings",
        metadata: { meeting_request_id: inserted.id, category, requester: sellerName },
      });
    }

    // Email the chosen recipients.
    const resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const when = preferredTime ? new Date(preferredTime).toLocaleString("sv-SE") : "Ingen önskad tid angiven";
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:560px">
          <h2 style="margin:0 0 8px">Ny möteförfrågan</h2>
          <p style="margin:0 0 12px"><strong>${sellerName}</strong> vill boka ett möte med er.</p>
          <table style="font-size:14px;border-collapse:collapse">
            <tr><td style="padding:4px 12px 4px 0;color:#555">Kategori</td><td><strong>${catLabel}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#555">Prioritet</td><td>${urgency === "bradskande" ? "⚡ Brådskande" : "Normal"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#555">Önskad tid</td><td>${when}</td></tr>
          </table>
          <p style="margin:14px 0 4px;color:#555;font-size:13px">Beskrivning</p>
          <div style="padding:12px 16px;border:1px solid #eee;border-radius:10px;background:#fafafa">${description.replace(/\n/g, "<br/>")}</div>
          <p style="margin:16px 0 0;color:#999;font-size:12px">Bekräfta i CRM:et under Möten.</p>
        </div>`;
      await resend.emails.send({
        from: "CoFlow <mail@coflow.se>",
        to: recipientEmails,
        subject: `Möteförfrågan (${catLabel}) – från ${sellerName}`,
        html,
      }).catch(() => {});
    }

    return json({ success: true, id: inserted.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
