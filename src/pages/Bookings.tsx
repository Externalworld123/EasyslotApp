import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, parseISO, subDays, addDays, addMinutes, setHours, setMinutes } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Globe, Footprints, Search, Pencil, XCircle, Loader2, Volleyball, Trophy, Waves, Target, CircleDot, User, Phone, Clock, MapPin, CreditCard, ChevronRight as ChevronRightIcon } from "lucide-react";
import ShareBookingButton from "@/components/ShareBookingButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  scheduled: "bg-primary/10 text-primary border-primary/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

const CARD_ACCENT: Record<string, string> = {
  active: "border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
  completed: "border-l-slate-400 bg-slate-50/50 dark:bg-slate-900/20",
  cancelled: "border-l-red-400 bg-red-50/30 dark:bg-red-950/20",
  scheduled: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
  no_show: "border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/20",
};

const SPORT_ICON_MAP: Record<string, React.ElementType> = {
  badminton: Volleyball,
  tennis: CircleDot,
  cricket: Trophy,
  football: CircleDot,
  basketball: CircleDot,
  swimming: Waves,
  table_tennis: Target,
  squash: Target,
  volleyball: Volleyball,
  Pickleball: CircleDot,
};

function getSportIcon(type?: string) {
  if (!type) return CircleDot;
  return SPORT_ICON_MAP[type] || CircleDot;
}

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

