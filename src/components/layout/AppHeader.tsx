import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Building2 } from "lucide-react";
import easyslotLogo from "@/assets/easyslot-logo.jpeg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCenter } from "@/hooks/useCenter";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationBell } from "./NotificationBell";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  organization_admin: "Org Admin",
  center_admin: "Center Admin",
  staff: "Staff",
  marshal: "Marshal",
};

export function AppHeader() {
  const { user, primaryRole, signOut, centerId } = useAuth();
  const { data: center, isLoading: centerLoading } = useCenter(centerId);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="header-shimmer-group group sticky top-0 z-50 h-14 overflow-hidden border-b border-white/10 bg-gradient-to-br from-[hsl(224,76%,12%)] via-[hsl(224,76%,18%)] to-[hsl(217,91%,28%)] text-white shadow-[0_8px_30px_-12px_hsl(217_91%_53%/0.45)] transition-shadow duration-500 hover:shadow-[0_12px_40px_-12px_hsl(217_91%_53%/0.6)]">
      {/* Layered glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/10" />
      {/* Animated shimmer sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="header-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>
      {/* Top hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="relative flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="mr-1 text-white hover:bg-white/10 hover:text-white" />
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/20 shadow-md">
            <img src={easyslotLogo} alt="EasySlot" className="h-8 w-8 object-cover" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">EasySlot</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Center Name */}
          {centerLoading ? (
            <Skeleton className="hidden md:block h-5 w-32 bg-white/10" />
          ) : center ? (
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/15 backdrop-blur-sm">
              <Building2 className="h-4 w-4 text-white/80" />
              <span className="font-medium text-white truncate max-w-[150px] lg:max-w-[200px]">
                {center.name}
              </span>
            </div>
          ) : null}

          <NotificationBell />

          {primaryRole && (
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20"
            >
              {ROLE_LABELS[primaryRole] ?? primaryRole}
            </Badge>
          )}
          <span className="hidden text-sm text-white/80 lg:block truncate max-w-[180px]">
            {user?.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
