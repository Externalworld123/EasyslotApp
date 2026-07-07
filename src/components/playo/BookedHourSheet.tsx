import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Phone, User, X, Square, IndianRupee } from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { endSession } from "@/lib/sessionService";
import { formatHourRange } from "@/lib/playoBooking";
import type { PlayoResource } from "@/lib/playoBooking";
import { CollectPaymentDialog } from "./CollectPaymentDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string | null;
  centerName?: string;
  date: Date;
  hour: number | null;
  resources: PlayoResource[]; // resources of the current sport
}

interface BookedSession {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  start_time: string;
  scheduled_end_time: string;
  end_time: string | null;
  status: string;
  resource_id: string;
  payment_status: string | null;
  final_amount: number | null;
  total_amount: number | null;
}

export function BookedHourSheet({
  open,
  onOpenChange,
  centerId,
  centerName = "Venue",
  date,
  hour,
  resources,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collectFor, setCollectFor] = useState<BookedSession | null>(null);

  const dateKey = hour != null ? format(date, "yyyy-MM-dd") : "";
  const slotStart =
    hour != null
      ? (() => {
          const d = new Date(date);
          d.setHours(hour, 0, 0, 0);
          return d;
        })()
      : null;
  const slotEnd = slotStart ? new Date(slotStart.getTime() + 60 * 60 * 1000) : null;
  const resourceIds = resources.map((r) => r.id);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["playo-booked-hour", centerId, dateKey, hour, resourceIds.join(",")],
    queryFn: async (): Promise<BookedSession[]> => {
      if (!centerId || hour == null || !slotStart || !slotEnd || resourceIds.length === 0)
        return [];
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "id, customer_name, customer_phone, start_time, scheduled_end_time, end_time, status, resource_id, payment_status, final_amount, total_amount",
        )
        .eq("center_id", centerId)
        .in("resource_id", resourceIds)
        .in("status", ["active", "scheduled"])
        .lt("start_time", slotEnd.toISOString())
        .gt("scheduled_end_time", slotStart.toISOString());
      if (error) throw error;
      return (data ?? []) as BookedSession[];
    },
    enabled: open && hour != null && !!centerId && resourceIds.length > 0,
  });

  const resourceName = (id: string) =>
    resources.find((r) => r.id === id)?.name ?? "Court";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["playo-booked-hour"] });
    qc.invalidateQueries({ queryKey: ["playo-sessions"] });
  };

  const handleEnd = async (s: BookedSession) => {
    setBusyId(s.id);
    try {
      await endSession({ session_id: s.id });
      toast({ title: "Session ended", description: s.customer_name });
      refresh();
    } catch (err: any) {
      toast({ title: "Failed to end", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (s: BookedSession) => {
    setBusyId(s.id);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "cancelled", end_time: new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
      toast({ title: "Booking cancelled", description: s.customer_name });
      refresh();
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[80vh] flex flex-col rounded-t-xl">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center justify-between">
            <span>Bookings · {hour != null ? formatHourRange(hour) : ""}</span>
            <Badge variant="secondary">{sessions?.length ?? 0}</Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No bookings in this hour
              </p>
            ) : (
              sessions.map((s) => {
                const isActive = s.status === "active";
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.customer_name}
                        </p>
                        {s.customer_phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Phone className="h-3 w-3" />
                            {s.customer_phone}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {resourceName(s.resource_id)} ·{" "}
                          {format(new Date(s.start_time), "h:mm a")} –{" "}
                          {format(new Date(s.scheduled_end_time), "h:mm a")}
                        </p>
                      </div>
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className="shrink-0 capitalize"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {s.payment_status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9 border-success/40 text-success hover:bg-success/10 hover:text-success"
                          onClick={() => setCollectFor(s)}
                        >
                          <IndianRupee className="h-3.5 w-3.5" />
                          Collect
                        </Button>
                      )}
                      {isActive ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 h-9"
                          disabled={busyId === s.id}
                          onClick={() => handleEnd(s)}
                        >
                          {busyId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Square className="h-3.5 w-3.5" />
                          )}
                          End
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9 text-destructive hover:text-destructive"
                          disabled={busyId === s.id}
                          onClick={() => handleCancel(s)}
                        >
                          {busyId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>

      <CollectPaymentDialog
        open={!!collectFor}
        onOpenChange={(o) => !o && setCollectFor(null)}
        centerId={centerId}
        centerName={centerName}
        resourceName={collectFor ? resourceName(collectFor.resource_id) : ""}
        session={collectFor}
        onCollected={refresh}
      />
    </Sheet>
  );
}
