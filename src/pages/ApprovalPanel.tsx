import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { approveRequest, rejectRequest } from "@/lib/approvalService";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type ApprovalStatus = "pending" | "approved" | "rejected";

const STATUS_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Approved", className: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const ApprovalPanel = () => {
  const { centerId, user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("approvals")
        .select("*, sessions!inner(customer_name, resource_id, resources!inner(name))")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("center_id", centerId);
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) ?? []);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRequest(id, user!.id),
    onSuccess: () => {
      toast.success("Approval granted");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectRequest(id, user!.id),
    onSuccess: () => {
      toast.success("Request rejected");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pendingItems = approvals?.filter(a => a.status === "pending") ?? [];
  const displayItems = tab === "pending" ? pendingItems : (approvals ?? []);
  const pendingCount = pendingItems.length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
          <p className="text-sm text-muted-foreground">Review and manage discount approval requests</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-warning/15 text-warning border-warning/30 text-sm px-3 py-1">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            {pendingCount} pending
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all")}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-1.5" />Pending
          </TabsTrigger>
          <TabsTrigger value="all">All Requests</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tab === "pending" ? "Pending Approvals" : "All Approval Requests"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-center">Discount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      {tab === "pending" && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tab === "pending" ? 8 : 7} className="text-center text-muted-foreground py-8">
                          No {tab === "pending" ? "pending " : ""}approval requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayItems.map((item) => {
                        const badge = STATUS_BADGE[item.status as ApprovalStatus];
                        const session = item.sessions as any;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{session?.customer_name ?? "—"}</TableCell>
                            <TableCell>{session?.resources?.name ?? "—"}</TableCell>
                            <TableCell className="text-center font-semibold">{item.discount_percent}%</TableCell>
                            <TableCell className="text-muted-foreground">{item.reason || "—"}</TableCell>
                            <TableCell>{profileMap.get(item.requested_by) || "Unknown"}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(parseISO(item.created_at), "MMM d, h:mm a")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                            </TableCell>
                            {tab === "pending" && (
                              <TableCell className="text-right">
                                {item.status === "pending" && (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-success border-success/30 hover:bg-success/10"
                                      onClick={() => approveMutation.mutate(item.id)}
                                      disabled={approveMutation.isPending}
                                    >
                                      {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                      onClick={() => rejectMutation.mutate(item.id)}
                                      disabled={rejectMutation.isPending}
                                    >
                                      {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalPanel;
