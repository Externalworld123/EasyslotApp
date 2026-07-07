import { Badge } from "@/components/ui/badge";
import type { Participant } from "./PlanWizardStep2";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Resource {
  id: string;
  name: string;
  hourly_rate: number;
}

interface Step3Props {
  planType: string;
  customerName: string;
  customerPhone: string;
  groupName: string;
  leaderName: string;
  resourceId: string;
  resources: Resource[];
  startDate: string;
  endDate: string;
  slotTime: string;
  duration: number;
  daysOfWeek: number[];
  notes: string;
  totalAmount: number;
  participants: Participant[];
}

export default function PlanWizardStep3(props: Step3Props) {
  const resource = props.resources.find((r) => r.id === props.resourceId);
  const paidCount = props.participants.filter((p) => p.payment_status === "paid").length;
  const pendingCount = props.participants.filter((p) => p.payment_status !== "paid").length;
  const paidAmount = props.participants.filter((p) => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = props.participants.filter((p) => p.payment_status !== "paid").reduce((s, p) => s + p.amount, 0);
  const membersTotal = props.participants.reduce((s, p) => s + p.amount, 0);
  const finalTotal = props.planType === "group" ? props.totalAmount : membersTotal;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Review & Confirm</h3>

      <div className="rounded-lg border divide-y">
        <div className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Plan Type</p>
          <p className="text-sm font-medium capitalize">{props.planType}</p>
        </div>

        {props.planType === "group" ? (
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Group</p>
            <p className="text-sm font-medium">{props.groupName}</p>
            <p className="text-xs text-muted-foreground">Leader Phone: {props.leaderName}</p>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="text-sm font-medium">{props.customerName}</p>
            <p className="text-xs text-muted-foreground">{props.customerPhone}</p>
          </div>
        )}

        <div className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Court</p>
          <p className="text-sm font-medium">{resource?.name ?? "—"}</p>
        </div>

        <div className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Schedule</p>
          <p className="text-sm">{props.startDate} → {props.endDate}</p>
          <p className="text-xs">{props.slotTime} · {props.duration}min</p>
          <div className="flex gap-1 flex-wrap mt-1">
            {props.daysOfWeek.map((d) => (
              <Badge key={d} variant="outline" className="text-[9px] px-1 py-0">{DAY_LABELS[d]}</Badge>
            ))}
          </div>
        </div>

        {props.notes && (
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-sm">{props.notes}</p>
          </div>
        )}
      </div>

      {/* Payment Summary */}
      <div className="rounded-lg border bg-primary/5 p-4 space-y-2">
        <h4 className="text-sm font-semibold">Payment Summary</h4>
        <div className="flex justify-between text-sm">
          <span>Total Amount</span>
          <span className="font-bold">₹{finalTotal.toLocaleString()}</span>
        </div>
        {props.planType === "members" && props.participants.length > 0 && (
          <>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Paid ({paidCount} players)</span>
              <span className="text-green-600">₹{paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pending ({pendingCount} players)</span>
              <span className="text-amber-600">₹{pendingAmount.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      {props.planType === "members" && props.participants.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Participants</p>
          <div className="rounded-lg border divide-y max-h-[30vh] overflow-y-auto">
            {props.participants.map((p, i) => (
              <div key={p.id} className="px-3 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{p.name || `Player ${i + 1}`}</p>
                  {p.phone && <p className="text-[10px] text-muted-foreground">{p.phone}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium">₹{p.amount}</span>
                  <Badge
                    variant={p.payment_status === "paid" ? "default" : "secondary"}
                    className="text-[9px] px-1.5 py-0"
                  >
                    {p.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
