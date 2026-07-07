import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "./AnimatedCounter";
import type { PlayoSlotCount } from "@/lib/playoBooking";

interface Props {
  rows: PlayoSlotCount[];
  selectedKeys: Set<string>; // hours selected in cart for current sport+date, key = `${hour}`
  onAddRange: (startHour: number, endHour: number) => void; // inclusive both ends
  onRemoveHour?: (hour: number) => void; // tap an already-selected hour to clear it
  onBookedClick?: (hour: number) => void;
}

/**
 * Three-column row (Playo style):
 *  [ booked count - red ]   [ time range - middle ]   [ available count - green ]
 *
 * Supports drag-select on the green (available) column to book a contiguous range
 * as one longer session.
 */
export function PlayoSlotMatrix({ rows, selectedKeys, onAddRange, onRemoveHour, onBookedClick }: Props) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  // Tracks whether the current pointer interaction began on an already-selected hour.
  // If the user lifts without dragging to a different hour, we treat it as a tap-to-clear.
  const tapToClearRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHourSelectable = useCallback(
    (hour: number) => {
      const r = rows.find((x) => x.hour === hour);
      if (!r) return false;
      return !r.isPast && r.availableCourts > 0;
    },
    [rows],
  );

  // An hour is interactable (pointer-down allowed) if it can be added (selectable)
  // OR if it's already in the cart (so user can tap to remove it).
  const isHourInteractable = useCallback(
    (hour: number) => {
      if (isHourSelectable(hour)) return true;
      if (selectedKeys.has(String(hour))) {
        const r = rows.find((x) => x.hour === hour);
        if (r && !r.isPast) return true;
      }
      return false;
    },
    [isHourSelectable, rows, selectedKeys],
  );

  const finishDrag = useCallback(() => {
    // Tap-to-clear: pointer started on a selected hour and never moved → remove it
    if (tapToClearRef.current != null && !movedRef.current && onRemoveHour) {
      onRemoveHour(tapToClearRef.current);
    } else if (dragStart != null && dragEnd != null) {
      const a = Math.min(dragStart, dragEnd);
      const b = Math.max(dragStart, dragEnd);
      // Ensure entire range is selectable; if not, trim to the longest contiguous run from start
      let end = a;
      for (let h = a; h <= b; h++) {
        if (!isHourSelectable(h)) break;
        end = h;
      }
      if (isHourSelectable(a)) {
        onAddRange(a, end);
      }
    }
    tapToClearRef.current = null;
    movedRef.current = false;
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, isHourSelectable, onAddRange, onRemoveHour]);

  useEffect(() => {
    if (dragStart == null) return;
    const up = () => finishDrag();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragStart, finishDrag]);

  const handlePointerDown = (hour: number) => (e: React.PointerEvent) => {
    if (!isHourInteractable(hour)) return;
    e.preventDefault();
    movedRef.current = false;
    tapToClearRef.current = selectedKeys.has(String(hour)) ? hour : null;
    setDragStart(hour);
    setDragEnd(hour);
  };

  const handlePointerEnter = (hour: number) => () => {
    if (dragStart == null) return;
    if (hour !== dragStart) movedRef.current = true;
    setDragEnd(hour);
  };

  const inDragRange = (hour: number) => {
    if (dragStart == null || dragEnd == null) return false;
    const a = Math.min(dragStart, dragEnd);
    const b = Math.max(dragStart, dragEnd);
    return hour >= a && hour <= b;
  };

  return (
    <div ref={containerRef} className="select-none px-2 py-1.5 space-y-1">
      {rows.map((r) => {
        const allBooked = r.availableCourts === 0;
        const inCart = selectedKeys.has(String(r.hour));
        const disabled = r.isPast || r.availableCourts === 0;
        const dragging = inDragRange(r.hour);
        const isLowAvail = !allBooked && r.availableCourts <= Math.max(1, Math.floor(r.totalCourts * 0.2));

        return (
          <div
            key={r.hour}
            className="grid grid-cols-[56px_1fr_56px] items-stretch gap-1.5"
          >
            {/* Left: booked counter — strong red, white text */}
            <button
              type="button"
              disabled={r.bookedCourts === 0 || !onBookedClick}
              onClick={() => onBookedClick?.(r.hour)}
              className={cn(
                "flex items-center justify-center rounded-lg text-lg font-bold tabular-nums h-9 select-none transition-all touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                r.bookedCourts === 0
                  ? "bg-muted/40 text-muted-foreground/40 cursor-default"
                  : "bg-destructive text-destructive-foreground active:scale-95 hover:bg-destructive/90 shadow-sm",
              )}
              aria-label={`${r.bookedCourts} courts booked${r.bookedCourts > 0 ? " — tap to view" : ""}`}
            >
              <AnimatedCounter value={r.bookedCourts} pulseOn="up" />
            </button>

            {/* Middle: time label — display only (use green button to add) */}
            <div
              className={cn(
                "relative flex items-center justify-center rounded-lg h-9 px-2 text-xs font-semibold leading-tight text-center select-none border border-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]",
                r.isPast
                  ? "text-muted-foreground bg-muted/40"
                  : inCart || dragging
                    ? "bg-primary/10 text-primary ring-2 ring-primary/40"
                    : "bg-card",
                isLowAvail && !r.isPast && !inCart && "ring-2 ring-warning/40 opacity-90",
              )}
              aria-label={r.timeLabel}
            >
              <span className="truncate">{r.timeLabel}</span>
              {r.isPast ? (
                <Clock className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
              ) : isLowAvail && !inCart ? (
                <Timer className="lucide lucide-triangle-alert absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-ring" />
              ) : null}
            </div>

            {/* Right: available counter — strong green, white text */}
            <button
              type="button"
              disabled={!isHourInteractable(r.hour)}
              onPointerDown={handlePointerDown(r.hour)}
              onPointerEnter={handlePointerEnter(r.hour)}
              className={cn(
                "flex items-center justify-center rounded-lg text-lg font-bold tabular-nums h-9 select-none transition-all touch-manipulation shadow-sm",
                "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !isHourInteractable(r.hour) && "cursor-not-allowed opacity-60",
                allBooked && !inCart
                  ? "bg-muted/40 text-muted-foreground"
                  : dragging || inCart
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                    : "bg-success text-success-foreground hover:bg-success/90",
              )}
              aria-label={
                inCart
                  ? `In cart — tap to remove`
                  : `${r.availableCourts} courts available — tap or drag to add`
              }
            >
              <AnimatedCounter value={r.availableCourts} pulseOn="any" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
