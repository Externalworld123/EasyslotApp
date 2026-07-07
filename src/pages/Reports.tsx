import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, subDays } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { StatsCard } from "@/components/reports/StatsCard";
import { RevenueTable, RevenueRow } from "@/components/reports/RevenueTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Clock, TrendingUp, BarChart3, Star } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const CHART_COLORS = [
  "hsl(217, 91%, 53%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 70%, 55%)",
  "hsl(190, 80%, 45%)",
];

const Reports = () => {
  const { centerId } = useAuth();
  const { format: formatCurrency, symbol } = useCurrency();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["reports-sessions", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, start_time, duration_minutes, final_amount, status, resources!inner(name)")
        .eq("center_id", centerId)
        .in("status", ["completed", "active"])
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const { data: feedbackData } = useQuery({
    queryKey: ["reports-feedback", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("feedback")
        .select("id, rating, comment, customer_name, created_at, session_id")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const avgRating = useMemo(() => {
    if (!feedbackData?.length) return 0;
    return feedbackData.reduce((s, f) => s + f.rating, 0) / feedbackData.length;
  }, [feedbackData]);

  const stats = useMemo(() => {
    if (!sessions) return { totalRevenue: 0, totalSessions: 0, uniqueCustomers: 0, avgDuration: 0 };
    const completed = sessions.filter(s => s.status === "completed");
    const totalRevenue = completed.reduce((sum, s) => sum + Number(s.final_amount), 0);
    const uniqueCustomers = new Set(sessions.map(s => s.customer_name)).size;
    const durations = completed.filter(s => s.duration_minutes).map(s => s.duration_minutes!);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return { totalRevenue, totalSessions: sessions.length, uniqueCustomers, avgDuration };
  }, [sessions]);

  const dailyRevenue = useMemo(() => {
    if (!sessions) return [];
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { date: format(d, "MMM d"), key: format(d, "yyyy-MM-dd"), revenue: 0, bookings: 0 };
    });
    const map = new Map(last7.map(d => [d.key, d]));
    sessions.filter(s => s.status === "completed").forEach(s => {
      const key = format(parseISO(s.start_time), "yyyy-MM-dd");
      const entry = map.get(key);
      if (entry) {
        entry.revenue += Number(s.final_amount);
        entry.bookings += 1;
      }
    });
    return last7;
  }, [sessions]);

  const resourceBreakdown = useMemo(() => {
    if (!sessions) return [];
    const counts: Record<string, number> = {};
    sessions.forEach(s => {
      const name = (s.resources as any)?.name ?? "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [sessions]);

  const revenueRows: RevenueRow[] = useMemo(() => {
    if (!sessions) return [];
    return sessions.slice(0, 50).map(s => ({
      id: s.id,
      date: format(parseISO(s.start_time), "MMM d, yyyy"),
      resource: (s.resources as any)?.name ?? "—",
      customer: s.customer_name,
      duration: s.duration_minutes ? `${s.duration_minutes}m` : "—",
      amount: s.status === "completed" ? formatCurrency(Number(s.final_amount)) : "—",
    }));
  }, [sessions]);

  const formatDuration = (mins: number) => {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-xs text-muted-foreground">Revenue and activity overview</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} iconClassName="text-success" />
        <StatsCard label="Sessions" value={String(stats.totalSessions)} icon={Clock} iconClassName="text-primary" />
        <StatsCard label="Customers" value={String(stats.uniqueCustomers)} icon={Users} iconClassName="text-muted-foreground" />
        <StatsCard label="Avg Duration" value={formatDuration(stats.avgDuration)} icon={TrendingUp} iconClassName="text-primary" />
      </div>

      {/* Charts - stack on mobile */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-md lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Revenue — Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={`Revenue (${symbol})`} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Popular Resources</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            {resourceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={resourceBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {resourceBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session History - cards on mobile, table on desktop */}
      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Session History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:block hidden">
          <RevenueTable rows={revenueRows} />
        </CardContent>
        <CardContent className="p-3 pt-0 md:hidden">
          {!revenueRows.length ? (
            <p className="text-center text-muted-foreground text-sm py-8">No sessions</p>
          ) : (
            <div className="space-y-2">
              {revenueRows.slice(0, 20).map((row) => (
                <div key={row.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{row.customer}</p>
                    <p className="text-xs text-muted-foreground">{row.resource} · {row.date}</p>
                  </div>
                  <p className="text-sm font-mono font-semibold shrink-0 ml-2">{row.amount}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Customer Feedback
            {avgRating > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{avgRating.toFixed(1)} avg</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!feedbackData?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No feedback yet</p>
          ) : (
            <div className="space-y-2">
              {feedbackData.map((f) => (
                <div key={f.id} className="flex items-start gap-2 rounded-md border p-2.5">
                  <div className="flex gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-3.5 w-3.5 ${star <= f.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{f.customer_name}</p>
                    {f.comment && <p className="text-xs text-muted-foreground mt-0.5">{f.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
