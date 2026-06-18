-- Enforce user-scoped lead visibility and related lead data access.

-- Helper used by RLS policies: user can access a lead only if they own/are assigned/member.
CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND l.organization_id = public.get_user_organization_id(_user_id)
      AND (
        l.created_by = _user_id
        OR l.assigned_to = _user_id
        OR public.is_lead_member(l.id, _user_id)
      )
  );
$$;

-- Backfill ownership for historical leads so existing records stay visible.
UPDATE public.leads l
SET created_by = COALESCE(
  l.created_by,
  l.assigned_to,
  (
    SELECT lm.user_id
    FROM public.lead_members lm
    WHERE lm.lead_id = l.id
    ORDER BY lm.created_at ASC
    LIMIT 1
  )
)
WHERE l.created_by IS NULL;

-- LEADS
DROP POLICY IF EXISTS "Users can view leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads in their organization" ON public.leads;

DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Users can view own leads"
ON public.leads FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_lead_member(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
CREATE POLICY "Users can insert own leads"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
CREATE POLICY "Users can update own leads"
ON public.leads FOR UPDATE TO authenticated
USING (public.can_access_lead(id, auth.uid()))
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_lead_member(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
CREATE POLICY "Users can delete own leads"
ON public.leads FOR DELETE TO authenticated
USING (public.can_access_lead(id, auth.uid()));

-- LEAD MEMBERS should also be scoped to leads the caller can access.
DROP POLICY IF EXISTS "Users can view lead members in their org" ON public.lead_members;
DROP POLICY IF EXISTS "Users can view lead members they can access" ON public.lead_members;
CREATE POLICY "Users can view lead members they can access"
ON public.lead_members FOR SELECT TO authenticated
USING (public.can_access_lead(lead_id, auth.uid()));

-- PROSPECTING DRAFTS
DROP POLICY IF EXISTS "org_isolation" ON public.prospecting_drafts;

DROP POLICY IF EXISTS "Users can view drafts for own leads" ON public.prospecting_drafts;
CREATE POLICY "Users can view drafts for own leads"
ON public.prospecting_drafts FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.can_access_lead(lead_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert drafts for own leads" ON public.prospecting_drafts;
CREATE POLICY "Users can insert drafts for own leads"
ON public.prospecting_drafts FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.can_access_lead(lead_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update drafts for own leads" ON public.prospecting_drafts;
CREATE POLICY "Users can update drafts for own leads"
ON public.prospecting_drafts FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.can_access_lead(lead_id, auth.uid())
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.can_access_lead(lead_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can delete drafts for own leads" ON public.prospecting_drafts;
CREATE POLICY "Users can delete drafts for own leads"
ON public.prospecting_drafts FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.can_access_lead(lead_id, auth.uid())
);

-- WEB ANALYSES
DROP POLICY IF EXISTS "Users can view analyses in their organization" ON public.web_analyses;
DROP POLICY IF EXISTS "Users can insert analyses in their organization" ON public.web_analyses;

DROP POLICY IF EXISTS "Users can view analyses for own leads" ON public.web_analyses;
CREATE POLICY "Users can view analyses for own leads"
ON public.web_analyses FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
    OR analyzed_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert analyses for own leads" ON public.web_analyses;
CREATE POLICY "Users can insert analyses for own leads"
ON public.web_analyses FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    analyzed_by = auth.uid()
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

-- SENT EMAILS
DROP POLICY IF EXISTS "Users can view sent emails in their organization" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can insert sent emails in their organization" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can update sent emails in their organization" ON public.sent_emails;
DROP POLICY IF EXISTS "Users see own org emails" ON public.sent_emails;

DROP POLICY IF EXISTS "Users can view sent emails for own leads" ON public.sent_emails;
CREATE POLICY "Users can view sent emails for own leads"
ON public.sent_emails FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    sent_by = auth.uid()
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can insert sent emails for own leads" ON public.sent_emails;
CREATE POLICY "Users can insert sent emails for own leads"
ON public.sent_emails FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND sent_by = auth.uid()
  AND (lead_id IS NULL OR public.can_access_lead(lead_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own sent emails" ON public.sent_emails;
CREATE POLICY "Users can update own sent emails"
ON public.sent_emails FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND sent_by = auth.uid()
);

-- ACTIVITIES
DROP POLICY IF EXISTS "Users can view activities in their organization" ON public.activities;
DROP POLICY IF EXISTS "Users can insert activities in their organization" ON public.activities;
DROP POLICY IF EXISTS "Users can update activities in their organization" ON public.activities;

DROP POLICY IF EXISTS "Users can view activities for own leads" ON public.activities;
CREATE POLICY "Users can view activities for own leads"
ON public.activities FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can insert activities for own leads" ON public.activities;
CREATE POLICY "Users can insert activities for own leads"
ON public.activities FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND user_id = auth.uid()
  AND (lead_id IS NULL OR public.can_access_lead(lead_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own activities" ON public.activities;
CREATE POLICY "Users can update own activities"
ON public.activities FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND user_id = auth.uid()
);

-- TASKS
DROP POLICY IF EXISTS "Users can view own or assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own or assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Admins can delete tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their organization" ON public.tasks;

DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND created_by = auth.uid()
  AND (
    lead_id IS NULL
    OR public.can_access_lead(lead_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND created_by = auth.uid()
);