export default function Bookings() {
  const { centerId } = useAuth();
  const { format: fmtCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState<"all" | "online" | "walkin">("all");
  const [search, setSearch] = useState("");

  // Detail sheet state
  const [detailBooking, setDetailBooking] = useState<any>(null);

  // Edit modal state
  const [editBooking, setEditBooking] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(60);

  // Cancel dialog state
  const [cancelBooking, setCancelBooking] = useState<any>(null);

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const dayStart = startOfDay(selectedDate).toISOString();
  const dayEnd = endOfDay(selectedDate).toISOString();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings-list", centerId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("*, resources!inner(name, type), centers(name)")
        .eq("center_id", centerId)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((b) => b.id);
      if (!ids.length) return rows;

      const { data: paymentRows, error: paymentError } = await supabase
        .from("payments")
        .select("session_id, amount")
        .eq("center_id", centerId)
        .in("session_id", ids);
      if (paymentError) throw paymentError;

      const paidMap = new Map<string, number>();
      (paymentRows ?? []).forEach((p) => {
        paidMap.set(p.session_id, (paidMap.get(p.session_id) ?? 0) + Number(p.amount));
      });

      return rows.map((b) => ({ ...b, paid_amount: paidMap.get(b.id) ?? 0 }));
    },
    enabled: !!centerId,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "cancelled" as any, end_time: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("center_id", centerId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["bookings-list"] });
      setCancelBooking(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editBooking || !centerId) throw new Error("No booking selected");
      const [h, m] = editTime.split(":").map(Number);
      const startDate = parseISO(editBooking.start_time);
      const newStart = setMinutes(setHours(startDate, h), m);
      newStart.setSeconds(0, 0);
      const newEnd = addMinutes(newStart, editDuration);

      const updates: any = {
        customer_name: editName.trim(),
        customer_phone: editPhone.trim() || null,
        start_time: newStart.toISOString(),
        scheduled_end_time: newEnd.toISOString(),
        duration_minutes: editDuration,
      };

      const { error } = await supabase
        .from("sessions")
        .update(updates)
        .eq("id", editBooking.id)
        .eq("center_id", centerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking updated");
      queryClient.invalidateQueries({ queryKey: ["bookings-list"] });
      setEditBooking(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (b: any) => {
    setEditBooking(b);
    setEditName(b.customer_name);
    setEditPhone(b.customer_phone || "");
    setEditTime(format(parseISO(b.start_time), "HH:mm"));
    setEditDuration(b.duration_minutes || 60);
  };

  const filtered = useMemo(() => {
    if (!bookings) return [];
    let list = bookings;

    if (tab === "online") {
      list = list.filter((b) => b.status === "scheduled" || b.notes?.toLowerCase().includes("online"));
    } else if (tab === "walkin") {
      list = list.filter((b) => b.status !== "scheduled" && !b.notes?.toLowerCase().includes("online"));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.customer_phone?.toLowerCase().includes(q) ||
          (b.resources as any)?.name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [bookings, tab, search]);

  const counts = useMemo(() => {
    if (!bookings) return { all: 0, online: 0, walkin: 0 };
    const online = bookings.filter((b) => b.status === "scheduled" || b.notes?.toLowerCase().includes("online")).length;
    return { all: bookings.length, online, walkin: bookings.length - online };
  }, [bookings]);

  const canModify = (status: string) => status === "scheduled" || status === "active";

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bookings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Today's bookings by channel</p>
      </div>

      {/* Date nav — full-width mobile */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 touch-manipulation"
          onClick={() => setSelectedDate((d) => subDays(d, 1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 h-11 justify-center font-medium touch-manipulation",
                isToday && "border-primary text-primary"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {isToday ? "Today" : format(selectedDate, "EEE, MMM d")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 touch-manipulation"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isToday && (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 px-2 text-xs shrink-0"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, phone, court..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Tabs — compact on mobile */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm px-1">
            All
            <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-1 text-xs sm:text-sm px-1">
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Online</span>
            <span className="xs:hidden">On</span>
            <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{counts.online}</Badge>
          </TabsTrigger>
          <TabsTrigger value="walkin" className="gap-1 text-xs sm:text-sm px-1">
            <Footprints className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Walk-in</span>
            <span className="xs:hidden">Walk</span>
            <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{counts.walkin}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg">No bookings found</p>
              <p className="text-sm mt-1">{tab !== "all" ? `No ${tab} bookings for this date.` : "No bookings for this date."}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
                 {filtered.map((b) => {
                const SportIcon = getSportIcon((b.resources as any)?.type);
                const endTime = b.scheduled_end_time || b.end_time;
                const paidAmount = Number((b as any).paid_amount || 0);
                const pendingAmount = Math.max(0, Number(b.final_amount || 0) - paidAmount);
                return (
                <Card
                  key={b.id}
                  className={cn(
                    "overflow-hidden border-l-4 transition-all cursor-pointer active:scale-[0.98] touch-manipulation",
                    CARD_ACCENT[b.status] || "border-l-muted"
                  )}
                  onClick={() => setDetailBooking(b)}
                >
                   <CardContent className="p-3.5">
                     <div className="flex items-start justify-between gap-3">
                       <div className="flex-1 min-w-0 space-y-1.5">
                         <div className="flex items-center gap-2">
                           <p className="font-semibold text-sm text-foreground truncate">{b.customer_name}</p>
                           <Badge className={cn("text-[10px] h-5 px-1.5 border", STATUS_COLORS[b.status] || "")}>
                             {b.status}
                           </Badge>
                           <PaymentStatusBadge status={b.payment_status} />
                         </div>
                         <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                           <SportIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                           <span className="font-medium text-foreground truncate">{(b.resources as any)?.name}</span>
                           <span className="text-muted-foreground/60">•</span>
                           <span className="whitespace-nowrap">
                             {format(parseISO(b.start_time), "h:mm a")}
                             {endTime && ` – ${format(parseISO(endTime), "h:mm a")}`}
                           </span>
                         </div>
                         {b.customer_phone && (
                           <p className="text-[11px] text-muted-foreground">{b.customer_phone}</p>
                         )}
                       </div>
                       <div className="flex items-center gap-1 shrink-0">
                         <div className="text-right">
                           <p className="text-sm font-bold text-foreground">{fmtCurrency(b.final_amount)}</p>
                            {paidAmount > 0 && (
                              <p className="text-[10px] text-muted-foreground">Due {fmtCurrency(pendingAmount)}</p>
                            )}
                           {b.duration_minutes && (
                             <p className="text-[10px] text-muted-foreground">{b.duration_minutes} min</p>
                           )}
                         </div>
                         <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                       </div>
                     </div>
                   </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Detail Sheet */}
      <Sheet open={!!detailBooking} onOpenChange={(open) => !open && setDetailBooking(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-4 pb-8">
          {detailBooking && (() => {
            const DetailIcon = getSportIcon((detailBooking.resources as any)?.type);
            const detailEnd = detailBooking.scheduled_end_time || detailBooking.end_time;
            return (
              <>
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-left text-lg">Booking Details</SheetTitle>
                </SheetHeader>

                {/* Status row */}
                <div className="flex items-center gap-2 mb-5">
                  <Badge className={cn("text-xs px-3 py-1 border", STATUS_COLORS[detailBooking.status] || "")}>
                    {detailBooking.status}
                  </Badge>
                  <PaymentStatusBadge status={detailBooking.payment_status} size="default" />
                </div>

                {/* Info rows */}
                <div className="space-y-3.5">
                  <DetailRow icon={User} label="Customer" value={detailBooking.customer_name} />
                  {detailBooking.customer_phone && (
                    <DetailRow icon={Phone} label="Phone" value={detailBooking.customer_phone} />
                  )}
                  <DetailRow icon={DetailIcon} label="Court" value={(detailBooking.resources as any)?.name || "—"} />
                  <DetailRow icon={CalendarIcon} label="Date" value={format(parseISO(detailBooking.start_time), "EEE, MMM d, yyyy")} />
                  <DetailRow icon={Clock} label="Time" value={
                    `${format(parseISO(detailBooking.start_time), "h:mm a")}${detailEnd ? ` – ${format(parseISO(detailEnd), "h:mm a")}` : ""}`
                  } />
                  {detailBooking.duration_minutes && (
                    <DetailRow icon={Clock} label="Duration" value={`${detailBooking.duration_minutes} min`} />
                  )}
                  <DetailRow icon={CreditCard} label="Amount" value={fmtCurrency(detailBooking.final_amount)} />
                  <DetailRow icon={CreditCard} label="Deposit" value={fmtCurrency((detailBooking as any).paid_amount || 0)} />
                  <DetailRow icon={CreditCard} label="Pending" value={fmtCurrency(Math.max(0, Number(detailBooking.final_amount || 0) - Number((detailBooking as any).paid_amount || 0)))} />
                  {detailBooking.notes && (
                    <DetailRow icon={MapPin} label="Notes" value={detailBooking.notes} />
                  )}
                </div>

                {/* Action buttons */}
                {canModify(detailBooking.status) && (
                  <div className="flex gap-2 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1 h-12"
                      onClick={(e) => { e.stopPropagation(); setDetailBooking(null); openEdit(detailBooking); }}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 h-12"
                      onClick={(e) => { e.stopPropagation(); setDetailBooking(null); setCancelBooking(detailBooking); }}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Cancel
                    </Button>
                  </div>
                )}

                <div className="mt-4 flex justify-center">
                  <ShareBookingButton
                    booking={{
                      customerName: detailBooking.customer_name,
                      customerPhone: detailBooking.customer_phone,
                      resourceName: (detailBooking.resources as any)?.name || "Court",
                      centerName: (detailBooking as any).centers?.name,
                      startTime: detailBooking.start_time,
                      durationMinutes: detailBooking.duration_minutes,
                      amount: detailBooking.final_amount,
                      paidAmount: (detailBooking as any).paid_amount || 0,
                    }}
                    variant="icon"
                  />
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={!!editBooking} onOpenChange={(open) => !open && setEditBooking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={String(editDuration)} onValueChange={(v) => setEditDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBooking(null)}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName.trim()}>
              {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelBooking} onOpenChange={(open) => !open && setCancelBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {cancelBooking?.customer_name}'s booking on {cancelBooking ? (cancelBooking.resources as any)?.name : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelBooking && cancelMutation.mutate(cancelBooking.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
