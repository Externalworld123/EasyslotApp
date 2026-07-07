import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Center {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useCenter = (centerId: string | null) => {
  return useQuery({
    queryKey: ["center", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      
      const { data, error } = await supabase
        .from("centers")
        .select("*")
        .eq("id", centerId)
        .maybeSingle();

      if (error) throw error;
      return data as Center | null;
    },
    enabled: !!centerId,
  });
};

export const useCenterSettings = (centerId: string | undefined) => {
  return useQuery({
    queryKey: ["center-settings", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      
      const { data, error } = await supabase
        .from("center_settings")
        .select("*")
        .eq("center_id", centerId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });
};
