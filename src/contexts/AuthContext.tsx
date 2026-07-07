import { createContext, useContext, useEffect, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppRole, UserRole, fetchUserRoles, getPrimaryRole, getUserCenterId } from "@/lib/auth";
import { useAppStore } from "@/stores/appStore";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: UserRole[];
  primaryRole: AppRole | null;
  centerId: string | null;
  rolesLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  roles: [],
  primaryRole: null,
  centerId: null,
  rolesLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Read state from the global Zustand store so all consumers stay in sync
  const session = useAppStore((s) => s.session);
  const loading = useAppStore((s) => s.authLoading);
  const roles = useAppStore((s) => s.roles);
  const primaryRole = useAppStore((s) => s.primaryRole);
  const centerId = useAppStore((s) => s.centerId);
  const rolesLoading = useAppStore((s) => s.rolesLoading);
  const setAuth = useAppStore((s) => s.setAuth);
  const setRoles = useAppStore((s) => s.setRoles);
  const clearAuth = useAppStore((s) => s.clearAuth);

  const loadRoles = async (userId: string) => {
    setRoles({ roles: [], primaryRole: null, centerId: null, rolesLoading: true });
    const userRoles = await fetchUserRoles(userId);
    setRoles({
      roles: userRoles,
      primaryRole: getPrimaryRole(userRoles),
      centerId: getUserCenterId(userRoles),
      rolesLoading: false,
    });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setAuth({ session: newSession, user: newSession?.user ?? null, authLoading: false });
        if (newSession?.user) {
          setTimeout(() => loadRoles(newSession.user.id), 0);
        } else {
          setRoles({ roles: [], primaryRole: null, centerId: null, rolesLoading: false });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setAuth({ session: currentSession, user: currentSession?.user ?? null, authLoading: false });
      if (currentSession?.user) {
        loadRoles(currentSession.user.id);
      } else {
        setRoles({ roles: [], primaryRole: null, centerId: null, rolesLoading: false });
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      roles,
      primaryRole,
      centerId,
      rolesLoading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
