-- Enable realtime for profiles table so avatar updates are reflected immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;