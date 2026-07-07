import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Trash2, ChevronDown, ChevronUp, MessageCircle, Phone, User, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Resource {
  id: string;
  name: string;
}

interface Participant {
  id: string;
  name: string;
  phone: string | null;
  amount: number;
  payment_status: string;
}

interface Plan {
  id: string;
  plan_type: string;
  customer_name: string;
  customer_phone: string | null;
  group_name: string | null;
  leader_name: string | null;
  total_amount: number;
  resource_id: string;
  start_date: string;
  end_date: string;
  slot_time: string;
  duration_minutes: number;
  days_of_week: number[];
  is_active: boolean;
  notes: string | null;
}

interface PlanListCardProps {
  plan: Plan;
  resource?: Resource;
  participants: Participant[];
  onDeactivate: (id: string) => void;
  onUpdateParticipantStatus: (participantId: string, status: string) => void;
  onEdit?: () => void;
  isPending: boolean;
}

function getOverallPaymentStatus(participants: Participant[], planType: string, totalAmount: number) {
  if (planType === "group") {
    return { status: "paid" as const, paidAmount: totalAmount, pendingAmount: 0 };
  }
  if (participants.length === 0) {
    return { status: "pending" as const, paidAmount: 0, pendingAmount: totalAmount };
  }
  const paidAmount = participants
    .filter((p) => p.payment_status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const total = participants.reduce((s, p) => s + p.amount, 0);
  const pendingAmount = total - paidAmount;
  const allPaid = participants.every((p) => p.payment_status === "paid");
  const allPending = participants.every((p) => p.payment_status === "pending");
  return {
    status: allPaid ? "paid" : allPending ? "pending" : "partial",
    paidAmount,
    pendingAmount,
  };
}

export default function PlanListCard({
  plan,
  resource,
  participants,
  onDeactivate,
  onUpdateParticipantStatus,
  onEdit,
  isPending,
}: PlanListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [localParticipants, setLocalParticipants] = useState(participants); // ✅ LOCAL STATE

  const isGroup = plan.plan_type === "group";
  const displayName = isGroup ? (plan.group_name || "Group") : plan.customer_name;
  const subtitle = isGroup ? (plan.leader_name ? `Leader: ${plan.leader_name}` : "—") : plan.customer_phone;

  const { status: paymentStatus, paidAmount, pendingAmount } = getOverallPaymentStatus(
    localParticipants,
    plan.plan_type,
    plan.total_amount
  );

  // ✅ Toggle Payment Status
  const togglePaymentStatus = (id: string) => {
    const updated = localParticipants.map((p) => {
      if (p.id === id) {
        const newStatus = p.payment_status === "paid" ? "pending" : "paid";

        // API callback
        onUpdateParticipantStatus(id, newStatus);

        return { ...p, payment_status: newStatus };
      }
      return p;
    });

    setLocalParticipants(updated);
  };

  return (
    <Card
      className="shadow-sm cursor-pointer touch-manipulation active:scale-[0.99] transition-transform"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize shrink-0">
                {plan.plan_type}
              </Badge>
              <p className="font-medium text-sm truncate">{displayName}</p>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <PaymentStatusBadge status={paymentStatus} size="sm" />

            {plan.is_active && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}

            {plan.is_active && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeactivate(plan.id);
                }}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {resource?.name ?? "—"}
            </span>{" "}
            · {plan.slot_time} · {plan.duration_minutes}min
          </p>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Participants */}
            {!isGroup && localParticipants.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Participants ({localParticipants.length})</p>

                {localParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        ₹{p.amount.toLocaleString()}
                      </span>

                      {/* ✅ CLICK TO TOGGLE */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePaymentStatus(p.id);
                        }}
                        className="cursor-pointer"
                      >
                        <PaymentStatusBadge status={p.payment_status} size="sm" />
                      </div>

                      {p.payment_status !== "paid" && p.phone && (
                        <a
                          href={`https://wa.me/${p.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-500/10 text-green-600"
                        >
                          <MessageCircle className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}