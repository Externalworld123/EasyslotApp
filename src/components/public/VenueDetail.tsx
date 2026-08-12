import { useMemo } from "react";
import { format, startOfDay, addDays } from "date-fns";
import type { AvailabilitySlot } from "./PublicSlotGrid";
import type { MonthlyPlan } from "@/hooks/useMonthlyPlans";
import {
  ArrowLeft, MapPin, Clock, Star, Users, ChevronRight, Navigation,
  Calendar as CalIcon, Wifi, Car, Droplets, Armchair, Coffee,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import PublicSlotGrid from "./PublicSlotGrid";
import { getStorageImageUrl } from "@/integrations/supabase/client";

export default function VenueCard({ center }: { center: any }) {
  return (
    <img
      src={getStorageImageUrl(center.image_url)}
      alt={center.name}
      onError={(e) => {
        // Fallback to placeholder if network error or missing resource occurs
        e.currentTarget.src = "/placeholder.png";
      }}
      className="w-full h-48 object-cover rounded-xl"
    />
  );
}
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

interface Resource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  pricing_type: string | null;
  capacity: number | null;
}

interface Props {
  center: {
    id: string;
    name: string;
    address: string | null;
    resources: Resource[];
  };
  sessions: any[];
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onBack: () => void;
  onSlotClick: (resourceId: string, resourceName: string, centerId: string, time: string, hourlyRate: number) => void;
  availability?: AvailabilitySlot[];
  monthlyPlans?: MonthlyPlan[];
}

export default function VenueDetail({ center, sessions, selectedDate, onDateChange, onBack, onSlotClick, availability, monthlyPlans }: Props) {
  const sportTypes = useMemo(() => {
    const types = new Set<string>();
    center.resources.forEach((r) => types.add(r.type));
    return Array.from(types);
  }, [center.resources]);

  const minRate = useMemo(() => {
    if (!center.resources.length) return 0;
    return Math.min(...center.resources.map((r) => r.hourly_rate));
  }, [center.resources]);

  const totalCourts = center.resources.length;

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

  const hasResources = center.resources.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Hero gradient header ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-secondary h-44 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 text-6xl">🏟️</div>
          <div className="absolute bottom-4 right-8 text-5xl">{SPORT_ICONS[sportTypes[0]] || "🎯"}</div>
          <div className="absolute top-12 right-20 text-3xl opacity-50">{SPORT_ICONS[sportTypes[1]] || ""}</div>
        </div>
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-10 h-9 w-9 rounded-full bg-background/20 backdrop-blur-sm flex items-center justify-center hover:bg-background/30 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-primary-foreground" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ── Venue info card ── */}
      <div className="relative -mt-10 mx-4">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-tight">{center.name}</h1>
              {center.address && (
                <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{center.address}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {hasResources ? (
                <div className="flex items-center gap-0.5 bg-success/10 rounded-lg px-2 py-1">
                  <Star className="h-3.5 w-3.5 text-success fill-success" />
                  <span className="text-xs font-bold text-success">New</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 bg-warning/10 rounded-lg px-2 py-1">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-bold text-warning">Coming Soon</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> 6 AM – 11 PM
              </span>
              {hasResources && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {totalCourts} court{totalCourts !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {center.address && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(center.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" />
                Directions
              </a>
            )}
          </div>

          {hasResources ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                From ₹{minRate}/hr
              </Badge>
              {totalCourts > 2 && (
                <Badge variant="outline" className="text-muted-foreground border-border">
                  {totalCourts} courts available
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              🏗️ Courts are being set up. Check back soon for bookings!
            </p>
          )}
        </div>
      </div>

      {hasResources ? (
        <>
          {/* ── Available Sports section ── */}
          <section className="mt-5 px-4">
            <h2 className="text-sm font-bold text-foreground mb-2.5">Available Sports</h2>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {sportTypes.map((type) => (
                <div key={type} className="flex flex-col items-center gap-1.5 min-w-[72px] py-3 px-2 rounded-2xl bg-muted/50 border border-border">
                  <span className="text-2xl">{SPORT_ICONS[type] || "🎯"}</span>
                  <span className="text-[11px] font-medium text-foreground text-center">{SPORT_LABELS[type] || type}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Amenities section ── */}
          <section className="mt-5 px-4">
            <h2 className="text-sm font-bold text-foreground mb-2.5">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {AMENITY_ICONS.map(({ key, label, icon: Icon }) => (
                <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border text-xs font-medium text-foreground">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
                </span>
              ))}
            </div>
          </section>

          <Separator className="my-5 mx-4" />

          {/* ── Date selector ── */}
          <section className="px-4">
            <h2 className="text-sm font-bold text-foreground mb-2.5">Select Date & Time</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {dateChips.map((chip, i) => {
                const isActive = format(selectedDate, "yyyy-MM-dd") === format(chip.date, "yyyy-MM-dd");
                return (
                  <button
                    key={i}
                    onClick={() => onDateChange(chip.date)}
                    className={cn(
                      "flex flex-col items-center min-w-[52px] py-2 px-2.5 rounded-xl text-center transition-all shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted/50 hover:bg-muted text-foreground border border-border"
                    )}
                  >
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
                  <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && onDateChange(d)}
                    disabled={(d) => d < startOfDay(new Date())} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </section>

          {/* ── Slot Grid ── */}
          <section className="mt-4 px-4" id="slot-grid-section">
            <PublicSlotGrid resources={center.resources} sessions={sessions || []} date={selectedDate}
              onSlotClick={onSlotClick} centerId={center.id} availability={availability} monthlyPlans={monthlyPlans} />
          </section>

          {/* ── Sticky bottom CTA ── */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-4 py-3 safe-area-bottom">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Starting from</span>
                <div className="text-lg font-bold text-primary">₹{minRate}<span className="text-xs font-normal text-muted-foreground">/hr</span></div>
              </div>
              <Button size="lg" className="h-12 px-8 rounded-xl text-sm font-bold shadow-md"
                onClick={() => { document.getElementById("slot-grid-section")?.scrollIntoView({ behavior: "smooth" }); }}>
                BOOK NOW
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* ── Coming Soon state ── */
        <div className="mt-8 mx-4 text-center py-12">
          <div className="text-5xl mb-4">🏗️</div>
          <h2 className="text-lg font-bold text-foreground">Coming Soon!</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            This venue is being set up. Courts and booking will be available shortly.
          </p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Browse Other Venues
          </Button>
        </div>
      )}
    </div>
  );
}
