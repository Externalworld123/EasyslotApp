import { useState, useMemo, useEffect, Fragment as FragmentWithKey } from "react";
import { useSeo } from "@/hooks/useSeo";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { SPORT_TYPES } from "@/lib/resourceTypes";
import { buildVenueUrl } from "@/lib/venueUrl";
import {
  Search, MapPin, Calendar as CalIcon, ChevronRight,
  Star, Zap, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";
import VenueDetail from "@/components/public/VenueDetail";
import VenueCard from "@/components/public/VenueCard";
import VideoAdCard from "@/components/public/VideoAdCard";
import { cn } from "@/lib/utils";
import PublicBookingDrawer from "@/components/public/PublicBookingDrawer";
import SeoContentBlock, { SeoJsonLd } from "@/components/public/SeoContentBlock";

import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";
import {
  LiveSlotPreview, WhyEasySlot, SocialProof,
  VenueOwnerCTA, SeoArticles, HomepageFooter,
} from "@/components/public/HomepageSections";
import OfferCarousel from "@/components/public/OfferCarousel";
import BottomNav from "@/components/public/BottomNav";

/* ── Constants ── */
const SPORT_ICONS: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", cricket: "🏏", football: "⚽",
  basketball: "🏀", swimming: "🏊", table_tennis: "🏓", squash: "🎯", volleyball: "🏐",
};
const SPORT_SHORT: Record<string, string> = {
  badminton: "Badminton", tennis: "Tennis", cricket: "Cricket", football: "Football",
  basketball: "Basketball", swimming: "Swimming", table_tennis: "Table Tennis",
  squash: "Squash", volleyball: "Volleyball",
};
const KNOWN_CITIES = ["hyderabad", "bangalore", "chennai", "mumbai", "delhi", "pune", "vijayawada", "delhi-ncr", "visakhapatnam", "guntur"];
const KNOWN_SPORTS = ["badminton", "football", "cricket", "tennis", "basketball", "swimming", "table_tennis", "squash", "volleyball", "Pickleball"];
const CITY_LABEL: Record<string, string> = {
  hyderabad: "Hyderabad", bangalore: "Bangalore", chennai: "Chennai",
  mumbai: "Mumbai", delhi: "Delhi", pune: "Pune", vijayawada: "Vijayawada",
  "delhi-ncr": "Delhi NCR", visakhapatnam: "Visakhapatnam", guntur: "Guntur",
};

interface CenterWithResources {
  id: string; name: string; address: string | null; city?: string | null; image_url?: string | null;
  slug?: string | null;
  latitude?: number | null; longitude?: number | null;
  rating?: number | null; reviewCount?: number;
  resources: { id: string; name: string; type: string; hourly_rate: number; pricing_type: string | null; capacity: number | null; }[];
}

