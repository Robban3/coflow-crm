-- Grant the CRM 'admin' role to the Applabbet owners so they can control what
-- salespeople have access to (module management, team, etc.).
-- Note: only affects accounts that already exist; if a user hasn't registered
-- yet, re-run this after they have signed up.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) IN ('robert@applabbet.com', 'oliver@applabbet.com')
ON CONFLICT (user_id, role) DO NOTHING;
