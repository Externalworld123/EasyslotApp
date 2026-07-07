import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, Award, Dumbbell, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSeo } from "@/hooks/useSeo";

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸",
  tennis: "🎾",
  cricket: "🏏",
  football: "⚽",
  basketball: "🏀",
  swimming: "🏊",
  table_tennis: "🏓",
  squash: "🎯",
  volleyball: "🏐",
  general: "🏋️",
};

const CARD_GRADIENTS = [
  "from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800",
  "from-emerald-500/10 to-teal-500/10 border-emerald-200 dark:border-emerald-800",
  "from-orange-500/10 to-amber-500/10 border-orange-200 dark:border-amber-800",
  "from-purple-500/10 to-pink-500/10 border-purple-200 dark:border-purple-800",
  "from-rose-500/10 to-red-500/10 border-rose-200 dark:border-rose-800",
  "from-cyan-500/10 to-sky-500/10 border-cyan-200 dark:border-cyan-800",
];

interface Trainer {
  id: string;
  name: string;
  sport: string;
  bio: string | null;
  image_url: string | null;
  rating: number;
  total_reviews: number;
  experience_years: number;
  is_active: boolean;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "h-3.5 w-3.5",
            s <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          )}
        />
      ))}
      {rating > 0 && (
        <span className="ml-1 text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}

function TrainerCard({ trainer, index }: { trainer: Trainer; index: number }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const initials = trainer.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-gradient-to-br p-4 transition-all duration-200",
        "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_10px_15px_-3px_rgba(0,0,0,0.08)]",
        "hover:shadow-[0_8px_12px_-2px_rgba(0,0,0,0.1),0_16px_24px_-4px_rgba(0,0,0,0.12)]",
        "hover:-translate-y-0.5 active:scale-[0.98] touch-manipulation",
        gradient,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {trainer.image_url ? (
          <img
            src={trainer.image_url}
            alt={trainer.name}
            className="h-16 w-16 rounded-xl object-cover border-2 border-background shadow-sm shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-primary/10 border-2 border-background shadow-sm flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{trainer.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-base">{SPORT_EMOJI[trainer.sport] || "🏟️"}</span>
            <span className="text-xs text-muted-foreground capitalize">{trainer.sport.replace("_", " ")}</span>
          </div>
          <StarRating rating={trainer.rating} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Award className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">{trainer.experience_years}y exp</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-medium">{trainer.total_reviews} reviews</span>
        </div>
      </div>

      {/* Bio */}
      {trainer.bio && (
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{trainer.bio}</p>
      )}

    </div>
  );
}

export default function Trainers() {
  useSeo({
    title: "Sports Trainers & Coaches | Book Certified Coaches | EasySlot",
    description: "Find and connect with certified sports coaches across badminton, tennis, cricket, football and more on EasySlot. Book trusted trainers near you.",
    canonical: "/trainers",
  });
  const { data: trainers, isLoading } = useQuery({
    queryKey: ["public-trainers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainers")
        .select("id, name, sport, bio, image_url, rating, total_reviews, experience_years, is_active")
        .eq("is_active", true)
        .order("rating", { ascending: false });
      if (error) throw error;
      return data as Trainer[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Our Trainers</h1>
            <p className="text-[11px] text-muted-foreground">Expert coaches to help you level up</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-3 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !trainers?.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No trainers listed yet.</p>
            <p className="text-xs text-muted-foreground/60">Check back soon!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sport filter badges */}
              {Array.from(new Set(trainers.map((t) => t.sport))).map((sport) => (
                <Badge key={sport} variant="secondary" className="text-[11px] gap-1 px-2.5 py-1">
                  {SPORT_EMOJI[sport] || "🏟️"} {sport.replace("_", " ")}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3">
              {trainers.map((t, i) => (
                <TrainerCard key={t.id} trainer={t} index={i} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}