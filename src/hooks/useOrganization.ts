import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan_id: string | null;
  billing_status: string;
  subscription_start: string | null;
  subscription_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  max_centers: number;
  max_resources: number;
  max_users: number;
  features: string[];
  is_active: boolean;
}

export const useOrganization = () => {
  const { user } = useAuth();

  const { data: organization, isLoading, error } = useQuery({
    queryKey: ["organization", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .or(`owner_id.eq.${user.id}`)
        .maybeSingle();

      if (error) throw error;
      return data as Organization | null;
    },
    enabled: !!user,
  });

  return { organization, isLoading, error };
};

export const usePlans = () => {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
  });
};

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, slug }: { name: string; slug: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Get the Starter plan
      const { data: starterPlan } = await supabase
        .from("plans")
        .select("id")
        .eq("name", "Starter")
        .single();

      const { data, error } = await supabase
        .from("organizations")
        .insert({
          name,
          slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          owner_id: user.id,
          plan_id: starterPlan?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Organization created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Organization> & { id: string }) => {
      const { data, error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Organization updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useOrganizationCenters = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ["organization-centers", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("centers")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};
