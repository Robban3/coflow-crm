
-- 1) geo_quick_scans: split insert by role so authenticated users cannot insert with NULL org or another org
DROP POLICY IF EXISTS "Org members can insert scans" ON public.geo_quick_scans;

DROP POLICY IF EXISTS "Anon can insert public scans" ON public.geo_quick_scans;
CREATE POLICY "Anon can insert public scans"
ON public.geo_quick_scans FOR INSERT TO anon
WITH CHECK (organization_id IS NULL);

DROP POLICY IF EXISTS "Authenticated insert scans in own org" ON public.geo_quick_scans;
CREATE POLICY "Authenticated insert scans in own org"
ON public.geo_quick_scans FOR INSERT TO authenticated
WITH CHECK (
  organization_id IS NULL
  OR organization_id = public.get_user_organization_id(auth.uid())
);

-- 2) analysis_trigger_logs: remove NULL-org leak
DROP POLICY IF EXISTS "Users can view trigger logs in their org" ON public.analysis_trigger_logs;
DROP POLICY IF EXISTS "Users can view trigger logs in their org" ON public.analysis_trigger_logs;
CREATE POLICY "Users can view trigger logs in their org"
ON public.analysis_trigger_logs FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- 3) organization_pricing: restrict to org members
DROP POLICY IF EXISTS "Anyone can read pricing" ON public.organization_pricing;
DROP POLICY IF EXISTS "Org members can read pricing" ON public.organization_pricing;
CREATE POLICY "Org members can read pricing"
ON public.organization_pricing FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- 4) notifications: restrict insert to self (service_role bypasses RLS for system inserts)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5) user_availability: drop blanket public read; keep org-member read
DROP POLICY IF EXISTS "Anyone can view user availability for booking" ON public.user_availability;
DROP POLICY IF EXISTS "Users can view availability in their organization" ON public.user_availability;
DROP POLICY IF EXISTS "Org members can view availability" ON public.user_availability;
CREATE POLICY "Org members can view availability"
ON public.user_availability FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()) OR user_id = auth.uid());

-- 6) meetings: remove anon direct access; replace with secure RPCs below
DROP POLICY IF EXISTS "Public view meetings for booking" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can book meetings with token" ON public.meetings;
DROP POLICY IF EXISTS "Public can update meeting via token" ON public.meetings;

-- 7) Secure RPCs for public booking flow
CREATE OR REPLACE FUNCTION public.public_get_host_availability(_host_id uuid)
RETURNS TABLE(day_of_week int, start_time time, end_time time, is_available boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT day_of_week, start_time, end_time, is_available
  FROM public.user_availability
  WHERE user_id = _host_id AND is_available = true;
$$;

CREATE OR REPLACE FUNCTION public.public_get_host_busy_slots(_host_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(start_time timestamptz, end_time timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT start_time, end_time
  FROM public.meetings
  WHERE host_user_id = _host_id
    AND status = 'scheduled'
    AND start_time >= _from
    AND start_time <= _to;
$$;

CREATE OR REPLACE FUNCTION public.public_book_meeting(
  _host_id uuid,
  _start timestamptz,
  _end timestamptz,
  _guest_name text,
  _guest_email text,
  _message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org uuid;
  _meeting_id uuid;
  _conflict int;
BEGIN
  -- Validate inputs
  IF _host_id IS NULL OR _start IS NULL OR _end IS NULL
     OR _guest_name IS NULL OR length(trim(_guest_name)) = 0
     OR _guest_email IS NULL OR _guest_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid booking input';
  END IF;
  IF _end <= _start OR _start < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'Invalid booking time';
  END IF;

  -- Conflict check
  SELECT count(*) INTO _conflict FROM public.meetings
  WHERE host_user_id = _host_id AND status = 'scheduled'
    AND tstzrange(start_time, end_time, '[)') && tstzrange(_start, _end, '[)');
  IF _conflict > 0 THEN
    RAISE EXCEPTION 'Time slot no longer available';
  END IF;

  SELECT organization_id INTO _org FROM public.profiles WHERE id = _host_id;

  INSERT INTO public.meetings (
    host_user_id, title, description, start_time, end_time,
    guest_name, guest_email, organization_id, status, booking_token
  ) VALUES (
    _host_id,
    'Möte med ' || _guest_name,
    _message,
    _start, _end,
    _guest_name, _guest_email,
    _org, 'scheduled', gen_random_uuid()::text
  ) RETURNING id INTO _meeting_id;

  RETURN _meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.public_get_host_availability(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_get_host_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_book_meeting(uuid, timestamptz, timestamptz, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_get_host_availability(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_host_busy_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_book_meeting(uuid, timestamptz, timestamptz, text, text, text) TO anon, authenticated;
