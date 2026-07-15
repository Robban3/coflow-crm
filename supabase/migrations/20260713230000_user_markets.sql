-- Per-user market access. A missing row = the market is ENABLED for that user
-- (default-on). An admin disables a market for a user by upserting enabled=false.
-- Mirrors the user_modules table + its admin-in-own-org RLS.
CREATE TABLE IF NOT EXISTS public.user_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, market)
);

ALTER TABLE public.user_markets ENABLE ROW LEVEL SECURITY;

-- A user can read their own market access (needed by the prospecting market selector).
CREATE POLICY "Users can view own markets"
ON public.user_markets FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins can read every user's markets within their own organization (settings grid).
CREATE POLICY "Admins can view markets in own org"
ON public.user_markets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_markets.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Admins can enable/disable markets for users in their own organization.
CREATE POLICY "Admins can manage markets in own org"
ON public.user_markets FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_markets.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles caller
    JOIN public.profiles target ON target.id = user_markets.user_id
    WHERE caller.id = auth.uid()
      AND caller.organization_id = target.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE TRIGGER update_user_markets_updated_at
BEFORE UPDATE ON public.user_markets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
