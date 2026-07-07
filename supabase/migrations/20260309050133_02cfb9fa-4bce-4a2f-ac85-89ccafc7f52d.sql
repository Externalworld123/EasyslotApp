-- ================================================
-- PHASE 1: MULTI-TENANT SAAS ARCHITECTURE (COMPLETE)
-- ================================================

-- 0. Create update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Add organization_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organization_admin';

-- 2. Create plans table for SaaS subscription tiers
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  max_centers INTEGER NOT NULL DEFAULT 1,
  max_resources INTEGER NOT NULL DEFAULT 5,
  max_users INTEGER NOT NULL DEFAULT 10,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins manage plans"
ON public.plans FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  plan_id UUID REFERENCES public.plans(id),
  billing_status TEXT NOT NULL DEFAULT 'active' CHECK (billing_status IN ('active', 'past_due', 'cancelled', 'trialing')),
  subscription_start TIMESTAMPTZ DEFAULT now(),
  subscription_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_owner ON public.organizations(owner_id);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 4. Add organization_id to centers table
ALTER TABLE public.centers ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
CREATE INDEX idx_centers_organization ON public.centers(organization_id);

-- 5. Create organization membership function
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.centers c ON ur.center_id = c.id
    WHERE ur.user_id = _user_id AND c.organization_id = _org_id
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id
  )
$$;

-- 6. Create get organization id function
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.organization_id FROM public.user_roles ur
     JOIN public.centers c ON ur.center_id = c.id
     WHERE ur.user_id = _user_id LIMIT 1),
    (SELECT id FROM public.organizations WHERE owner_id = _user_id LIMIT 1)
  )
$$;

-- 7. Organizations RLS
CREATE POLICY "Owners see own organization"
ON public.organizations FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Organization members see their org"
ON public.organizations FOR SELECT USING (user_belongs_to_organization(auth.uid(), id));

CREATE POLICY "Super admins see all organizations"
ON public.organizations FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners can update own organization"
ON public.organizations FOR UPDATE
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admins manage all organizations"
ON public.organizations FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 8. Update centers RLS
DROP POLICY IF EXISTS "Users see own center" ON public.centers;
DROP POLICY IF EXISTS "Super admins see all centers" ON public.centers;
DROP POLICY IF EXISTS "Super admins manage centers" ON public.centers;

CREATE POLICY "Users see centers in their organization"
ON public.centers FOR SELECT
USING (
  user_belongs_to_center(auth.uid(), id)
  OR user_belongs_to_organization(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Organization owners manage their centers"
ON public.centers FOR ALL
USING (
  (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 9. Insert default plans
INSERT INTO public.plans (name, price_monthly, max_centers, max_resources, max_users, features) VALUES
('Starter', 0, 1, 5, 5, '["Basic booking", "Email support"]'::jsonb),
('Pro', 49, 3, 20, 25, '["Advanced booking", "Analytics", "Priority support", "WhatsApp notifications"]'::jsonb),
('Enterprise', 149, 10, 100, 100, '["Unlimited features", "Custom integrations", "Dedicated support", "API access", "White-label"]'::jsonb);

-- 10. Triggers
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();