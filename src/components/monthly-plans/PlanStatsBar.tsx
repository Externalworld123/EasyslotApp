import { CalendarRange, Wallet, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrency } from "@/hooks/useCurrency";

interface Participant {
  amount: number;
  payment_status: string;
}

interface Plan {
  id: string;
  plan_type: string;
  total_amount: number;
  is_active: boolean;
  plan_participants?: Participant[];
}

interface PlanStatsBarProps {
  plans: Plan[];
}

export default function PlanStatsBar({ plans }: PlanStatsBarProps) {
  const { format } = useCurrency();

  const activePlans = plans.filter((p) => p.is_active);

  let collected = 0;
  let pending = 0;

  for (const plan of activePlans) {
    if (plan.plan_type === "group") {
      // Group plans: total_amount is the agreed amount (no granular paid status yet)
      // Treat as collected only if explicitly tracked elsewhere; default to pending.
      pending += Number(plan.total_amount) || 0;
    } else {
      const parts = plan.plan_participants ?? [];
      for (const p of parts) {
        const amt = Number(p.amount) || 0;
        if (p.payment_status === "paid") collected += amt;
        else pending += amt;
      }
    }
  }

  const stats = [
    {
      label: "Total Plans",
      value: activePlans.length.toString(),
      icon: CalendarRange,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Collected",
      value: format(collected),
      icon: Wallet,
      iconClass: "text-emerald-600 dark:text-emerald-500",
      bgClass: "bg-emerald-500/10",
    },
    {
      label: "Pending",
      value: format(pending),
      icon: AlertCircle,
      iconClass: "text-amber-600 dark:text-amber-500",
      bgClass: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <Card key={s.label} className="p-2.5">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${s.bgClass}`}>
              <s.icon className={`h-4 w-4 ${s.iconClass}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">
                {s.label}
              </p>
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {s.value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
