-- Create junction table for multiple lead members
CREATE TABLE public.lead_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by UUID,
  UNIQUE(lead_id, user_id)
);

-- Enable RLS
ALTER TABLE public.lead_members ENABLE ROW LEVEL SECURITY;

-- RLS: Users in the same organization can see lead members
CREATE POLICY "Users can view lead members in their org"
ON public.lead_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
    AND l.organization_id = public.get_user_organization_id(auth.uid())
  )
);

-- RLS: Admins or lead owner can manage members
CREATE POLICY "Admins and lead owners can manage members"
ON public.lead_members FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.lead_members lm
    WHERE lm.lead_id = lead_members.lead_id
    AND lm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_members.lead_id
    AND l.assigned_to = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_members.lead_id
    AND l.created_by = auth.uid()
  )
);

CREATE POLICY "Admins and lead owners can delete members"
ON public.lead_members FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.lead_members lm
    WHERE lm.lead_id = lead_members.lead_id
    AND lm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_members.lead_id
    AND l.assigned_to = auth.uid()
  )
);

-- Auto-set organization_id trigger
ALTER TABLE public.lead_members ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

CREATE TRIGGER set_lead_members_org_id
BEFORE INSERT ON public.lead_members
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_user();

-- Migrate existing assigned_to data to lead_members
INSERT INTO public.lead_members (lead_id, user_id, role, organization_id)
SELECT l.id, l.assigned_to, 'owner', l.organization_id
FROM public.leads l
WHERE l.assigned_to IS NOT NULL
ON CONFLICT (lead_id, user_id) DO NOTHING;
