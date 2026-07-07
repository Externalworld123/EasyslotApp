CREATE OR REPLACE FUNCTION public.is_resource_publicly_visible(_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resources r
    JOIN public.centers c ON c.id = r.center_id
    WHERE r.id = _resource_id
      AND r.is_active = true
      AND c.is_active = true
  )
$$;

DROP POLICY IF EXISTS "Public can view active resource schedules" ON public.availability_schedule;

CREATE POLICY "Public can view active resource schedules"
ON public.availability_schedule
FOR SELECT
TO anon
USING (public.is_resource_publicly_visible(resource_id));