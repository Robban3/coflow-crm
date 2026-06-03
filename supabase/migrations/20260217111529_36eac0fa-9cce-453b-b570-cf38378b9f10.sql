
-- BACKFILL activity_events from existing tables

-- 1) Emails sent
INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
SELECT organization_id, sent_by, 'email.sent', created_at, 'sent_email', id
FROM public.sent_emails
WHERE organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2) Calls logged
INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
SELECT organization_id, user_id, 'call.logged', created_at, 'activity', id
FROM public.activities
WHERE type = 'call' AND organization_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Meetings booked
INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
SELECT organization_id, host_user_id, 'meeting.booked', created_at, 'meeting', id
FROM public.meetings
WHERE organization_id IS NOT NULL AND created_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4) Documents sent
INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
SELECT organization_id, created_by, 'document.sent', sent_at, 'document', id
FROM public.documents
WHERE sent_at IS NOT NULL AND organization_id IS NOT NULL AND created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5) Tasks completed
INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
SELECT organization_id, user_id, 'task.completed', completed_at, 'activity', id
FROM public.activities
WHERE type = 'task_completed' AND completed_at IS NOT NULL AND organization_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6) Notes created
INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
SELECT organization_id, user_id, 'note.created', created_at, 'activity', id
FROM public.activities
WHERE type = 'note' AND organization_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUTO-LOGGING TRIGGERS for future events
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_activity_event_from_activities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'call' THEN
      INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
      VALUES (NEW.organization_id, NEW.user_id, 'call.logged', NEW.created_at, 'activity', NEW.id);
    ELSIF NEW.type = 'note' THEN
      INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
      VALUES (NEW.organization_id, NEW.user_id, 'note.created', NEW.created_at, 'activity', NEW.id);
    ELSIF NEW.type = 'task_completed' AND NEW.completed_at IS NOT NULL THEN
      INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
      VALUES (NEW.organization_id, NEW.user_id, 'task.completed', NEW.completed_at, 'activity', NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.type = 'task_completed' AND NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
      INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
      VALUES (NEW.organization_id, NEW.user_id, 'task.completed', NEW.completed_at, 'activity', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activities_log_event
AFTER INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.log_activity_event_from_activities();

CREATE OR REPLACE FUNCTION public.log_activity_event_from_meetings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
    VALUES (NEW.organization_id, NEW.host_user_id, 'meeting.booked', COALESCE(NEW.created_at, now()), 'meeting', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meetings_log_event
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.log_activity_event_from_meetings();

CREATE OR REPLACE FUNCTION public.log_activity_event_from_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sent_at IS NOT NULL AND (OLD.sent_at IS NULL) AND NEW.organization_id IS NOT NULL AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id)
    VALUES (NEW.organization_id, NEW.created_by, 'document.sent', NEW.sent_at, 'document', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_log_event
AFTER UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_activity_event_from_documents();
