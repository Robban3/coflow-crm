-- Add dedicated sender display name field to profiles
ALTER TABLE public.profiles 
ADD COLUMN sender_display_name text;