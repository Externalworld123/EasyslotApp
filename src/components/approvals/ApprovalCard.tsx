// ApprovalCard — displays a single approval request
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ApprovalCardProps {
  customerName: string;
  resourceName: string;
  discountPercent: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Approved", className: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function ApprovalCard({
  customerName,
  resourceName,
  discountPercent,
  reason,
  status,
  requestedBy,
}: ApprovalCardProps) {
  const badge = STATUS_BADGE[status];

  return (
    <Card className="shadow-md">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{customerName}</p>
          <p className="text-sm text-muted-foreground">
            {resourceName} · {discountPercent}% discount
          </p>
          {reason && (
            <p className="text-xs text-muted-foreground">{reason}</p>
          )}
          <p className="text-xs text-muted-foreground">By {requestedBy}</p>
        </div>
        <Badge variant="outline" className={badge.className}>
          {badge.label}
        </Badge>
      </CardContent>
    </Card>
  );
}
