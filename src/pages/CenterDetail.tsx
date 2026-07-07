import { useState, useMemo, useEffect, useCallback } from "react";
import { useSeo } from "@/hooks/useSeo";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft, Heart, Share2, MapPin, Clock, Star, Users,
  Navigation, Calendar as CalIcon, Wifi, Car, Droplets,
  Armchair, Coffee, ChevronRight, Trophy, Ticket, ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PublicSlotGrid, { type AvailabilitySlot } from "@/components/public/PublicSlotGrid";
import PublicBookingDrawer from "@/components/public/PublicBookingDrawer";
import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";
import { buildVenueUrl } from "@/lib/venueUrl";
import type { MonthlyPlan } from "@/hooks/useMonthlyPlans";

/* ── Icon maps ── */
const SPORT_ICONS: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", cricket: "🏏", football: "⚽",
  basketball: "🏀", swimming: "🏊", table_tennis: "🏓", squash: "🎯", volleyball: "🏐",
};
const SPORT_LABELS: Record<string, string> = {
  badminton: "Badminton", tennis: "Tennis", cricket: "Cricket", football: "Football",
  basketball: "Basketball", swimming: "Swimming", table_tennis: "Table Tennis",
  squash: "Squash", volleyball: "Volleyball",
};
const AMENITY_ICONS = [
  { key: "parking", label: "Parking", icon: Car },
  { key: "washroom", label: "Washroom", icon: Droplets },
  { key: "seating", label: "Sitting Area", icon: Armchair },
  { key: "refreshments", label: "Refreshments", icon: Coffee },
  { key: "wifi", label: "Wi-Fi", icon: Wifi },
];

