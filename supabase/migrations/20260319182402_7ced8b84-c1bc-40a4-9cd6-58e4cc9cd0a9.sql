-- Drop the overly permissive invitation SELECT policy
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitations;

-- Replace with scoped policy: users can only see invitations sent to their email, or center admins can see their center's invitations
CREATE POLICY "Users read own or center invitations"
ON public.invitations FOR SELECT TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR (user_belongs_to_center(auth.uid(), center_id)
      AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'organization_admin'::app_role)))
);