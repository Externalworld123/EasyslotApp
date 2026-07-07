import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, XCircle, Clock, Search, CreditCard, Loader2, Filter,
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentHistory() {
  const { centerId } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "verify" | "reject" } | null>(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["public-payments", centerId, statusFilter],
    queryFn: async () => {
      if (!centerId) return [];
      let query = supabase
        .from("public_payments")
        .select("*")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ paymentId, action }: { paymentId: string; action: "verify" | "reject" }) => {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { payment_id: paymentId, action },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "verify" ? "Payment verified & customer notified" : "Payment rejected & customer notified");
      queryClient.invalidateQueries({ queryKey: ["public-payments"] });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmAction(null);
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50"><Clock className="h-3 w-3" />Pending</Badge>;
    }
  };

  const filtered = (payments ?? []).filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.customer_name?.toLowerCase().includes(s) ||
      p.customer_phone?.toLowerCase().includes(s) ||
      p.utr_id?.toLowerCase().includes(s) ||
      p.transaction_id?.toLowerCase().includes(s)
    );
  });

  const pendingCount = (payments ?? []).filter((p) => p.status === "pending").length;

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
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Payment History
        </h1>
        <p className="text-sm text-muted-foreground">
          Verify or reject UPI payments from public bookings
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{payments?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {(payments ?? []).filter((p) => p.status === "verified").length}
            </p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              ₹{(payments ?? []).filter((p) => p.status === "verified").reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Verified Amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, UTR or Txn ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-10">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Txn ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>UTR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.transaction_id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{p.customer_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{p.customer_phone || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">₹{Number(p.amount).toFixed(0)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.utr_id}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending" ? (
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs gap-1"
                              onClick={() => setConfirmAction({ id: p.id, action: "verify" })}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                              onClick={() => setConfirmAction({ id: p.id, action: "reject" })}
                            >
                              <XCircle className="h-3 w-3" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {p.verified_at ? format(new Date(p.verified_at), "MMM d, h:mm a") : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "verify" ? "Verify Payment?" : "Reject Payment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "verify"
                ? "This will mark the payment as verified and notify the customer via WhatsApp."
                : "This will reject the payment and notify the customer via WhatsApp."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  verifyMutation.mutate({ paymentId: confirmAction.id, action: confirmAction.action });
                }
              }}
              disabled={verifyMutation.isPending}
              className={confirmAction?.action === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {verifyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {confirmAction?.action === "verify" ? "Verify & Notify" : "Reject & Notify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
