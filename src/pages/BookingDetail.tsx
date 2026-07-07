import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, MapPin, Clock, Calendar, User, Phone, CreditCard, XCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

const PHONE_KEY = "easyslot_phone";

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const savedPhone = localStorage.getItem(PHONE_KEY) || "";

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("my-bookings", {
        body: { action: "detail", session_id: id },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    // Poll every 3s until payment is confirmed paid (or booking cancelled).
    refetchInterval: (query) => {
      const b: any = query.state.data;
      if (!b) return 3000;
      if (b.payment_status === "paid") return false;
      if (b.status === "cancelled") return false;
      return 3000;
    },
    refetchIntervalInBackground: false,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("my-bookings", {
        body: { action: "cancel", session_id: id, phone: savedPhone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Booking cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canCancel = booking?.status === "scheduled" && (() => {
    const startMs = new Date(booking.start_time).getTime();
    return startMs - Date.now() > 2 * 60 * 60 * 1000;
  })();

  const statusStyle: Record<string, string> = {
    scheduled: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    active: "bg-green-500/15 text-green-700 border-green-500/30",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md"><CardContent className="p-6 space-y-4">
          <Skeleton className="h-40 w-40 mx-auto" />
          <Skeleton className="h-24 w-full" />
        </CardContent></Card>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center"><CardContent className="p-8 space-y-4">
          <p className="font-medium text-foreground">Booking not found</p>
          <Button onClick={() => navigate("/my-bookings")}>My Bookings</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 space-y-5 pb-24">
        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/my-bookings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Booking Details</h1>
        </div>

        {/* Status */}
        <div className="text-center flex items-center justify-center gap-2">
          <Badge className={`text-sm px-4 py-1 ${statusStyle[booking.status] || "bg-muted"}`}>
            {booking.status}
          </Badge>
          <PaymentStatusBadge status={booking.payment_status || "pending"} size="default" />
        </div>

        {/* QR */}
        {booking.qr_code && booking.status !== "cancelled" && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <div className="bg-card rounded-xl p-5 inline-block border border-border">
                <QRCodeSVG value={booking.qr_code} size={180} level="M" includeMargin />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Show this QR at the sports center</p>
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold text-foreground">Details</h2>
            <Row icon={User} label="Name" value={booking.customer_name} />
            <Row icon={Phone} label="Phone" value={booking.customer_phone || booking.phone || "—"} />
            <Row icon={MapPin} label="Court" value={booking.resources?.name || "—"} />
            <Row icon={MapPin} label="Venue" value={booking.centers?.name || "—"} />
            {booking.centers?.address && (
              <Row icon={MapPin} label="Address" value={booking.centers.address} />
            )}
            <Row icon={Calendar} label="Date" value={booking.start_time ? format(new Date(booking.start_time), "EEE, MMM d, yyyy") : "—"} />
            <Row icon={Clock} label="Time" value={booking.start_time ? format(new Date(booking.start_time), "h:mm a") : "—"} />
            <Row icon={Clock} label="Duration" value={booking.duration_minutes ? `${booking.duration_minutes} min` : "—"} />
            <Row icon={CreditCard} label="Amount" value={`₹${Number(booking.final_amount || 0).toFixed(0)}`} />
          </CardContent>
        </Card>

        {/* Latest verified payment */}
        {booking.latest_payment && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Payment Receipt
                </h2>
                <PaymentStatusBadge
                  status={booking.latest_payment.status === "verified" ? "paid" : booking.latest_payment.status}
                  size="default"
                />
              </div>
              <Row
                icon={CreditCard}
                label="Method"
                value={booking.latest_payment.payment_method === "razorpay" ? "Razorpay" : booking.latest_payment.payment_method?.toUpperCase() || "—"}
              />
              <Row
                icon={CreditCard}
                label="Paid"
                value={`₹${Number(booking.latest_payment.amount || 0).toFixed(0)}`}
              />
              <Row
                icon={CreditCard}
                label="Ref ID"
                value={booking.latest_payment.utr_id || booking.latest_payment.transaction_id || "—"}
              />
              {booking.latest_payment.verified_at && (
                <Row
                  icon={Clock}
                  label="Verified"
                  value={format(new Date(booking.latest_payment.verified_at), "MMM d, yyyy h:mm a")}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Cancel */}
        {canCancel && (
          <Button
            variant="destructive"
            className="w-full h-12"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
