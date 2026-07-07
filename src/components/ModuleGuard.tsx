import { ReactNode } from "react";
import { useSubscription, ModuleKey } from "@/hooks/useSubscription";
import { Lock, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ModuleGuardProps {
  children: ReactNode;
  module: ModuleKey;
  fallback?: "hide" | "upgrade-prompt";
}

export const ModuleGuard = ({
  children,
  module,
  fallback = "upgrade-prompt",
}: ModuleGuardProps) => {
  const { data: subscription, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) return <>{children}</>;

  const hasAccess = subscription?.moduleAccess?.[module] ?? true;

  if (hasAccess) return <>{children}</>;

  if (fallback === "hide") return null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Module Locked</h2>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        The <span className="font-medium capitalize">{module.replace(/_/g, " ")}</span> module
        is not available on your current plan
        {subscription?.planName ? ` (${subscription.planName})` : ""}.
      </p>
      {subscription?.isInGracePeriod && (
        <p className="text-xs text-destructive">
          ⚠ Your subscription has expired. You're in a grace period.
        </p>
      )}
      <Button
        onClick={() => navigate("/organization")}
        className="gap-2"
      >
        <ArrowUpCircle className="h-4 w-4" />
        Upgrade Plan
      </Button>
    </div>
  );
};
