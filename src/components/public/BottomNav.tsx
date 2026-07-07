import { useState } from "react";
import { Home, Gamepad2, MapPin, User, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BottomNavProps {
  activeVenueId?: string | null;
  onBookNow?: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: typeof Home;
  action: string;
  accent?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: Home, action: "scroll-top" },
  { key: "games", label: "Games", icon: Gamepad2, action: "scroll-sports" },
  { key: "book", label: "Book", icon: Zap, action: "book-venue", accent: true },
  { key: "venues", label: "Venues", icon: MapPin, action: "scroll-venues" },
  { key: "login", label: "Login", icon: User, action: "navigate-login" },
];

export default function BottomNav({ activeVenueId, onBookNow }: BottomNavProps) {
  const [active, setActive] = useState<string>("home");
  const navigate = useNavigate();

  const handleTap = (item: NavItem) => {
    setActive(item.key);
    switch (item.action) {
      case "scroll-top":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "scroll-sports":
        document.getElementById("sport-pills")?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      case "scroll-venues":
        document.getElementById("venue-cards")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "book-venue":
        if (activeVenueId && onBookNow) {
          onBookNow();
        } else {
          toast.info("Select a venue first, then tap Book");
          document.getElementById("venue-cards")?.scrollIntoView({ behavior: "smooth" });
        }
        break;
      case "navigate-login":
        navigate("/login");
        break;
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          const Icon = item.icon;
          const hasVenue = item.key === "book" && !!activeVenueId;
          return (
            <button
              key={item.key}
              onClick={() => handleTap(item)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 rounded-xl transition-all touch-manipulation active:scale-95"
              )}
            >
              {item.accent ? (
                <div className={cn(
                  "flex items-center justify-center w-11 h-11 -mt-5 rounded-full shadow-lg transition-colors",
                  hasVenue
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 animate-pulse"
                    : "bg-primary text-primary-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
              ) : (
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
              )}
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                item.accent ? "text-primary font-semibold" : isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
              {isActive && !item.accent && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
