import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Resource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  is_active: boolean;
  center_id: string;
  image_url: string | null;
  capacity: number;
  pricing_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useResources() {
  const { centerId } = useAuth();

  return useQuery({
    queryKey: ["resources", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("center_id", centerId)
        .order("name");
      if (error) throw error;
      return data as Resource[];
    },
    enabled: !!centerId,
  });
}

export function useResourcesWithSessions() {
  const { centerId } = useAuth();

  return useQuery({
    queryKey: ["resources-with-sessions", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data: resources, error: rErr } = await supabase
        .from("resources")
        .select("*")
        .eq("center_id", centerId)
        .order("name");
      if (rErr) throw rErr;

      const { data: sessions, error: sErr } = await supabase
        .from("sessions")
        .select("id, customer_name, customer_phone, start_time, notes, resource_id")
        .eq("center_id", centerId)
        .eq("status", "active");
      if (sErr) throw sErr;

      const sessionMap = new Map<string, typeof sessions[number]>();
      for (const s of sessions ?? []) {
        sessionMap.set(s.resource_id, s);
      }

      return (resources ?? []).map((r) => ({
        ...(r as Resource),
        activeSession: sessionMap.get(r.id) ?? null,
      }));
    },
    enabled: !!centerId,
  });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      type: string;
      hourly_rate: number;
      center_id: string;
      capacity?: number;
      pricing_type?: string;
      image_url?: string;
    }) => {
      const { data, error } = await supabase.from("resources").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["resources-with-sessions"] });
    },
  });
}

export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      is_active?: boolean;
      hourly_rate?: number;
      type?: string;
      capacity?: number;
      pricing_type?: string;
      image_url?: string | null;
      status?: string;
    }) => {
      const { data, error } = await supabase.from("resources").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["resources-with-sessions"] });
    },
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["resources-with-sessions"] });
    },
  });
}
