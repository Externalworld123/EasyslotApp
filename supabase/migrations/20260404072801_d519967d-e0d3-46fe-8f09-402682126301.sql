
CREATE TABLE public.monthly_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  slot_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center users see monthly plans"
  ON public.monthly_plans FOR SELECT
  TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center staff create monthly plans"
  ON public.monthly_plans FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center admins manage monthly plans"
  ON public.monthly_plans FOR UPDATE
  TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY "Center admins delete monthly plans"
  ON public.monthly_plans FOR DELETE
  TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE TRIGGER update_monthly_plans_updated_at
  BEFORE UPDATE ON public.monthly_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_monthly_plans_resource ON public.monthly_plans(resource_id, is_active);
CREATE INDEX idx_monthly_plans_center ON public.monthly_plans(center_id, is_active);
CREATE INDEX idx_monthly_plans_dates ON public.monthly_plans(start_date, end_date);
