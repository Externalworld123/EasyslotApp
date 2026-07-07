
-- Add UPI ID to centers
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS upi_id text;

-- Add payment_status to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

-- Create public_payments table for tracking UPI transactions
CREATE TABLE public.public_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  utr_id text NOT NULL,
  transaction_id text NOT NULL DEFAULT ('TXN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  payment_method text NOT NULL DEFAULT 'upi',
  status text NOT NULL DEFAULT 'pending',
  customer_name text,
  customer_phone text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_payments ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a payment (public booking flow)
CREATE POLICY "Anyone can create public payment"
ON public.public_payments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Center staff can view payments
CREATE POLICY "Center staff view public payments"
ON public.public_payments
FOR SELECT
TO authenticated
USING (user_belongs_to_center(auth.uid(), center_id));

-- Center admins can update payment status (verify/reject)
CREATE POLICY "Center admins update public payments"
ON public.public_payments
FOR UPDATE
TO authenticated
USING (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
WITH CHECK (user_belongs_to_center(auth.uid(), center_id) AND (has_role(auth.uid(), 'center_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- Trigger for updated_at
CREATE TRIGGER update_public_payments_updated_at
BEFORE UPDATE ON public.public_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
