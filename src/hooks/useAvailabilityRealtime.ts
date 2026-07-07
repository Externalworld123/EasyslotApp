import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseAvailabilityRealtimeOptions {
  enabled?: boolean;
  queryKeys: QueryKey[];
}

export function useAvailabilityRealtime({ enabled = true, queryKeys }: UseAvailabilityRealtimeOptions) {
  const queryClient = useQueryClient();
  const serializedQueryKeys = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!enabled) return;

    const parsedQueryKeys = JSON.parse(serializedQueryKeys) as QueryKey[];
    const channel = supabase
      .channel(`availability-schedule-sync-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability_schedule",
        },
        () => {
          parsedQueryKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, serializedQueryKeys]);
}