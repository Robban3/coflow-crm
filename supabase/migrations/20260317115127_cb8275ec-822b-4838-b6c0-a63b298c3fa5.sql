
-- Add FK from meetings.host_user_id to profiles.id for join support
ALTER TABLE public.meetings
ADD CONSTRAINT meetings_host_user_id_profiles_fkey
FOREIGN KEY (host_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update public booking RLS: allow anon inserts (booking_token is auto-generated)
DROP POLICY IF EXISTS "Anyone can book meetings with token" ON public.meetings;
CREATE POLICY "Anyone can book meetings with token"
ON public.meetings
FOR INSERT
TO anon
WITH CHECK (booking_token IS NOT NULL);

-- Allow anon to update meetings (e.g. view tracking)
DROP POLICY IF EXISTS "Public can update meeting via token" ON public.meetings;
CREATE POLICY "Public can update meeting via token"
ON public.meetings
FOR UPDATE
TO anon
USING (booking_token IS NOT NULL)
WITH CHECK (booking_token IS NOT NULL);
