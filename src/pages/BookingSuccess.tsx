import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, MapPin, Clock, Calendar, User, Phone, ArrowLeft, CreditCard } from "lucide-react";
import ShareBookingButton from "@/components/ShareBookingButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookingSuccess() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-detail", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("my-bookings", {
        body: { action: "detail", session_id: sessionId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-14 w-14 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-40 w-40 mx-auto" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8 space-y-4">
            <p className="text-lg font-medium text-foreground">Booking not found</p>
            <Button onClick={() => navigate("/book")}>Browse Courts</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    active: "bg-green-500/15 text-green-700 border-green-500/30",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/book")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground">Back to booking</span>
        </div>

        {/* Success Banner */}
        <div className="text-center space-y-2 py-4">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/15 mx-auto">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Booking Confirmed!</h1>
          <p className="text-sm text-muted-foreground">Your slot has been reserved successfully</p>
        </div>

        {/* QR Code */}
        {booking.qr_code && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <div className="bg-card rounded-xl p-5 inline-block border border-border">
                <QRCodeSVG value={booking.qr_code} size={180} level="M" includeMargin />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Show this QR at the sports center
              </p>
            </CardContent>
          </Card>
        )}

        {/* Booking Details */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Booking Details</h2>
              <Badge className={statusColor[booking.status] || "bg-muted"}>
                {booking.status}
              </Badge>
            </div>

            <div className="space-y-3">
              <DetailRow icon={User} label="Name" value={booking.customer_name} />
              <DetailRow icon={Phone} label="Phone" value={booking.customer_phone || booking.phone || "—"} />
              <DetailRow icon={MapPin} label="Court" value={booking.resources?.name || "—"} />
              <DetailRow icon={MapPin} label="Venue" value={booking.centers?.name || "—"} />
              <DetailRow icon={Calendar} label="Date" value={booking.start_time ? format(new Date(booking.start_time), "EEE, MMM d, yyyy") : "—"} />
              <DetailRow icon={Clock} label="Time" value={booking.start_time ? format(new Date(booking.start_time), "h:mm a") : "—"} />
              <DetailRow icon={Clock} label="Duration" value={booking.duration_minutes ? `${booking.duration_minutes} min` : "—"} />
              <DetailRow icon={CreditCard} label="Amount" value={`₹${Number(booking.final_amount || 0).toFixed(0)}`} />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <ShareBookingButton
            booking={{
              customerName: booking.customer_name,
              customerPhone: booking.customer_phone || booking.phone,
              resourceName: booking.resources?.name || "Court",
              centerName: booking.centers?.name,
              startTime: booking.start_time,
              durationMinutes: booking.duration_minutes,
              amount: booking.final_amount,
            }}
            variant="button"
            className="w-full h-12"
          />
          <Button className="w-full h-12" onClick={() => navigate("/my-bookings")}>
            View My Bookings
          </Button>
          <Button variant="outline" className="w-full h-12" onClick={() => navigate("/book")}>
            Book Another Slot
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
