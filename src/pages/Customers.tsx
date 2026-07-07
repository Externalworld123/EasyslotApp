import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Users, Loader2, Calendar, Globe, UserCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface EnrichedCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  total_sessions: number;
  lifetime_value: number;
  created_at: string;
  // Enriched fields
  actual_total_sessions: number;
  actual_lifetime_value: number;
  online_bookings: number;
  walk_in_bookings: number;
  active_monthly_plans: number;
  last_visit: string | null;
}

export default function Customers() {
  const { centerId } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const qc = useQueryClient();
  const SEARCH_KEY = "easyslot_customers_search";
  const [search, setSearch] = useState<string>(() => {
    try { return sessionStorage.getItem(SEARCH_KEY) ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(SEARCH_KEY, search); } catch {}
  }, [search]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-enriched", centerId],
    queryFn: async (): Promise<EnrichedCustomer[]> => {
      if (!centerId) return [];

      // Fetch customers, sessions, and monthly plans in parallel
      const [custRes, sessRes, planRes] = await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("center_id", centerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select("id, customer_phone, customer_name, status, final_amount, start_time, notes")
          .eq("center_id", centerId)
          .in("status", ["active", "completed", "scheduled"]),
        supabase
          .from("monthly_plans")
          .select("id, customer_phone, customer_name, is_active")
          .eq("center_id", centerId)
          .eq("is_active", true),
      ]);

      if (custRes.error) throw custRes.error;
      const allCustomers = custRes.data ?? [];
      const allSessions = sessRes.data ?? [];
      const allPlans = planRes.data ?? [];

      // Build session stats by cleaned phone
      const sessionsByPhone = new Map<string, {
        total: number;
        revenue: number;
        online: number;
        walkIn: number;
        lastVisit: string | null;
      }>();

      for (const s of allSessions) {
        const phone = s.customer_phone?.replace(/[^0-9]/g, "") || "";
        if (!phone || phone.length < 10) continue;
        const existing = sessionsByPhone.get(phone) || {
          total: 0, revenue: 0, online: 0, walkIn: 0, lastVisit: null,
        };
        existing.total += 1;
        existing.revenue += Number(s.final_amount) || 0;
        // Online bookings have status "scheduled" initially, walk-ins are "active"
        if (s.status === "scheduled") {
          existing.online += 1;
        } else {
          existing.walkIn += 1;
        }
        if (!existing.lastVisit || s.start_time > existing.lastVisit) {
          existing.lastVisit = s.start_time;
        }
        sessionsByPhone.set(phone, existing);
      }

      // Build monthly plan count by phone
      const plansByPhone = new Map<string, number>();
      for (const p of allPlans) {
        const phone = p.customer_phone?.replace(/[^0-9]/g, "") || "";
        if (!phone || phone.length < 10) continue;
        plansByPhone.set(phone, (plansByPhone.get(phone) || 0) + 1);
      }

      // Also collect customers from sessions who might not be in the customers table
      const existingPhones = new Set(allCustomers.map(c => c.phone?.replace(/[^0-9]/g, "") || ""));
      const missingCustomers: typeof allCustomers = [];
      const seenMissingPhones = new Set<string>();

      for (const s of allSessions) {
        const phone = s.customer_phone?.replace(/[^0-9]/g, "") || "";
        if (!phone || phone.length < 10) continue;
        if (existingPhones.has(phone) || seenMissingPhones.has(phone)) continue;
        seenMissingPhones.add(phone);
        missingCustomers.push({
          id: `session-${phone}`,
          name: s.customer_name,
          phone,
          email: null,
          notes: null,
          total_sessions: 0,
          lifetime_value: 0,
          center_id: centerId,
          created_at: s.start_time,
          updated_at: s.start_time,
        });
      }

      const combined = [...allCustomers, ...missingCustomers];

      return combined.map((c): EnrichedCustomer => {
        const cleanPhone = c.phone?.replace(/[^0-9]/g, "") || "";
        const stats = sessionsByPhone.get(cleanPhone);
        const activePlans = plansByPhone.get(cleanPhone) || 0;

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          notes: c.notes,
          total_sessions: c.total_sessions,
          lifetime_value: Number(c.lifetime_value),
          created_at: c.created_at,
          actual_total_sessions: stats?.total || 0,
          actual_lifetime_value: stats?.revenue || 0,
          online_bookings: stats?.online || 0,
          walk_in_bookings: stats?.walkIn || 0,
          active_monthly_plans: activePlans,
          last_visit: stats?.lastVisit || null,
        };
      });
    },
    enabled: !!centerId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!centerId) throw new Error("No center");
      const { error } = await supabase.from("customers").insert({
        center_id: centerId,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer added");
      qc.invalidateQueries({ queryKey: ["customers-enriched", centerId] });
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", notes: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = customers?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  // Sort by actual sessions descending
  const sorted = [...filtered].sort((a, b) => b.actual_total_sessions - a.actual_total_sessions);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const totalCustomers = customers?.length || 0;
  const totalRevenue = customers?.reduce((s, c) => s + c.actual_lifetime_value, 0) || 0;
  const totalSessions = customers?.reduce((s, c) => s + c.actual_total_sessions, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header — mobile-first stacked */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Bookings, walk-ins & monthly plans</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAdd(true)}
            className="flex-1 h-11 touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Customer
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 touch-manipulation shrink-0"
            onClick={() => qc.invalidateQueries({ queryKey: ["customers-enriched", centerId] })}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards — compact on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{totalCustomers}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{totalSessions}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-sm sm:text-2xl font-bold text-foreground leading-tight truncate">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Search — full width on mobile */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No customers found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 md:hidden">
            {sorted.map((c) => (
              <Card key={c.id} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.phone || "No phone"}
                        {c.email ? ` · ${c.email}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {c.actual_total_sessions} {c.actual_total_sessions === 1 ? "session" : "sessions"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.online_bookings > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
                        <Globe className="h-3 w-3" /> {c.online_bookings} online
                      </Badge>
                    )}
                    {c.walk_in_bookings > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
                        <UserCheck className="h-3 w-3" /> {c.walk_in_bookings} walk-in
                      </Badge>
                    )}
                    {c.active_monthly_plans > 0 && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1 px-1.5 py-0.5">
                        <Calendar className="h-3 w-3" /> {c.active_monthly_plans} plan
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <span className="text-[11px] text-muted-foreground">
                      {c.last_visit
                        ? `Last: ${format(new Date(c.last_visit), "dd MMM yyyy")}`
                        : "No visits yet"}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(c.actual_lifetime_value)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-center">Source</TableHead>
                    <TableHead className="text-center">Monthly Plans</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Last Visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.actual_total_sessions}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.online_bookings > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Globe className="h-3 w-3" /> {c.online_bookings}
                            </Badge>
                          )}
                          {c.walk_in_bookings > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <UserCheck className="h-3 w-3" /> {c.walk_in_bookings}
                            </Badge>
                          )}
                          {c.online_bookings === 0 && c.walk_in_bookings === 0 && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.active_monthly_plans > 0 ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                            <Calendar className="h-3 w-3" /> {c.active_monthly_plans}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(c.actual_lifetime_value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.last_visit
                          ? format(new Date(c.last_visit), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10+ digits" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.name.trim() || form.phone.replace(/[^0-9]/g, "").length < 10}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
