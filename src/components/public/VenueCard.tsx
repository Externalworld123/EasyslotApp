import { useMemo } from "react";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import imgBadminton from "@/assets/sports/badminton.jpg";
import imgCricket from "@/assets/sports/cricket.jpg";
import imgFootball from "@/assets/sports/football.jpg";
import imgTennis from "@/assets/sports/tennis.jpg";
import imgSwimming from "@/assets/sports/swimming.jpg";
import imgDefault from "@/assets/sports/default.jpg";
import { getStorageImageUrl } from "@/integrations/supabase/client";


const SPORT_IMAGES: Record<string, string> = {
  badminton: imgBadminton,
  cricket: imgCricket,
  football: imgFootball,
  tennis: imgTennis,
  swimming: imgSwimming,
};

const SPORT_ICONS: Record<string, string> = {
  badminton: "🏸",
  tennis: "🎾",
  cricket: "🏏",
  football: "⚽",
  basketball: "🏀",
  swimming: "🏊",
  table_tennis: "🏓",
  squash: "🎯",
  volleyball: "🏐",
};

interface Resource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  pricing_type: string | null;
  capacity: number | null;
  image_url?: string | null;
}

interface VenueCardProps {
  center: {
    id: string;
    name: string;
    address: string | null;
    image_url?: string | null;
    resources: Resource[];
  };
  onClick: () => void;
}
    
export default function VenueCard({ center, onClick }: VenueCardProps) {
  const hasResources = center.resources.length > 0;

  const heroImage = useMemo(() => {
    if (center.image_url) return center.image_url;
    const withImg = center.resources.find((r) => r.image_url);
    if (withImg?.image_url) return withImg.image_url;
    const primaryType = center.resources[0]?.type;
    return SPORT_IMAGES[primaryType] || imgDefault;
  }, [center.resources, center.image_url]);

  const minRate = useMemo(() => {
    if (!hasResources) return 0;
    return Math.min(...center.resources.map((r) => r.hourly_rate));
  }, [center.resources, hasResources]);

  // Group resources by sport type with count
  const sportGroups = useMemo(() => {
    const map = new Map<string, number>();
    center.resources.forEach((r) => {
      map.set(r.type, (map.get(r.type) || 0) + 1);
    });
    return Array.from(map.entries()).slice(0, 4); // max 4 sport types
  }, [center.resources]);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-2xl overflow-hidden bg-card border border-border transition-all duration-200 touch-manipulation",
        "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_10px_15px_-3px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.06)]",
        "hover:shadow-[0_8px_12px_-2px_rgba(0,0,0,0.12),0_20px_30px_-5px_rgba(0,0,0,0.15),0_30px_40px_-8px_rgba(0,0,0,0.1)]",
        "hover:-translate-y-1",
        hasResources ? "cursor-pointer active:scale-[0.98]" : "cursor-pointer opacity-90",
      )}
    >
      {/* ── Top: Image (55%) ── */}

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
      <div className="relative h-44 sm:h-52 overflow-hidden">
        <img
          src={heroImage}
          alt={`${center.name} sports venue`}
          width={600}
          height={200}
          loading="lazy"
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105",
            !hasResources && "opacity-60 blur-[1px]",
          )}
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top-right badge */}
        <div className="absolute top-2.5 right-2.5">
          {hasResources ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/90 backdrop-blur-sm text-[10px] font-bold text-success-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success-foreground animate-pulse" />
              Open Now
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/90 backdrop-blur-sm text-[10px] font-bold text-warning-foreground shadow-sm">
              <Clock className="h-3 w-3" />
              Coming Soon
            </span>
          )}
        </div>

        {/* Bottom-left: Venue name + address on image */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-base font-bold text-white leading-tight truncate drop-shadow-md">{center.name}</h3>
          {center.address && (
            <p className="text-[11px] text-white/80 flex items-center gap-1 mt-0.5 drop-shadow-sm">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{center.address}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom: Info ── */}
      <div className="p-3 flex flex-col gap-2.5">
        {hasResources ? (
          <>
            {/* Sport icons with count */}
            <div className="flex gap-2 flex-wrap">
              {sportGroups.map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs font-semibold text-foreground"
                >
                  <span className="text-sm">{SPORT_ICONS[type] || "🏟️"}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">×{count}</span>
                </span>
              ))}
            </div>

            {/* Footer: courts + price + CTA */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {center.resources.length} court{center.resources.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground">from </span>
                  <span className="text-sm font-bold text-primary">₹{minRate}</span>
                  <span className="text-[10px] text-muted-foreground">/hr</span>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs rounded-full font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                >
                  Book <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">🏗️ Courts are being set up. Check back soon!</p>
        )}
      </div>
    </div>
  );
}
