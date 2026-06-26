-- Make pool-release reasons actually visible as notes.
--
-- Two gaps remained after release reasons started being written as notes:
--   1) Leads already in the pool were released BEFORE that change, so they have
--      a released_reason but no note. Backfill one from the stored reason.
--   2) The activities SELECT policy only let the lead's owner (or an admin) read
--      its notes — so a regular seller browsing the pool couldn't read why a
--      lead was released, which is the whole point. Allow org members to read
--      the activities of a pooled (released, unassigned) lead.

-- 1) Backfill a note for every pooled lead that has a reason but no note yet ---
INSERT INTO public.activities (lead_id, organization_id, user_id, type, title, description, completed_at, created_at)
SELECT l.id, l.organization_id, l.released_by, 'note',
       'Lead släppt till poolen', l.released_reason, l.released_at, l.released_at
FROM public.leads l
WHERE l.released_at IS NOT NULL
  AND l.assigned_to IS NULL
  AND NULLIF(l.released_reason, '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.lead_id = l.id
      AND a.type = 'note'
      AND a.title IN ('Lead släppt till poolen', 'Lead återförd till poolen')
  );

-- 2) Let org members read activities of pooled leads ------------------------
DROP POLICY IF EXISTS "Users can view activities for own leads" ON public.activities;
CREATE POLICY "Users can view activities for own leads"
ON public.activities FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      customer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = activities.customer_id
          AND c.assigned_to = auth.uid()
      )
    )
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
    -- Pooled leads: anyone in the org may read the notes (e.g. the release
    -- reason) so they can decide whether to claim it.
    OR (
      lead_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = activities.lead_id
          AND l.assigned_to IS NULL
          AND l.released_at IS NOT NULL
          AND l.organization_id = public.get_user_organization_id(auth.uid())
      )
    )
  )
);
