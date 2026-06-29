import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// Robert/Oliver (or an admin) confirm or decline a meeting request, optionally
// setting a time + meeting link + note. The requester gets an in-CRM
// notification and an email. verify_jwt = true.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { id, action, scheduledTime, meetingLink, note } = await req.json();
    if (!id || !["confirm", "decline"].includes(action)) return json({ error: "Bad request" }, 400);

    const { data: reqRow } = await supabase
      .from("meeting_requests").select("*").eq("id", id).single();
    if (!reqRow) return json({ error: "Request not found" }, 404);

    // Authorize: admin or an addressed recipient.
    const { data: me } = await supabase.from("profiles").select("email, full_name").eq("id", user.id).single();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    const isRecipient = me?.email && (reqRow.recipient_emails || []).includes(me.email);
    if (!isAdmin && !isRecipient) return json({ error: "Inte behörig" }, 403);

    const status = action === "confirm" ? "confirmed" : "declined";
    await supabase.from("meeting_requests").update({
      status,
      scheduled_time: action === "confirm" ? (scheduledTime || null) : null,
      meeting_link: action === "confirm" ? (meetingLink || null) : null,
      response_note: note || null,
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    }).eq("id", id);

    // Notify the requester.
    const responder = me?.full_name || me?.email || "Teamet";
    const title = action === "confirm" ? "Möte bekräftat" : "Möteförfrågan avböjd";
    const whenStr = scheduledTime ? ` – ${new Date(scheduledTime).toLocaleString("sv-SE")}` : "";
    await supabase.from("notifications").insert({
      user_id: reqRow.requested_by,
      type: "meeting_response",
      title,
      message: action === "confirm"
        ? `${responder} bekräftade ditt möte${whenStr}.${note ? " " + note : ""}`
        : `${responder} kunde inte boka mötet.${note ? " " + note : ""}`,
      link: "/meetings",
      metadata: { meeting_request_id: id, status },
    });

    // Email the requester.
    const { data: reqProfile } = await supabase
      .from("profiles").select("email, full_name").eq("id", reqRow.requested_by).single();
    const resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
    if (reqProfile?.email && resendApiKey) {
      const resend = new Resend(resendApiKey);
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:520px">
          <h2 style="margin:0 0 8px">${title}</h2>
          <p style="margin:0 0 12px">${action === "confirm"
            ? `<strong>${responder}</strong> har bekräftat ditt möte${whenStr}.`
            : `<strong>${responder}</strong> kunde tyvärr inte boka mötet.`}</p>
          ${meetingLink && action === "confirm" ? `<p><a href="${meetingLink}">${meetingLink}</a></p>` : ""}
          ${note ? `<div style="padding:12px 16px;border:1px solid #eee;border-radius:10px;background:#fafafa">${String(note).replace(/\n/g, "<br/>")}</div>` : ""}
        </div>`;
      await resend.emails.send({
        from: "CoFlow <mail@coflow.se>",
        to: [reqProfile.email],
        subject: title,
        html,
      }).catch(() => {});
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
