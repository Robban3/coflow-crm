-- Add columns for detailed phone and vehicle data
ALTER TABLE public.lead_fleet_data 
ADD COLUMN IF NOT EXISTS phone_numbers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS vehicles JSONB DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.lead_fleet_data.phone_numbers IS 'Array of phone number objects: [{number, operator, type}]';
COMMENT ON COLUMN public.lead_fleet_data.vehicles IS 'Array of vehicle objects: [{model, regNumber, color, type, year}]';