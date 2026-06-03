import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { reportId, leadId, guestName, guestEmail, guestPhone, companyName, message, domain } =
      await req.json();

    if (!guestName || !guestEmail) {
      throw new Error("Namn och e-post krävs");
    }

    // ── Determine meeting host ──────────────────────────────────────────
    let hostUserId: string | null = null;

    // 1. Try lead owner from lead_members
    if (leadId) {
      const { data: members } = await supabase
        .from("lead_members")
        .select("user_id, role")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });

      if (members && members.length > 0) {
        // Prefer owner role, otherwise first member
        const owner = members.find((m: any) => m.role === "owner");
        hostUserId = owner ? owner.user_id : members[0].user_id;
      }
    }

    // 2. Fallback: find an admin user
    if (!hostUserId) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1);

      if (admins && admins.length > 0) {
        hostUserId = admins[0].user_id;
      }
    }

    if (!hostUserId) {
      throw new Error("Ingen värd kunde hittas för bokningen");
    }

    // ── Get host org for meeting ────────────────────────────────────────
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("organization_id, full_name")
      .eq("id", hostUserId)
      .single();

    // ── Create meeting ──────────────────────────────────────────────────
    // Create a placeholder meeting (30 min from now as placeholder – the host will reschedule)
    const meetingTitle = `Genomgång: ${companyName || guestName}${domain ? ` (${domain})` : ""}`;
    const meetingDescription = [
      `Bokningsförfrågan från GEO-rapport`,
      `Kontakt: ${guestName}`,
      `E-post: ${guestEmail}`,
      guestPhone ? `Telefon: ${guestPhone}` : null,
      companyName ? `Företag: ${companyName}` : null,
      message ? `\nMeddelande:\n${message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Set meeting 3 days from now at 10:00 as a suggestion
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + 3);
    suggestedDate.setHours(10, 0, 0, 0);
    const suggestedEnd = new Date(suggestedDate);
    suggestedEnd.setMinutes(suggestedEnd.getMinutes() + 30);

    const { error: meetingError } = await supabase.from("meetings").insert({
      host_user_id: hostUserId,
      title: meetingTitle,
      description: meetingDescription,
      start_time: suggestedDate.toISOString(),
      end_time: suggestedEnd.toISOString(),
      guest_name: guestName,
      guest_email: guestEmail,
      lead_id: leadId || null,
      organization_id: hostProfile?.organization_id || null,
      status: "scheduled",
    });

    if (meetingError) {
      console.error("Meeting insert error:", meetingError);
      throw new Error("Kunde inte skapa mötet");
    }

    // ── Send notification email to hej@kodco.se ─────────────────────────
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      const htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f4f4f5;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="padding:32px;">
            <h1 style="font-size:20px;margin:0 0 4px;color:#1a1a1a;">Ny bokningsförfrågan</h1>
            <p style="font-size:13px;color:#666;margin:0 0 24px;">Från GEO-rapport${domain ? ` – ${domain}` : ""}</p>
            
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:8px 0;color:#666;width:100px;">Namn</td>
                <td style="padding:8px 0;color:#1a1a1a;font-weight:500;">${guestName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#666;">E-post</td>
                <td style="padding:8px 0;color:#1a1a1a;"><a href="mailto:${guestEmail}" style="color:#2563eb;">${guestEmail}</a></td>
              </tr>
              ${guestPhone ? `<tr><td style="padding:8px 0;color:#666;">Telefon</td><td style="padding:8px 0;color:#1a1a1a;">${guestPhone}</td></tr>` : ""}
              ${companyName ? `<tr><td style="padding:8px 0;color:#666;">Företag</td><td style="padding:8px 0;color:#1a1a1a;">${companyName}</td></tr>` : ""}
            </table>
            
            ${message ? `<div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;"><p style="font-size:13px;color:#666;margin:0 0 4px;">Meddelande:</p><p style="font-size:14px;color:#333;margin:0;line-height:1.5;">${message.replace(/\n/g, "<br/>")}</p></div>` : ""}
            
            <p style="font-size:13px;color:#999;margin:24px 0 0;">Tilldelad: ${hostProfile?.full_name || "Admin"}</p>
          </div>
        </div>
      </body>
      </html>`;

      try {
        await resend.emails.send({
          from: `Kod & Co <hej@kodco.se>`,
          to: ["hej@kodco.se"],
          subject: `Ny genomgång: ${companyName || guestName}${domain ? ` (${domain})` : ""}`,
          html: htmlBody,
        });
      } catch (emailErr) {
        console.error("Email send error (non-fatal):", emailErr);
      }
    }

    // ── Create notification for host ────────────────────────────────────
    await supabase.from("notifications").insert({
      user_id: hostUserId,
      type: "booking",
      title: `Ny bokningsförfrågan: ${companyName || guestName}`,
      message: `${guestName} vill boka en genomgång av sin GEO-rapport.`,
      link: "/meetings",
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("book-report-meeting error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
