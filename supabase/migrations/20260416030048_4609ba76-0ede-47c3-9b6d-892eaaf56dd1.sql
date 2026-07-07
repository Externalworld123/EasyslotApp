
-- Add new columns to monthly_plans
ALTER TABLE public.monthly_plans
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'members',
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS leader_name text,
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;

-- Create plan_participants table
CREATE TABLE public.plan_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.monthly_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: center staff can view participants
CREATE POLICY "Center users see plan participants"
  ON public.plan_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.monthly_plans mp
      WHERE mp.id = plan_participants.plan_id
        AND user_belongs_to_center(auth.uid(), mp.center_id)
    )
  );

-- INSERT: center staff can create participants
CREATE POLICY "Center staff create plan participants"
  ON public.plan_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.monthly_plans mp
      WHERE mp.id = plan_participants.plan_id
        AND user_belongs_to_center(auth.uid(), mp.center_id)
    )
  );

-- UPDATE: center staff can update participants
CREATE POLICY "Center staff update plan participants"
  ON public.plan_participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.monthly_plans mp
      WHERE mp.id = plan_participants.plan_id
        AND user_belongs_to_center(auth.uid(), mp.center_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.monthly_plans mp
      WHERE mp.id = plan_participants.plan_id
        AND user_belongs_to_center(auth.uid(), mp.center_id)
    )
  );

-- DELETE: admins only
CREATE POLICY "Center admins delete plan participants"
  ON public.plan_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.monthly_plans mp
      WHERE mp.id = plan_participants.plan_id
        AND user_belongs_to_center(auth.uid(), mp.center_id)
        AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

-- Public can view participants of active plans
CREATE POLICY "Public can view active plan participants"
  ON public.plan_participants
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.monthly_plans mp
      WHERE mp.id = plan_participants.plan_id
        AND mp.is_active = true
        AND is_resource_publicly_visible(mp.resource_id)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_plan_participants_updated_at
  BEFORE UPDATE ON public.plan_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_plan_participants_plan_id ON public.plan_participants(plan_id);
