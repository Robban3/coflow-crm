-- Drop existing policies on sent_emails
DROP POLICY IF EXISTS "Users can view sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can insert sent emails" ON public.sent_emails;

-- Create new secure policies for sent_emails
-- Users can only see their own sent emails, admins can see all
CREATE POLICY "Users can view own sent emails or admins all"
ON public.sent_emails
FOR SELECT
TO authenticated
USING (
  sent_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Users can insert their own sent emails
CREATE POLICY "Users can insert own sent emails"
ON public.sent_emails
FOR INSERT
TO authenticated
WITH CHECK (sent_by = auth.uid());

-- Users can update their own sent emails (for open tracking updates via service role)
CREATE POLICY "Users can update own sent emails"
ON public.sent_emails
FOR UPDATE
TO authenticated
USING (sent_by = auth.uid());

-- Drop existing SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new secure policies for profiles
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admins can view all profiles (for team management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));