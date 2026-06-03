
-- Step 1: Add outreach_pro to app_module enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'outreach_pro'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_module')
  ) THEN
    ALTER TYPE public.app_module ADD VALUE 'outreach_pro';
  END IF;
END$$;
