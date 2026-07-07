import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, Calendar, Clock, MapPin, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const PHONE_KEY = "easyslot_phone";

export default function MyBookings() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_KEY) || "");
  const [searchPhone, setSearchPhone] = useState(() => localStorage.getItem(PHONE_KEY) || "");

  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ["my-bookings", searchPhone],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("my-bookings", {
        body: { action: "list", phone: searchPhone },
      });
      if (error) throw error;
      return data as any[];
    },
    enabled: searchPhone.length >= 5,
  });

  const handleSearch = () => {
    const clean = phone.replace(/\s+/g, "").trim();
    if (clean.length >= 5) {
      localStorage.setItem(PHONE_KEY, clean);
      setSearchPhone(clean);
    }
  };

  useEffect(() => {
    if (searchPhone.length >= 5) refetch();
  }, [searchPhone]);

  const statusStyle: Record<string, string> = {
    scheduled: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    active: "bg-green-500/15 text-green-700 border-green-500/30",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
    no_show: "bg-orange-500/15 text-orange-700",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/easyslot-booking")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Bookings</h1>
            <p className="text-xs text-muted-foreground">View and manage your bookings</p>
          </div>
        </div>

        {/* Phone Search */}
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Enter your phone to view bookings
            </label>
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                type="tel"
                className="h-12 text-base"
                maxLength={15}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button size="lg" className="h-12 px-6" onClick={handleSearch} disabled={phone.trim().length < 5}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && searchPhone && bookings?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium text-foreground">No bookings yet</p>
              <p className="text-sm text-muted-foreground">Book your first slot to see it here</p>
              <Button onClick={() => navigate("/easyslot-booking")}>Browse Courts</Button>
            </CardContent>
          </Card>
        )}

        {/* No search yet */}
        {!searchPhone && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Search className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium text-foreground">Enter your phone number</p>
              <p className="text-sm text-muted-foreground">We'll show all bookings linked to your number</p>
            </CardContent>
          </Card>
        )}

        {/* Bookings List */}
        {bookings && bookings.length > 0 && (
          <div className="space-y-3">
            {bookings.map((b: any) => (
              <Card
                key={b.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/booking/${b.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {b.resources?.name || "Court"}
                        </span>
                        <Badge className={`text-xs shrink-0 ${statusStyle[b.status] || "bg-muted"}`}>
                          {b.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{b.centers?.name || "—"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {b.start_time ? format(new Date(b.start_time), "MMM d, yyyy") : "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {b.start_time ? format(new Date(b.start_time), "h:mm a") : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-foreground">
                        ₹{Number(b.final_amount || 0).toFixed(0)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
