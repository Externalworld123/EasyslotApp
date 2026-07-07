
CREATE TABLE public.center_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  default_currency text NOT NULL DEFAULT 'INR',
  default_session_duration integer NOT NULL DEFAULT 60,
  tax_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(center_id)
);

ALTER TABLE public.center_settings ENABLE ROW LEVEL SECURITY;

-- Center users can read their own center settings
CREATE POLICY "Center users see settings"
  ON public.center_settings
  FOR SELECT
  TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

-- Center admins can insert settings
CREATE POLICY "Admins insert settings"
  ON public.center_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_belongs_to_center(auth.uid(), center_id)
    AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

-- Center admins can update settings
CREATE POLICY "Admins update settings"
  ON public.center_settings
  FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_center(auth.uid(), center_id)
    AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    user_belongs_to_center(auth.uid(), center_id)
    AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );
