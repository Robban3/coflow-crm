
-- Add prospecting columns to leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS prospecting_source TEXT,
ADD COLUMN IF NOT EXISTS imported_via_prospecting BOOLEAN DEFAULT FALSE;

-- Prospecting drafts table
CREATE TABLE IF NOT EXISTS prospecting_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  ai_summary TEXT,
  ai_confidence INTEGER,
  status TEXT DEFAULT 'draft',
  resend_message_id TEXT,
  send_error TEXT,
  send_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS on prospecting_drafts
ALTER TABLE prospecting_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON prospecting_drafts
  FOR ALL
  USING (organization_id = (SELECT get_user_organization_id(auth.uid())));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prospecting_drafts_org_status
  ON prospecting_drafts(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_enrichment
  ON leads(organization_id, enrichment_status, imported_via_prospecting, created_at DESC);
