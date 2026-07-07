ALTER TABLE public.center_settings
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'optional',
  ADD COLUMN IF NOT EXISTS min_deposit_percent numeric NOT NULL DEFAULT 50;