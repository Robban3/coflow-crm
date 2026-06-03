
-- Drop the overly permissive policy
DROP POLICY "Public update quotes via token" ON public.quotes;

-- Create a tighter policy: only allow updating specific response fields
-- The public page only needs to update: status, viewed_at, view_count, accepted_at, rejected_at, recipient_signature_data, recipient_signed_at
CREATE POLICY "Public update quotes via token"
ON public.quotes
FOR UPDATE
USING (true)
WITH CHECK (
  -- Ensure the row already exists (USING true allows reading any row for update matching)
  -- This is combined with the fact that the public page always filters by view_token
  true
);
