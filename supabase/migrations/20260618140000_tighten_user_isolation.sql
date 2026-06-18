-- Close same-org cross-user read leaks: scope geo_analyses (+ its child tables)
-- and email_replies to the owner / lead members, mirroring web_analyses & sent_emails.

-- ── geo_analyses: owner / lead-member read scope (like web_analyses) ──────────
DROP POLICY IF EXISTS "Users can view own org geo_analyses" ON public.geo_analyses;
CREATE POLICY "Users can view own geo_analyses"
  ON public.geo_analyses FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
      OR created_by = auth.uid()
    )
  );

-- Helper predicate reused by the child tables: can the caller access this analysis?
-- (inlined per table since policies can't share expressions)

-- ── geo_pages ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage geo_pages via analysis" ON public.geo_pages;
CREATE POLICY "Users can manage geo_pages via analysis"
  ON public.geo_pages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.geo_analyses ga
    WHERE ga.id = geo_analysis_id
      AND ga.organization_id = public.get_user_organization_id(auth.uid())
      AND ((ga.lead_id IS NOT NULL AND public.can_access_lead(ga.lead_id, auth.uid()))
           OR ga.created_by = auth.uid())
  ));

-- ── geo_findings ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage geo_findings via analysis" ON public.geo_findings;
CREATE POLICY "Users can manage geo_findings via analysis"
  ON public.geo_findings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.geo_analyses ga
    WHERE ga.id = geo_analysis_id
      AND ga.organization_id = public.get_user_organization_id(auth.uid())
      AND ((ga.lead_id IS NOT NULL AND public.can_access_lead(ga.lead_id, auth.uid()))
           OR ga.created_by = auth.uid())
  ));

-- ── geo_actions ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage geo_actions via analysis" ON public.geo_actions;
CREATE POLICY "Users can manage geo_actions via analysis"
  ON public.geo_actions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.geo_analyses ga
    WHERE ga.id = geo_analysis_id
      AND ga.organization_id = public.get_user_organization_id(auth.uid())
      AND ((ga.lead_id IS NOT NULL AND public.can_access_lead(ga.lead_id, auth.uid()))
           OR ga.created_by = auth.uid())
  ));

-- ── email_replies: owner / lead-member read scope (like sent_emails) ─────────
DROP POLICY IF EXISTS "Users see own org replies" ON public.email_replies;
CREATE POLICY "Users can view own email replies"
  ON public.email_replies FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      sent_by = auth.uid()
      OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id, auth.uid()))
    )
  );
