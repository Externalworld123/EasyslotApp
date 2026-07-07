import { useState, useMemo, useEffect, useCallback } from "react";
import { useSeo } from "@/hooks/useSeo";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft, Heart, Share2, MapPin, Clock, Star, Users,
  Navigation, Calendar as CalIcon, Wifi, Car, Droplets,
  Armchair, Coffee, Trophy, Ticket, ImageIcon, Phone,
  ChevronDown, ChevronUp, MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PublicSlotGrid from "@/components/public/PublicSlotGrid";
import { SeoLinkMatrix } from "@/components/public/SeoContentBlock";
import PublicBookingDrawer from "@/components/public/PublicBookingDrawer";
import type { AvailabilitySlot } from "@/components/public/PublicSlotGrid";
import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";
import type { MonthlyPlan } from "@/hooks/useMonthlyPlans";

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

const FAQ_ITEMS = [
  { q: "How do I book a court?", a: "Select your preferred date, pick an available time slot from the grid, fill in your details, and confirm. You'll receive a booking confirmation instantly." },
  { q: "What payment methods are accepted?", a: "We accept UPI payments. A UPI payment link is generated after booking confirmation for quick and secure payment." },
  { q: "Can I cancel or reschedule?", a: "Yes, cancellations are allowed based on the venue's cancellation policy. Check the specific policy before booking." },
  { q: "Is there a minimum booking duration?", a: "The minimum booking duration is typically 1 hour, but it may vary by sport and venue." },
];

