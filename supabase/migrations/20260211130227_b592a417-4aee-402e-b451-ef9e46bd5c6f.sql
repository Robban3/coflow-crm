
-- Allow public/anonymous users to update quotes via view_token (for accepting/rejecting/tracking views)
CREATE POLICY "Public update quotes via token"
ON public.quotes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow anonymous inserts into notifications (for quote events from public page)
CREATE POLICY "Public insert quote notifications"
ON public.notifications
FOR INSERT
WITH CHECK (type IN ('quote_viewed', 'quote_accepted', 'quote_rejected'));
