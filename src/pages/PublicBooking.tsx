import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Clock, MapPin, Tv2, Loader2, CheckCircle2, CalendarDays } from "lucide-react";
import { getResourceTypeLabel, SPORT_TYPES } from "@/lib/resourceTypes";
import { format, startOfDay, endOfDay, addHours, parseISO } from "date-fns";
import { toast } from "sonner";

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [duration, setDuration] = useState("60");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);

  // Fetch center by slug (via organization slug)
  const { data: center, isLoading: centerLoading } = useQuery({
    queryKey: ["public-center", slug],
    queryFn: async () => {
      if (!slug) return null;
      // Find organization by slug, then get its first center
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (orgErr || !org) return null;

      const { data: centers, error: cErr } = await supabase
        .from("centers")
        .select("id, name, address, phone, email, is_active, organization_id, slug, city, image_url, latitude, longitude, area")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .limit(1);

      if (cErr || !centers?.length) return null;
      return { ...centers[0], org_name: org.name };
    },
    enabled: !!slug,
  });

  // Fetch resources for center
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ["public-resources", center?.id],
    queryFn: async () => {
      if (!center?.id) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("center_id", center.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!center?.id,
  });

  // Fetch sessions for selected date to show availability
  const { data: existingSessions } = useQuery({
    queryKey: ["public-sessions", center?.id, selectedDate?.toDateString()],
    queryFn: async () => {
      if (!center?.id || !selectedDate) return [];
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .select("resource_id, start_time, end_time, duration_minutes, status")
        .eq("center_id", center.id)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .in("status", ["active", "scheduled", "completed"]);
      if (error) throw error;
      return data;
    },
    enabled: !!center?.id && !!selectedDate,
  });


  const filteredPublicResources = sportFilter
    ? resources?.filter((r) => r.type === sportFilter)
    : resources;

  const selectedResourceData = resources?.find((r) => r.id === selectedResource);

  // Generate available time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 6; h < 23; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        slots.push(time);
      }
    }
    return slots;
  }, []);

  const isSlotBooked = (time: string) => {
    if (!selectedResource || !existingSessions) return false;
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(selectedDate);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = addHours(slotStart, parseInt(duration) / 60);

    return existingSessions.some((s) => {
      if (s.resource_id !== selectedResource) return false;
      const sStart = new Date(s.start_time);
      const sEnd = s.end_time
        ? new Date(s.end_time)
        : addHours(sStart, (s.duration_minutes || 60) / 60);
      return slotStart < sEnd && slotEnd > sStart;
    });
  };

  const estimatedCost = selectedResourceData
    ? (selectedResourceData.hourly_rate * parseInt(duration)) / 60
    : 0;

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!center || !selectedResource || !selectedTime || !customerName) {
        throw new Error("Please fill all required fields");
      }
      const [h, m] = selectedTime.split(":").map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(h, m, 0, 0);

      // Generate a QR code value
      const qrCode = crypto.randomUUID();

      const { data, error } = await supabase.functions.invoke("public-booking", {
        body: {
          center_id: center.id,
          resource_id: selectedResource,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          start_time: startTime.toISOString(),
          duration_minutes: parseInt(duration),
          base_amount: estimatedCost,
          final_amount: estimatedCost,
        },
      });

      if (error) throw new Error(error.message || "Booking failed");
      return { qrCode: data?.qr_code };
    },
    onSuccess: () => {
      setBookingComplete(true);
      setShowConfirm(false);
      toast.success("Booking confirmed!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (centerLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!center) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Center Not Found</h1>
        <p className="text-muted-foreground">
          The booking page you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  if (bookingComplete) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6 p-4">
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="text-2xl font-bold text-foreground">Booking Confirmed!</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Your session at {center.name} has been scheduled for{" "}
          {format(selectedDate, "MMMM d, yyyy")} at {selectedTime}.
        </p>
        <Button onClick={() => { setBookingComplete(false); setSelectedResource(null); setCustomerName(""); setCustomerPhone(""); }}>
          Book Another
        </Button>
      </div>
    );
  }

  // SEO meta tags
  const pageTitle = `Book at ${center.org_name || center.name} | EasySlot`;
  if (typeof document !== "undefined") {
    document.title = pageTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", `Book sports courts and sessions at ${center.name}. Easy online booking with instant confirmation.`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container max-w-5xl py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{center.org_name || center.name}</h1>
              <p className="text-sm text-muted-foreground">{center.address || "Book your session"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-8 space-y-8">
        {/* Step 1: Select Resource */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">1</Badge>
            Select a Resource
          </h2>
          {resourcesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resources?.map((r) => (
                <Card
                  key={r.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedResource === r.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  }`}
                  onClick={() => setSelectedResource(r.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{r.name}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{r.type}</p>
                      </div>
                      <Tv2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-lg font-bold text-primary">
                      ₹{r.hourly_rate}/hr
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Step 2: Pick Date & Time */}
        {selectedResource && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">2</Badge>
              Choose Date & Time
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    disabled={(d) => d < startOfDay(new Date())}
                    className="pointer-events-auto"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {format(selectedDate, "EEEE, MMMM d")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Available Times</Label>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {timeSlots.map((time) => {
                        const booked = isSlotBooked(time);
                        return (
                          <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            disabled={booked}
                            onClick={() => setSelectedTime(time)}
                          >
                            {time}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* Step 3: Customer Details */}
        {selectedResource && selectedTime && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">3</Badge>
              Your Details
            </h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your name"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone number"
                      maxLength={20}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h3 className="font-semibold text-foreground">Booking Summary</h3>
                  <div className="grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Court</span>
                      <span>{selectedResourceData?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{format(selectedDate, "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span>{selectedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{duration} min</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground pt-2 border-t">
                      <span>Estimated Total</span>
                      <span>₹{estimatedCost}</span>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!customerName.trim()}
                  onClick={() => setShowConfirm(true)}
                >
                  Confirm Booking
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Booking</DialogTitle>
            <DialogDescription>
              {selectedResourceData?.name} • {format(selectedDate, "MMM d")} at {selectedTime} • {duration}min
            </DialogDescription>
          </DialogHeader>
          <p className="text-center text-2xl font-bold text-foreground">₹{estimatedCost}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={() => bookingMutation.mutate()} disabled={bookingMutation.isPending}>
              {bookingMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Book Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
