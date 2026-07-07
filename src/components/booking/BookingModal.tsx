import { useState, useCallback, useMemo, useEffect } from "react";
import { format, addMinutes, setHours, setMinutes, startOfDay, endOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Clock, DollarSign } from "lucide-react";
import { bookSession, checkConflict } from "@/lib/bookingService";
import { checkCapacity as checkCapacityService, isSharedCapacityResource } from "@/lib/capacityService";
import { startSession } from "@/lib/sessionService";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { BookingTimeline } from "./BookingTimeline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
  { label: "4 hours", value: 240 },
  { label: "5 hours", value: 300 },
  { label: "6 hours", value: 360 },
];

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceName: string;
  centerId: string;
  hourlyRate: number;
  pricingType?: string;
  capacity?: number;
  slotTime?: string;
  slotDate?: Date;
  onBooked?: () => void;
}

export function BookingModal({
  open, onOpenChange, resourceId, resourceName, centerId,
  hourlyRate, pricingType, capacity, slotTime, slotDate, onBooked,
}: BookingModalProps) {
  const { toast } = useToast();
  const { symbol } = useCurrency();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState(slotTime ?? "");
  const [loading, setLoading] = useState(false);
  const [collectDeposit, setCollectDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);

  const MODAL_KEY = "easyslot_staff_booking_form";

  useEffect(() => {
    if (open) {
      const saved = sessionStorage.getItem(MODAL_KEY);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (s.resourceId === resourceId) {
            setCustomerName(s.customerName || "");
            setCustomerPhone(s.customerPhone || "");
            setNotes(s.notes || "");
            setDuration(s.duration || 60);
            setStartTime(s.startTime || (slotTime ?? format(new Date(), "HH:mm")));
            setCollectDeposit(s.collectDeposit || false);
            setDepositAmount(s.depositAmount || 0);
            return;
          }
        } catch {}
      }
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setDuration(60);
      setStartTime(slotTime ?? format(new Date(), "HH:mm"));
      setCollectDeposit(false);
      setDepositAmount(0);
    } else {
      sessionStorage.removeItem(MODAL_KEY);
    }
  }, [open, slotTime]);

  useEffect(() => {
    if (open) {
      sessionStorage.setItem(MODAL_KEY, JSON.stringify({
        resourceId, customerName, customerPhone, notes, duration,
        startTime, collectDeposit, depositAmount,
      }));
    }
  }, [open, resourceId, customerName, customerPhone, notes, duration, startTime, collectDeposit, depositAmount]);

  const selectedDate = slotDate ?? new Date();

  // Fetch existing bookings for this resource on the selected date
  const { data: existingBookings } = useQuery({
    queryKey: ["resource-bookings", resourceId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();
      const { data } = await supabase
        .from("sessions")
        .select("id, customer_name, start_time, scheduled_end_time, end_time, status")
        .eq("resource_id", resourceId)
        .in("status", ["active", "scheduled"])
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time");
      return data ?? [];
    },
    enabled: open && !!resourceId,
  });

  const endTimeStr = useMemo(() => {
    if (!startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    const start = setMinutes(setHours(selectedDate, h), m);
    return format(addMinutes(start, duration), "HH:mm");
  }, [startTime, duration, selectedDate]);

  const price = useMemo(() => {
    if (pricingType === "per_session") return hourlyRate;
    if (pricingType === "daily") return hourlyRate;
    return hourlyRate * (duration / 60);
  }, [hourlyRate, duration, pricingType]);

  // Default deposit to 50% when toggled
  useEffect(() => {
    if (collectDeposit && depositAmount === 0) {
      setDepositAmount(Math.round(price * 0.5));
    }
  }, [collectDeposit, price]);

  const handleBook = useCallback(async () => {
    if (!customerName.trim() || !startTime) return;
    setLoading(true);
    try {
      const [h, m] = startTime.split(":").map(Number);
      const start = setMinutes(setHours(new Date(selectedDate), h), m);
      start.setSeconds(0, 0);
      const end = addMinutes(start, duration);
      const now = new Date();
      const isImmediate = Math.abs(start.getTime() - now.getTime()) < 5 * 60 * 1000;

      let sessionResult: any;

      if (isImmediate) {
        sessionResult = await startSession({
          resource_id: resourceId,
          center_id: centerId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast({ title: "Session started", description: `${customerName.trim()} on ${resourceName}` });
      } else {
        // For shared-capacity resources (capacity > 1), use capacity check instead of conflict check
        if (isSharedCapacityResource(capacity)) {
          const capResult = await checkCapacityService(resourceId, capacity ?? 1, start.toISOString(), end.toISOString());
          if (!capResult.allowed) {
            toast({ title: "Slot full", description: `All ${capacity} slots are booked for this time.`, variant: "destructive" });
            setLoading(false);
            return;
          }
        } else {
          const hasConflict = await checkConflict(resourceId, centerId, start.toISOString(), end.toISOString());
          if (hasConflict) {
            toast({ title: "Slot conflict", description: "This time slot is already booked.", variant: "destructive" });
            setLoading(false);
            return;
          }
        }

        sessionResult = await bookSession({
          resource_id: resourceId,
          center_id: centerId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
        });
        toast({ title: "Booking confirmed", description: `${format(start, "h:mm a")} – ${format(end, "h:mm a")}` });
      }

      // Record deposit payment if enabled
      if (collectDeposit && depositAmount > 0 && sessionResult?.id && user) {
        await supabase.from("payments").insert({
          session_id: sessionResult.id,
          center_id: centerId,
          amount: depositAmount,
          method: "cash",
          payment_type: "deposit",
          received_by: user.id,
        });
      }

      onOpenChange(false);
      onBooked?.();
    } catch (err: any) {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [customerName, customerPhone, notes, startTime, duration, selectedDate, resourceId, centerId, resourceName, onOpenChange, onBooked, toast, collectDeposit, depositAmount, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Court — {resourceName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Customer Name *</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter name" />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timeline */}
          <BookingTimeline
            bookings={existingBookings ?? []}
            selectedDate={selectedDate}
            proposedStart={startTime}
            proposedDuration={duration}
          />

          {startTime && (
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {format(selectedDate, "MMM d")} · {startTime} – {endTimeStr}
              </span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {symbol}{price.toFixed(2)}
              </span>
            </div>
          )}

          {/* Deposit toggle */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="deposit-toggle" className="text-sm cursor-pointer">Collect Deposit</Label>
            <Switch id="deposit-toggle" checked={collectDeposit} onCheckedChange={setCollectDeposit} />
          </div>

          {collectDeposit && (
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Deposit ({symbol})</Label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                min={0}
                max={price}
                step={10}
                className="h-8"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Bal: {symbol}{(price - depositAmount).toFixed(2)}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleBook} disabled={loading || !customerName.trim() || !startTime}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {collectDeposit ? `Book + Deposit ${symbol}${depositAmount}` : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
