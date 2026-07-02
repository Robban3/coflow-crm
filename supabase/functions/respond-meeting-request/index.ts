import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { resolveOrgSender, sendWithFallback } from "../_shared/org-sender.ts";

// Robert/Oliver (or an admin) confirm or decline a meeting request, optionally
// setting a time + meeting link + note. The requester gets an in-CRM
// notification and an email. verify_jwt = true.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORY_LABEL: Record<string, string> = {
  teknisk: "Teknisk fråga", salj: "Säljstöd / coachning", offert: "Offert & prissättning",
  kund: "Kund & leverans", ovrigt: "Övrigt",
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

    // Time for the booked meeting: use the responder's chosen time, else fall
    // back to the requester's preferred time — so a confirm always produces a
    // calendar meeting even if no explicit time was picked.
    const meetingTime = action === "confirm" ? (scheduledTime || reqRow.preferred_time || null) : null;

    const status = action === "confirm" ? "confirmed" : "declined";
    await supabase.from("meeting_requests").update({
      status,
      scheduled_time: action === "confirm" ? meetingTime : null,
      meeting_link: action === "confirm" ? (meetingLink || null) : null,
      response_note: note || null,
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    }).eq("id", id);

    const responder = me?.full_name || me?.email || "Teamet";

    // On confirm, create a real calendar meeting (shows under Möten + dashboard).
    // Everyone who takes part sees it: the requester (host), the confirming
    // recipient (guest) and all addressed recipients are listed in
    // participant_ids, which the calendar/dashboard match against.
    if (action === "confirm" && meetingTime && reqRow.status === "pending") {
      const start = new Date(meetingTime);
      const end = new Date(start.getTime() + 30 * 60_000);

      // Resolve every addressed recipient's user id, then combine with the
      // requester and the confirming user into a deduped participant list.
      const recipientEmails: string[] = reqRow.recipient_emails || [];
      let recipientIds: string[] = [];
      if (recipientEmails.length > 0) {
        const { data: recipProfiles } = await supabase
          .from("profiles").select("id").in("email", recipientEmails);
        recipientIds = (recipProfiles ?? []).map((p: { id: string }) => p.id);
      }
      const participantIds = [...new Set(
        [reqRow.requested_by, user.id, ...recipientIds].filter(Boolean) as string[],
      )];

      const { error: meetingErr } = await supabase.from("meetings").insert({
        organization_id: reqRow.organization_id,
        host_user_id: reqRow.requested_by,
        lead_id: reqRow.lead_id,
        guest_name: responder,
        guest_email: me?.email ?? null,
        participant_ids: participantIds,
        title: `Internt möte: ${CATEGORY_LABEL[reqRow.category] || reqRow.category}`,
        description: reqRow.description,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        meeting_link: meetingLink || null,
        status: "scheduled",
      });
      if (meetingErr) console.error("[respond-meeting-request] meeting insert failed:", meetingErr.message);
    }

    // Notify the requester.
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
      const sender = await resolveOrgSender(supabase, reqRow.organization_id);
      await sendWithFallback(sender, {
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
