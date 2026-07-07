import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { Loader2, Zap, MessageCircle, CreditCard, Calendar as CalIcon } from "lucide-react";
import ShareBookingButton from "@/components/ShareBookingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { startSession } from "@/lib/sessionService";
import { getResourceTypeLabel, SPORT_TYPES } from "@/lib/resourceTypes";
import { cn } from "@/lib/utils";
import { usePricingRules, getEffectiveHourlyPrice } from "@/hooks/usePricingRules";

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
];

// Dynamic 24-hour time slots (every 30 min)
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  const label = `${h % 12 || 12}:${m === 0 ? "00" : "30"} ${h < 12 ? "AM" : "PM"}`;
  return { label, value: `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}` };
});

export default function StaffBooking() {
  const { centerId, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [resourceId, setResourceId] = useState("");
  const [duration, setDuration] = useState(60);
  const [timeSlot, setTimeSlot] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [lastBooking, setLastBooking] = useState<{
    name: string; resource: string; time: string; amount: number; phone: string; centerName: string;
  } | null>(null);

  // Date chips: Today / Tomorrow / Custom
  const dateChips = useMemo(() => {
    const today = startOfDay(new Date());
    return [
      { date: today, label: "Today" },
      { date: addDays(today, 1), label: "Tomorrow" },
    ];
  }, []);

  // Fetch resources
  const { data: resources } = useQuery({
    queryKey: ["staff-booking-resources", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, type, hourly_rate, is_active, status")
        .eq("center_id", centerId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });

  // Fetch center info for WhatsApp messages
  const { data: centerInfo } = useQuery({
    queryKey: ["staff-center-info", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      const { data } = await supabase.from("centers").select("name").eq("id", centerId).maybeSingle();
      return data;
    },
    enabled: !!centerId,
  });

  // Fetch sessions for the SELECTED date
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const { data: daySessions } = useQuery({
    queryKey: ["staff-booking-sessions", centerId, dateKey],
    queryFn: async () => {
      if (!centerId) return [];
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);
      const { data, error } = await supabase
        .from("sessions")
        .select("id, resource_id, start_time, end_time, status, customer_name, scheduled_end_time")
        .eq("center_id", centerId)
        .in("status", ["active", "scheduled"])
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEnd.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
    refetchInterval: 15_000,
  });

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    if (sportFilter === "all") return resources;
    return resources.filter((r) => r.type === sportFilter);
  }, [resources, sportFilter]);

  const availableSports = useMemo(() => {
    if (!resources) return [];
    const types = new Set(resources.map((r) => r.type));
    return SPORT_TYPES.filter((s) => types.has(s.value));
  }, [resources]);

  const selectedResourceBusy = useMemo(() => {
    if (!resourceId || !daySessions) return false;
    return daySessions.some((s) => s.resource_id === resourceId && s.status === "active");
  }, [resourceId, daySessions]);

  const selectedResource = useMemo(
    () => resources?.find((r) => r.id === resourceId),
    [resources, resourceId]
  );

  const { data: pricingRules } = usePricingRules();

  const estimatedAmount = useMemo(() => {
    if (!selectedResource) return 0;
    const effectiveTime = timeSlot || format(new Date(), "HH:mm");
    const effectiveHourly = getEffectiveHourlyPrice(
      pricingRules ?? [],
      selectedResource.id,
      selectedDate,
      effectiveTime,
      selectedResource.hourly_rate,
    );
    return Math.round((effectiveHourly * duration) / 60);
  }, [selectedResource, duration, timeSlot, selectedDate, pricingRules]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !resourceId || !centerId) return;
    setLoading(true);
    try {
      // Build scheduled_start from selected date + time slot
      let scheduledStart: string | undefined;
      let scheduledEnd: string | undefined;
      if (timeSlot) {
        const [h, m] = timeSlot.split(":").map(Number);
        const start = new Date(selectedDate);
        start.setHours(h, m, 0, 0);
        const end = new Date(start.getTime() + duration * 60000);
        scheduledStart = start.toISOString();
        scheduledEnd = end.toISOString();
      } else {
        // No time slot selected — use now + duration
        const now = new Date();
        const end = new Date(now.getTime() + duration * 60000);
        scheduledStart = now.toISOString();
        scheduledEnd = end.toISOString();
      }

      await startSession({
        resource_id: resourceId,
        center_id: centerId,
        customer_name: name.trim(),
        customer_phone: phone.trim() || undefined,
        notes: `Staff booking • Duration: ${duration}min${timeSlot ? ` • Slot: ${timeSlot}` : ""} • Date: ${format(selectedDate, "MMM d")}`,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      });
      
      setLastBooking({
        name: name.trim(),
        resource: selectedResource?.name || "",
        time: timeSlot || format(new Date(), "HH:mm"),
        amount: estimatedAmount,
        phone: phone.trim(),
        centerName: centerInfo?.name || "EasySlot Venue",
      });
      
      toast({ title: "Booking created!", description: `${name.trim()} → ${selectedResource?.name}` });
      setName("");
      setPhone("");
      setResourceId("");
      setTimeSlot("");
      qc.invalidateQueries({ queryKey: ["staff-booking-sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-sessions"] });
    } catch (err: any) {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [name, phone, resourceId, centerId, duration, timeSlot, selectedResource, selectedDate, estimatedAmount, centerInfo, toast, qc]);

  const isValid = name.trim().length > 0 && resourceId.length > 0;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  // Generate WhatsApp & UPI links for last booking
  const lastBookingWhatsApp = useMemo(() => {
    if (!lastBooking?.phone) return "";
    const msg = `🏟️ Booking Confirmed!\n\n📍 Venue: ${lastBooking.centerName}\n🎯 Court: ${lastBooking.resource}\n📅 Date: ${format(selectedDate, "EEE, MMM d")}\n⏰ Time: ${lastBooking.time}\n💰 Amount: ₹${lastBooking.amount}\n\nBooked via EasySlot ⚡`;
    return `https://wa.me/${lastBooking.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
  }, [lastBooking, selectedDate]);

  const lastBookingUPI = useMemo(() => {
    if (!lastBooking) return "";
    return `upi://pay?pn=${encodeURIComponent(lastBooking.centerName)}&am=${lastBooking.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Booking: ${lastBooking.resource}`)}`;
  }, [lastBooking]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Rapid Booking
        </h1>
        <p className="text-sm text-muted-foreground">Single-screen fast booking for staff</p>
      </div>

      {/* Date selector: Today / Tomorrow / Custom */}
      <div className="flex gap-2 items-center flex-wrap">
        {dateChips.map((chip) => {
          const active = format(selectedDate, "yyyy-MM-dd") === format(chip.date, "yyyy-MM-dd");
          return (
            <button
              key={chip.label}
              onClick={() => setSelectedDate(chip.date)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium border transition-colors touch-manipulation",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          );
        })}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 touch-manipulation",
              !isToday && format(selectedDate, "yyyy-MM-dd") !== format(addDays(new Date(), 1), "yyyy-MM-dd")
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-foreground border-border hover:bg-muted"
            )}>
              <CalIcon className="h-3.5 w-3.5" />
              {!isToday && format(selectedDate, "yyyy-MM-dd") !== format(addDays(new Date(), 1), "yyyy-MM-dd")
                ? format(selectedDate, "MMM d")
                : "Custom"
              }
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              disabled={(d) => d < startOfDay(new Date())}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground ml-1">
          {format(selectedDate, "EEEE, MMM d")}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Customer Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              </div>
            </div>

            {/* Sport filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sport</Label>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => { setSportFilter("all"); setResourceId(""); }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    sportFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:bg-muted"
                  )}
                >
                  All
                </button>
                {availableSports.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { setSportFilter(s.value); setResourceId(""); }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      sportFilter === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {s.label.replace(/ Court| Table| Net.*| Turf| Pool/i, "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Court selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Court *</Label>
              <div className="grid grid-cols-2 gap-2">
                {filteredResources.map((r) => {
                  const busy = daySessions?.some((s) => s.resource_id === r.id && s.status === "active");
                  return (
                    <button
                      key={r.id}
                      onClick={() => setResourceId(r.id)}
                      disabled={busy}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        resourceId === r.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : busy
                            ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{getResourceTypeLabel(r.type)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-semibold text-primary">₹{r.hourly_rate}/hr</span>
                        {busy && <Badge variant="secondary" className="text-[9px] h-4">In Use</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duration</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        duration === d.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Start Time</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={isToday ? "Now (walk-in)" : "Select time"} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimate + Submit */}
            {selectedResource && (
              <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3 border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Estimated</p>
                  <p className="text-lg font-bold text-foreground">₹{estimatedAmount}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{selectedResource.name}</p>
                  <p>{duration} min · {format(selectedDate, "MMM d")}</p>
                </div>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={loading || !isValid} className="w-full h-12 text-base font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
              Book Now
            </Button>
          </CardContent>
        </Card>

        {/* Right: Activity + Last booking actions */}
        <div className="space-y-4">
          {/* Last booking quick actions */}
          {lastBooking && (
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-success flex items-center gap-1.5">
                  ✅ Last Booking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-foreground">{lastBooking.name} → {lastBooking.resource}</p>
                <p className="text-xs text-muted-foreground">₹{lastBooking.amount} · {lastBooking.time}</p>
                <div className="flex gap-2 flex-wrap">
                  <a href={lastBookingUPI}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                    <CreditCard className="h-3.5 w-3.5" /> Send UPI Link
                  </a>
                  {lastBooking.phone && lastBookingWhatsApp && (
                    <a href={lastBookingWhatsApp} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isToday ? "Current Activity" : `Bookings · ${format(selectedDate, "MMM d")}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!daySessions?.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {isToday ? "No active sessions" : "No bookings for this date"}
                </p>
              ) : (
                <div className="space-y-2">
                  {daySessions
                    .filter((s) => s.status === "active")
                    .map((s) => {
                      const r = resources?.find((res) => res.id === s.resource_id);
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-success/5">
                          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{r?.name ?? "Unknown"}</p>
                          </div>
                          <ShareBookingButton
                            booking={{
                              customerName: s.customer_name,
                              resourceName: r?.name ?? "Court",
                              centerName: centerInfo?.name,
                              startTime: s.start_time,
                            }}
                            variant="icon"
                          />
                          <Badge variant="secondary" className="text-[10px]">Active</Badge>
                        </div>
                      );
                    })}
                  {daySessions
                    .filter((s) => s.status === "scheduled")
                    .map((s) => {
                      const r = resources?.find((res) => res.id === s.resource_id);
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{r?.name ?? "Unknown"} • {format(new Date(s.start_time), "h:mm a")}</p>
                          </div>
                          <ShareBookingButton
                            booking={{
                              customerName: s.customer_name,
                              resourceName: r?.name ?? "Court",
                              centerName: centerInfo?.name,
                              startTime: s.start_time,
                            }}
                            variant="icon"
                          />
                          <Badge variant="outline" className="text-[10px]">Scheduled</Badge>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
