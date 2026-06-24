import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeadsData, type LeadWithOutreachStatus } from "@/lib/leadsQuery";

/**
 * The current seller's "call queue": their OWN, unworked, active leads in the
 * same order as the leads list (created_at DESC). Powers the "next lead" arrow
 * in the lead detail view.
 *
 * Ownership is filtered explicitly (assigned_to / member) rather than relying on
 * RLS, because admins see every org lead via RLS — the queue must still only
 * walk the current user's own leads, never anyone else's.
 *
 * The filter mirrors LeadsList's default view (own + active + hide worked). Keep
 * the two in sync if that default changes.
 */
export function useLeadQueue() {
  const { user } = useAuth();

  // Same query key as the leads list, so this shares the list's cache.
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-enriched"],
    queryFn: fetchLeadsData,
  });

  const queue = useMemo<LeadWithOutreachStatus[]>(
    () =>
      leads.filter(
        (l) =>
          // own (mirror LeadsList "mine")
          (l.assigned_to === user?.id || l.member_ids?.includes(user?.id ?? "")) &&
          // unworked
          !l.has_activity &&
          // active (mirror leads list default status set)
          ["active", "customer"].includes(l.lead_status),
      ),
    [leads, user?.id],
  );

  /**
   * Next lead id to advance to. If the current lead is in the queue, returns the
   * one after it (null when it's the last). If the current lead is no longer in
   * the queue (e.g. just worked, or not owned), returns the first queued lead.
   */
  const getNextId = (currentId: string): string | null => {
    const i = queue.findIndex((l) => l.id === currentId);
    if (i === -1) return queue[0]?.id ?? null;
    return queue[i + 1]?.id ?? null;
  };

  return { queue, getNextId };
}
