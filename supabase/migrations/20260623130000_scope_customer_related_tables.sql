-- Scope customer/lead-RELATED tables (activities, tasks, sent_emails, email_replies)
-- so a user can no longer SEE rows tied to customers they don't own — while
-- lead-linked rows stay visible org-wide (leads are intentionally org-wide,
-- per 20260623120000_scope_customer_and_lead_visibility.sql) and admins see
-- everything within their organization.
--
-- This migration ONLY replaces the existing authenticated SELECT / UPDATE /
-- DELETE policies (by their exact current names). It does NOT touch any INSERT
-- policy, does NOT add WITH CHECK clauses (so creation/update flows keep
-- working), and does NOT touch any anon / public / service-role / token policy.
--
-- Tenant isolation (organization_id) is preserved throughout.
--
-- Visibility model for SELECT (a row is visible to an authenticated caller iff):
--   * the row is in the caller's organization, AND
--   * at least one of:
--       - the caller owns the row itself, OR
--       - the caller is an org admin, OR
--       - the row is linked to a CUSTOMER the caller is assigned to, OR
--       - the row is linked to a LEAD the caller can access
--         (can_access_lead = own / assigned / lead member — NOT org-wide, so
--         other users' lead activity history stays private).
-- UPDATE / DELETE: owner OR admin within the org (plain USING, no WITH CHECK).

-- ============================================================================
-- ACTIVITIES
--   columns confirmed: organization_id, user_id (owner), customer_id, lead_id
--   owner = user_id
-- ============================================================================

-- SELECT
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
  )
);

-- UPDATE: owner or admin within the org.
DROP POLICY IF EXISTS "Users can update own activities" ON public.activities;
CREATE POLICY "Users can update own activities"
ON public.activities FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- (No DELETE policy exists on public.activities; none is added here.)

-- ============================================================================
-- TASKS
--   columns confirmed: organization_id, created_by + assigned_to (owners),
--                       customer_id, lead_id
--   owner = created_by OR assigned_to
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      customer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = tasks.customer_id
          AND c.assigned_to = auth.uid()
      )
    )
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

-- UPDATE: owner or admin within the org.
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- DELETE: owner or admin within the org.
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- ============================================================================
-- SENT EMAILS
--   columns confirmed: organization_id, sent_by (owner), customer_id, lead_id
--   owner = sent_by
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view sent emails for own leads" ON public.sent_emails;
CREATE POLICY "Users can view sent emails for own leads"
ON public.sent_emails FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    sent_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      customer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = sent_emails.customer_id
          AND c.assigned_to = auth.uid()
      )
    )
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

-- UPDATE: owner or admin within the org.
DROP POLICY IF EXISTS "Users can update own sent emails" ON public.sent_emails;
CREATE POLICY "Users can update own sent emails"
ON public.sent_emails FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    sent_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- (No DELETE policy exists on public.sent_emails; none is added here.)

-- ============================================================================
-- EMAIL REPLIES  (inbound emails — found via supabase/functions/receive-email-reply)
--   columns confirmed: organization_id, sent_by (owner), lead_id
--   NOTE: this table has NO customer_id column, so the customer-linkage branch
--   is omitted; org check comes from the direct organization_id comparison and
--   the lead branch.
--   owner = sent_by
--   Service-role INSERT ("Service role can insert replies") is left untouched.
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own email replies" ON public.email_replies;
CREATE POLICY "Users can view own email replies"
ON public.email_replies FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    sent_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

-- UPDATE: owner or admin within the org.
DROP POLICY IF EXISTS "Users can update own replies" ON public.email_replies;
CREATE POLICY "Users can update own replies"
ON public.email_replies FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    sent_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- (No DELETE policy exists on public.email_replies; none is added here.)
