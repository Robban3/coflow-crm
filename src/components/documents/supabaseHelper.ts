import { supabase } from "@/integrations/supabase/client";

/**
 * Helper to query new tables not yet in the auto-generated types.
 * Returns supabase.from() with `any` typing to bypass type checks.
 */
export function fromTable(table: string) {
  return (supabase as any).from(table);
}
