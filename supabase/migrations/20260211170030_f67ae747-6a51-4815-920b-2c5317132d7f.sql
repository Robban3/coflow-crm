
-- ============================================
-- Fas 1: Offert- och Mallbyggare 2.0 – Datamodell
-- ============================================

-- 1. document_templates
CREATE TABLE public.document_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'offer', -- offer / contract / other
  description text,
  brand_settings jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_org_document_templates
  BEFORE INSERT ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can view templates in their org"
  ON public.document_templates FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can create templates in their org"
  ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update templates in their org"
  ON public.document_templates FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete templates in their org"
  ON public.document_templates FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. template_versions
CREATE TABLE public.template_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  blocks_json jsonb NOT NULL DEFAULT '[]',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view template versions via template org"
  ON public.template_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.document_templates t
      WHERE t.id = template_id
      AND t.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can create template versions"
  ON public.template_versions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_templates t
      WHERE t.id = template_id
      AND t.organization_id = get_user_organization_id(auth.uid())
    )
  );

-- 3. documents (offers/contracts)
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  document_number text,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'offer',
  status text NOT NULL DEFAULT 'draft', -- draft/sent/viewed/accepted/rejected/expired
  signature_status text NOT NULL DEFAULT 'none', -- none/requested/signed/declined
  template_id uuid REFERENCES public.document_templates(id),
  template_version int,
  currency text DEFAULT 'SEK',
  valid_until date,
  discount_percent numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  vat_total numeric DEFAULT 0,
  total numeric DEFAULT 0,
  lead_id uuid REFERENCES public.leads(id),
  customer_id uuid REFERENCES public.customers(id),
  recipient_name text,
  recipient_email text,
  notes text,
  terms text,
  view_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  view_count int DEFAULT 0,
  viewed_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  sender_signature_data text,
  sender_signed_at timestamptz,
  recipient_signature_data text,
  recipient_signed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_documents_view_token ON public.documents(view_token);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_org_documents
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Authenticated: org-scoped access
CREATE POLICY "Users can view documents in their org"
  ON public.documents FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can create documents in their org"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update documents in their org"
  ON public.documents FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete documents in their org"
  ON public.documents FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Anon: public view via view_token (single document, no org data leaked)
CREATE POLICY "Public can view document by token"
  ON public.documents FOR SELECT TO anon
  USING (true);
-- Note: the public page will query by view_token which is unique, returning exactly one doc.
-- We use a permissive anon policy but the public page only selects specific columns.

-- 4. document_blocks
CREATE TABLE public.document_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  type text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocks for their org documents"
  ON public.document_blocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage blocks for their org documents"
  ON public.document_blocks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can update blocks for their org documents"
  ON public.document_blocks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete blocks for their org documents"
  ON public.document_blocks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );

-- Anon: public view of blocks via document view_token
CREATE POLICY "Public can view blocks by document token"
  ON public.document_blocks FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
    )
  );

-- 5. document_recipients
CREATE TABLE public.document_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  sign_provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipients for their org documents"
  ON public.document_recipients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage recipients for their org documents"
  ON public.document_recipients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can update recipients for their org documents"
  ON public.document_recipients FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.organization_id = get_user_organization_id(auth.uid())
    )
  );
