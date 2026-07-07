
-- 1. Cancellation policies table
CREATE TABLE public.cancellation_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  hours_before integer NOT NULL DEFAULT 2,
  refund_percent numeric NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center users see cancellation policies"
  ON public.cancellation_policies FOR SELECT TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Admins manage cancellation policies"
  ON public.cancellation_policies FOR ALL TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE TRIGGER update_cancellation_policies_updated_at
  BEFORE UPDATE ON public.cancellation_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Feedback table
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  customer_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center users see feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Anyone can insert feedback"
  ON public.feedback FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 3. Expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center users see expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center staff manage expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center staff update expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id))
  WITH CHECK (user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Admins delete expenses"
  ON public.expenses FOR DELETE TO authenticated
  USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add payment_type to payments
ALTER TABLE public.payments ADD COLUMN payment_type text NOT NULL DEFAULT 'full';

-- 5. Add no_show to session_status enum
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'no_show';

-- 6. Indexes
CREATE INDEX idx_expenses_center_date ON public.expenses(center_id, expense_date);
CREATE INDEX idx_feedback_center ON public.feedback(center_id);
CREATE INDEX idx_feedback_session ON public.feedback(session_id);
