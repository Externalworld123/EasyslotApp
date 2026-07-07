import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { subDays, format, parseISO, getHours } from "date-fns";

const COLORS = [
  "hsl(217, 91%, 53%)", // primary
  "hsl(160, 84%, 39%)", // success
  "hsl(38, 92%, 50%)",  // warning
  "hsl(0, 84%, 60%)",   // destructive
  "hsl(224, 76%, 40%)", // secondary
  "hsl(280, 70%, 55%)",
];

export function AnalyticsDashboard() {
  const { centerId } = useAuth();
  const { format: formatCurrency } = useCurrency();

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["analytics-sessions", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, resource_id, start_time, duration_minutes, final_amount, status, resources!inner(name)")
        .eq("center_id", centerId)
        .eq("status", "completed")
        .gte("start_time", thirtyDaysAgo)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
    staleTime: 60_000,
  });

  // Revenue by day (last 30 days)
  const revenueByDay = useMemo(() => {
    if (!sessions) return [];
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const day = format(parseISO(s.start_time), "MMM d");
      map.set(day, (map.get(day) ?? 0) + Number(s.final_amount));
    });
    return Array.from(map, ([day, revenue]) => ({ day, revenue }));
  }, [sessions]);

  // Top resources by sessions
  const topResources = useMemo(() => {
    if (!sessions) return [];
    const map = new Map<string, { count: number; revenue: number }>();
    sessions.forEach((s: any) => {
      const name = s.resources?.name ?? "Unknown";
      const prev = map.get(name) ?? { count: 0, revenue: 0 };
      map.set(name, { count: prev.count + 1, revenue: prev.revenue + Number(s.final_amount) });
    });
    return Array.from(map, ([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [sessions]);

  // Peak hours
  const peakHours = useMemo(() => {
    if (!sessions) return [];
    const hourMap = new Array(24).fill(0);
    sessions.forEach((s) => {
      const hour = getHours(parseISO(s.start_time));
      hourMap[hour]++;
    });
    return hourMap.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      sessions: count,
    }));
  }, [sessions]);

  // Revenue per resource
  const revenuePerResource = useMemo(() => {
    return topResources.map((r) => ({ name: r.name, value: r.revenue }));
  }, [topResources]);

  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Revenue Trend */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue Trend (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="hsl(217, 91%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Peak Hours */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Peak Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="sessions" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by Resource (Pie) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue by Resource</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={revenuePerResource}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name }) => name}
              >
                {revenuePerResource.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Resources Table */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Resources (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topResources.map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 rounded-lg border p-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                >
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.count} sessions · {formatCurrency(r.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
