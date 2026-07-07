import { cn } from "@/lib/utils";
import type { SlotInfo } from "@/lib/bookingService";

const STATUS_STYLES: Record<SlotInfo["status"], string> = {
  available: "bg-success/15 text-success hover:bg-success/25 cursor-pointer border-success/30",
  booked: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-primary/15 text-primary border-primary/30",
  past: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/15 text-warning border-warning/30",
};

const STATUS_LABELS: Record<SlotInfo["status"], string> = {
  available: "Available",
  booked: "Booked",
  active: "In Use",
  past: "Past",
  pending: "Pending",
};

interface SlotCellProps {
  slot: SlotInfo;
  onClick?: () => void;
}

export function SlotCell({ slot, onClick }: SlotCellProps) {
  const isClickable = slot.status === "available";

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "flex items-center gap-3 w-full rounded-md border px-3 py-2 text-sm transition-colors",
        STATUS_STYLES[slot.status],
        !isClickable && "cursor-default opacity-80"
      )}
    >
      <span className="font-mono text-xs font-medium w-12 shrink-0">{slot.time}</span>
      <span className="flex-1 text-left truncate">
        {slot.session ? slot.session.customer_name : STATUS_LABELS[slot.status]}
      </span>
      {isClickable && (
        <span className="text-xs font-medium shrink-0">Book →</span>
      )}
    </button>
  );
}
