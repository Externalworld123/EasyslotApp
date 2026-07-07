-- Hide Stripe billing identifiers from non-owner members via column-level privileges
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.organizations FROM anon, authenticated;
GRANT SELECT (stripe_customer_id, stripe_subscription_id) ON public.organizations TO service_role;