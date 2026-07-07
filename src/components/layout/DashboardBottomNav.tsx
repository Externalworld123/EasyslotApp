import { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Tv2, Clock, CalendarCheck, CreditCard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "/resources", label: "Courts", icon: Tv2 },
  { key: "/sessions", label: "Sessions", icon: Clock },
  { key: "/bookings", label: "Bookings", icon: CalendarCheck },
  { key: "/payments", label: "Payments", icon: CreditCard },
];

export function DashboardBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setVisible(y < lastScrollY.current || y < 10);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className="relative flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 rounded-xl transition-all touch-manipulation active:scale-95"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
