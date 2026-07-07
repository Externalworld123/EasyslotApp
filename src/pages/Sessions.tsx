import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import ShareBookingButton from "@/components/ShareBookingButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BookingCalendar } from "@/components/BookingCalendar";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  completed: "secondary",
  cancelled: "destructive",
  scheduled: "default",
  no_show: "destructive",
};

export default function Sessions() {
  const { centerId } = useAuth();
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [view, setView] = useState<"table" | "calendar">("table");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-list", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("*, resources!inner(name), centers(name)")
        .eq("center_id", centerId)
        .order("status", { ascending: true })
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const filtered = useMemo(() => {
    if (!sessions) return [];
    if (!dateFilter) return sessions;
    const dayStart = startOfDay(dateFilter).toISOString();
    const dayEnd = endOfDay(dateFilter).toISOString();
    return sessions.filter((s) => s.start_time >= dayStart && s.start_time <= dayEnd);
  }, [sessions, dateFilter]);

  const formatDuration = (mins: number | null) => {
    if (mins == null) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sessions</h1>
          <p className="text-xs text-muted-foreground">Session history & active sessions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "calendar")} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="table" className="text-xs px-3 h-7">Table</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs px-3 h-7">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "table" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs", !dateFilter && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateFilter ? format(dateFilter, "MMM d") : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {dateFilter && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDateFilter(undefined)}>Clear</Button>
              )}
            </>
          )}
        </div>
      </div>

      {view === "table" && (
        <>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : !filtered.length ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {dateFilter ? "No sessions for this date." : "No sessions found."}
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-2 md:hidden">
                {filtered.map((s) => (
                  <Card key={s.id} className="shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{s.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{(s.resources as any)?.name ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"} className="text-[10px] px-1.5 py-0">{s.status}</Badge>
                          <PaymentStatusBadge status={s.payment_status} />
                          <ShareBookingButton
                            booking={{
                              customerName: s.customer_name,
                              resourceName: (s.resources as any)?.name || "Court",
                              centerName: (s as any).centers?.name,
                              startTime: s.start_time,
                              durationMinutes: s.duration_minutes,
                              amount: s.final_amount,
                            }}
                            variant="icon"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(s.start_time), "MMM d, h:mm a")}</span>
                        <span>·</span>
                        <span>{formatDuration(s.duration_minutes)}</span>
                        {s.final_amount > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-mono font-semibold text-foreground">₹{s.final_amount}</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{(s.resources as any)?.name ?? "—"}</TableCell>
                        <TableCell>{s.customer_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{format(parseISO(s.start_time), "MMM d, h:mm a")}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{s.end_time ? format(parseISO(s.end_time), "MMM d, h:mm a") : "—"}</TableCell>
                        <TableCell>{formatDuration(s.duration_minutes)}</TableCell>
                        <TableCell className="text-right font-mono">{s.final_amount > 0 ? `₹${s.final_amount}` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>{s.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={s.payment_status} />
                        </TableCell>
                        <TableCell>
                          <ShareBookingButton
                            booking={{
                              customerName: s.customer_name,
                              resourceName: (s.resources as any)?.name || "Court",
                              centerName: (s as any).centers?.name,
                              startTime: s.start_time,
                              durationMinutes: s.duration_minutes,
                              amount: s.final_amount,
                            }}
                            variant="icon"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </>
      )}

      {view === "calendar" && <BookingCalendar />}
    </div>
  );
}
