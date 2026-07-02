-- Backfill calendar meetings for confirmed internal meeting_requests that never
-- got a `meetings` row (e.g. requests confirmed before the "create a meeting on
-- confirm" feature existed, or where the insert was skipped). Idempotent: the
-- NOT EXISTS guard prevents duplicates for requests that already have a meeting.
--
-- host_user_id = the requester (so they see it on their calendar) and the
-- confirming recipient is stored as the guest (guest_email) so they see it too
-- via the host-OR-guest filter in the app.
INSERT INTO public.meetings (
  organization_id, host_user_id, guest_name, guest_email,
  title, description, start_time, end_time, meeting_link, status
)
SELECT
  COALESCE(mr.organization_id, reqp.organization_id),
  mr.requested_by,
  COALESCE(resp.full_name, resp.email),
  resp.email,
  'Internt möte: ' || CASE mr.category
    WHEN 'teknisk' THEN 'Teknisk fråga'
    WHEN 'salj'    THEN 'Säljstöd / coachning'
    WHEN 'offert'  THEN 'Offert & prissättning'
    WHEN 'kund'    THEN 'Kund & leverans'
    WHEN 'ovrigt'  THEN 'Övrigt'
    ELSE mr.category
  END,
  mr.description,
  mr.scheduled_time,
  mr.scheduled_time + interval '30 minutes',
  mr.meeting_link,
  'scheduled'
FROM public.meeting_requests mr
LEFT JOIN public.profiles resp ON resp.id = mr.responded_by
LEFT JOIN public.profiles reqp ON reqp.id = mr.requested_by
WHERE mr.status = 'confirmed'
  AND mr.scheduled_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.host_user_id = mr.requested_by
      AND m.start_time = mr.scheduled_time
  );
