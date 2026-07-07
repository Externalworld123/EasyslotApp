
-- Drop existing update policy
DROP POLICY IF EXISTS "Center admins manage monthly plans" ON public.monthly_plans;

-- Create new update policy that includes staff
CREATE POLICY "Center staff manage monthly plans"
ON public.monthly_plans
FOR UPDATE
TO authenticated
USING (user_belongs_to_center(auth.uid(), center_id))
WITH CHECK (user_belongs_to_center(auth.uid(), center_id));
