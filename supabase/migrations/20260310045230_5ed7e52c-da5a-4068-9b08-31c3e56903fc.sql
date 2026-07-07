
-- 1. Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  lifetime_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center users see customers" ON public.customers
  FOR SELECT TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center staff manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id))
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id));

-- Add customer_id to sessions
ALTER TABLE public.sessions ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- 2. Pricing rules table
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week INTEGER, -- 0=Sun, 6=Sat, NULL=all
  start_time TIME,
  end_time TIME,
  price_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center users see pricing rules" ON public.pricing_rules
  FOR SELECT TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center admins manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin') OR has_role(auth.uid(), 'super_admin')));

-- 3. Audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center admins see audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Center staff insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id));

-- Add updated_at triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
