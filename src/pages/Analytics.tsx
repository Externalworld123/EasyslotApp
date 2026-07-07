import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Resource utilization and revenue insights</p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
