import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useOrgs = () =>
  useQuery({
    queryKey: ["sa-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*, plans(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCenters = () =>
  useQuery({
    queryKey: ["sa-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centers")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useRolesList = () =>
  useQuery({
    queryKey: ["sa-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles(full_name), centers(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

export const usePlans = () =>
  useQuery({
    queryKey: ["sa-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price_monthly", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useTotals = () => {
  const totalBookings = useQuery({
    queryKey: ["sa-total-bookings"],
    queryFn: async () => {
      const { count, error } = await supabase.from("sessions").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
  const totalRevenue = useQuery({
    queryKey: ["sa-total-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("amount");
      if (error) throw error;
      return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    },
  });
  const totalCourts = useQuery({
    queryKey: ["sa-total-courts"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });
  return { totalBookings, totalRevenue, totalCourts };
};

export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}