export default function VenuePage() {
  const { slug } = useParams<{ slug: string }>();
  const isValidSlug = !!slug && slug !== ":slug" && slug.length > 1;
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFavorite, setIsFavorite] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    resourceId: string; resourceName: string; centerId: string; time: string; hourlyRate: number;
  } | null>(null);
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());

  const toggleSport = (type: string) => {
    setSelectedSports(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onEmblaSelect);
    return () => { emblaApi.off("select", onEmblaSelect); };
  }, [emblaApi, onEmblaSelect]);

  // Fetch center data by slug
  const { data: centerData, isLoading } = useQuery({
    queryKey: ["venue-seo", slug],
    queryFn: async () => {
      if (!isValidSlug) return null;
      const { data, error } = await supabase.functions.invoke("public-discover", {
        body: { action: "center_by_slug", slug },
      });
      if (error) throw error;
      return data as {
        center: { id: string; name: string; address: string | null; phone: string | null; email: string | null; slug: string | null; city: string | null };
        resources: { id: string; name: string; type: string; hourly_rate: number; pricing_type: string | null; capacity: number | null; image_url: string | null }[];
        totalGames: number;
        rating: { avg: number; count: number } | null;
        reviews: { rating: number; comment: string | null; customer_name: string; created_at: string }[];
      } | null;
    },
    enabled: isValidSlug,
  });

  const center = centerData?.center;
  const resources = centerData?.resources ?? [];
  const totalGames = centerData?.totalGames ?? 0;
  const avgRating = centerData?.rating;
  const reviews = centerData?.reviews ?? [];

  // Fetch sessions
  const { data: sessions } = useQuery({
    queryKey: ["venue-sessions", center?.id, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!center?.id) return [];
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();
      const { data } = await supabase.functions.invoke("public-discover", {
        body: {
          action: "sessions",
          center_id: center.id,
          date: format(selectedDate, "yyyy-MM-dd"),
          day_start: dayStart,
          day_end: dayEnd,
        },
      });
      return data || [];
    },
    enabled: !!center?.id,
    refetchInterval: 15_000,
  });

  // Fetch availability
  const { data: availability } = useQuery({
    queryKey: ["venue-availability", center?.id],
    queryFn: async () => {
      if (!center?.id) return [];
      const { data } = await supabase.functions.invoke("public-discover", {
        body: { action: "availability", center_id: center.id },
      });
      return (data || []) as AvailabilitySlot[];
    },
    enabled: !!center?.id,
    staleTime: 0,
  });

  useAvailabilityRealtime({
    enabled: !!center?.id,
    queryKeys: [["venue-availability", center?.id]],
  });

  // Realtime: refresh sessions + monthly plans for live slot availability
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!center?.id) return;
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const channel = supabase
      .channel(`venue-slots-${center.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `center_id=eq.${center.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["venue-sessions", center.id, dateKey] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monthly_plans", filter: `center_id=eq.${center.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["venue-monthly-plans", center.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [center?.id, selectedDate, queryClient]);

  // Fetch monthly plans for public view
  const { data: monthlyPlans } = useQuery({
    queryKey: ["venue-monthly-plans", center?.id],
    queryFn: async () => {
      if (!center?.id) return [];
      const { data, error } = await supabase
        .from("monthly_plans")
        .select("id, resource_id, center_id, start_date, end_date, slot_time, duration_minutes, days_of_week, is_active, plan_type")
        .eq("center_id", center.id)
        .eq("is_active", true);
      if (error) return [];
      return (data ?? []) as MonthlyPlan[];
    },
    enabled: !!center?.id,
  });

  // SEO via useSeo hook (per-route title/description/canonical + JSON-LD)
  const seoMeta = useMemo(() => {
    if (!center) return null;
    const city = center.city || "";
    const sports = [...new Set(resources.map(r => SPORT_LABELS[r.type] || r.type))].join(", ");
    const title = `${center.name}${city ? ` - ${city}` : ""} | Book ${sports} Courts Online | EasySlot`;
    const minRate = resources.length ? Math.min(...resources.map(r => r.hourly_rate)) : 0;
    const maxRate = resources.length ? Math.max(...resources.map(r => r.hourly_rate)) : 0;
    const description = `Book sports courts at ${center.name}${city ? ` in ${city}` : ""}. ${sports} available. Instant online booking, UPI payments. ${resources.length} courts from ₹${minRate}/hr.`;
    const citySlug = center.city ? center.city.toLowerCase().replace(/\s+/g, "-") : null;
    const canonical = citySlug ? `/${citySlug}/venue/${center.slug || slug}` : `/venue/${center.slug || slug}`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: center.name,
      address: center.address ? { "@type": "PostalAddress", streetAddress: center.address, addressLocality: city } : undefined,
      telephone: center.phone,
      url: `https://www.easyslot.co.in${canonical}`,
      aggregateRating: avgRating ? { "@type": "AggregateRating", ratingValue: avgRating.avg, reviewCount: avgRating.count } : undefined,
      priceRange: minRate ? `₹${minRate} - ₹${maxRate}` : undefined,
    };
    return { title, description, canonical, jsonLd };
  }, [center, resources, avgRating, slug]);
  useSeo(seoMeta || { title: "Loading… | EasySlot", noindex: true });

  const sportTypes = useMemo(() => [...new Set(resources.map(r => r.type))], [resources]);
  const minRate = useMemo(() => resources.length ? Math.min(...resources.map(r => r.hourly_rate)) : 0, [resources]);

  const heroImages = useMemo(() => {
    return resources.filter(r => r.image_url).map(r => ({ url: r.image_url!, label: r.name }));
  }, [resources]);

  const dateChips = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      return { date: d, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE"), sub: format(d, "d MMM") };
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Skeleton className="h-64 w-full" />
        <div className="px-4 mt-4 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full mt-4" />
        </div>
      </div>
    );
  }

  if (!center) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-4">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Venue Not Found</h1>
        <p className="text-sm text-muted-foreground text-center">This venue doesn't exist or is no longer active.</p>
        <Button variant="outline" onClick={() => navigate("/easyslot-booking")}>Browse Venues</Button>
      </div>
    );
  }

  const ratingDisplay = avgRating ? avgRating.avg : 4.8;
  const ratingCount = avgRating ? avgRating.count : 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Hero Image Carousel */}
      <div className="relative h-64 sm:h-80 overflow-hidden bg-muted">
        {heroImages.length > 0 ? (
          <div ref={emblaRef} className="h-full overflow-hidden">
            <div className="flex h-full">
              {heroImages.map((img, i) => (
                <div key={i} className="relative flex-[0_0_100%] min-w-0 h-full">
                  <img src={img.url} alt={`${center.name} - ${img.label}`} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                  <div className="absolute bottom-12 left-4 bg-background/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
                    <span className="text-xs font-medium text-foreground">{img.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full bg-gradient-to-br from-primary via-primary/90 to-secondary">
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <ImageIcon className="h-20 w-20 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Top action bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center hover:bg-background/30 transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex gap-2">
            <button onClick={() => setIsFavorite(!isFavorite)} className="h-10 w-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center hover:bg-background/30 transition-colors">
              <Heart className={cn("h-5 w-5", isFavorite ? "fill-destructive text-destructive" : "text-foreground")} />
            </button>
            <button onClick={handleShare} className="h-10 w-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center hover:bg-background/30 transition-colors">
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>

        {heroImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {heroImages.map((_, i) => (
              <div key={i} className={cn("rounded-full transition-all", i === activeSlide ? "h-1.5 w-6 bg-primary" : "h-1.5 w-1.5 bg-foreground/40")} />
            ))}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Center Info Card */}
      <div className="relative -mt-12 mx-4">
        <div className="bg-card rounded-2xl border border-border shadow-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground leading-tight">{center.name}</h1>
              {center.city && <p className="text-xs font-medium text-primary mt-0.5">{center.city}</p>}
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

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {resources.length} court{resources.length !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> {totalGames} games</span>
            {ratingCount > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {ratingCount} reviews</span>}
          </div>

          {/* Price + Contact */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 text-sm py-1">
              From ₹{minRate}/hr
            </Badge>
            <div className="flex gap-2">
              {center.phone && (
                <a href={`tel:${center.phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors">
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
              {center.address && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(center.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                  <Navigation className="h-4 w-4" /> Directions
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Amenities */}
      <section className="mt-6 px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Amenities</h2>
        <div className="flex flex-wrap gap-2">
          {AMENITY_ICONS.map(({ key, label, icon: Icon }) => (
            <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border text-xs font-medium text-foreground">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
            </span>
          ))}
        </div>
      </section>

      {/* Available Sports — filter chips */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Available Sports</h2>
          {selectedSports.size > 0 && (
            <button onClick={() => setSelectedSports(new Set())} className="text-xs font-medium text-primary hover:underline">
              Clear filter
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {sportTypes.map(type => {
            const count = resources.filter(r => r.type === type).length;
            const isActive = selectedSports.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleSport(type)}
                aria-pressed={isActive}
                className={cn(
                  "flex flex-col items-center gap-2 min-w-[80px] py-4 px-3 rounded-2xl border transition-all touch-manipulation",
                  isActive
                    ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-sm"
                    : "bg-muted/50 border-border hover:bg-muted"
                )}
              >
                <span className="text-3xl">{SPORT_ICONS[type] || "🎯"}</span>
                <span className={cn("text-xs font-medium text-center", isActive ? "text-primary" : "text-foreground")}>{SPORT_LABELS[type] || type}</span>
                <span className="text-[10px] text-muted-foreground">{count} court{count !== 1 ? "s" : ""}</span>
              </button>
            );
          })}
        </div>
        {selectedSports.size > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Showing {selectedSports.size} sport{selectedSports.size !== 1 ? "s" : ""} only — tap again to remove filter.
          </p>
        )}
      </section>


      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Customer Reviews</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {reviews.filter(r => r.comment).slice(0, 5).map((review, i) => (
              <div key={i} className="min-w-[260px] p-4 rounded-2xl border border-border bg-card shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {review.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{review.customer_name}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className={cn("h-3 w-3", j < review.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                  </div>
                </div>
                {review.comment && <p className="text-xs text-muted-foreground line-clamp-3">{review.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <Separator className="my-6 mx-4" />

      {/* Date Selector */}
      <section className="px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Select Date & Time</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {dateChips.map((chip, i) => {
            const isActive = format(selectedDate, "yyyy-MM-dd") === format(chip.date, "yyyy-MM-dd");
            return (
              <button key={i} onClick={() => setSelectedDate(chip.date)} className={cn(
                "flex flex-col items-center min-w-[52px] py-2 px-2.5 rounded-xl text-center transition-all shrink-0",
                isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 hover:bg-muted text-foreground border border-border"
              )}>
                <span className="text-[11px] font-semibold">{chip.label}</span>
                <span className={cn("text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>{chip.sub}</span>
              </button>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex flex-col items-center min-w-[52px] py-2 px-2.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground border border-border transition-all shrink-0">
                <CalIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} disabled={(d) => d < startOfDay(new Date())} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {/* Slot Grid */}
      <section className="mt-4 px-4" id="slot-grid-section">
        <PublicSlotGrid
          resources={selectedSports.size > 0 ? resources.filter(r => selectedSports.has(r.type)) : resources}
          sessions={sessions || []}
          date={selectedDate}
          onSlotClick={handleSlotClick}
          centerId={center.id}
          availability={availability}
          monthlyPlans={monthlyPlans}
        />
      </section>

      {/* FAQ Section */}
      <section className="mt-8 px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                <span className="text-sm font-medium text-foreground pr-2">{faq.q}</span>
                {expandedFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
              {expandedFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SEO Content Block */}
      <section className="mt-8 px-4">
        <div className="rounded-2xl bg-muted/30 border border-border p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground">About {center.name}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {center.name} is a premier sports facility{center.city ? ` located in ${center.city}` : ""}{center.address ? ` at ${center.address}` : ""}. 
            Offering {sportTypes.map(t => SPORT_LABELS[t] || t).join(", ")} facilities with {resources.length} well-maintained courts. 
            Book your favourite sport court online instantly through EasySlot — India's fastest sports booking platform. 
            With prices starting from just ₹{minRate}/hr, enjoy world-class facilities with easy UPI payments and instant booking confirmation.
            {totalGames > 0 ? ` Over ${totalGames} games have been played here by our vibrant sporting community.` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sportTypes.map(t => (
              <Badge key={t} variant="outline" className="text-[10px]">{SPORT_LABELS[t] || t} Court Booking</Badge>
            ))}
            {center.city && <Badge variant="outline" className="text-[10px]">Sports in {center.city}</Badge>}
            <Badge variant="outline" className="text-[10px]">Online Court Booking</Badge>
          </div>
        </div>
      </section>

      {/* SEO Link Matrix */}
      <section className="mt-8 px-4">
        <SeoLinkMatrix />
      </section>

      {/* Breadcrumbs for SEO */}
      <nav className="mt-6 px-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-1 items-center">
          <li><Link to="/easyslot-booking" className="hover:text-primary transition-colors">EasySlot</Link></li>
          <li>/</li>
          {center.city && <><li><Link to={`/easyslot-booking/${center.city.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-primary transition-colors">{center.city}</Link></li><li>/</li></>}
          <li className="text-foreground font-medium">{center.name}</li>
        </ol>
      </nav>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-4 py-3 safe-area-bottom">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">Starting from</span>
            <div className="text-lg font-bold text-primary">₹{minRate}<span className="text-xs font-normal text-muted-foreground">/hr</span></div>
          </div>
          <Button size="lg" className="h-12 px-8 rounded-xl text-sm font-bold shadow-md" onClick={() => document.getElementById("slot-grid-section")?.scrollIntoView({ behavior: "smooth" })}>
            BOOK NOW
          </Button>
        </div>
      </div>

      {/* Booking Drawer */}
      {selectedSlot && (
        <PublicBookingDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          slot={{
            resourceId: selectedSlot.resourceId,
            resourceName: selectedSlot.resourceName,
            centerId: selectedSlot.centerId,
            time: selectedSlot.time,
            hourlyRate: selectedSlot.hourlyRate,
          }}
          date={selectedDate}
          onBooked={() => {
            setDrawerOpen(false);
            setSelectedSlot(null);
          }}
          centerName={center.name}
        />
      )}
    </div>
  );
}
