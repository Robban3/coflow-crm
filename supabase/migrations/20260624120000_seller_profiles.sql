-- Per-seller profile (personal details collected via a mandatory first-login
-- popup for @applabbet.com sellers). Kept in its own table — NOT on profiles —
-- because profiles is read org-wide for names/avatars and these fields
-- (personnummer etc.) are sensitive and must never leak to other sellers.
--
-- Privacy: a seller sees ONLY their own row; admins see all in the org.

CREATE TABLE IF NOT EXISTS public.seller_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  applabbet_email text NOT NULL,
  external_email text NOT NULL,
  address text NOT NULL,
  postal_code text NOT NULL,
  city text NOT NULL,
  personnummer text NOT NULL,
  company_form text NOT NULL CHECK (company_form IN ('enskild_firma', 'aktiebolag', 'extern_tjanst')),
  external_service_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own row, or admin sees all in the org.
CREATE POLICY "Sellers view own profile or admin views all"
ON public.seller_profiles FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- INSERT: a seller creates only their OWN row.
CREATE POLICY "Sellers insert own profile"
ON public.seller_profiles FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND user_id = auth.uid()
);

-- UPDATE: own row, or admin any in the org.
CREATE POLICY "Sellers update own profile or admin updates all"
ON public.seller_profiles FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- DELETE: admin only.
CREATE POLICY "Admins delete seller profiles"
ON public.seller_profiles FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Auto-populate organization_id from the user's profile on insert.
DROP TRIGGER IF EXISTS set_seller_profiles_org_id ON public.seller_profiles;
CREATE TRIGGER set_seller_profiles_org_id
  BEFORE INSERT ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_seller_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_seller_profiles ON public.seller_profiles;
CREATE TRIGGER touch_seller_profiles
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_seller_profiles_updated_at();

-- Admin-only listing for the "Säljare" page: every @applabbet seller (non-admin)
-- in the org, LEFT JOINed to their profile, with a has_profile flag so admins
-- can see who has not filled it in yet. Returns nothing to non-admins.
CREATE OR REPLACE FUNCTION public.get_org_sellers()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  has_profile boolean,
  first_name text,
  last_name text,
  external_email text,
  address text,
  postal_code text,
  city text,
  personnummer text,
  company_form text,
  external_service_name text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.email::text,
    p.full_name::text,
    (sp.user_id IS NOT NULL) AS has_profile,
    sp.first_name, sp.last_name, sp.external_email, sp.address, sp.postal_code,
    sp.city, sp.personnummer, sp.company_form, sp.external_service_name, sp.updated_at
  FROM public.profiles p
  LEFT JOIN public.seller_profiles sp ON sp.user_id = p.id
  WHERE p.organization_id = public.get_user_organization_id(auth.uid())
    AND lower(p.email) LIKE '%@applabbet.com'
    AND NOT public.has_role(p.id, 'admin'::app_role)
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY has_profile ASC, p.full_name NULLS LAST, p.email;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_sellers() TO authenticated;
