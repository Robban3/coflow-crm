-- Allow public users to insert meetings (for booking)
CREATE POLICY "Anyone can book meetings with token"
ON public.meetings
FOR INSERT
WITH CHECK (booking_token IS NOT NULL);

-- Allow public to view their own booked meetings via token
CREATE POLICY "Anyone can view their booked meeting"
ON public.meetings
FOR SELECT
USING (booking_token IS NOT NULL);

-- Allow public users to read user availability for booking
CREATE POLICY "Anyone can view user availability for booking"
ON public.user_availability
FOR SELECT
USING (true);