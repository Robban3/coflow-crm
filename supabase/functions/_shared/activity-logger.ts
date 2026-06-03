import { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Log an activity event for statistics tracking.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function logActivityEvent(
  supabase: SupabaseClient,
  params: {
    organization_id: string;
    actor_user_id: string;
    type: string; // e.g. "email.sent", "call.logged", "document.sent", "meeting.booked", "task.completed"
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("activity_events").insert({
      organization_id: params.organization_id,
      actor_user_id: params.actor_user_id,
      type: params.type,
      occurred_at: new Date().toISOString(),
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      metadata: params.metadata || null,
    });
  } catch (err) {
    console.error("Failed to log activity event:", err);
  }
}
