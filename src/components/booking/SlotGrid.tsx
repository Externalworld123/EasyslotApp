import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SlotCell } from "./SlotCell";
import { fetchResourceSlots, type SlotInfo } from "@/lib/bookingService";

interface SlotGridProps {
  resourceId: string;
  resourceName: string;
  centerId: string;
  hourlyRate: number;
  capacity?: number;
  onSlotClick?: (slot: SlotInfo, date: Date) => void;
}

export function SlotGrid({
  resourceId,
  resourceName,
  centerId,
  hourlyRate,
  capacity,
  onSlotClick,
}: SlotGridProps) {
  const dateStorageKey = `easyslot_slotgrid_date_${resourceId}`;
  const [date, setDateState] = useState<Date>(() => {
    try {
      const stored = sessionStorage.getItem(dateStorageKey);
      if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime()) && d >= startOfDay(new Date())) return d;
      }
    } catch {}
    return new Date();
  });

  const setDate = useCallback(
    (updater: Date | ((d: Date) => Date)) => {
      setDateState((prev) => {
        const next = typeof updater === "function" ? (updater as (d: Date) => Date)(prev) : updater;
        try {
          sessionStorage.setItem(dateStorageKey, next.toISOString());
        } catch {}
        return next;
      });
    },
    [dateStorageKey],
  );

  const { data: slots, isLoading } = useQuery({
    queryKey: ["resource-slots", resourceId, format(date, "yyyy-MM-dd")],
    queryFn: () => fetchResourceSlots(resourceId, centerId, date),
    refetchInterval: 30000,
  });

  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            {resourceName}
            {capacity && capacity > 1 && (
              <span className="text-xs font-normal text-muted-foreground">
                (cap: {capacity})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDate((d) => subDays(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setDate(new Date())}
            >
              {isToday ? "Today" : format(date, "MMM d")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDate((d) => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-md" />
          ))
        ) : !slots?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No slots available
          </p>
        ) : (
          slots.map((slot) => (
            <SlotCell
              key={slot.time}
              slot={slot}
              onClick={() => onSlotClick?.(slot, date)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
