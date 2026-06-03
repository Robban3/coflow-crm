import { supabase } from "@/integrations/supabase/client";

/**
 * Log an activity event for the statistics module.
 * Fire-and-forget: never throws.
 */
export async function logActivityEvent(params: {
  organization_id: string;
  actor_user_id: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("activity_events" as any).insert({
      organization_id: params.organization_id,
      actor_user_id: params.actor_user_id,
      type: params.type,
      occurred_at: new Date().toISOString(),
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      metadata: params.metadata || null,
    });
  } catch {
    // Silently fail – statistics should never block primary flows
  }
}
