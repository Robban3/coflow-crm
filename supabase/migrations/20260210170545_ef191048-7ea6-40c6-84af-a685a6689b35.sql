
-- Product catalog for reusable products/services
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'st',
  vat_rate NUMERIC(5,2) DEFAULT 25.00,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quotes (offerter)
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  lead_id UUID REFERENCES public.leads(id),
  customer_id UUID REFERENCES public.customers(id),
  quote_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT DEFAULT 'SEK',
  valid_until DATE,
  notes TEXT,
  terms TEXT,
  subtotal NUMERIC(12,2) DEFAULT 0,
  vat_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  view_token UUID NOT NULL DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  sender_signature_data TEXT,
  sender_signed_at TIMESTAMPTZ,
  recipient_signature_data TEXT,
  recipient_signed_at TIMESTAMPTZ,
  recipient_name TEXT,
  recipient_email TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote line items
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'st',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  vat_rate NUMERIC(5,2) DEFAULT 25.00,
  line_total NUMERIC(12,2) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - discount_percent / 100)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add quotes module to the app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'quotes';

-- RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org products" ON public.products
FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users create own org products" ON public.products
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users update own org products" ON public.products
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users delete own org products" ON public.products
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- RLS for quotes
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org quotes" ON public.quotes
FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users create own org quotes" ON public.quotes
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users update own org quotes" ON public.quotes
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users delete own org quotes" ON public.quotes
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Public access for quote viewing via token (no auth needed)
CREATE POLICY "Public view quotes via token" ON public.quotes
FOR SELECT TO anon
USING (true);

-- RLS for quote_items
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org quote items" ON public.quote_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.organization_id = get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Users create quote items" ON public.quote_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.organization_id = get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Users update quote items" ON public.quote_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.organization_id = get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Users delete quote items" ON public.quote_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.organization_id = get_user_organization_id(auth.uid())
  )
);

-- Public access for quote items via token
CREATE POLICY "Public view quote items" ON public.quote_items
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id
  )
);

-- Update trigger for quotes
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for products
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for quote numbers per org
CREATE OR REPLACE FUNCTION public.generate_quote_number(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(NULLIF(REGEXP_REPLACE(quote_number, '^[^-]+-', ''), '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.quotes
  WHERE organization_id = org_id
  AND quote_number LIKE year_prefix || '-%';
  
  RETURN year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;
