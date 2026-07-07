import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useResources } from "@/hooks/useResources";
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, addHours, differenceInMinutes, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const SLOT_HEIGHT = 60;

interface CalendarSession {
  id: string;
  customer_name: string;
  start_time: string;
  end_time: string | null;
  status: string;
  resource_id: string;
  duration_minutes: number | null;
}

export function BookingCalendar() {
  const { centerId } = useAuth();
  const [date, setDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const { data: resources } = useResources();

  const dayStart = viewMode === "day"
    ? startOfDay(date).toISOString()
    : startOfWeek(date, { weekStartsOn: 1 }).toISOString();
  const dayEnd = viewMode === "day"
    ? endOfDay(date).toISOString()
    : endOfWeek(date, { weekStartsOn: 1 }).toISOString();

  const { data: sessions } = useQuery({
    queryKey: ["calendar-sessions", centerId, dayStart, dayEnd],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, start_time, end_time, status, resource_id, duration_minutes")
        .eq("center_id", centerId)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .in("status", ["active", "completed", "scheduled"])
        .order("start_time");
      if (error) throw error;
      return data as CalendarSession[];
    },
    enabled: !!centerId,
  });

  const activeResources = useMemo(() => resources?.filter(r => r.is_active) ?? [], [resources]);

  const sessionsByResource = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    sessions?.forEach(s => {
      const list = map.get(s.resource_id) ?? [];
      list.push(s);
      map.set(s.resource_id, list);
    });
    return map;
  }, [sessions]);

  const getBlockStyle = (session: CalendarSession) => {
    const start = parseISO(session.start_time);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const offsetFromGrid = startHour - 6;

    let durationHours: number;
    if (session.end_time) {
      durationHours = differenceInMinutes(parseISO(session.end_time), start) / 60;
    } else if (session.status === "active") {
      durationHours = differenceInMinutes(new Date(), start) / 60;
    } else {
      durationHours = (session.duration_minutes ?? 60) / 60;
    }

    return {
      top: `${offsetFromGrid * SLOT_HEIGHT}px`,
      height: `${Math.max(durationHours * SLOT_HEIGHT, 20)}px`,
    };
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-destructive/80 border-destructive text-destructive-foreground";
      case "completed": return "bg-muted border-border text-muted-foreground";
      case "scheduled": return "bg-warning/80 border-warning text-warning-foreground";
      default: return "bg-muted border-border text-muted-foreground";
    }
  };

  const navigateDate = (dir: number) => {
    setDate(d => viewMode === "day" ? addDays(d, dir) : addDays(d, dir * 7));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{format(date, "EEEE, MMM d, yyyy")}</span>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Today</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive" /> Booked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning" /> Pending</span>
      </div>

      <Card className="shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <div className="min-w-[600px]">
              <div className="flex border-b bg-muted/50 sticky top-0 z-10">
                <div className="w-16 shrink-0 border-r px-2 py-2 text-xs font-medium text-muted-foreground">Time</div>
                {activeResources.map(r => (
                  <div key={r.id} className="flex-1 min-w-[120px] border-r last:border-r-0 px-2 py-2 text-center">
                    <p className="text-xs font-semibold text-foreground truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.type}</p>
                  </div>
                ))}
              </div>

              <div className="flex relative">
                <div className="w-16 shrink-0 border-r">
                  {HOURS.map(h => (
                    <div key={h} className="border-b px-2 flex items-start pt-1" style={{ height: SLOT_HEIGHT }}>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {format(addHours(startOfDay(date), h), "h a")}
                      </span>
                    </div>
                  ))}
                </div>

                {activeResources.map(r => {
                  const resSessions = sessionsByResource.get(r.id) ?? [];
                  return (
                    <div key={r.id} className="flex-1 min-w-[120px] border-r last:border-r-0 relative">
                      {HOURS.map(h => (
                        <div key={h} className="border-b border-dashed" style={{ height: SLOT_HEIGHT }} />
                      ))}
                      {resSessions.map(s => {
                        const style = getBlockStyle(s);
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "absolute left-1 right-1 rounded-md border px-1.5 py-0.5 overflow-hidden text-xs cursor-default",
                              statusColor(s.status)
                            )}
                            style={style}
                            title={`${s.customer_name} — ${s.status}`}
                          >
                            <p className="font-semibold truncate leading-tight">{s.customer_name}</p>
                            <p className="truncate leading-tight opacity-80 text-[10px]">
                              {format(parseISO(s.start_time), "h:mm a")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
