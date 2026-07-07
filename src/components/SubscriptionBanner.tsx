import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle } from "lucide-react";

export const SubscriptionBanner = () => {
  const { data: subscription } = useSubscription();

  if (!subscription) return null;

  if (subscription.isInGracePeriod) {
    return (
      <div className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Your subscription has expired. You have{" "}
          <strong>{subscription.daysRemaining ?? 0} days</strong> of grace period remaining.
          Please renew to avoid losing access.
        </span>
      </div>
    );
  }

  if (subscription.daysRemaining !== null && subscription.daysRemaining <= 7 && subscription.daysRemaining > 0) {
    return (
      <div className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Your subscription expires in <strong>{subscription.daysRemaining} days</strong>.
        </span>
      </div>
    );
  }

  return null;
};
