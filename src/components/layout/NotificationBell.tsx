import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Generate a notification beep using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Play a second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.65);
  } catch {
    // Audio not supported, silently ignore
  }
}

function showBrowserNotification(name: string, amount: number) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("💰 New Payment Received", {
      body: `${name || "Customer"} paid ₹${amount.toFixed(0)} via UPI. Verify now.`,
      icon: "/favicon.ico",
      tag: "easyslot-payment",
    });
  }
}

export function NotificationBell() {
  const { centerId, primaryRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  const isAdmin = primaryRole === "center_admin" || primaryRole === "super_admin" || primaryRole === "organization_admin";

  // Request notification permission on mount
  useEffect(() => {
    if (!isAdmin) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isAdmin]);

  const { data: pendingPayments } = useQuery({
    queryKey: ["pending-payments-notifications", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("public_payments")
        .select("id, customer_name, customer_phone, amount, utr_id, transaction_id, created_at")
        .eq("center_id", centerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId && isAdmin,
    refetchInterval: 30000,
  });

  const count = pendingPayments?.length ?? 0;

  // Play sound + show browser notification when count increases
  useEffect(() => {
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      const newest = pendingPayments?.[0];
      playNotificationSound();
      if (newest) {
        showBrowserNotification(newest.customer_name || "", Number(newest.amount));
        toast.info(`New payment from ${newest.customer_name || "Customer"} · ₹${Number(newest.amount).toFixed(0)}`, {
          action: {
            label: "View",
            onClick: () => navigate("/payment-history"),
          },
        });
      }
    }
    prevCountRef.current = count;
  }, [count, pendingPayments, navigate]);

  const handleNewPayment = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pending-payments-notifications"] });
  }, [queryClient]);

  // Realtime subscription for new pending payments
  useEffect(() => {
    if (!centerId || !isAdmin) return;

    const channel = supabase
      .channel("pending-payments-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "public_payments",
          filter: `center_id=eq.${centerId}`,
        },
        handleNewPayment
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "public_payments",
          filter: `center_id=eq.${centerId}`,
        },
        handleNewPayment
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [centerId, isAdmin, handleNewPayment]);

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={`h-4 w-4 ${count > 0 ? "animate-bounce" : ""}`} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {count > 0 && (
            <p className="text-xs text-muted-foreground">{count} pending payment{count !== 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {count === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending payments</p>
            </div>
          ) : (
            pendingPayments?.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                onClick={() => {
                  setOpen(false);
                  navigate("/payment-history");
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.customer_name || p.customer_phone || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      UTR: {p.utr_id} · ₹{Number(p.amount).toFixed(0)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 border-amber-300/50 text-amber-600">
                    Pending
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(p.created_at), "MMM d, h:mm a")}
                </p>
              </button>
            ))
          )}
        </div>
        {count > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setOpen(false);
                navigate("/payment-history");
              }}
            >
              View all payments
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
