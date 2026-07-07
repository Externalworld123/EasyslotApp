import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, Plus, CalendarIcon, CreditCard, Banknote, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Payments() {
  const { centerId, user } = useAuth();
  const queryClient = useQueryClient();
  const { format: formatCurrency, symbol } = useCurrency();
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [showRecord, setShowRecord] = useState(false);
  const [selectedSession, setSelectedSession] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*, sessions!inner(customer_name, resources!inner(name))")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const { data: availableSessions } = useQuery({
    queryKey: ["payment-sessions", centerId, showRecord],
    queryFn: async () => {
      if (!centerId) return [];
      // Get sessions that haven't been fully paid yet
      const { data: sessions, error: sErr } = await supabase
        .from("sessions")
        .select("id, customer_name, customer_phone, final_amount, status, resources!inner(name)")
        .eq("center_id", centerId)
        .in("status", ["completed", "active", "scheduled"])
        .order("start_time", { ascending: false })
        .limit(200);
      if (sErr) throw sErr;

      // Get existing payments to filter out fully-paid sessions
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("session_id, amount")
        .eq("center_id", centerId);

      // Sum payments per session
      const paidMap = new Map<string, number>();
      (existingPayments ?? []).forEach(p => {
        paidMap.set(p.session_id, (paidMap.get(p.session_id) ?? 0) + Number(p.amount));
      });

      // Deduplicate by session id and exclude fully-paid sessions
      const seen = new Set<string>();
      return (sessions ?? []).filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        const paid = paidMap.get(s.id) ?? 0;
        return paid < Number(s.final_amount);
      });
    },
    enabled: !!centerId && showRecord,
  });

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!centerId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("payments").insert({
        session_id: selectedSession,
        center_id: centerId,
        amount: Number(amount),
        method,
        received_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-sessions"] });
      setShowRecord(false);
      setSelectedSession("");
      setAmount("");
      setMethod("cash");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = dateFilter
    ? payments?.filter(p => {
        const dayStart = startOfDay(dateFilter).toISOString();
        const dayEnd = endOfDay(dateFilter).toISOString();
        return p.created_at >= dayStart && p.created_at <= dayEnd;
      })
    : payments;

  const totalRevenue = (filtered ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Payments</h1>
          <p className="text-xs text-muted-foreground">Track and record payments</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button size="sm" className="h-8 ml-auto" onClick={() => setShowRecord(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Record
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">Collected</p>
              <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">Txns</p>
              <p className="text-base font-semibold tabular-nums text-foreground">{filtered?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10">
              <Banknote className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">Avg</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {filtered?.length ? formatCurrency(totalRevenue / filtered.length) : `${symbol}0`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment list */}
      {/* Mobile card view */}
      <div className="space-y-2 md:hidden">
        {!filtered?.length ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No payments found</div>
        ) : (
          filtered.map(p => {
            const session = p.sessions as any;
            return (
              <Card key={p.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{session?.customer_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{session?.resources?.name ?? "—"}</p>
                    </div>
                    <p className="font-mono font-semibold text-sm shrink-0">{formatCurrency(Number(p.amount))}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{format(parseISO(p.created_at), "MMM d, h:mm a")}</span>
                    <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">{p.method}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <Card className="shadow-md hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map(p => {
                    const session = p.sessions as any;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-sm">{format(parseISO(p.created_at), "MMM d, h:mm a")}</TableCell>
                        <TableCell className="font-medium">{session?.customer_name ?? "—"}</TableCell>
                        <TableCell>{session?.resources?.name ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{p.method}</Badge></TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(Number(p.amount))}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={showRecord} onOpenChange={setShowRecord}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={selectedSession} onValueChange={(v) => {
                setSelectedSession(v);
                const s = availableSessions?.find(s => s.id === v);
                if (s) setAmount(String(s.final_amount));
              }}>
                <SelectTrigger><SelectValue placeholder="Select a session" /></SelectTrigger>
                <SelectContent>
                  {availableSessions?.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.customer_name} — {(s.resources as any)?.name} ({formatCurrency(Number(s.final_amount))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({symbol})</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRecord(false)}>Cancel</Button>
            <Button onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending || !selectedSession || !amount}>
              {recordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
