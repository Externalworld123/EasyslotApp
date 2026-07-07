import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppRole,
  UserRole,
  fetchUserRoles,
  getPrimaryRole,
  getUserCenterId,
} from "@/lib/auth";

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<AppRole | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setPrimaryRole(null);
      setCenterId(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const userRoles = await fetchUserRoles(user.id);
      setRoles(userRoles);
      setPrimaryRole(getPrimaryRole(userRoles));
      setCenterId(getUserCenterId(userRoles));
      setLoading(false);
    };

    load();
  }, [user]);

  return { roles, primaryRole, centerId, loading };
};
