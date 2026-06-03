-- Add new enum values for separate module control
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'offers';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'documents';