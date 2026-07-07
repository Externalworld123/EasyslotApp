
-- Enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'center_admin', 'staff', 'marshal');
CREATE TYPE public.session_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Centers
CREATE TABLE public.centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles (separate table per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, center_id)
);

-- Resources (courts, pools, etc.)
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'court',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status session_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approvals (discount approvals)
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  discount_percent NUMERIC(5,2) NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  received_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_center ON public.profiles(center_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_center ON public.user_roles(center_id);
CREATE INDEX idx_resources_center ON public.resources(center_id);
CREATE INDEX idx_sessions_center ON public.sessions(center_id);
CREATE INDEX idx_sessions_resource ON public.sessions(resource_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_approvals_center ON public.approvals(center_id);
CREATE INDEX idx_approvals_session ON public.approvals(session_id);
CREATE INDEX idx_payments_center ON public.payments(center_id);
CREATE INDEX idx_payments_session ON public.payments(session_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user center_id (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_center_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT center_id FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Check if user belongs to center
CREATE OR REPLACE FUNCTION public.user_belongs_to_center(_user_id UUID, _center_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND center_id = _center_id
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS: centers
CREATE POLICY "Super admins see all centers" ON public.centers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users see own center" ON public.centers
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), id));

CREATE POLICY "Super admins manage centers" ON public.centers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- RLS: profiles
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users in same center see profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (center_id IS NOT NULL AND public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- RLS: user_roles
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins see center roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Center admins manage center roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'center_admin')
    AND public.user_belongs_to_center(auth.uid(), center_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'center_admin')
    AND public.user_belongs_to_center(auth.uid(), center_id)
  );

-- RLS: resources (center-isolated)
CREATE POLICY "Center users see resources" ON public.resources
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Super admins see all resources" ON public.resources
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Center admins manage resources" ON public.resources
  FOR ALL TO authenticated
  USING (
    public.user_belongs_to_center(auth.uid(), center_id)
    AND (public.has_role(auth.uid(), 'center_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    public.user_belongs_to_center(auth.uid(), center_id)
    AND (public.has_role(auth.uid(), 'center_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- RLS: sessions (center-isolated)
CREATE POLICY "Center users see sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center staff create sessions" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Center staff update sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), center_id))
  WITH CHECK (public.user_belongs_to_center(auth.uid(), center_id));

-- RLS: approvals (center-isolated)
CREATE POLICY "Center users see approvals" ON public.approvals
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Staff create approvals" ON public.approvals
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Admins update approvals" ON public.approvals
  FOR UPDATE TO authenticated
  USING (
    public.user_belongs_to_center(auth.uid(), center_id)
    AND (public.has_role(auth.uid(), 'center_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    public.user_belongs_to_center(auth.uid(), center_id)
    AND (public.has_role(auth.uid(), 'center_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- RLS: payments (center-isolated)
CREATE POLICY "Center users see payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_center(auth.uid(), center_id));

CREATE POLICY "Staff create payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_center(auth.uid(), center_id));
