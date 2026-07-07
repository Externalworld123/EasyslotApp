import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MonthlyPlan {
  id: string;
  resource_id: string;
  center_id: string;
  customer_name: string;
  customer_phone: string | null;
  start_date: string;
  end_date: string;
  slot_time: string;
  duration_minutes: number;
  days_of_week: number[];
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  plan_type: string;
  group_name: string | null;
  leader_name: string | null;
  total_amount: number;
}

/**
 * Fetch active monthly plans for the current center.
 */
export function useMonthlyPlans() {
  const { centerId } = useAuth();

  return useQuery({
    queryKey: ["monthly-plans", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("monthly_plans")
        .select("*")
        .eq("center_id", centerId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthlyPlan[];
    },
    enabled: !!centerId,
  });
}

/**
 * Check if a specific slot is blocked by a monthly plan.
 */
export function isSlotBlockedByPlan(
  plans: MonthlyPlan[],
  resourceId: string,
  slotDate: Date,
  slotHour: number
): MonthlyPlan | undefined {
  const dateStr = slotDate.toISOString().split("T")[0]; // yyyy-MM-dd
  const dow = slotDate.getDay();

  return plans.find((plan) => {
    if (plan.resource_id !== resourceId) return false;
    if (!plan.is_active) return false;
    if (dateStr < plan.start_date || dateStr > plan.end_date) return false;
    if (!plan.days_of_week.includes(dow)) return false;

    // Check time overlap
    const planHour = parseInt(plan.slot_time.split(":")[0], 10);
    const planMin = parseInt(plan.slot_time.split(":")[1] || "0", 10);
    const planStartMinutes = planHour * 60 + planMin;
    const planEndMinutes = planStartMinutes + plan.duration_minutes;

    const slotStartMinutes = slotHour * 60;
    const slotEndMinutes = slotStartMinutes + 60;

    return slotStartMinutes < planEndMinutes && slotEndMinutes > planStartMinutes;
  });
}
