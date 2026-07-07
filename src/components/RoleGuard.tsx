import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppRole, hasMinRole } from "@/lib/auth";
import { Loader2, ShieldX } from "lucide-react";

interface RoleGuardProps {
  children: ReactNode;
  minRole?: AppRole;
  allowedRoles?: AppRole[];
  fallback?: "redirect" | "forbidden";
}

export const RoleGuard = ({
  children,
  minRole,
  allowedRoles,
  fallback = "forbidden",
}: RoleGuardProps) => {
  const { session, loading: authLoading } = useAuth();
  const { primaryRole, loading: roleLoading } = useUserRoles();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = allowedRoles
    ? allowedRoles.includes(primaryRole as AppRole)
    : minRole
      ? hasMinRole(primaryRole, minRole)
      : true;

  if (!hasAccess) {
    if (fallback === "redirect") {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <ShieldX className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          You don't have permission to access this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
