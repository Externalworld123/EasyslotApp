
-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Center admins manage schedules" ON public.availability_schedule;

-- Create a new policy allowing all center staff (not just admins) to manage schedules
CREATE POLICY "Center staff manage schedules"
ON public.availability_schedule
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM resources r
    WHERE r.id = availability_schedule.resource_id
      AND user_belongs_to_center(auth.uid(), r.center_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM resources r
    WHERE r.id = availability_schedule.resource_id
      AND user_belongs_to_center(auth.uid(), r.center_id)
  )
);
