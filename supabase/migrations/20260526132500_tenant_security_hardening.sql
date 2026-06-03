-- Tenant security hardening: org-scoped admin policies + safe public access helpers.

-- 1) Scope admin role/module management to caller organization
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view roles in own org"
ON public.user_roles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_roles.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can manage roles in own org"
ON public.user_roles FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_roles.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_roles.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Admins can view all modules" ON public.user_modules;
DROP POLICY IF EXISTS "Admins can manage modules" ON public.user_modules;

CREATE POLICY "Admins can view modules in own org"
ON public.user_modules FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_modules.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can manage modules in own org"
ON public.user_modules FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_modules.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_modules.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 2) Remove enumerable invite access and expose code-scoped RPCs instead
DROP POLICY IF EXISTS "Anyone can verify invite codes" ON public.organization_invites;

CREATE OR REPLACE FUNCTION public.get_public_invite_by_code(invite_code text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  uses integer,
  max_uses integer,
  is_active boolean,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.organization_id, i.uses, i.max_uses, i.is_active, i.expires_at
  FROM public.organization_invites i
  WHERE i.code = upper(invite_code)
    AND i.is_active = true
    AND (i.expires_at IS NULL OR i.expires_at > now())
    AND (i.max_uses IS NULL OR i.uses < i.max_uses)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.consume_invite_code(invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  UPDATE public.organization_invites
  SET uses = uses + 1
  WHERE code = upper(invite_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses)
  RETURNING organization_id INTO v_org_id;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_invite_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text) TO anon, authenticated;

-- 3) Replace broad report share policies with token-scoped RPC helpers
DROP POLICY IF EXISTS "Public can read enabled shares by token" ON public.report_shares;
DROP POLICY IF EXISTS "Anyone can increment view count" ON public.report_shares;
DROP POLICY IF EXISTS "Public can read reports via enabled share" ON public.reports;

DROP POLICY IF EXISTS "Users can view reports in their organization" ON public.reports;
CREATE POLICY "Users can view reports in their organization"
ON public.reports FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_public_report_by_token(share_token text)
RETURNS SETOF public.reports
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.report_shares rs
  JOIN public.reports r ON r.id = rs.report_id
  WHERE rs.token = share_token
    AND rs.enabled = true
    AND (rs.expires_at IS NULL OR rs.expires_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.increment_public_report_view(share_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.report_shares
  SET view_count = COALESCE(view_count, 0) + 1,
      last_viewed_at = now()
  WHERE token = share_token
    AND enabled = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_public_report_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_public_report_view(text) TO anon, authenticated;