export default function BookPublic() {
  const { param1, param2 } = useParams<{ param1?: string; param2?: string }>();
  const navigate = useNavigate();

  const availableSports = useMemo(() => {
    if (!centers) return [];
    const types = new Set<string>();
    centers.forEach(c => {
      if (Array.isArray(c.resources)) {
        c.resources.forEach(r => types.add(r.type));
      }
    });
    return SPORT_TYPES.filter(s => types.has(s.value));
  }, [centers]);
  // Determine if params are city or sport
  const routeCity = useMemo(() => {
    if (param1 && KNOWN_CITIES.includes(param1)) return param1;
    if (param2 && KNOWN_CITIES.includes(param2)) return param2;
    return undefined;
  }, [param1, param2]);

  const routeSport = useMemo(() => {
    if (param1 && KNOWN_SPORTS.includes(param1)) return param1;
    if (param2 && KNOWN_SPORTS.includes(param2)) return param2;
    return undefined;
  }, [param1, param2]);

  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState<string>(routeSport || "");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    resourceId: string; resourceName: string; centerId: string; time: string; hourlyRate: number;
  } | null>(null);

  useAvailabilityRealtime({
    enabled: !!selectedCenter,
    queryKeys: [["public-availability", selectedCenter]],
  });

  // Request user geolocation on mount and detect city
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          // Reverse geocode to detect city
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&zoom=10`,
              { headers: { "Accept-Language": "en" } }
            );
            const geo = await resp.json();
            const city = geo?.address?.city || geo?.address?.town || geo?.address?.state_district || geo?.address?.state;
            if (city) setDetectedCity(city);
          } catch { /* ignore geocoding errors */ }
        },
        () => { /* permission denied */ },
        { timeout: 5000, maximumAge: 300_000 }
      );
    }
  }, []);

  // Sync route sport filter
  useEffect(() => { if (routeSport) setSportFilter(routeSport); }, [routeSport]);

  // Dynamic SEO via useSeo hook (per-route title/description/canonical/OG)
  const seoMeta = useMemo(() => {
    const sportName = routeSport ? SPORT_SHORT[routeSport] || routeSport : "";
    const cityName = routeCity ? CITY_LABEL[routeCity] || routeCity : "";
    let title = "EasySlot Booking – Book Sports Slots Online | Turf & Grounds";
    let description = "Book sports slots online with EasySlot. Find cricket turfs, football grounds, and courts near you. Fast booking with UPI payments.";
    if (sportName || cityName) {
      const parts = ["Book"];
      if (sportName) parts.push(sportName, "Courts");
      else parts.push("Sports Courts");
      if (cityName) parts.push("in", cityName);
      parts.push("| EasySlot");
      title = parts.join(" ");
      const descParts = ["Find and book"];
      if (sportName) descParts.push(sportName.toLowerCase(), "courts,");
      else descParts.push("badminton courts, football turfs, cricket nets");
      if (cityName) descParts.push(`near you in ${cityName}.`);
      else descParts.push("near you.");
      descParts.push("Instant booking with EasySlot.");
      description = descParts.join(" ");
    }
    const path = `/easyslot-booking${routeCity ? `/${routeCity}` : ""}${routeSport ? `/${routeSport}` : ""}`;
    return { title, description, canonical: path };
  }, [routeCity, routeSport]);
  useSeo(seoMeta);

  const { data: centers, isLoading } = useQuery({
    queryKey: ["public-discover"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("public-discover");
      if (error) throw error;
      return (data as CenterWithResources[]) || [];
    },
    staleTime: 0,
  });

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["public-sessions-grid", selectedCenter, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!selectedCenter) return [];
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();
      const { data, error } = await supabase.functions.invoke("public-discover", {
        body: {
          action: "sessions",
          center_id: selectedCenter,
          date: format(selectedDate, "yyyy-MM-dd"),
          day_start: dayStart,
          day_end: dayEnd,
        },
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCenter,
    refetchInterval: 15_000,
  });

  const { data: availability } = useQuery({
    queryKey: ["public-availability", selectedCenter],
    queryFn: async () => {
      if (!selectedCenter) return [];
      const { data, error } = await supabase.functions.invoke("public-discover", {
        body: { action: "availability", center_id: selectedCenter },
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCenter,
    staleTime: 0,
  });

  const filtered = useMemo(() => {
    if (!centers) return [];
    const matched = centers.filter((c) => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.address?.toLowerCase().includes(search.toLowerCase());
      const activeSport = sportFilter || routeSport;
      // Safeguard c.resources with optional chaining or Array fallback
      const resources = Array.isArray(c.resources) ? c.resources : [];
      const matchSport = !activeSport || resources.some((r) => r.type === activeSport);
      const matchCity = !routeCity || c.address?.toLowerCase().includes(routeCity.toLowerCase());
      return matchSearch && matchSport && matchCity;
    }).map((c) => {
      const activeSport = sportFilter || routeSport;
      const resources = Array.isArray(c.resources) ? c.resources : [];
      return { 
        ...c, 
        resources: activeSport ? resources.filter((r) => r.type === activeSport) : resources 
      };
    });

    // Haversine distance in km
    const distKm = (c: typeof matched[0]) => {
      if (!userLocation || c.latitude == null || c.longitude == null) return Infinity;
      const R = 6371;
      const dLat = ((c.latitude - userLocation.lat) * Math.PI) / 180;
      const dLon = ((c.longitude - userLocation.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((c.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Sort: Active → Distance → Rating → Price
    return matched.sort((a, b) => {
      const aResources = Array.isArray(a.resources) ? a.resources : [];
      const bResources = Array.isArray(b.resources) ? b.resources : [];

      // 1. Active venues (with resources) first
      const aActive = aResources.length > 0 ? 1 : 0;
      const bActive = bResources.length > 0 ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;

      // 2. Closer venues first
      const aDist = distKm(a);
      const bDist = distKm(b);
      if (Math.abs(aDist - bDist) > 0.5) return aDist - bDist;

      // 3. Higher rating first
      const aRating = a.rating ?? 0;
      const bRating = b.rating ?? 0;
      if (bRating !== aRating) return bRating - aRating;

      // 4. Lower price first
      const minRate = (c: typeof a) => {
        const res = Array.isArray(c.resources) ? c.resources : [];
        return res.length ? Math.min(...res.map(r => r.hourly_rate)) : Infinity;
      };
      return minRate(a) - minRate(b);
    });
  }, [centers, search, sportFilter, routeSport, routeCity, userLocation]);

  // Split into city-local and other venues
  const { nearbyVenues, otherVenues } = useMemo(() => {
    if (!detectedCity || routeCity || search) return { nearbyVenues: filtered, otherVenues: [] as typeof filtered };
    const cityLower = detectedCity.toLowerCase();
    const nearby = filtered.filter((c) =>
      c.city?.toLowerCase().includes(cityLower) || c.address?.toLowerCase().includes(cityLower)
    );
    const other = filtered.filter((c) =>
      !(c.city?.toLowerCase().includes(cityLower) || c.address?.toLowerCase().includes(cityLower))
    );
    return { nearbyVenues: nearby, otherVenues: other };
  }, [filtered, detectedCity, routeCity, search]);

  // ── Pagination ──
  const PAGE_SIZE = 6;
  const [nearbyPage, setNearbyPage] = useState(1);
  const [otherPage, setOtherPage] = useState(1);
  const nearbyPageCount = Math.max(1, Math.ceil(nearbyVenues.length / PAGE_SIZE));
  const otherPageCount = Math.max(1, Math.ceil(otherVenues.length / PAGE_SIZE));
  useEffect(() => { setNearbyPage(1); }, [search, sportFilter, routeSport, routeCity, detectedCity]);
  useEffect(() => { setOtherPage(1); }, [search, sportFilter, routeSport, routeCity, detectedCity]);
  const pagedNearby = useMemo(
    () => nearbyVenues.slice((nearbyPage - 1) * PAGE_SIZE, nearbyPage * PAGE_SIZE),
    [nearbyVenues, nearbyPage]
  );
  const pagedOther = useMemo(
    () => otherVenues.slice((otherPage - 1) * PAGE_SIZE, otherPage * PAGE_SIZE),
    [otherVenues, otherPage]
  );
  const scrollToVenues = () => {
    requestAnimationFrame(() =>
      document.getElementById("venue-cards")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const activeCenter = filtered.find((c) => c.id === selectedCenter);
 // const availableSports = useMemo(() => {
  //  if (!centers) return [];
  //  const types = new Set<string>();
  //  centers.forEach(c => c.resources.forEach(r => types.add(r.type)));
  //  return SPORT_TYPES.filter(s => types.has(s.value));
//  }, [centers]);

  const dateChips = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      return { date: d, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE"), sub: format(d, "d MMM") };
    });
  }, []);

  const handleSlotClick = (resourceId: string, resourceName: string, centerId: string, time: string, hourlyRate: number) => {
    setSelectedSlot({ resourceId, resourceName, centerId, time, hourlyRate });
    setDrawerOpen(true);
  };
  const handleBooked = () => { setDrawerOpen(false); refetchSessions(); };

  const sportLabel = routeSport ? SPORT_SHORT[routeSport] || routeSport : "";
  const cityLabel = routeCity ? CITY_LABEL[routeCity] || routeCity : "";
  const h1Text = sportLabel && cityLabel
    ? `Book ${sportLabel} Courts in ${cityLabel}`
    : sportLabel ? `Book ${sportLabel} Courts Near You`
    : cityLabel ? `Book Sports Courts in ${cityLabel}`
    : "EasySlot Booking – Book Sports Slots Online Instantly";
  const h2Text = sportLabel
    ? `Available ${sportLabel} Courts${cityLabel ? ` in ${cityLabel}` : ""}`
    : `Top Picks${cityLabel ? ` in ${cityLabel}` : " Around You"}`;

  return (
    <div className="min-h-screen bg-background">
      <SeoJsonLd city={routeCity} sport={routeSport} />

      {selectedCenter && activeCenter ? (
        <>
          <VenueDetail center={activeCenter} sessions={sessions || []} selectedDate={selectedDate}
            onDateChange={setSelectedDate} onBack={() => setSelectedCenter(null)} onSlotClick={handleSlotClick}
            availability={availability || []} />
          <PublicBookingDrawer open={drawerOpen} onOpenChange={setDrawerOpen} slot={selectedSlot}
            date={selectedDate} onBooked={handleBooked} centerName={activeCenter.name} />
        </>
      ) : (
        <div>
          {/* ── Top Bar ── */}
          <header className="sticky top-0 z-30 bg-card border-b border-border">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <span className="text-sm font-bold text-foreground leading-tight">EasySlot</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">Book instantly</p>
                </div>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search venues, sports..." className="pl-10 h-10 bg-muted/50 border-none text-sm rounded-full" />
              </div>
              <Button variant="outline" size="sm" className="shrink-0 rounded-full font-semibold" onClick={() => navigate("/login")}>
                Login
              </Button>
            </div>
          </header>

          <main className="max-w-5xl mx-auto pb-28 md:pb-24">
            {/* ── Offer Carousel ── */}
            <OfferCarousel />

            {/* ── Sports Categories ── */}
            <section className="mt-8 px-4">
              <h2 className="text-lg font-bold text-foreground mb-0.5">Choose Your Game</h2>
              <p className="text-xs text-muted-foreground mb-4">Pick a sport and find available courts</p>
              <div id="sport-pills" className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                <button onClick={() => setSportFilter("")}
                  className={cn("flex flex-col items-center gap-1.5 min-w-[72px] py-3 px-2 rounded-2xl transition-all shrink-0",
                    sportFilter === "" ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/50 hover:bg-muted")}>
                  <span className="text-2xl">🏆</span>
                  <span className="text-[11px] font-medium text-foreground">All</span>
                </button>
                {(availableSports.length > 0 ? availableSports : SPORT_TYPES.slice(0, 6)).map((s) => (
                  <button key={s.value} onClick={() => setSportFilter(sportFilter === s.value ? "" : s.value)}
                    className={cn("flex flex-col items-center gap-1.5 min-w-[72px] py-3 px-2 rounded-2xl transition-all shrink-0",
                      sportFilter === s.value ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/50 hover:bg-muted")}>
                    <span className="text-2xl">{SPORT_ICONS[s.value] || "🎯"}</span>
                    <span className="text-[11px] font-medium text-foreground">{SPORT_SHORT[s.value] || s.label}</span>
                  </button>
                ))}
              </div>
            </section>


            {/* ── Venue Cards ── */}
            <section id="venue-cards" className="mt-8 px-4">
              {isLoading && (
                <div className="grid gap-5 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-72 rounded-2xl" />
                  ))}
                </div>
              )}

              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-16">
                  <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-foreground">No venues found</h2>
                  <p className="text-muted-foreground text-sm mt-1">Try a different sport or search term</p>
                </div>
              )}

              {/* Nearby / detected city venues */}
              {nearbyVenues.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">
                      {detectedCity && !routeCity && !search ? `Venues in ${detectedCity}` : h2Text}
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Tap a venue to see live slots &amp; book</p>
                  <div className="space-y-5">
                    {pagedNearby.map((center, idx) => (
                      <FragmentWithKey key={center.id}>
                        <VenueCard
                          center={center}
                          onClick={() => navigate(buildVenueUrl(center))}
                        />
                        {((idx + 1) % 5 === 0) && (
                          <VideoAdCard />
                        )}
                      </FragmentWithKey>
                    ))}
                  </div>
                  <PagerBar
                    page={nearbyPage}
                    pageCount={nearbyPageCount}
                    onChange={(p) => { setNearbyPage(p); scrollToVenues(); }}
                  />
                </>
              )}

              {/* Other cities */}
              {otherVenues.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-lg font-bold text-foreground">Explore Other Cities</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Discover venues across India</p>
                  <div className="space-y-5">
                    {pagedOther.map((center, idx) => (
                      <FragmentWithKey key={center.id}>
                        <VenueCard
                          center={center}
                          onClick={() => navigate(buildVenueUrl(center))}
                        />
                        {((idx + 1) % 5 === 0) && (
                          <VideoAdCard />
                        )}
                      </FragmentWithKey>
                    ))}
                  </div>
                  <PagerBar
                    page={otherPage}
                    pageCount={otherPageCount}
                    onChange={(p) => { setOtherPage(p); scrollToVenues(); }}
                  />
                </div>
              )}
            </section>

            {/* ── Live Slot Preview ── */}
            <LiveSlotPreview />

            {/* ── Why EasySlot ── */}
            <WhyEasySlot />

            {/* ── Social Proof ── */}
            <SocialProof />

            {/* ── Venue Owner CTA ── */}
            <VenueOwnerCTA />

            {/* ── SEO Articles ── */}
            <SeoArticles />

            {/* ── SEO Content, FAQ, Links ── */}
            {!isLoading && (
              <section className="mt-10 px-4">
                <SeoContentBlock city={routeCity} sport={routeSport} />
              </section>
            )}

            {/* ── Bottom CTA ── */}
            {!isLoading && filtered.length > 0 && (
              <div className="mt-8 mx-4 py-4 px-5 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                <p className="text-sm font-medium text-foreground">
                  ⚡ Instant booking · No login required · Pay at venue
                </p>
              </div>
            )}
          </main>

          {/* ── Bottom Nav (mobile) ── */}
          <BottomNav activeVenueId={selectedCenter} onBookNow={() => {
            if (selectedCenter) {
              document.getElementById("venue-cards")?.scrollIntoView({ behavior: "smooth" });
              // Auto-open first available slot for the active venue
              const center = filtered.find(c => c.id === selectedCenter);
              if (center && center.resources.length > 0) {
                const r = center.resources[0];
                handleSlotClick(r.id, r.name, center.id, "", r.hourly_rate);
              }
            }
          }} />

          {/* ── Footer ── */}
          <HomepageFooter />

          <PublicBookingDrawer open={drawerOpen} onOpenChange={setDrawerOpen} slot={selectedSlot}
            date={selectedDate} onBooked={handleBooked} centerName="" />
        </div>
      )}
    </div>
  );
}

/* ─────────── Pagination Bar ─────────── */
function PagerBar({
  page, pageCount, onChange,
}: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null;

  // Build a compact page list: 1 … (p-1) p (p+1) … last
  const pages: (number | "ellipsis")[] = [];
  const add = (v: number | "ellipsis") => pages.push(v);
  const window = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  let prev = 0;
  Array.from(window).filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b).forEach((p) => {
    if (prev && p - prev > 1) add("ellipsis");
    add(p);
    prev = p;
  });

  return (
    <Pagination className="mt-6">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={(e) => { e.preventDefault(); if (page > 1) onChange(page - 1); }}
            className={cn("touch-manipulation", page === 1 && "pointer-events-none opacity-50")}
          />
        </PaginationItem>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === page}
                onClick={(e) => { e.preventDefault(); onChange(p); }}
                className="touch-manipulation cursor-pointer"
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            onClick={(e) => { e.preventDefault(); if (page < pageCount) onChange(page + 1); }}
            className={cn("touch-manipulation", page === pageCount && "pointer-events-none opacity-50")}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
