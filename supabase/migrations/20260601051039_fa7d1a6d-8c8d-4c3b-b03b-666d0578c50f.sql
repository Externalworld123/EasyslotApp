
INSERT INTO public.feature_flags (flag_key, description, value, is_active)
SELECT 'convenience_fee_percent', 'Convenience fee percentage charged on public bookings (Razorpay)', '5'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE flag_key = 'convenience_fee_percent');
