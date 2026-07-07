import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, DollarSign, Clock, Tv2 } from "lucide-react";
import { getResourceTypeLabel } from "@/lib/resourceTypes";
import { useCurrency } from "@/hooks/useCurrency";
import { AvailabilityEditor } from "@/components/resources/AvailabilityEditor";
import { format, parseISO } from "date-fns";
import type { Resource } from "@/hooks/useResources";

const PRICING_LABELS: Record<string, string> = {
  hourly: "Per Hour",
  daily: "Per Day",
  per_person: "Per Person",
  per_session: "Per Session",
};

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { centerId } = useAuth();
  const { symbol } = useCurrency();

  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Resource;
    },
    enabled: !!id,
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ["resource-upcoming", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, start_time, end_time, status")
        .eq("resource_id", id!)
        .in("status", ["active", "scheduled"])
        .order("start_time")
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  if (!resource) return <p className="text-muted-foreground">Resource not found.</p>;

  const statusBadge = resource.status === "active"
    ? "default"
    : resource.status === "maintenance"
    ? "outline"
    : "secondary";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            {resource.image_url && (
              <div className="h-48 w-full bg-muted">
                <img src={resource.image_url} alt={resource.name} className="w-full h-full object-cover" />
              </div>
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{resource.name}</CardTitle>
                <Badge variant={statusBadge}>{resource.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Tv2 className="h-4 w-4 text-muted-foreground" />
                <span>{getResourceTypeLabel(resource.type)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Capacity: {resource.capacity}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{symbol}{resource.hourly_rate} {PRICING_LABELS[resource.pricing_type] ?? resource.pricing_type}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{resource.is_active ? "Active" : "Inactive"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {!upcomingSessions?.length ? (
                <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingSessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{s.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(s.start_time), "MMM d, h:mm a")}</p>
                      </div>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Availability */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <AvailabilityEditor resourceId={resource.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