const HERO_GRADIENTS = [
  "from-primary via-primary/90 to-secondary",
  "from-emerald-600 via-emerald-500 to-teal-400",
  "from-violet-600 via-purple-500 to-indigo-400",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CenterDetail() {
  const { centerId } = useParams<{ centerId: string }>();
  const isValidId = !!centerId && UUID_RE.test(centerId);
  const navigate = useNavigate();
  const dateStorageKey = centerId ? `easyslot_center_date_${centerId}` : "";
  const [selectedDate, setSelectedDateState] = useState<Date>(() => {
    try {
      if (!dateStorageKey) return new Date();
      const stored = sessionStorage.getItem(dateStorageKey);
      if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime()) && d >= startOfDay(new Date())) return d;
      }
    } catch {}
    return new Date();
  });
  const setSelectedDate = useCallback((d: Date) => {
    setSelectedDateState(d);
    try {
      if (dateStorageKey) sessionStorage.setItem(dateStorageKey, d.toISOString());
    } catch {}
  }, [dateStorageKey]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedSlot, setSelectedSlot] = useState<{
    resourceId: string; resourceName: string; centerId: string; time: string; hourlyRate: number;
  } | null>(null);

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onEmblaSelect);
    return () => { emblaApi.off("select", onEmblaSelect); };
  }, [emblaApi, onEmblaSelect]);

  // Fetch all center data via public edge function (no auth needed)
  const { data: centerData, isLoading: centerLoading } = useQuery({
    queryKey: ["public-center-detail", centerId],
    queryFn: async () => {
      if (!centerId || !isValidId) return null;
      const { data, error } = await supabase.functions.invoke("public-discover", {
        body: { action: "center_detail", center_id: centerId },
      });
      if (error) throw error;
      return data as {
        center: { id: string; name: string; address: string | null; phone: string | null; email: string | null; is_active: boolean; slug: string | null; city: string | null };
        resources: { id: string; name: string; type: string; hourly_rate: number; pricing_type: string | null; capacity: number | null; image_url: string | null }[];
        totalGames: number;
        rating: { avg: number; count: number } | null;
      } | null;
    },
    enabled: isValidId,
  });

  const center = centerData?.center ?? null;
  const resources = centerData?.resources ?? [];
  const totalGames = centerData?.totalGames ?? 0;
  const avgRating = centerData?.rating ?? null;

  // Fetch sessions for slot grid
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["public-center-sessions", centerId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!centerId) return [];
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();
      const { data, error } = await supabase.functions.invoke("public-discover", {
        body: {
          action: "sessions",
          center_id: centerId,
          date: format(selectedDate, "yyyy-MM-dd"),
          day_start: dayStart,
          day_end: dayEnd,
        },
      });
      if (error) throw error;
      return data || [];
    },
    enabled: isValidId,
    refetchInterval: 15_000,
  });

  const { data: availability } = useQuery({
    queryKey: ["public-center-availability", centerId],
    queryFn: async () => {
      if (!centerId || !isValidId) return [];
      const { data, error } = await supabase.functions.invoke("public-discover", {
        body: { action: "availability", center_id: centerId },
      });
      if (error) throw error;
      return (data || []) as AvailabilitySlot[];
    },
    enabled: isValidId,
    staleTime: 0,
  });

  useAvailabilityRealtime({
    enabled: !!centerId && isValidId,
    queryKeys: [["public-center-availability", centerId]],
  });

  const { data: monthlyPlans } = useQuery({
    queryKey: ["public-center-monthly-plans", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("monthly_plans")
        .select("id, resource_id, center_id, start_date, end_date, slot_time, duration_minutes, days_of_week, is_active, plan_type")
        .eq("center_id", centerId)
        .eq("is_active", true);
      if (error) return [];
      return (data ?? []) as MonthlyPlan[];
    },
    enabled: isValidId,
  });

  // Redirect legacy UUID URL to canonical SEO slug URL when available.
  // This keeps shared/old links working while consolidating SEO signals
  // on /:city/venue/:slug (matches sitemap canonical).
  useEffect(() => {
    if (!center?.slug) return;
    const canonical = buildVenueUrl(center);
    if (canonical && canonical !== window.location.pathname) {
      navigate(canonical, { replace: true });
    }
  }, [center, navigate]);

  // SEO via useSeo hook — point canonical at the slug URL when available
  // so Google de-duplicates the legacy /easyslot-booking/center/:id route.
  const seoCanonical = center?.slug ? buildVenueUrl(center) : `/easyslot-booking/center/${centerId}`;
  useSeo({
    title: center ? `${center.name} - Book Sports Courts | EasySlot` : "Loading… | EasySlot",
    description: center ? `Book sports courts at ${center.name}. Instant online booking with UPI payments on EasySlot.` : undefined,
    canonical: seoCanonical,
    noindex: !center,
  });

  const sportTypes = useMemo(() => {
    const types = new Set<string>();
    resources?.forEach((r) => types.add(r.type));
    return Array.from(types);
  }, [resources]);

  const minRate = useMemo(() => {
    if (!resources?.length) return 0;
    return Math.min(...resources.map((r) => r.hourly_rate));
  }, [resources]);

  const totalCourts = resources?.length || 0;

  const heroImages = useMemo(() => {
    const imgs = (resources || [])
      .filter((r) => r.image_url)
      .map((r) => ({ url: r.image_url!, label: r.name }));
    return imgs.length > 0 ? imgs : [];
  }, [resources]);

  const dateChips = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      return {
        date: d,
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE"),
        sub: format(d, "d MMM"),
      };
    });
  }, []);

  const handleSlotClick = (resourceId: string, resourceName: string, cId: string, time: string, hourlyRate: number) => {
    setSelectedSlot({ resourceId, resourceName, centerId: cId, time, hourlyRate });
    setDrawerOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: center?.name, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  if (centerLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Skeleton className="h-52 w-full" />
        <div className="px-4 mt-4 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!center) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-4">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Center Not Found</h1>
        <p className="text-sm text-muted-foreground text-center">This venue doesn't exist or is no longer active.</p>
        <Button variant="outline" onClick={() => navigate("/book")}>Browse Venues</Button>
      </div>
    );
  }

  const ratingDisplay = avgRating ? avgRating.avg : 4.8;
  const ratingCount = avgRating ? avgRating.count : 0;
  const gradientClass = HERO_GRADIENTS[center.name.length % HERO_GRADIENTS.length];

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Hero Image Carousel ── */}
      <div className="relative h-64 sm:h-72 overflow-hidden bg-muted">
        {heroImages.length > 0 ? (
          <div ref={emblaRef} className="h-full overflow-hidden">
            <div className="flex h-full">
              {heroImages.map((img, i) => (
                <div key={i} className="relative flex-[0_0_100%] min-w-0 h-full">
                  <img
                    src={img.url}
                    alt={img.label}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                  {/* Court label */}
                  <div className="absolute bottom-12 left-4 bg-background/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
                    <span className="text-xs font-medium text-foreground">{img.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Fallback gradient when no images */
          <div className={cn("h-full bg-gradient-to-br", gradientClass)}>
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <ImageIcon className="h-20 w-20 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Top action bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center hover:bg-background/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="h-10 w-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center hover:bg-background/30 transition-colors"
            >
              <Heart className={cn("h-5 w-5", isFavorite ? "fill-destructive text-destructive" : "text-foreground")} />
            </button>
            <button
              onClick={handleShare}
              className="h-10 w-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center hover:bg-background/30 transition-colors"
            >
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Image counter + dots */}
        {heroImages.length > 1 && (
          <>
            <div className="absolute top-4 right-20 z-10 bg-background/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-medium text-foreground">
              {activeSlide + 1}/{heroImages.length}
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {heroImages.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all",
                    i === activeSlide
                      ? "h-1.5 w-6 bg-primary"
                      : "h-1.5 w-1.5 bg-foreground/40"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ── Center Info Card ── */}
      <div className="relative -mt-12 mx-4">
        <div className="bg-card rounded-2xl border border-border shadow-lg p-5 space-y-4">
          {/* Name & Rating */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground leading-tight">{center.name}</h1>
              {center.address && (
                <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{center.address}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 bg-success/10 rounded-xl px-2.5 py-1.5 shrink-0">
              <Star className="h-4 w-4 text-success fill-success" />
              <span className="text-sm font-bold text-success">{ratingDisplay}</span>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>6:00 AM – 11:00 PM</span>
            <span className="text-[10px] bg-success/10 text-success font-medium px-1.5 py-0.5 rounded-md">OPEN</span>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{totalCourts} court{totalCourts !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              <span>{totalGames || 0} games played</span>
            </div>
            {ratingCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5" />
                <span>{ratingCount} review{ratingCount !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Price + Directions */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 text-sm py-1">
              From ₹{minRate}/hr
            </Badge>
            {center.address && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(center.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                <Navigation className="h-4 w-4" />
                Show in Map
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Offers Section ── */}
      <section className="mt-6 px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Offers & Deals</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 p-3 text-white">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Ticket className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Limited Offer</span>
            </div>
            <p className="text-sm font-bold">Upto 5% OFF</p>
            <p className="text-[10px] opacity-80">On bookings above ₹500</p>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 p-3 text-primary-foreground">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Ticket className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">First Booking</span>
            </div>
            <p className="text-sm font-bold">₹50 OFF</p>
            <p className="text-[10px] opacity-80">Use code: EASYSLOT50</p>
          </div>
        </div>
      </section>

      {/* ── Rating & Stats ── */}
      <section className="mt-6 px-4">
        <div className="flex gap-3">
          <div className="flex-1 bg-card rounded-2xl border border-border p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span className="text-2xl font-bold text-foreground">{ratingDisplay}</span>
            </div>
            <p className="text-xs text-muted-foreground">{ratingCount > 0 ? `${ratingCount} ratings` : "New venue"}</p>
          </div>
          <div className="flex-1 bg-card rounded-2xl border border-border p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{totalGames || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">Games Played</p>
          </div>
        </div>
      </section>

      {/* ── Action Buttons ── */}
      <section className="mt-5 px-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl text-sm font-semibold gap-2"
            onClick={() => navigate(`/feedback/placeholder`)}
          >
            <Star className="h-4 w-4" /> Rate Venue
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl text-sm font-semibold gap-2"
            onClick={() => navigate("/my-bookings")}
          >
            <CalIcon className="h-4 w-4" /> My Bookings
          </Button>
        </div>
      </section>

      {/* ── Available Sports ── */}
      <section className="mt-6 px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Available Sports</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {sportTypes.map((type) => (
            <div
              key={type}
              className="flex flex-col items-center gap-2 min-w-[80px] py-4 px-3 rounded-2xl bg-muted/50 border border-border"
            >
              <span className="text-3xl">{SPORT_ICONS[type] || "🎯"}</span>
              <span className="text-xs font-medium text-foreground text-center">
                {SPORT_LABELS[type] || type}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {resources?.filter((r) => r.type === type).length} court{resources?.filter((r) => r.type === type).length !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Amenities ── */}
      <section className="mt-6 px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Amenities</h2>
        <div className="flex flex-wrap gap-2">
          {AMENITY_ICONS.map(({ key, label, icon: Icon }) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border text-xs font-medium text-foreground"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </span>
          ))}
        </div>
      </section>

      <Separator className="my-6 mx-4" />

      {/* ── Date Selector ── */}
      <section className="px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Select Date & Time</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {dateChips.map((chip, i) => {
            const isActive = format(selectedDate, "yyyy-MM-dd") === format(chip.date, "yyyy-MM-dd");
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(chip.date)}
                className={cn(
                  "flex flex-col items-center min-w-[56px] py-2.5 px-3 rounded-xl text-center transition-all shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted/50 hover:bg-muted text-foreground border border-border"
                )}
              >
                <span className="text-[11px] font-bold">{chip.label}</span>
                <span className={cn("text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {chip.sub}
                </span>
              </button>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex flex-col items-center min-w-[56px] py-2.5 px-3 rounded-xl bg-muted/50 hover:bg-muted text-foreground border border-border transition-all shrink-0">
                <CalIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(d) => d < startOfDay(new Date())}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {/* ── Slot Grid ── */}
      <section className="mt-5 px-4" id="slot-grid-section">
        {resources && resources.length > 0 ? (
          <PublicSlotGrid
            resources={resources}
            sessions={sessions || []}
            date={selectedDate}
            onSlotClick={handleSlotClick}
            centerId={centerId!}
            availability={availability}
            monthlyPlans={monthlyPlans}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No courts available at this venue.</p>
          </div>
        )}
      </section>

      {/* ── Sticky Bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 safe-area-bottom">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">Starting from</span>
            <div className="text-lg font-bold text-primary">
              ₹{minRate}<span className="text-xs font-normal text-muted-foreground">/hr</span>
            </div>
          </div>
          <Button
            size="lg"
            className="h-12 px-8 rounded-xl text-sm font-bold shadow-lg"
            onClick={() => {
              const grid = document.getElementById("slot-grid-section");
              grid?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            BOOK NOW
          </Button>
        </div>
      </div>

      {/* ── Booking Drawer ── */}
      <PublicBookingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        slot={selectedSlot}
        date={selectedDate}
        onBooked={() => { setDrawerOpen(false); refetchSessions(); }}
      />
    </div>
  );
}
