-- Restrict schedule visibility: reps see only their own rows, admins see the
-- whole org. Dropping the broad org-wide SELECT policy is enough — the existing
-- "Users manage own schedule" (FOR ALL) still lets a user read their own rows,
-- and "Admins manage org schedules" (FOR ALL) still lets admins read every row
-- in their org. RLS policies are OR-ed, so no replacement SELECT policy needed.
DROP POLICY IF EXISTS "Org members view schedules" ON public.work_schedules;
