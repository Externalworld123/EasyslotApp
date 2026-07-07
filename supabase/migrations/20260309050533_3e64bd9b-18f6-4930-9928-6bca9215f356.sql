-- ================================================
-- PHASE 2 & 3: INVITATIONS TABLE + QR CHECK-IN
-- ================================================

-- 1. Create invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_center ON public.invitations(center_id);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins in same center can manage invitations
CREATE POLICY "Center admins manage invitations"
ON public.invitations FOR ALL
TO authenticated
USING (
  user_belongs_to_center(auth.uid(), center_id)
  AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'organization_admin'::app_role))
)
WITH CHECK (
  user_belongs_to_center(auth.uid(), center_id)
  AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'organization_admin'::app_role))
);

-- Anyone can read by token (for accepting invitations)
CREATE POLICY "Anyone can read invitation by token"
ON public.invitations FOR SELECT
TO authenticated
USING (true);

-- 2. Add QR code column to sessions
ALTER TABLE public.sessions ADD COLUMN qr_code TEXT;

-- 3. Add checked_in_at timestamp to sessions  
ALTER TABLE public.sessions ADD COLUMN checked_in_at TIMESTAMPTZ;

-- 4. Create trigger for invitations updated_at
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();