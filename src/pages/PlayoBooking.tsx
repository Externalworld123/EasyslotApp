import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfDay, endOfDay, subDays, addMonths } from "date-fns";
import { Loader2, ChevronLeft, RefreshCw, Bell, CalendarRange, Menu, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCenter } from "@/hooks/useCenter";
import { useMonthlyPlans } from "@/hooks/useMonthlyPlans";
import { usePricingRules, getEffectiveMultiplier, getEffectiveHourlyPrice, priceRange } from "@/hooks/usePricingRules";
import { startSession } from "@/lib/sessionService";
import { getResourceTypeLabel } from "@/lib/resourceTypes";
import { getSportEmoji, getSportShortLabel } from "@/lib/sportIcons";
import {
  buildPlayoMatrix,
  isHourFreeOnResource,
  cartKey,
  formatHourRange,
  type PlayoResource,
  type PlayoSession,
  type CartItem,
} from "@/lib/playoBooking";
import { BookingCart } from "@/components/playo/BookingCart";
import { PlayoSlotMatrix } from "@/components/playo/PlayoSlotMatrix";
import { BookedHourSheet } from "@/components/playo/BookedHourSheet";
import { BookingNotifications } from "@/components/playo/BookingNotifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_DATE = "easyslot_playo_date";
const STORAGE_SPORT = "easyslot_playo_sport";
const STORAGE_CART = "easyslot_playo_cart";
const STORAGE_CART_OPEN = "easyslot_playo_cart_open";

