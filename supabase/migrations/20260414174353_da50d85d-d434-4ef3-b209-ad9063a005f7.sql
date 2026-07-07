CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  sport text NOT NULL DEFAULT 'general',
  bio text,
  image_url text,
  rating numeric NOT NULL DEFAULT 0,
  total_reviews integer NOT NULL DEFAULT 0,
  experience_years integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active trainers"
  ON public.trainers FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated can view trainers"
  ON public.trainers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Center admins manage trainers"
  ON public.trainers FOR ALL TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));