-- Let every participant of an internal meeting see it — not just the host and
-- the one recipient who confirmed. Add a participant list to meetings and match
-- against it in the calendar/dashboard queries.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS participant_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill participant_ids for the internal meetings created from confirmed
-- meeting_requests: the requester + the responder + everyone who was addressed
-- (recipient_emails resolved to user ids).
UPDATE public.meetings m
SET participant_ids = ARRAY(
  SELECT DISTINCT x
  FROM unnest(
    ARRAY[mr.requested_by, mr.responded_by]
    || COALESCE(
         (SELECT array_agg(p.id) FROM public.profiles p WHERE p.email = ANY(mr.recipient_emails)),
         ARRAY[]::uuid[]
       )
  ) AS x
  WHERE x IS NOT NULL
)
FROM public.meeting_requests mr
WHERE mr.status = 'confirmed'
  AND mr.scheduled_time IS NOT NULL
  AND m.host_user_id = mr.requested_by
  AND m.start_time = mr.scheduled_time;