export default function PlayoBooking() {
  const { centerId, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: center } = useCenter(centerId);
  const { data: pricingRules } = usePricingRules();
  const { data: monthlyPlans } = useMonthlyPlans();

  // ── persisted state ─────────────────────────────────────────
  const [date, setDateState] = useState<Date>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_DATE);
      if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime()) && d >= startOfDay(new Date())) return d;
      }
    } catch {}
    return new Date();
  });
  const [sport, setSportState] = useState<string>(() => {
    try {
      return sessionStorage.getItem(STORAGE_SPORT) ?? "";
    } catch {
      return "";
    }
  });
  const [cart, setCartState] = useState<CartItem[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_CART);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const setDate = useCallback((d: Date) => {
    setDateState(d);
    try {
      sessionStorage.setItem(STORAGE_DATE, d.toISOString());
    } catch {}
  }, []);
  const setSport = useCallback((s: string) => {
    setSportState(s);
    try {
      sessionStorage.setItem(STORAGE_SPORT, s);
    } catch {}
  }, []);
  const setCart = useCallback((next: CartItem[] | ((c: CartItem[]) => CartItem[])) => {
    setCartState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try {
        sessionStorage.setItem(STORAGE_CART, JSON.stringify(value));
      } catch {}
      return value;
    });
  }, []);

  // ── data fetch ──────────────────────────────────────────────
  const { data: resources, isLoading: loadingRes } = useQuery({
    queryKey: ["playo-resources", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, type, hourly_rate, capacity, status")
        .eq("center_id", centerId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PlayoResource[];
    },
    enabled: !!centerId,
  });

  const dateKey = format(date, "yyyy-MM-dd");
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["playo-sessions", centerId, dateKey],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, resource_id, start_time, scheduled_end_time, end_time, status")
        .eq("center_id", centerId)
        .in("status", ["active", "scheduled"])
        .gte("start_time", startOfDay(date).toISOString())
        .lte("start_time", endOfDay(date).toISOString());
      if (error) throw error;
      return (data ?? []) as PlayoSession[];
    },
    enabled: !!centerId,
    refetchInterval: 20_000,
  });

  // ── realtime: reconcile with other staff ────────────────────
  useEffect(() => {
    if (!centerId) return;
    const channel = supabase
      .channel(`playo-sessions-${centerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `center_id=eq.${centerId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["playo-sessions", centerId, dateKey] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [centerId, dateKey, qc]);

  // ── derived ─────────────────────────────────────────────────
  const sportTabs = useMemo(() => {
    if (!resources?.length) return [];
    return Array.from(new Set(resources.map((r) => r.type)));
  }, [resources]);

  // default sport to first available
  useEffect(() => {
    if (!sport && sportTabs.length) setSport(sportTabs[0]);
    if (sport && sportTabs.length && !sportTabs.includes(sport)) setSport(sportTabs[0]);
  }, [sport, sportTabs, setSport]);

  const sportResources = useMemo(
    () => (resources ?? []).filter((r) => r.type === sport),
    [resources, sport],
  );

  // Fetch availability schedules for the current sport's resources to constrain the grid
  const sportResourceIds = useMemo(() => sportResources.map((r) => r.id), [sportResources]);
  const { data: availabilitySchedules } = useQuery({
    queryKey: ["playo-availability", sportResourceIds.sort().join(",")],
    queryFn: async () => {
      if (!sportResourceIds.length) return [];
      const { data, error } = await supabase
        .from("availability_schedule")
        .select("resource_id, day_of_week, start_time, end_time, is_closed")
        .in("resource_id", sportResourceIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: sportResourceIds.length > 0,
  });

  const { gridStartHour, gridEndHour } = useMemo(() => {
    const dow = date.getDay();
    const todays = (availabilitySchedules ?? []).filter(
      (s: any) => s.day_of_week === dow && !s.is_closed,
    );
    if (!todays.length) return { gridStartHour: 0, gridEndHour: 24 };
    let minStart = 24;
    let maxEnd = 0;
    for (const s of todays as any[]) {
      const [sh, sm] = String(s.start_time).split(":").map(Number);
      const [eh, em] = String(s.end_time).split(":").map(Number);
      const startH = sh + (sm > 0 ? 0 : 0); // floor
      const endH = eh + (em > 0 ? 1 : 0); // ceil to next hour
      const normalizedEnd = endH <= startH ? 24 : endH; // overnight → up to midnight
      if (startH < minStart) minStart = startH;
      if (normalizedEnd > maxEnd) maxEnd = normalizedEnd;
    }
    return {
      gridStartHour: Math.max(0, Math.min(23, minStart)),
      gridEndHour: Math.max(minStart + 1, Math.min(24, maxEnd)),
    };
  }, [availabilitySchedules, date]);

  const matrix = useMemo(() => {
    if (!sportResources.length) return [];
    return buildPlayoMatrix(
      sportResources,
      sessions ?? [],
      monthlyPlans ?? [],
      date,
      cart,
      gridStartHour,
      gridEndHour,
    );
  }, [sportResources, sessions, monthlyPlans, date, cart, gridStartHour, gridEndHour]);

  const selectedHoursForSportDate = useMemo(() => {
    const set = new Set<string>();
    cart
      .filter(
        (c) =>
          c.date === dateKey &&
          sportResources.some((r) => r.id === c.resourceId),
      )
      .forEach((c) => {
        for (let h = c.hour; h < c.hour + c.hours; h++) set.add(String(h));
      });
    return set;
  }, [cart, dateKey, sportResources]);

  // ── add range to cart (drag-select, contiguous hours on a single court) ──
  const handleAddRange = useCallback(
    (startHour: number, endHourInclusive: number) => {
      const hoursCount = endHourInclusive - startHour + 1;

      // Find a court that is free for ALL hours in the range
      let chosen: PlayoResource | null = null;
      for (const r of sportResources) {
        let ok = true;
        for (let h = startHour; h <= endHourInclusive; h++) {
          if (!isHourFreeOnResource(r, sessions ?? [], monthlyPlans ?? [], cart, date, h)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          chosen = r;
          break;
        }
      }

      if (!chosen) {
        toast({
          title:
            hoursCount > 1
              ? "No single court free for the whole range"
              : "Slot just got booked",
          description:
            hoursCount > 1
              ? "Try a shorter range or a different time."
              : undefined,
          variant: "destructive",
        });
        return;
      }

      // Compute total amount across all hours respecting pricing rules.
      // Use 30-min segments so slots straddling a rate boundary (e.g. 17:30→18:30)
      // get charged proportionally per segment.
      const amount = priceRange(
        pricingRules ?? [],
        chosen.id,
        date,
        startHour,
        hoursCount,
        chosen.hourly_rate,
      );

      // Merge with an adjacent existing cart item on the SAME court + date
      // so a long contiguous selection becomes a single card.
      setCart((prev) => {
        const adjBefore = prev.find(
          (c) =>
            c.resourceId === chosen!.id &&
            c.date === dateKey &&
            c.hour + c.hours === startHour,
        );
        const adjAfter = prev.find(
          (c) =>
            c.resourceId === chosen!.id &&
            c.date === dateKey &&
            c.hour === endHourInclusive + 1,
        );

        if (adjBefore || adjAfter) {
          const merged: CartItem = {
            resourceId: chosen!.id,
            resourceName: chosen!.name,
            hourlyRate: chosen!.hourly_rate,
            date: dateKey,
            hour: adjBefore ? adjBefore.hour : startHour,
            hours:
              (adjBefore?.hours ?? 0) + hoursCount + (adjAfter?.hours ?? 0),
            amount:
              (adjBefore?.amount ?? 0) + amount + (adjAfter?.amount ?? 0),
          };
          return [
            ...prev.filter((c) => c !== adjBefore && c !== adjAfter),
            merged,
          ];
        }

        return [
          ...prev,
          {
            resourceId: chosen!.id,
            resourceName: chosen!.name,
            hourlyRate: chosen!.hourly_rate,
            date: dateKey,
            hour: startHour,
            hours: hoursCount,
            amount,
          },
        ];
      });
    },
    [sportResources, sessions, monthlyPlans, cart, date, dateKey, pricingRules, setCart, toast],
  );

  const handleRemove = useCallback(
    (key: string) => {
      setCart((prev) => prev.filter((c) => cartKey(c) !== key));
    },
    [setCart],
  );

  const handleClear = useCallback(() => setCart([]), [setCart]);

  // Remove ONLY the tapped hour from any cart item that covers it.
  // If a multi-hour item is split, keep the surrounding hours as separate items.
  const handleRemoveHour = useCallback(
    (hour: number) => {
      setCart((prev) => {
        const next: CartItem[] = [];
        for (const c of prev) {
          if (c.date !== dateKey) { next.push(c); continue; }
          const start = c.hour;
          const end = c.hour + c.hours; // exclusive
          if (!(hour >= start && hour < end)) { next.push(c); continue; }

          const resource = (resources ?? []).find((r) => r.id === c.resourceId);
          const baseRate = resource?.hourly_rate ?? c.hourlyRate;

          // Left segment [start, hour)
          if (hour > start) {
            const leftHours = hour - start;
            const amount = priceRange(pricingRules ?? [], c.resourceId, date, start, leftHours, baseRate);
            next.push({ ...c, hour: start, hours: leftHours, amount });
          }
          // Right segment [hour+1, end)
          if (hour + 1 < end) {
            const rightStart = hour + 1;
            const rightHours = end - rightStart;
            const amount = priceRange(pricingRules ?? [], c.resourceId, date, rightStart, rightHours, baseRate);
            next.push({ ...c, hour: rightStart, hours: rightHours, amount });
          }
        }
        next.sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          if (a.hour !== b.hour) return a.hour - b.hour;
          return a.resourceName.localeCompare(b.resourceName);
        });
        return next;
      });
    },
    [dateKey, resources, pricingRules, date, setCart],
  );

  // ── split a merged multi-hour cart item back into 1-hour items ──
  const handleSplit = useCallback(
    (key: string) => {
      setCart((prev) => {
        const item = prev.find((c) => cartKey(c) === key);
        if (!item || item.hours <= 1) return prev;
        const resource = (resources ?? []).find((r) => r.id === item.resourceId);
        if (!resource) return prev;

        const pieces: CartItem[] = [];
        const totalHours = Math.floor(item.hours);
        for (let i = 0; i < totalHours; i++) {
          const hour = item.hour + i;
          const amount = priceRange(
            pricingRules ?? [],
            resource.id,
            date,
            hour,
            1,
            resource.hourly_rate,
          );
          pieces.push({ ...item, hour, hours: 1, amount });
        }
        const next = [...prev.filter((c) => cartKey(c) !== key), ...pieces];
        // Deterministic chronological order: by date, then start hour, then court name
        next.sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          if (a.hour !== b.hour) return a.hour - b.hour;
          return a.resourceName.localeCompare(b.resourceName);
        });
        return next;
      });
    },
    [resources, pricingRules, date, setCart],
  );

  // ── booked-hour bottom sheet ─────────────────────────────────
  const [bookedHour, setBookedHour] = useState<number | null>(null);

  // ── cart sheet open state — persisted so it survives app backgrounding,
  //    route returns and remounts. Stays open until the user explicitly closes it.
  const [cartOpen, setCartOpenState] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_CART_OPEN) === "1"; } catch { return false; }
  });
  const setCartOpen = useCallback((v: boolean) => {
    setCartOpenState(v);
    try { sessionStorage.setItem(STORAGE_CART_OPEN, v ? "1" : "0"); } catch {}
  }, []);
  // ── confirm cart → create sessions ──────────────────────────
  const handleConfirm = useCallback(
    async ({ name, phone, depositUpi, depositCash }: { name: string; phone: string; depositUpi?: number; depositCash?: number }) => {
      if (!centerId || cart.length === 0) return;
      const results = { ok: 0, fail: 0, errors: [] as string[] };

      const upiAmt = depositUpi && depositUpi > 0 ? depositUpi : 0;
      const cashAmt = depositCash && depositCash > 0 ? depositCash : 0;
      const depositParts: string[] = [];
      if (upiAmt) depositParts.push(`UPI ₹${upiAmt}`);
      if (cashAmt) depositParts.push(`Cash ₹${cashAmt}`);
      const depositNote = depositParts.length ? ` · Deposit: ${depositParts.join(" + ")}` : "";

      // Track confirmed bookings to build a WhatsApp summary on success
      const confirmed: { resourceName: string; rangeLabel: string; dateLabel: string; amount: number; paid: number; balance: number }[] = [];
      let totalAmount = 0;
      let remainingUpi = upiAmt;
      let remainingCash = cashAmt;

      for (const item of cart) {
        try {
          const start = new Date(item.date + "T00:00:00");
          const startH = Math.floor(item.hour);
          const startM = Math.round((item.hour % 1) * 60);
          start.setHours(startH, startM, 0, 0);
          const end = new Date(start.getTime() + item.hours * 60 * 60 * 1000);
          const fmtT = (d: Date) => format(d, "h:mm a");
          const rangeLabel = `${fmtT(start)} - ${fmtT(end)}`;
          const session = await startSession({
            resource_id: item.resourceId,
            center_id: centerId,
            customer_name: name,
            customer_phone: phone,
            notes: `Cart booking · ${item.resourceName} · ${rangeLabel}${depositNote}`,
            scheduled_start: start.toISOString(),
            scheduled_end: end.toISOString(),
            local_dow: start.getDay(),
            local_start_minutes: startH * 60 + startM,
            local_duration_minutes: Math.round(item.hours * 60),
          });

          const actualAmount = Math.round(Number(session?.final_amount ?? item.amount));
          let paidForSession = 0;
          const paymentRows: any[] = [];
          if (user && actualAmount > 0) {
            const upiForSession = Math.min(remainingUpi, actualAmount);
            if (upiForSession > 0) {
              paidForSession += upiForSession;
              remainingUpi -= upiForSession;
              paymentRows.push({ session_id: session.id, center_id: centerId, amount: upiForSession, method: "upi", payment_type: "deposit", received_by: user.id });
            }

            const cashForSession = Math.min(remainingCash, Math.max(0, actualAmount - paidForSession));
            if (cashForSession > 0) {
              paidForSession += cashForSession;
              remainingCash -= cashForSession;
              paymentRows.push({ session_id: session.id, center_id: centerId, amount: cashForSession, method: "cash", payment_type: "deposit", received_by: user.id });
            }

            if (paymentRows.length > 0) {
              const { error: paymentError } = await supabase.from("payments").insert(paymentRows);
              if (paymentError) {
                results.errors.push(`${item.resourceName}: deposit not recorded (${paymentError.message})`);
              } else {
                await supabase
                  .from("sessions")
                  .update({ payment_status: paidForSession >= actualAmount ? "paid" : "partial" })
                  .eq("id", session.id)
                  .eq("center_id", centerId);
              }
            }
          }

          confirmed.push({
            resourceName: item.resourceName,
            rangeLabel,
            dateLabel: format(start, "EEE, MMM d, yyyy"),
            amount: actualAmount,
            paid: paidForSession,
            balance: Math.max(0, actualAmount - paidForSession),
          });
          totalAmount += actualAmount;
          results.ok++;
        } catch (err: any) {
          results.fail++;
          results.errors.push(`${item.resourceName} ${formatHourRange(Math.floor(item.hour))}: ${err.message}`);
        }
      }

      if (results.ok > 0) {
        toast({
          title: `${results.ok} booking${results.ok > 1 ? "s" : ""} confirmed`,
          description:
            results.fail > 0
              ? `${results.fail} failed — see toast for details`
              : `Booked for ${name}`,
        });

        // Build WhatsApp summary message
        const paid = upiAmt + cashAmt;
        const balance = Math.max(0, totalAmount - paid);
        const venue = center?.name?.trim() || "Venue";
        const lines: string[] = [];
        lines.push("🏟️ *Booking Confirmed*");
        lines.push("");
        lines.push(`📍 *Venue:* ${venue}`);
        lines.push(`👤 *Name:* ${name}`);
        lines.push(`📞 *Contact:* ${phone}`);
        lines.push("");
        confirmed.forEach((b, i) => {
          lines.push(`${confirmed.length > 1 ? `*${i + 1}.* ` : ""}🎯 ${b.resourceName}`);
          lines.push(`   📅 ${b.dateLabel}`);
          lines.push(`   ⏰ ${b.rangeLabel}`);
          lines.push(`   💰 Court price: ₹${b.amount}`);
          lines.push(`   ✅ Deposit: ₹${b.paid}`);
          lines.push(`   ⏳ Pending: ₹${b.balance}`);
        });
        lines.push("");
        const paidParts: string[] = [];
        if (upiAmt) paidParts.push(`UPI ₹${upiAmt}`);
        if (cashAmt) paidParts.push(`Cash ₹${cashAmt}`);
        lines.push(`*Total court price:* ₹${totalAmount}`);
        lines.push(`*Deposit paid:* ₹${paid}${paidParts.length ? ` (${paidParts.join(" + ")})` : ""}`);
        lines.push(`*Pending amount:* ₹${balance}`);
        lines.push("");
        lines.push("Booked via EasySlot ⚡");
        lines.push("https://www.easyslot.co.in");

        const message = lines.join("\n");
        let cleanPhone = phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          // ignore popup-blocker; user still sees confirmation toast
        }

        setCart([]);
      }
      if (results.fail > 0) {
        toast({
          title: `${results.fail} slot${results.fail > 1 ? "s" : ""} failed`,
          description: results.errors.slice(0, 2).join(" · "),
          variant: "destructive",
        });
      }
      qc.invalidateQueries({ queryKey: ["playo-sessions", centerId, dateKey] });
      qc.invalidateQueries({ queryKey: ["dashboard-sessions"] });
      refetchSessions();
    },
    [centerId, cart, dateKey, qc, refetchSessions, setCart, toast, center],
  );

  // ── update an existing cart item's duration in-place ────────
  const handleUpdateDuration = useCallback(
    (key: string, newHours: number) => {
      setCart((prev) => {
        const item = prev.find((c) => cartKey(c) === key);
        if (!item) return prev;
        const resource = (resources ?? []).find((r) => r.id === item.resourceId);
        if (!resource) return prev;

        // Validate every NEW hour (beyond what's already in this item) is free on the same court
        for (let h = item.hour; h < item.hour + newHours; h++) {
          const alreadyInThisItem = h >= item.hour && h < item.hour + item.hours;
          if (alreadyInThisItem) continue;
          if (
            !isHourFreeOnResource(
              resource as PlayoResource,
              sessions ?? [],
              monthlyPlans ?? [],
              prev,
              date,
              h,
              key,
            )
          ) {
            toast({
              title: "Court busy at that time",
              description: `${resource.name} is not free for the full duration.`,
              variant: "destructive",
            });
            return prev;
          }
        }

        // Recompute amount across the new range using 30-min priced segments
        const amount = priceRange(
          pricingRules ?? [],
          resource.id,
          date,
          item.hour,
          newHours,
          resource.hourly_rate,
        );

        return prev.map((c) =>
          cartKey(c) === key ? { ...c, hours: newHours, amount } : c,
        );
      });
    },
    [resources, sessions, monthlyPlans, date, pricingRules, setCart, toast],
  );

  // ── update an existing cart item's start time (30-min increments) ─
  const handleUpdateStart = useCallback(
    (key: string, newStart: number) => {
      setCart((prev) => {
        const item = prev.find((c) => cartKey(c) === key);
        if (!item) return prev;
        if (Math.abs(item.hour - newStart) < 0.01) return prev;
        const resource = (resources ?? []).find((r) => r.id === item.resourceId);
        if (!resource) return prev;

        const newEnd = newStart + item.hours;
        const firstHour = Math.floor(newStart);
        const lastHourExclusive = Math.ceil(newEnd);
        for (let h = firstHour; h < lastHourExclusive; h++) {
          if (
            !isHourFreeOnResource(
              resource as PlayoResource,
              sessions ?? [],
              monthlyPlans ?? [],
              prev,
              date,
              h,
              key,
            )
          ) {
            toast({
              title: "Court busy at that time",
              description: `${resource.name} is not free at ${String(h).padStart(2, "0")}:00.`,
              variant: "destructive",
            });
            return prev;
          }
        }

        const amount = priceRange(
          pricingRules ?? [],
          resource.id,
          date,
          newStart,
          item.hours,
          resource.hourly_rate,
        );

        return prev.map((c) =>
          cartKey(c) === key ? { ...c, hour: newStart, amount } : c,
        );
      });
    },
    [resources, sessions, monthlyPlans, date, pricingRules, setCart, toast],
  );

  // ── save current cart as recurring monthly plan ─────────────
  const handleSaveAsMonthlyPlan = useCallback(
    async (
      { name, phone }: { name: string; phone: string },
      { months }: { months: number },
    ) => {
      if (!centerId || !user || cart.length === 0) return;
      const startDate = format(date, "yyyy-MM-dd");
      const endDate = format(addMonths(date, months), "yyyy-MM-dd");

      const rows = cart.map((item) => {
        const slotDate = new Date(item.date + "T00:00:00");
        const dow = slotDate.getDay();
        const startHour = Math.floor(item.hour);
        const startMin = (item.hour % 1) * 60;
        return {
          center_id: centerId,
          resource_id: item.resourceId,
          customer_name: name,
          customer_phone: phone,
          start_date: startDate,
          end_date: endDate,
          slot_time: `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}:00`,
          duration_minutes: Math.round(item.hours * 60),
          days_of_week: [dow],
          plan_type: "members",
          total_amount: item.amount,
          notes: `From cart on ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
          created_by: user.id,
        };
      });

      const { error } = await supabase.from("monthly_plans").insert(rows);
      if (error) {
        toast({
          title: "Couldn't save plan",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: `Monthly plan saved`,
        description: `${rows.length} recurring slot${rows.length > 1 ? "s" : ""} for ${name} · until ${format(addMonths(date, months), "MMM d")}`,
      });
      setCart([]);
      qc.invalidateQueries({ queryKey: ["monthly-plans", centerId] });
    },
    [centerId, user, cart, date, qc, setCart, toast],
  );

  return (
    <div className="-m-4 sm:-m-6 -mb-20 md:-mb-6 min-h-[calc(100vh-3.5rem)] flex flex-col bg-gradient-to-b from-muted/30 via-background to-background">
      {/* Header (Playo-blue) */}
      <header className="bg-primary text-primary-foreground px-4 pt-4 pb-3 space-y-3 shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">
              {center?.name ?? "Venue"}
            </h1>
            <p className="text-xs opacity-90">{format(date, "EEE, do MMM yy")}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate("/monthly-plans")}
              aria-label="Monthly plans"
            >
              <CalendarRange className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => refetchSessions()}
              aria-label="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <BookingNotifications centerId={centerId} />
          </div>
        </div>
      </header>

      {/* Sport pill tabs (Playo style) */}
      <div className="bg-card border-b border-border px-3 py-3 sticky top-0 z-20 shadow-sm">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1">
          {sportTabs.map((s) => {
            const active = s === sport;
            const label = getSportShortLabel(s, getResourceTypeLabel(s));
            return (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full text-sm font-semibold transition-all touch-manipulation min-h-12",
                  "ring-1 ring-inset",
                  active
                    ? "bg-primary text-primary-foreground ring-primary shadow-md"
                    : "bg-muted/40 text-muted-foreground ring-border hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-7 w-7 inline-flex items-center justify-center rounded-full text-base",
                    active ? "bg-primary-foreground/20" : "bg-card ring-1 ring-border",
                  )}
                >
                  {getSportEmoji(s)}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot matrix — fits viewport, no scroll */}
      <div className="flex-1 overflow-hidden pb-16">
        {loadingRes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sportResources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No courts for this sport
          </p>
        ) : (
          <PlayoSlotMatrix
            rows={matrix}
            selectedKeys={selectedHoursForSportDate}
            onAddRange={handleAddRange}
            onRemoveHour={handleRemoveHour}
            onBookedClick={(h) => setBookedHour(h)}
          />
        )}
      </div>

      <BookedHourSheet
        open={bookedHour !== null}
        onOpenChange={(o) => !o && setBookedHour(null)}
        centerId={centerId}
        centerName={center?.name ?? "Venue"}
        date={date}
        hour={bookedHour}
        resources={sportResources}
      />

      {/* Day nav (rounded floating pill style) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,16rem)] bg-card/95 backdrop-blur border-t border-border px-3 py-2 flex items-center justify-between z-30 shadow-[0_-4px_12px_-4px_hsl(var(--foreground)/0.08)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDate(subDays(date, 1))}
          disabled={format(date, "yyyy-MM-dd") <= format(new Date(), "yyyy-MM-dd")}
          className="gap-1 rounded-full"
        >
          <ChevronLeft className="h-4 w-4" /> Previous Day
        </Button>
        <span className="text-xs font-medium text-foreground">
          {format(date, "EEEE, MMM d")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDate(addDays(date, 1))}
          className="gap-1 rounded-full"
        >
          Next Day <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <BookingCart
        cart={cart}
        onRemove={handleRemove}
        onClear={handleClear}
        onConfirm={handleConfirm}
        onUpdateDuration={handleUpdateDuration}
        onUpdateStart={handleUpdateStart}
        onSplit={handleSplit}
        open={cartOpen}
        onOpenChange={setCartOpen}
      />
    </div>
  );
}
