-- Onboarding/handoff details a seller fills in when a deal is won.
CREATE TABLE IF NOT EXISTS public.deal_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Required
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  product_service text NOT NULL,
  onboarding_date date NOT NULL,
  onboarding_time text NOT NULL,
  -- Nice to have
  seller_notes text,
  customer_goal text,
  promises text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_handoffs_org ON public.deal_handoffs (organization_id, created_at DESC);

ALTER TABLE public.deal_handoffs ENABLE ROW LEVEL SECURITY;

-- Auto-fill organization_id from the inserting user's profile.
DROP TRIGGER IF EXISTS set_deal_handoffs_org_id ON public.deal_handoffs;
CREATE TRIGGER set_deal_handoffs_org_id
  BEFORE INSERT ON public.deal_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- A seller manages their own handoffs; admins see all in the org.
CREATE POLICY "Users insert own deal handoffs"
ON public.deal_handoffs FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Users view own or admin all deal handoffs"
ON public.deal_handoffs FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users update own or admin deal handoffs"
ON public.deal_handoffs FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins delete deal handoffs"
ON public.deal_handoffs FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
