-- Optional lunch/break window per scheduled day. Net worked hours =
-- (end - start) - (break_end - break_start). NULL break = no deduction.
ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS break_start time,
  ADD COLUMN IF NOT EXISTS break_end time;
