import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// 1x1 transparent GIF
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
]);

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("id");

  // Always return the tracking pixel, even if update fails
  const headers = {
    "Content-Type": "image/gif",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };

  if (!emailId) {
    return new Response(TRACKING_PIXEL, { status: 200, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update the email record with open tracking
    const { data: existingEmail } = await supabase
      .from("sent_emails")
      .select("id, opened_at, opened_count, sent_by, recipient_name, recipient_email, subject, lead_id")
      .eq("id", emailId)
      .single();

    if (existingEmail) {
      const isFirstOpen = !existingEmail.opened_at;
      
      await supabase
        .from("sent_emails")
        .update({
          opened_at: existingEmail.opened_at || new Date().toISOString(),
          opened_count: (existingEmail.opened_count || 0) + 1,
        })
        .eq("id", emailId);
      
      console.log(`Email ${emailId} opened. Count: ${(existingEmail.opened_count || 0) + 1}`);

      // Send notification only on first open
      if (isFirstOpen && existingEmail.sent_by) {
        await supabase.from("notifications").insert({
          user_id: existingEmail.sent_by,
          type: "email_opened",
          title: "Mail öppnat",
          message: `${existingEmail.recipient_name || existingEmail.recipient_email} öppnade "${existingEmail.subject}"`,
          link: existingEmail.lead_id ? `/leads/${existingEmail.lead_id}` : "/outreach",
          metadata: {
            email_id: emailId,
            recipient_email: existingEmail.recipient_email,
            subject: existingEmail.subject,
            lead_id: existingEmail.lead_id,
          },
        });
        console.log(`Notification sent to user ${existingEmail.sent_by} for email open`);
      }
    }
  } catch (error) {
    console.error("Error tracking email open:", error);
  }

  return new Response(TRACKING_PIXEL, { status: 200, headers });
});
