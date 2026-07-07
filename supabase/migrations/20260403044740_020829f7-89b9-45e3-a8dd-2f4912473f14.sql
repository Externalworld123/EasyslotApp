-- 1. Enable RLS on turfs and users (legacy unused tables)
ALTER TABLE public.turfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see own turfs"
ON public.turfs FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Owners manage own turfs"
ON public.turfs FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users see own record"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users update own record"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 2. Drop the SECURITY DEFINER customer_stats view (unused, exposes PII)
DROP VIEW IF EXISTS public.customer_stats;

-- 3. Fix privilege escalation: restrict center_admins to only assign staff/marshal roles
DROP POLICY IF EXISTS "Center admins manage center roles" ON public.user_roles;

CREATE POLICY "Center admins manage center roles"
ON public.user_roles FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'center_admin'::app_role)
  AND user_belongs_to_center(auth.uid(), center_id)
)
WITH CHECK (
  has_role(auth.uid(), 'center_admin'::app_role)
  AND user_belongs_to_center(auth.uid(), center_id)
  AND role IN ('staff'::app_role, 'marshal'::app_role)
);

-- 4. Fix feedback: replace overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;

CREATE POLICY "Validated feedback insert"
ON public.feedback FOR INSERT TO anon, authenticated
WITH CHECK (
  rating BETWEEN 1 AND 5
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = feedback.session_id
      AND s.center_id = feedback.center_id
      AND s.status IN ('completed', 'active')
  )
);

-- 5. Add rating range constraint
ALTER TABLE public.feedback ADD CONSTRAINT feedback_rating_range CHECK (rating BETWEEN 1 AND 5);