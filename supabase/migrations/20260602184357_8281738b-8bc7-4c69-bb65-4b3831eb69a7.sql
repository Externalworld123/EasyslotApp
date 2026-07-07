-- Drop the overly permissive INSERT policy that allows anonymous users to create payment records
DROP POLICY IF EXISTS "Anyone can create public payment" ON public.public_payments;

-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Center staff view public payments" ON public.public_payments;

-- Restrict INSERT to authenticated users who belong to the center
CREATE POLICY "Center members create public payments"
ON public.public_payments
FOR INSERT
TO authenticated
WITH CHECK (user_belongs_to_center(auth.uid(), center_id));

-- Harden SELECT to require center membership AND an authorized role
CREATE POLICY "Authorized center roles view public payments"
ON public.public_payments
FOR SELECT
TO authenticated
USING (
  user_belongs_to_center(auth.uid(), center_id)
  AND (
    has_role(auth.uid(), 'center_admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'organization_admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  )
);