-- Scope customer visibility to the assignee (admins see all in their org),
-- and make leads readable org-wide so users can see who owns each lead
-- (while edits stay owner-scoped, so nobody can take someone else's lead).
--
-- Tenant isolation (organization_id) is preserved throughout: nothing here
-- ever exposes data across organizations.

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

-- A user must always see customers they create. Customers are created in some
-- flows (e.g. quotes) with created_by but no assigned_to, so default the
-- assignee to the creator when it is left empty — creating a customer makes
-- you its owner. Admins can still assign to someone else explicitly.
CREATE OR REPLACE FUNCTION public.set_customer_assignee_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_customer_assignee ON public.customers;
CREATE TRIGGER set_customer_assignee
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_assignee_default();

-- Backfill: existing customers with no assignee become owned by their creator,
-- so nobody loses access to customers they already created when the stricter
-- visibility below kicks in. (Truly orphaned rows stay admin-only.)
UPDATE public.customers
SET assigned_to = created_by
WHERE assigned_to IS NULL AND created_by IS NOT NULL;

-- Drop every existing policy on customers so no older permissive policy can
-- keep granting broad access, then recreate exactly the intended four.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', pol.policyname);
  END LOOP;
END $$;

-- SELECT: your own (assigned) customers; admins see all in the org.
CREATE POLICY "Customers: assignee or org admin can view"
ON public.customers FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- INSERT: any member can create within their own org (assignee defaulted above).
CREATE POLICY "Customers: members can insert in own org"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- UPDATE: your own (assigned) customers; admins any in the org.
CREATE POLICY "Customers: assignee or org admin can update"
ON public.customers FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- DELETE: admins only, within the org.
CREATE POLICY "Customers: org admin can delete"
ON public.customers FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================================
-- LEADS
-- ============================================================================
-- Make leads readable org-wide so everyone can see which leads exist and who
-- owns them. INSERT/UPDATE/DELETE stay owner-scoped (set in the
-- user_scoped_lead_access migration), so a user still cannot take or edit
-- someone else's lead — only see that it is taken.
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their organization" ON public.leads;
CREATE POLICY "Users can view leads in their organization"
ON public.leads FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- ============================================================================
-- REPORTS  (own only; admins see all in the org)
-- created_by is set on every insert path, and public sharing goes through the
-- get_public_report_by_token() RPC, so this only narrows authenticated access.
-- INSERT policy is left as-is (members create in their own org).
-- ============================================================================
DROP POLICY IF EXISTS "Users can view reports in their organization" ON public.reports;
CREATE POLICY "Users can view reports in their organization"
ON public.reports FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Users can update reports in their organization" ON public.reports;
CREATE POLICY "Users can update reports in their organization"
ON public.reports FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete reports in their organization" ON public.reports;
CREATE POLICY "Admins can delete reports in their organization"
ON public.reports FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- ============================================================================
-- QUOTES / OFFERS  (own only; admins see all in the org)
-- created_by is set on insert; public token viewing goes through an RPC, so
-- the "Users create own org quotes" INSERT policy and any token paths stay.
-- ============================================================================
DROP POLICY IF EXISTS "Users see own org quotes" ON public.quotes;
CREATE POLICY "Users see own org quotes"
ON public.quotes FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Users update own org quotes" ON public.quotes;
CREATE POLICY "Users update own org quotes"
ON public.quotes FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Users delete own org quotes" ON public.quotes;
CREATE POLICY "Users delete own org quotes"
ON public.quotes FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- Quote line items follow their parent quote's visibility (prevents reading
-- another user's offer content via the child table). INSERT is left as-is.
DROP POLICY IF EXISTS "Users see own org quote items" ON public.quote_items;
CREATE POLICY "Users see own org quote items"
ON public.quote_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.organization_id = public.get_user_organization_id(auth.uid())
      AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Users update quote items" ON public.quote_items;
CREATE POLICY "Users update quote items"
ON public.quote_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.organization_id = public.get_user_organization_id(auth.uid())
      AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Users delete quote items" ON public.quote_items;
CREATE POLICY "Users delete quote items"
ON public.quote_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.organization_id = public.get_user_organization_id(auth.uid())
      AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);
