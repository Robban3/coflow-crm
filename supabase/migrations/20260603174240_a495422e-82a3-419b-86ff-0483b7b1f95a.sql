
-- Revoke anon execute on internal helpers (still callable from RLS as authenticated/service_role)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, app_module) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_lead(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_lead_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_has_enabled_share(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_quote_number(uuid) FROM anon, PUBLIC;

-- Trigger functions: never call from API
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'auto_assign_lead_creator',
        'handle_new_user',
        'handle_organization_created',
        'auto_create_ticket_on_document_accept',
        'log_activity_event_from_activities',
        'log_activity_event_from_call_logs',
        'log_activity_event_from_documents',
        'log_activity_event_from_meetings',
        'set_organization_id_from_user',
        'trigger_auto_enrich_lead',
        'update_power_call_lists_updated_at',
        'update_updated_at_column'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;
