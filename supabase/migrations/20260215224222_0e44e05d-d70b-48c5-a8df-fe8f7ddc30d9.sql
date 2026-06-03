
-- Report view sessions table
CREATE TABLE public.report_view_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_token text NOT NULL,
  report_id uuid NULL,
  lead_id uuid NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  session_key text NOT NULL,
  user_agent_hash text NULL,
  referrer text NULL,
  country_code text NULL,
  total_active_ms int NOT NULL DEFAULT 0,
  CONSTRAINT uq_session_key UNIQUE (session_key)
);

CREATE INDEX idx_sessions_token_started ON public.report_view_sessions (report_token, started_at DESC);

ALTER TABLE public.report_view_sessions ENABLE ROW LEVEL SECURITY;

-- Only org members can read sessions for their reports
CREATE POLICY "Org members can read report sessions"
  ON public.report_view_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM report_shares rs
      JOIN reports r ON r.id = rs.report_id
      WHERE rs.token = report_view_sessions.report_token
        AND r.organization_id = get_user_organization_id(auth.uid())
    )
  );

-- Service role inserts only (no public insert policy)

-- Report view events table
CREATE TABLE public.report_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_token text NOT NULL,
  session_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  event_name text NULL,
  value_int int NULL,
  meta jsonb NULL
);

CREATE INDEX idx_events_token_time ON public.report_view_events (report_token, created_at DESC);
CREATE INDEX idx_events_session ON public.report_view_events (session_key, created_at);

ALTER TABLE public.report_view_events ENABLE ROW LEVEL SECURITY;

-- Only org members can read events for their reports
CREATE POLICY "Org members can read report events"
  ON public.report_view_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM report_shares rs
      JOIN reports r ON r.id = rs.report_id
      WHERE rs.token = report_view_events.report_token
        AND r.organization_id = get_user_organization_id(auth.uid())
    )
  );
