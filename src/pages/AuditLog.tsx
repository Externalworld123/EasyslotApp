import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollText } from "lucide-react";
import { format, parseISO } from "date-fns";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-success/15 text-success border-success/30",
  update: "bg-primary/15 text-primary border-primary/30",
  delete: "bg-destructive/15 text-destructive border-destructive/30",
  start_session: "bg-success/15 text-success border-success/30",
  end_session: "bg-warning/15 text-warning border-warning/30",
};

export default function AuditLog() {
  const { centerId } = useAuth();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Track all system actions</p>
      </div>

      {!logs?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ScrollText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No audit logs yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(parseISO(log.created_at), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action] ?? ""} variant="outline">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.entity_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.metadata && typeof log.metadata === "object"
                        ? JSON.stringify(log.metadata)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
