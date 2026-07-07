import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMinutes, setHours, setMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, CreditCard, Shield, CheckCircle2 } from "lucide-react";
import UpiPaymentScreen from "./UpiPaymentScreen";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { priceRange } from "@/hooks/usePricingRules";

interface SlotInfo {
  resourceId: string;
  resourceName: string;
  centerId: string;
  time: string;
  hourlyRate: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: SlotInfo | null;
  date: Date;
  onBooked: () => void;
  centerName?: string;
}

export default function PublicBookingDrawer({ open, onOpenChange, slot, date, onBooked, centerName }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [duration, setDuration] = useState("60");
  const [bookingId, setBookingId] = useState("");
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  // Fetch center UPI ID via edge function (upi_id is not exposed to anon on the table).
  const { data: centerData } = useQuery({
    queryKey: ["center-upi", slot?.centerId],
    queryFn: async () => {
      if (!slot?.centerId) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      try {
        const resp = await fetch(
          `${supabaseUrl}/functions/v1/public-api?endpoint=payment-info&centerId=${encodeURIComponent(slot.centerId)}`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
        );
        if (!resp.ok) return null;
        return (await resp.json()) as { upi_id: string | null; name: string };
      } catch {
        return null;
      }
    },
    enabled: open && !!slot?.centerId,
  });

  // Fetch center settings for payment_mode + min_deposit_percent
  const { data: centerSettings } = useQuery({
    queryKey: ["center-settings-public", slot?.centerId],
    queryFn: async () => {
      if (!slot?.centerId) return null;
      const { data } = await supabase
        .from("center_settings")
        .select("payment_mode, min_deposit_percent")
        .eq("center_id", slot.centerId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!slot?.centerId,
  });

  // Fetch active pricing rules for the center so public price matches admin/staff pricing
  const { data: pricingRules } = useQuery({
    queryKey: ["public-pricing-rules", slot?.centerId, slot?.resourceId],
    queryFn: async () => {
      if (!slot?.centerId) return [];
      const { data } = await supabase
        .from("pricing_rules")
        .select("resource_id, day_of_week, start_time, end_time, price_multiplier, flat_price, is_active")
        .eq("center_id", slot.centerId)
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: open && !!slot?.centerId,
  });

  // Fetch convenience fee percent (super-admin configurable)
  const { data: convenienceFeePercent = 5 } = useQuery({
    queryKey: ["convenience-fee-percent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("feature_flags")
        .select("value, is_active")
        .eq("flag_key", "convenience_fee_percent")
        .maybeSingle();
      if (!data || data.is_active === false) return 0;
      const v = data.value;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 5;
    },
    staleTime: 5 * 60 * 1000,
  });

  const upiId = centerData?.upi_id;
  const resolvedCenterName = centerName || centerData?.name || "EasySlot Venue";
  const paymentMode = (centerSettings as any)?.payment_mode || "optional";
  const minDepositPercent = Number((centerSettings as any)?.min_deposit_percent ?? 50);

  // Razorpay is mandatory for all public bookings — booking only confirmed after payment success.
  const paymentRequired = true;
  const [rzpLoading, setRzpLoading] = useState(false);


  // Persist form state to sessionStorage so switching apps doesn't lose data
  const FORM_KEY = "easyslot_booking_form";

  // Restore saved form state when drawer opens
  useEffect(() => {
    if (open) {
      const saved = sessionStorage.getItem(FORM_KEY);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          setName(s.name || "");
          setPhone(s.phone || "");
          setDuration(s.duration || "60");
          setStep(s.step || "form");
          setPaymentSubmitted(s.paymentSubmitted || false);
          return; // Don't reset — restored from storage
        } catch {}
      }
      // No saved state — fresh open
      setStep("form");
      setName("");
      setPhone(localStorage.getItem("easyslot_phone") || "");
      setDuration("60");
      setBookingId("");
      setPaymentSubmitted(false);
    } else {
      // Clear persisted state when drawer closes normally
      sessionStorage.removeItem(FORM_KEY);
    }
  }, [open]);

  // Save form state on every change so it survives app switches
  useEffect(() => {
    if (open) {
      sessionStorage.setItem(FORM_KEY, JSON.stringify({
        name, phone, duration, step, paymentSubmitted,
        slotResourceId: slot?.resourceId,
      }));
    }
  }, [open, name, phone, duration, step, paymentSubmitted, slot?.resourceId]);

  const price = useMemo(() => {
    if (!slot) return 0;
    const [h, m] = slot.time.split(":").map(Number);
    const startHour = h + (m || 0) / 60;
    const durationHours = parseInt(duration) / 60;
    return priceRange(
      (pricingRules ?? []) as any,
      slot.resourceId,
      date,
      startHour,
      durationHours,
      Number(slot.hourlyRate) || 0,
    );
  }, [slot, duration, pricingRules, date]);

  const subtotal = price;
  const convenienceFee = useMemo(
    () => Math.round(subtotal * (Number(convenienceFeePercent) || 0)) / 100,
    [subtotal, convenienceFeePercent],
  );
  // For "deposit" mode: fee charged on the deposit portion. For "full"/"optional"/default: charged on full price.
  const baseChargeAmount = paymentMode === "deposit"
    ? Math.round(price * (minDepositPercent / 100))
    : price;
  const feeOnCharge = Math.round(baseChargeAmount * (Number(convenienceFeePercent) || 0)) / 100;
  const minPayAmount = Math.round((baseChargeAmount + feeOnCharge) * 100) / 100;

  const endTime = useMemo(() => {
    if (!slot) return "";
    const [h, m] = slot.time.split(":").map(Number);
    const start = setMinutes(setHours(new Date(), h), m);
    return format(addMinutes(start, parseInt(duration)), "h:mm a");
  }, [slot, duration]);

  const startFormatted = useMemo(() => {
    if (!slot) return "";
    const [h, m] = slot.time.split(":").map(Number);
    return format(setMinutes(setHours(new Date(), h), m), "h:mm a");
  }, [slot]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!slot || !name.trim()) throw new Error("Please enter your name");
      if (!phone.trim() || phone.replace(/[^0-9]/g, "").length < 10) throw new Error("Please enter a valid phone number");
      const [h, m] = slot.time.split(":").map(Number);
      const startTime = new Date(date);
      startTime.setHours(h, m, 0, 0);

      // Pull verified Razorpay payment from session storage
      const pendingPaymentStr = sessionStorage.getItem("easyslot_pending_payment");
      let paymentData: any = null;
      if (pendingPaymentStr) {
        try { paymentData = JSON.parse(pendingPaymentStr); } catch {}
      }
      if (!paymentData?.razorpay_payment_id) {
        throw new Error("Payment not completed. Please pay first.");
      }

      const [hh, mm] = slot.time.split(":").map(Number);
      const { data, error } = await supabase.functions.invoke("public-booking", {
        body: {
          center_id: slot.centerId,
          resource_id: slot.resourceId,
          customer_name: name.trim(),
          customer_phone: phone.trim() || null,
          start_time: startTime.toISOString(),
          duration_minutes: parseInt(duration),
          local_dow: date.getDay(),
          local_start_minutes: hh * 60 + (mm || 0),
          local_duration_minutes: parseInt(duration),
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          razorpay_amount: Math.round(Number(paymentData.amount) * 100),
        },
      });

      if (error) throw new Error(error.message || "Booking failed");
      if (data?.error) throw new Error(data.error);

      // Clear the pending payment data
      sessionStorage.removeItem("easyslot_pending_payment");
      return data;

    },
    onSuccess: (data) => {
      if (phone.trim()) {
        localStorage.setItem("easyslot_phone", phone.trim());
      }
      setBookingId(data?.id || "");
      toast.success("Booking confirmed!");
      onBooked();
      onOpenChange(false);
      if (data?.id) {
        navigate(`/booking-success/${data.id}`);
      }
    },
    onError: (err: Error) => {
      if (err.message.includes("already booked") || err.message.includes("conflict")) {
        toast.error("Slot just got booked, please select another");
        onOpenChange(false);
      } else {
        toast.error(err.message);
      }
    },
  });

  const handlePaymentSubmitted = (sessionId: string) => {
    setPaymentSubmitted(true);
    setBookingId(sessionId);
  };

  const handleProceedAfterPayment = () => {
    // Now create the booking after payment
    bookMutation.mutate();
  };

  const handleRazorpayPay = async () => {
    if (!slot) return;
    if (!name.trim() || phone.replace(/[^0-9]/g, "").length < 10) {
      toast.error("Enter your name and a valid phone number");
      return;
    }
    const payAmount = minPayAmount;
    setRzpLoading(true);
    try {
      const result = await openRazorpayCheckout({
        amount: payAmount,
        name: `EasySlot - ${resolvedCenterName}`,
        description: `Booking: ${slot.resourceName}`,
        prefill: { name: name.trim(), contact: phone.trim() },
        notes: { resource: slot.resourceName, center: resolvedCenterName },
        // No verifyContext yet — booking doesn't exist. We mark as paid post-booking via pending payment.
      });
      // Stash verified Razorpay payment so public-booking re-verifies and links to the new session
      sessionStorage.setItem("easyslot_pending_payment", JSON.stringify({
        center_id: slot.centerId,
        amount: payAmount,
        razorpay_order_id: result.order_id,
        razorpay_payment_id: result.payment_id,
        razorpay_signature: result.signature,
        payment_method: "razorpay",
        customer_name: name.trim(),
        customer_phone: phone.trim(),
      }));
      setPaymentSubmitted(true);
      toast.success("Payment successful — confirming booking…");
      // Auto-proceed to create the booking
      bookMutation.mutate();

    } catch (e: any) {
      if (e?.message !== "Payment cancelled") toast.error(e?.message || "Payment failed");
    } finally {
      setRzpLoading(false);
    }
  };

  const content = (
    <div className="space-y-4 px-1">
      {step === "form" && (
        <>
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Court</span>
              <span className="font-medium text-foreground">{slot?.resourceName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium text-foreground">{format(date, "EEE, MMM d")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium text-foreground">
                {startFormatted} – {endTime}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Your Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-12 text-base"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Phone Number *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="h-12 text-base"
                maxLength={20}
                type="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="300">5 hours</SelectItem>
                  <SelectItem value="360">6 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">₹{subtotal.toFixed(0)}</span>
            </div>
            {Number(convenienceFeePercent) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Convenience fee ({convenienceFeePercent}%)</span>
                <span className="font-medium text-foreground">₹{feeOnCharge.toFixed(0)}</span>
              </div>
            )}
            {paymentMode === "deposit" && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Deposit</span>
                <span>{minDepositPercent}% of subtotal</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-primary/10 pt-2">
              <span className="text-sm font-medium text-foreground">Pay now</span>
              <span className="text-xl font-bold text-primary">₹{minPayAmount.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 text-primary" />
              Booking confirmed after payment
            </div>
          </div>

          {paymentRequired && (
            <Badge variant="outline" className="w-full justify-center py-1.5 text-xs gap-1.5 border-primary/30 text-primary">
              <CreditCard className="h-3 w-3" />
              Secure payment via Razorpay
            </Badge>
          )}
        </>
      )}

      {step === "payment" && slot && upiId && (
        <>
          {!paymentSubmitted ? (
            <UpiPaymentScreen
              sessionId=""
              centerId={slot.centerId}
              centerName={resolvedCenterName}
              resourceName={slot.resourceName}
              amount={minPayAmount}
              upiId={upiId}
              customerName={name}
              customerPhone={phone}
              preBookMode
              onPaymentSubmitted={() => handlePaymentSubmitted("")}
            />
          ) : (
            <div className="text-center space-y-4 py-6">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <h3 className="text-lg font-bold text-foreground">Payment Submitted!</h3>
              <p className="text-sm text-muted-foreground">
                Now confirm your booking to secure the slot.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const formValid = name.trim().length > 0 && phone.trim().length > 0 && phone.replace(/[^0-9]/g, "").length >= 10;
  const payAmount = minPayAmount;
  const busy = rzpLoading || bookMutation.isPending;

  const footer = (
    <>
      {step === "form" && (
        <div className="w-full space-y-2">
          <Button
            size="lg"
            className="w-full h-14 text-base"
            disabled={!formValid || busy}
            onClick={() => {
              if (paymentRequired) {
                handleRazorpayPay();
              } else {
                bookMutation.mutate();
              }
            }}
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
            {paymentRequired ? (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay ₹{payAmount} & Book
              </>
            ) : (
              "Book Now"
            )}
          </Button>
          {paymentRequired && upiId && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              disabled={!formValid || busy}
              onClick={() => setStep("payment")}
            >
              Or pay via UPI manually
            </Button>
          )}
        </div>
      )}
      {step === "payment" && (
        <div className="flex gap-3 w-full">
          <Button variant="outline" size="lg" className="flex-1 h-14" onClick={() => setStep("form")}>
            Back
          </Button>
          {paymentSubmitted && (
            <Button
              size="lg"
              className="flex-1 h-14 text-base"
              onClick={handleProceedAfterPayment}
              disabled={bookMutation.isPending}
            >
              {bookMutation.isPending && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
              Confirm Booking
            </Button>
          )}
        </div>
      )}
    </>
  );

  const title = step === "payment" ? "Pay via UPI" : "Book Slot";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={step === "payment" ? "max-h-[95vh]" : ""}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">Booking form</DrawerDescription>
          </DrawerHeader>
          <div className={`px-4 pb-2 ${step === "payment" ? "overflow-y-auto max-h-[60vh]" : ""}`}>{content}</div>
          <DrawerFooter>{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Booking form</DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter className="mt-2">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
