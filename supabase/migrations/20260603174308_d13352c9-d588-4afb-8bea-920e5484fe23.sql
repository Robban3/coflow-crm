
-- Restrict realtime channel subscriptions to authenticated users.
-- Underlying data is still protected by RLS on source tables (we use postgres_changes).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can write realtime" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (true);
