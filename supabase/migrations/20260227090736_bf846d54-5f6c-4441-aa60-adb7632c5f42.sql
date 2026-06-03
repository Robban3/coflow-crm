
-- 1. Add enrichment columns to leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending' 
  CHECK (enrichment_status IN ('pending', 'processing', 'ready', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enrichment_error TEXT,
ADD COLUMN IF NOT EXISTS auto_draft_generated BOOLEAN DEFAULT FALSE;

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_org_enrichment 
  ON leads(organization_id, enrichment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_status_created 
  ON leads(organization_id, lead_status, created_at DESC);

-- =============================================
-- 3. Fix RLS policies: cached subquery form
-- =============================================

-- LEADS
DROP POLICY IF EXISTS "Users can view leads in their organization" ON leads;
CREATE POLICY "Users can view leads in their organization" ON leads FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert leads in their organization" ON leads;
CREATE POLICY "Users can insert leads in their organization" ON leads FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update leads in their organization" ON leads;
CREATE POLICY "Users can update leads in their organization" ON leads FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())))
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can delete leads in their organization" ON leads;
CREATE POLICY "Admins can delete leads in their organization" ON leads FOR DELETE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- ACTIVITIES
DROP POLICY IF EXISTS "Users can view activities in their organization" ON activities;
CREATE POLICY "Users can view activities in their organization" ON activities FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert activities in their organization" ON activities;
CREATE POLICY "Users can insert activities in their organization" ON activities FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update activities in their organization" ON activities;
CREATE POLICY "Users can update activities in their organization" ON activities FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

-- WEB_ANALYSES
DROP POLICY IF EXISTS "Users can view analyses in their organization" ON web_analyses;
CREATE POLICY "Users can view analyses in their organization" ON web_analyses FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert analyses in their organization" ON web_analyses;
CREATE POLICY "Users can insert analyses in their organization" ON web_analyses FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

-- GEO_ANALYSES
DROP POLICY IF EXISTS "Users can view own org geo_analyses" ON geo_analyses;
CREATE POLICY "Users can view own org geo_analyses" ON geo_analyses FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert geo_analyses" ON geo_analyses;
CREATE POLICY "Users can insert geo_analyses" ON geo_analyses FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update own org geo_analyses" ON geo_analyses;
CREATE POLICY "Users can update own org geo_analyses" ON geo_analyses FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

-- SENT_EMAILS
DROP POLICY IF EXISTS "Users see own org emails" ON sent_emails;
CREATE POLICY "Users see own org emails" ON sent_emails FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert sent emails in their organization" ON sent_emails;
CREATE POLICY "Users can insert sent emails in their organization" ON sent_emails FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update sent emails in their organization" ON sent_emails;
CREATE POLICY "Users can update sent emails in their organization" ON sent_emails FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

-- DOCUMENTS
DROP POLICY IF EXISTS "Users can view documents in their org" ON documents;
CREATE POLICY "Users can view documents in their org" ON documents FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can create documents in their org" ON documents;
CREATE POLICY "Users can create documents in their org" ON documents FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update documents in their org" ON documents;
CREATE POLICY "Users can update documents in their org" ON documents FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())))
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can delete documents in their org" ON documents;
CREATE POLICY "Admins can delete documents in their org" ON documents FOR DELETE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- OUTREACH_SEQUENCES
DROP POLICY IF EXISTS "Users can view sequences in their organization" ON outreach_sequences;
CREATE POLICY "Users can view sequences in their organization" ON outreach_sequences FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert sequences in their organization" ON outreach_sequences;
CREATE POLICY "Users can insert sequences in their organization" ON outreach_sequences FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update sequences in their organization" ON outreach_sequences;
CREATE POLICY "Users can update sequences in their organization" ON outreach_sequences FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can delete sequences in their organization" ON outreach_sequences;
CREATE POLICY "Admins can delete sequences in their organization" ON outreach_sequences FOR DELETE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- LEAD_SEQUENCES
DROP POLICY IF EXISTS "Users can view lead sequences in their organization" ON lead_sequences;
CREATE POLICY "Users can view lead sequences in their organization" ON lead_sequences FOR SELECT
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert lead sequences in their organization" ON lead_sequences;
CREATE POLICY "Users can insert lead sequences in their organization" ON lead_sequences FOR INSERT
  WITH CHECK (organization_id = (SELECT get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update lead sequences in their organization" ON lead_sequences;
CREATE POLICY "Users can update lead sequences in their organization" ON lead_sequences FOR UPDATE
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));
