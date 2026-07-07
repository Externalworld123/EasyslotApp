import { useMemo } from "react";
import { format, setHours, setMinutes, addMinutes } from "date-fns";

interface TimelineBooking {
  id: string;
  start_time: string;
  scheduled_end_time?: string;
  end_time?: string;
  customer_name: string;
  status: string;
}

interface BookingTimelineProps {
  bookings: TimelineBooking[];
  selectedDate: Date;
  proposedStart?: string; // HH:mm
  proposedDuration?: number; // minutes
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/80",
  scheduled: "bg-blue-500/60",
  completed: "bg-muted",
};

export function BookingTimeline({
  bookings,
  selectedDate,
  proposedStart,
  proposedDuration = 60,
}: BookingTimelineProps) {
  const TIMELINE_START = 6; // 6 AM
  const TIMELINE_END = 24; // midnight
  const TOTAL_MINUTES = (TIMELINE_END - TIMELINE_START) * 60;

  const toPercent = (date: Date) => {
    const mins = (date.getHours() - TIMELINE_START) * 60 + date.getMinutes();
    return Math.max(0, Math.min(100, (mins / TOTAL_MINUTES) * 100));
  };

  const hourMarkers = useMemo(() => {
    const markers = [];
    for (let h = TIMELINE_START; h <= TIMELINE_END; h += 2) {
      markers.push({
        label: h === 0 || h === 24 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`,
        pct: ((h - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100,
      });
    }
    return markers;
  }, []);

  const proposed = useMemo(() => {
    if (!proposedStart) return null;
    const [h, m] = proposedStart.split(":").map(Number);
    const start = setMinutes(setHours(new Date(selectedDate), h), m);
    const end = addMinutes(start, proposedDuration);
    return { start, end, leftPct: toPercent(start), widthPct: toPercent(end) - toPercent(start) };
  }, [proposedStart, proposedDuration, selectedDate]);

  const nowPct = useMemo(() => {
    const now = new Date();
    if (format(now, "yyyy-MM-dd") !== format(selectedDate, "yyyy-MM-dd")) return null;
    return toPercent(now);
  }, [selectedDate]);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Today's Bookings</p>
      <div className="relative h-10 bg-muted/50 rounded-md border overflow-hidden">
        {/* Hour markers */}
        {hourMarkers.map((m) => (
          <div
            key={m.label}
            className="absolute top-0 h-full border-l border-border/40"
            style={{ left: `${m.pct}%` }}
          >
            <span className="absolute -top-0.5 left-0.5 text-[9px] text-muted-foreground/60">
              {m.label}
            </span>
          </div>
        ))}

        {/* Existing bookings */}
        {bookings.map((b) => {
          const start = new Date(b.start_time);
          const end = b.scheduled_end_time
            ? new Date(b.scheduled_end_time)
            : b.end_time
              ? new Date(b.end_time)
              : addMinutes(start, 60);
          const left = toPercent(start);
          const width = Math.max(1, toPercent(end) - left);
          const color = STATUS_COLORS[b.status] ?? "bg-muted";

          return (
            <div
              key={b.id}
              className={`absolute top-2 h-6 rounded-sm ${color} border border-border/30 flex items-center overflow-hidden px-0.5`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${b.customer_name} (${format(start, "h:mm a")} – ${format(end, "h:mm a")})`}
            >
              <span className="text-[8px] text-white truncate leading-none">
                {b.customer_name}
              </span>
            </div>
          );
        })}

        {/* Proposed slot */}
        {proposed && proposed.widthPct > 0 && (
          <div
            className="absolute top-2 h-6 rounded-sm bg-primary/30 border-2 border-primary border-dashed"
            style={{ left: `${proposed.leftPct}%`, width: `${proposed.widthPct}%` }}
          />
        )}

        {/* Now indicator */}
        {nowPct !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-destructive z-10"
            style={{ left: `${nowPct}%` }}
          />
        )}
      </div>
    </div>
  );
}
