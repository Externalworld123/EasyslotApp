
-- Add subscription fields to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS amount_agreed numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renew_date timestamptz DEFAULT NULL;

-- Add access control fields to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS allow_bookings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS module_access jsonb NOT NULL DEFAULT '{"analytics": true, "api_access": true, "multi_user": true, "monthly_plans": true, "pricing_rules": true, "expenses": true, "reports": true, "approvals": true, "marshal_view": true}'::jsonb;

-- Function: Check if org subscription is valid (including grace period)
CREATE OR REPLACE FUNCTION public.is_subscription_valid(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id
      AND o.is_active = true
      AND (
        o.subscription_end IS NULL
        OR (o.subscription_end + (o.grace_period_days || ' days')::interval) >= now()
      )
  )
$$;

-- Function: Check if org's plan grants module access
CREATE OR REPLACE FUNCTION public.org_has_module_access(_org_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (p.module_access->>_module)::boolean
     FROM public.organizations o
     JOIN public.plans p ON p.id = o.plan_id
     WHERE o.id = _org_id
       AND o.is_active = true),
    false
  )
$$;

-- Function: Check if org can create bookings
CREATE OR REPLACE FUNCTION public.org_can_book(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.plans p ON p.id = o.plan_id
    WHERE o.id = _org_id
      AND o.is_active = true
      AND p.allow_bookings = true
      AND (
        o.subscription_end IS NULL
        OR (o.subscription_end + (o.grace_period_days || ' days')::interval) >= now()
      )
  )
$$;
