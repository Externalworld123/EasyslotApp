DROP POLICY IF EXISTS "Center staff manage schedules" ON public.availability_schedule;
DROP POLICY IF EXISTS "Center users see schedules" ON public.availability_schedule;

CREATE POLICY "Center staff and super admins manage schedules"
ON public.availability_schedule
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE r.id = availability_schedule.resource_id
      AND (
        public.user_belongs_to_center(auth.uid(), r.center_id)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE r.id = availability_schedule.resource_id
      AND (
        public.user_belongs_to_center(auth.uid(), r.center_id)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

CREATE POLICY "Center users and super admins see schedules"
ON public.availability_schedule
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE r.id = availability_schedule.resource_id
      AND (
        public.user_belongs_to_center(auth.uid(), r.center_id)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'availability_schedule'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_schedule;
  END IF;
END $$;