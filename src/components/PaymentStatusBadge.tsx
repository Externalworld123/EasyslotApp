import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

const PAYMENT_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  paid: {
    label: "Paid",
    className: "bg-primary/10 text-primary border-primary/30",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    className: "border-amber-300/50 text-amber-600 bg-amber-50",
    icon: Clock,
  },
  partial: {
    label: "Partial",
    className: "bg-secondary/60 text-secondary-foreground border-border",
    icon: Clock,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    icon: XCircle,
  },
};

interface Props {
  status: string;
  size?: "sm" | "default";
}

export function PaymentStatusBadge({ status, size = "sm" }: Props) {
  const style = PAYMENT_STYLES[status] || PAYMENT_STYLES.pending;
  const Icon = style.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1 ${style.className} ${size === "sm" ? "text-[10px] h-5 px-1.5" : "text-xs px-2 py-0.5"}`}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {style.label}
    </Badge>
  );
}
