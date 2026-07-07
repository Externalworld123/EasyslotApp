import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "organization_admin" | "center_admin" | "staff" | "marshal";

export interface UserRole {
  role: AppRole;
  center_id: string | null;
}

// Permission matrix
const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 5,
  organization_admin: 4,
  center_admin: 3,
  staff: 2,
  marshal: 1,
};

export const isOrgAdmin = (role: AppRole | null): boolean => 
  role === "organization_admin" || role === "super_admin";

export const hasMinRole = (userRole: AppRole | null, minRole: AppRole): boolean => {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
};

export const canWrite = (role: AppRole | null): boolean => hasMinRole(role, "staff");
export const canManage = (role: AppRole | null): boolean => hasMinRole(role, "center_admin");
export const isSuperAdmin = (role: AppRole | null): boolean => role === "super_admin";

export const fetchUserRoles = async (userId: string): Promise<UserRole[]> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, center_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user roles:", error);
    return [];
  }

  return (data ?? []) as UserRole[];
};

export const getPrimaryRole = (roles: UserRole[]): AppRole | null => {
  if (roles.length === 0) return null;
  return roles.reduce((highest, current) => {
    return ROLE_HIERARCHY[current.role as AppRole] > ROLE_HIERARCHY[highest.role as AppRole]
      ? current
      : highest;
  }).role as AppRole;
};

export const getUserCenterId = (roles: UserRole[]): string | null => {
  const nonSuperRole = roles.find((r) => r.role !== "super_admin" && r.center_id);
  return nonSuperRole?.center_id ?? roles[0]?.center_id ?? null;
};
