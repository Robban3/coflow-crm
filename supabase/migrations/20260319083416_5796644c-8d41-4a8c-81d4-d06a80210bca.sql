
-- sent_emails: composite index for follow-up queries (lead_id + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_sent_emails_lead_created ON public.sent_emails (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;

-- sent_emails: organization + created_at for statistics queries
CREATE INDEX IF NOT EXISTS idx_sent_emails_org_created ON public.sent_emails (organization_id, created_at DESC) WHERE organization_id IS NOT NULL;

-- sent_emails: sent_by + created_at for user-scoped mail views
CREATE INDEX IF NOT EXISTS idx_sent_emails_sentby_created ON public.sent_emails (sent_by, created_at DESC);

-- documents: organization + created_at for document lists
CREATE INDEX IF NOT EXISTS idx_documents_org_created ON public.documents (organization_id, created_at DESC) WHERE organization_id IS NOT NULL;

-- documents: lead_id for lead detail lookups
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON public.documents (lead_id) WHERE lead_id IS NOT NULL;

-- documents: created_by for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.documents (created_by) WHERE created_by IS NOT NULL;

-- meetings: organization + start_time for calendar queries
CREATE INDEX IF NOT EXISTS idx_meetings_org_start ON public.meetings (organization_id, start_time) WHERE organization_id IS NOT NULL;

-- meetings: host_user_id + start_time for user calendar
CREATE INDEX IF NOT EXISTS idx_meetings_host_start ON public.meetings (host_user_id, start_time);

-- customers: organization_id (missing, used in all list queries via RLS)
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers (organization_id) WHERE organization_id IS NOT NULL;

-- tasks: organization_id for org-scoped lists
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks (organization_id) WHERE organization_id IS NOT NULL;

-- document_blocks: document_id + sort_order for editor rendering
CREATE INDEX IF NOT EXISTS idx_document_blocks_doc_sort ON public.document_blocks (document_id, sort_order);

-- document_templates: organization_id for template lists
CREATE INDEX IF NOT EXISTS idx_document_templates_org ON public.document_templates (organization_id) WHERE organization_id IS NOT NULL;

-- lead_members: user_id for RLS is_lead_member lookups
CREATE INDEX IF NOT EXISTS idx_lead_members_user ON public.lead_members (user_id);

-- lead_members: organization_id
CREATE INDEX IF NOT EXISTS idx_lead_members_org ON public.lead_members (organization_id) WHERE organization_id IS NOT NULL;

-- profiles: organization_id for team member lookups
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles (organization_id) WHERE organization_id IS NOT NULL;

-- email_replies: received_at for chronological inbox queries
CREATE INDEX IF NOT EXISTS idx_email_replies_received ON public.email_replies (sent_by, received_at DESC);

-- lead_sequences: organization_id + status for active sequence checks
CREATE INDEX IF NOT EXISTS idx_lead_sequences_org_status ON public.lead_sequences (organization_id, status);
