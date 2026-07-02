-- Support multiple external guests on a meeting. `guest_name`/`guest_email`
-- remain the primary (first) guest for backward-compat and single-guest display;
-- `guests` holds the full list of {name, email} objects.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS guests jsonb NOT NULL DEFAULT '[]';
