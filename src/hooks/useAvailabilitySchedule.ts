import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";

export interface AvailabilitySlot {
  id: string;
  resource_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export { DAY_NAMES };

export function useAvailabilitySchedule(resourceId: string | undefined) {
  useAvailabilityRealtime({
    enabled: !!resourceId,
    queryKeys: [["availability-schedule", resourceId]],
  });

  return useQuery({
    queryKey: ["availability-schedule", resourceId],
    queryFn: async () => {
      if (!resourceId) return [];
      const { data, error } = await supabase
        .from("availability_schedule")
        .select("*")
        .eq("resource_id", resourceId)
        .order("day_of_week");
      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    enabled: !!resourceId,
  });
}

export function useUpsertAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      resource_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_closed: boolean;
    }) => {
      // Upsert by resource_id + day_of_week
      const { data, error } = await supabase
        .from("availability_schedule")
        .upsert(input, { onConflict: "resource_id,day_of_week" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["availability-schedule", vars.resource_id] });
      qc.invalidateQueries({ queryKey: ["dashboard-availability"] });
      qc.invalidateQueries({ queryKey: ["public-availability"] });
      qc.invalidateQueries({ queryKey: ["public-center-availability"] });
      qc.invalidateQueries({ queryKey: ["venue-availability"] });
    },
  });
}
