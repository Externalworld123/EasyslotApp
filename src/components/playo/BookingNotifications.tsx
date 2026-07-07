import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Props {
  centerId: string | null;
}

interface BookingNotification {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string;
  scheduled_end_time: string;
  final_amount: number | null;
  created_at: string;
  status: string;
  resources: { name: string } | null;
}

const STORAGE_KEY = "easyslot_booking_notif_read";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    // Cap at 200 most recent ids
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

export function BookingNotifications({ centerId }: Props) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds());
  const navigate = useNavigate();

  const { data: bookings, refetch } = useQuery({
    queryKey: ["booking-notifications", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "id, customer_name, customer_phone, start_time, scheduled_end_time, final_amount, created_at, status, resources(name)",
        )
        .eq("center_id", centerId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as unknown as BookingNotification[];
    },
    enabled: !!centerId,
    refetchInterval: 30_000,
  });

  // Realtime: refresh on new bookings
  useEffect(() => {
    if (!centerId) return;
    const channel = supabase
      .channel(`booking-notif-${centerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sessions",
          filter: `center_id=eq.${centerId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [centerId, refetch]);

  const unreadCount = useMemo(
    () => (bookings ?? []).filter((b) => !readIds.has(b.id)).length,
    [bookings, readIds],
  );

  const markAllRead = () => {
    const next = new Set(readIds);
    (bookings ?? []).forEach((b) => next.add(b.id));
    setReadIds(next);
    saveReadIds(next);
  };

  const markOneRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Latest Bookings
            </p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} new booking${unreadCount !== 1 ? "s" : ""}`
                : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {(bookings ?? []).length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No bookings yet</p>
            </div>
          ) : (
            (bookings ?? []).map((b) => {
              const isUnread = !readIds.has(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    markOneRead(b.id);
                    setOpen(false);
                    navigate(`/booking/${b.id}`);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-muted/50",
                    isUnread && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-1.5 shrink-0">
                      {isUnread ? (
                        <Circle className="h-2 w-2 fill-primary text-primary" />
                      ) : (
                        <Circle className="h-2 w-2 text-transparent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm truncate",
                            isUnread
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground/80",
                          )}
                        >
                          {b.customer_name || b.customer_phone || "Walk-in"}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(b.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.resources?.name ?? "Court"} ·{" "}
                        {format(new Date(b.start_time), "d MMM, h:mm a")}
                        {b.final_amount
                          ? ` · ₹${Number(b.final_amount).toFixed(0)}`
                          : ""}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mt-0.5">
                        {b.status}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
