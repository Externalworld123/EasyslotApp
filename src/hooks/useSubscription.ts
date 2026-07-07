import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ModuleKey =
  | "analytics"
  | "api_access"
  | "multi_user"
  | "monthly_plans"
  | "pricing_rules"
  | "expenses"
  | "reports"
  | "approvals"
  | "marshal_view";

export interface SubscriptionStatus {
  isValid: boolean;
  isInGracePeriod: boolean;
  daysRemaining: number | null;
  allowBookings: boolean;
  moduleAccess: Record<ModuleKey, boolean>;
  planName: string | null;
  amountAgreed: number | null;
  renewDate: string | null;
  subscriptionEnd: string | null;
}

const DEFAULT_MODULE_ACCESS: Record<ModuleKey, boolean> = {
  analytics: true,
  api_access: true,
  multi_user: true,
  monthly_plans: true,
  pricing_rules: true,
  expenses: true,
  reports: true,
  approvals: true,
  marshal_view: true,
};

export const useSubscription = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionStatus> => {
      if (!user) {
        return {
          isValid: false,
          isInGracePeriod: false,
          daysRemaining: null,
          allowBookings: false,
          moduleAccess: { ...DEFAULT_MODULE_ACCESS },
          planName: null,
          amountAgreed: null,
          renewDate: null,
          subscriptionEnd: null,
        };
      }

      // Get org via user's center or ownership
      const { data: org } = await supabase
        .from("organizations")
        .select("*, plans(*)")
        .or(`owner_id.eq.${user.id}`)
        .maybeSingle();

      if (!org) {
        // No org = free/default access (allow everything)
        return {
          isValid: true,
          isInGracePeriod: false,
          daysRemaining: null,
          allowBookings: true,
          moduleAccess: { ...DEFAULT_MODULE_ACCESS },
          planName: "Free",
          amountAgreed: null,
          renewDate: null,
          subscriptionEnd: null,
        };
      }

      const now = new Date();
      const subEnd = org.subscription_end ? new Date(org.subscription_end) : null;
      const graceDays = (org as any).grace_period_days ?? 7;
      const graceEnd = subEnd
        ? new Date(subEnd.getTime() + graceDays * 86400000)
        : null;

      const isExpired = subEnd ? now > subEnd : false;
      const isInGrace = isExpired && graceEnd ? now <= graceEnd : false;
      const isValid = !subEnd || now <= subEnd || isInGrace;

      const daysRemaining = subEnd
        ? Math.max(0, Math.ceil((subEnd.getTime() - now.getTime()) / 86400000))
        : null;

      const plan = org.plans as any;
      const allowBookings = plan?.allow_bookings ?? true;
      const moduleAccess = plan?.module_access
        ? { ...DEFAULT_MODULE_ACCESS, ...plan.module_access }
        : { ...DEFAULT_MODULE_ACCESS };

      return {
        isValid: isValid && org.is_active,
        isInGracePeriod: isInGrace,
        daysRemaining,
        allowBookings: isValid && allowBookings,
        moduleAccess,
        planName: plan?.name ?? null,
        amountAgreed: (org as any).amount_agreed ?? plan?.price_monthly ?? null,
        renewDate: (org as any).renew_date ?? null,
        subscriptionEnd: org.subscription_end,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};

export const useModuleAccess = (module: ModuleKey): boolean => {
  const { data } = useSubscription();
  return data?.moduleAccess?.[module] ?? true;
};

export const useCanBook = (): boolean => {
  const { data } = useSubscription();
  return data?.allowBookings ?? true;
};
