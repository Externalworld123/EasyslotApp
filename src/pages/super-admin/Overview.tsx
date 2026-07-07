import { format, parseISO } from "date-fns";
import { Globe, Building2, Tv2, Users, CalendarCheck, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrgs, useCenters, useRolesList, useTotals, LoadingSkeleton } from "./queries";

export default function Overview() {
  const { data: orgs, isLoading: orgsLoading } = useOrgs();
  const { data: centers } = useCenters();
  const { data: roles } = useRolesList();
  const { totalBookings, totalRevenue, totalCourts } = useTotals();

  const stats = [
    { label: "Organizations", value: orgs?.length ?? "—", icon: Globe, color: "text-primary", bg: "bg-primary/10" },
    { label: "Centers", value: centers?.filter((c) => c.is_active).length ?? "—", icon: Building2, color: "text-green-600", bg: "bg-green-500/10" },
    { label: "Active Courts", value: totalCourts.data ?? "—", icon: Tv2, color: "text-primary", bg: "bg-primary/10" },
    { label: "Users", value: roles?.length ?? "—", icon: Users, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Total Bookings", value: totalBookings.data ?? "—", icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Revenue", value: typeof totalRevenue.data === "number" ? `₹${totalRevenue.data.toLocaleString("en-IN")}` : "—", icon: DollarSign, color: "text-green-600", bg: "bg-green-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">Global platform metrics</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-foreground truncate">{s.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Organizations</h3>
        {orgsLoading ? <LoadingSkeleton /> : (
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs?.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{o.slug}</TableCell>
                    <TableCell><Badge variant="outline">{(o.plans as any)?.name ?? "Free"}</Badge></TableCell>
                    <TableCell><Badge variant={o.billing_status === "active" ? "default" : "secondary"}>{o.billing_status}</Badge></TableCell>
                    <TableCell><span className={`inline-flex h-2 w-2 rounded-full ${o.is_active ? "bg-green-500" : "bg-destructive"}`} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(parseISO(o.created_at), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
