import { useEffect, useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { isSlotBlockedByPlan, type MonthlyPlan } from "@/hooks/useMonthlyPlans";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

interface Resource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  pricing_type: string | null;
  capacity: number | null;
}

interface SessionSlot {
  resource_id: string;
  start_time: string;
  end_time: string | null;
  scheduled_end_time?: string | null;
  duration_minutes: number | null;
  status: string;
}

export interface AvailabilitySlot {
  resource_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

interface Props {
  resources: Resource[];
  sessions: SessionSlot[];
  date: Date;
  centerId: string;
  availability?: AvailabilitySlot[];
  monthlyPlans?: MonthlyPlan[];
  onSlotClick: (resourceId: string, resourceName: string, centerId: string, time: string, hourlyRate: number) => void;
}

type CellStatus = "available" | "booked" | "active" | "blocked" | "past" | "closed";

function getResourceHours(resourceId: string, date: Date, availability?: AvailabilitySlot[]): { start: number; end: number } {
  if (!availability || availability.length === 0) return { start: 0, end: 24 };
  const dow = date.getDay();
  const schedule = availability.find((a) => a.resource_id === resourceId && a.day_of_week === dow);
  if (!schedule) return { start: 0, end: 24 };
  if (schedule.is_closed) return { start: -1, end: -1 };
  const startHour = parseInt(schedule.start_time.split(":")[0], 10);
  const endHour = parseInt(schedule.end_time.split(":")[0], 10);
  const endMin = parseInt(schedule.end_time.split(":")[1], 10);
  const effectiveEnd = endHour === 0 && endMin === 0 ? 24 : (endMin > 0 ? endHour + 1 : endHour);
  if (effectiveEnd <= startHour) return { start: startHour, end: 24 };
  return { start: startHour, end: effectiveEnd };
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function PublicSlotGrid({ resources, sessions, date, centerId, availability, monthlyPlans, onSlotClick }: Props) {
  const now = new Date();
  const isToday = format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const getCellStatus = (resourceId: string, hour: number): CellStatus => {
    const { start, end } = getResourceHours(resourceId, date, availability);
    if (start === -1) return "closed";
    if (hour < start || hour >= end) return "closed";

    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = addHours(slotStart, 1);

    if (slotEnd <= now && isToday) return "past";

    const match = sessions.find((s) => {
      if (s.resource_id !== resourceId) return false;
      const sStart = new Date(s.start_time);
      const sEnd = s.end_time
        ? new Date(s.end_time)
        : s.scheduled_end_time
          ? new Date(s.scheduled_end_time)
          : addHours(sStart, (s.duration_minutes || 60) / 60);
      return sStart < slotEnd && sEnd > slotStart;
    });

    if (match) {
      if (match.status === "active") return "active";
      return "booked";
    }

    if (monthlyPlans && isSlotBlockedByPlan(monthlyPlans, resourceId, date, hour)) {
      return "booked";
    }

    return "available";
  };

  const cellBase = "h-9 w-full rounded-md border-2 flex items-center justify-center text-[10px] font-semibold truncate px-1 transition-colors";

  const statsByResource = useMemo(() => {
    const map = new Map<string, { available: number; total: number; fullyBooked: boolean; closed: boolean }>();
    for (const r of resources) {
      const { start, end } = getResourceHours(r.id, date, availability);
      if (start === -1) {
        map.set(r.id, { available: 0, total: 0, fullyBooked: false, closed: true });
        continue;
      }
      let available = 0;
      let total = 0;
      for (let h = start; h < end; h++) {
        const status = getCellStatus(r.id, h);
        if (status === "closed") continue;
        total++;
        if (status === "available" || status === "active") available++;
      }
      map.set(r.id, { available, total, fullyBooked: total > 0 && available === 0, closed: false });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, sessions, monthlyPlans, availability, date]);

  const visibleResources = selectedCourt === "all"
    ? resources
    : resources.filter((r) => r.id === selectedCourt);

  // Reset carousel when filter changes
  useEffect(() => {
    if (api) {
      api.scrollTo(0, true);
    }
  }, [selectedCourt, api]);

  // Track carousel state
  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    });
    return () => {
      api.off("select", onSelect);
    };
  }, [api, visibleResources.length]);

  const renderCourtCard = (r: Resource) => {
    const { start } = getResourceHours(r.id, date, availability);
    const stats = statsByResource.get(r.id);

    if (start === -1) {
      return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden opacity-60 h-full">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold text-foreground">{r.name}</span>
            <span className="text-xs font-medium text-destructive">Closed Today</span>
          </div>
        </div>
      );
    }

    const fullyBooked = stats?.fullyBooked ?? false;
    const available = stats?.available ?? 0;

    const chipClass = fullyBooked
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : available <= 2
        ? "bg-warning/15 text-warning border-warning/40"
        : "bg-success/15 text-success border-success/30";
    const chipLabel = fullyBooked
      ? "Fully booked"
      : `${available} slot${available === 1 ? "" : "s"} free`;

    return (
      <div
        className={cn(
          "rounded-2xl border bg-card overflow-hidden transition-colors h-full",
          fullyBooked ? "border-destructive/40" : "border-border",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between w-full px-4 py-2.5 border-b",
            fullyBooked ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30",
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap", chipClass)}>
              {chipLabel}
            </span>
          </div>
          <span className="text-xs font-bold text-primary shrink-0">₹{r.hourly_rate}/hr</span>
        </div>

        <div className="grid grid-cols-4 gap-2 p-3">
          {ALL_HOURS.map((h) => {
            const status = getCellStatus(r.id, h);
            const time = `${String(h).padStart(2, "0")}:00`;
            const label = format(new Date(2000, 0, 1, h), "h a");

            if (status === "available" || status === "active") {
              return (
                <button
                  key={h}
                  onClick={() => onSlotClick(r.id, r.name, centerId, time, r.hourly_rate)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onSlotClick(r.id, r.name, centerId, time, r.hourly_rate);
                  }}
                  className={cn(cellBase, "border-success bg-success/10 text-success hover:bg-success/20 active:scale-95 cursor-pointer touch-manipulation")}
                >
                  {status === "active" ? "Live" : label}
                </button>
              );
            }

            if (status === "booked") {
              return (
                <div key={h} className={cn(cellBase, "border-destructive bg-destructive/10 text-destructive cursor-not-allowed")}>
                  Booked
                </div>
              );
            }

            return (
              <div key={h} className={cn(cellBase, "border-muted bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed")}>
                {status === "past" ? label : "—"}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const canPrev = current > 0;
  const canNext = current < count - 1;

  return (
    <div className="space-y-3">
      {resources.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Court:</span>
          <Select value={selectedCourt} onValueChange={setSelectedCourt}>
            <SelectTrigger className="h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courts ({resources.length})</SelectItem>
              {resources.map((r) => {
                const s = statsByResource.get(r.id);
                const suffix = s?.closed ? " · Closed" : s?.fullyBooked ? " · Full" : ` · ${s?.available ?? 0} free`;
                return (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}{suffix}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {visibleResources.length > 0 && (
        <div className="relative">
          <Carousel
            setApi={setApi}
            opts={{ align: "start", loop: false }}
            className="w-full"
          >
            <CarouselContent>
              {visibleResources.map((r) => (
                <CarouselItem key={r.id} className="basis-full">
                  {renderCourtCard(r)}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {visibleResources.length > 1 && (
            <>
              {/* Pager + Arrows */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => api?.scrollPrev()}
                  disabled={!canPrev}
                  className={cn(
                    "h-10 w-10 rounded-full border border-border bg-card text-foreground flex items-center justify-center touch-manipulation active:scale-95 transition",
                    !canPrev && "opacity-40 cursor-not-allowed",
                  )}
                  aria-label="Previous court"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {visibleResources[current]?.name} · {current + 1} / {count}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {visibleResources.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => api?.scrollTo(i)}
                        aria-label={`Go to court ${i + 1}`}
                        className={cn(
                          "h-1.5 rounded-full transition-all touch-manipulation",
                          i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => api?.scrollNext()}
                  disabled={!canNext}
                  className={cn(
                    "h-10 w-10 rounded-full border border-border bg-card text-foreground flex items-center justify-center touch-manipulation active:scale-95 transition",
                    !canNext && "opacity-40 cursor-not-allowed",
                  )}
                  aria-label="Next court"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {resources.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No courts available for this sport
        </div>
      )}
    </div>
  );
}
