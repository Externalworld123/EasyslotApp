import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import easyslotLogo from "@/assets/easyslot-logo.jpeg";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  center_admin: "Center Admin",
  staff: "Staff",
  marshal: "Marshal",
};

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, primaryRole, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary">
              <img src={easyslotLogo} alt="EasySlot" className="h-8 w-8 object-cover" />
            </div>
            <span className="text-lg font-bold text-foreground">EasySlot</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>

            {primaryRole && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {ROLE_LABELS[primaryRole] ?? primaryRole}
              </Badge>
            )}

            <div className="hidden text-sm text-muted-foreground sm:block">
              {user?.email}
            </div>

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
};
