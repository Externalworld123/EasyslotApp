import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Clock, Users, Tv2, DollarSign, LucideIcon, AlertTriangle,
  ChevronLeft, ChevronRight, Square, Timer, ChevronDown, ChevronUp,
  LayoutGrid, CalendarRange, BarChart3, FileBarChart, Eye, TrendingUp,
  Receipt, ScrollText, CheckSquare, Settings as SettingsIcon, CreditCard,
  Building2, Shield, ArrowUpRight, Zap, Target, Trophy,
} from "lucide-react";
// Hub3DIcon removed — Booking Hub now uses unified pastel tile style
import { useResourcesWithSessions } from "@/hooks/useResources";
import { useAuth } from "@/contexts/AuthContext";
import { isOrgAdmin, canManage, isSuperAdmin } from "@/lib/auth";
import { useSubscription, ModuleKey } from "@/hooks/useSubscription";
import { format, addDays, subDays, startOfDay, endOfDay } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { BookingModal } from "@/components/booking/BookingModal";
import { getResourceTypeLabel } from "@/lib/resourceTypes";
import { endSession } from "@/lib/sessionService";
import {
  buildSlotMatrix, getHourLabels, formatElapsed,
  type GridRow, type GridCell, type AvailabilityScheduleRow,
} from "@/lib/slotGridUtils";
import { useToast } from "@/hooks/use-toast";
import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";
import { useMonthlyPlans } from "@/hooks/useMonthlyPlans";

// ─── Stat Cards ──────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  href?: string;
}

// ─── Cell Component ──────────────────────────────────

function SlotCellView({
  cell,
  onClickAvailable,
  onClickActive,
}: {
  cell: GridCell;
  onClickAvailable: () => void;
  onClickActive: () => void;
}) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if ((cell.status === "active" || cell.status === "overdue") && cell.session) {
      setElapsed(formatElapsed(cell.session.start_time));
      const iv = setInterval(() => setElapsed(formatElapsed(cell.session!.start_time)), 1000);
      return () => clearInterval(iv);
    }
  }, [cell.status, cell.session]);

  const cellBase =
    "h-8 w-full rounded-md border-2 transition-colors cursor-pointer flex items-center justify-center text-[10px] font-semibold truncate px-1";

  switch (cell.status) {
    case "available":
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClickAvailable}
                className={`${cellBase} border-success bg-success/10 hover:bg-success/20 text-success`}
              >
                Available
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Book this slot
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case "booked": {
      const isLive = cell.session?.start_time && new Date(cell.session.start_time) <= new Date();
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`${cellBase} cursor-default ${isLive ? "border-primary bg-primary/10 text-primary animate-pulse" : "border-destructive bg-destructive/10 text-destructive"}`}
              >
                {isLive ? elapsed || "Live" : "Booked"}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs space-y-1">
              <p className="font-semibold">{cell.session?.customer_name ?? "Booked"}</p>
              {cell.session?.customer_phone && <p>{cell.session.customer_phone}</p>}
              <p className="text-muted-foreground">
                {cell.session?.start_time && !isNaN(new Date(cell.session.start_time).getTime())
                  ? format(new Date(cell.session.start_time), "h:mm a")
                  : (cell.timeLabel ?? "")}
              </p>
              {isLive && <p className="text-primary font-medium">Session is live</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    case "active":
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClickActive}
                className={`${cellBase} border-primary bg-primary/10 text-primary animate-pulse font-mono-timer`}
              >
                {elapsed || "Live"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs space-y-1">
              <p className="font-semibold text-primary">{cell.session?.customer_name}</p>
              <p className="font-mono-timer text-primary font-bold">{elapsed}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case "overdue":
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClickActive}
                className={`${cellBase} border-destructive bg-destructive/15 text-destructive animate-pulse font-mono-timer`}
              >
                {elapsed || "OT"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs space-y-1">
              <p className="font-semibold text-destructive">{cell.session?.customer_name}</p>
              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                OVERTIME
              </Badge>
              <p className="font-mono-timer text-destructive font-bold">{elapsed}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case "blocked":
      return <div className={`${cellBase} border-muted bg-muted/20 cursor-default text-muted-foreground`}>Blocked</div>;

    case "past":
    default:
      return (
        <div
          className={`${cellBase} cursor-default ${cell.session ? "border-muted-foreground/40 bg-muted-foreground/10 text-muted-foreground" : "border-muted bg-muted/10 text-muted-foreground/60"}`}
        >
          {cell.session ? "Done" : "—"}
        </div>
      );
  }
}

// ─── Active Session Row ──────────────────────────────

function ActiveSessionRow({
  courtName,
  session,
  onEnd,
  isEnding,
}: {
  courtName: string;
  session: { id: string; customer_name: string; start_time: string };
  onEnd: () => void;
  isEnding: boolean;
}) {
  const [elapsed, setElapsed] = useState(formatElapsed(session.start_time));

  useEffect(() => {
    const iv = setInterval(() => setElapsed(formatElapsed(session.start_time)), 1000);
    return () => clearInterval(iv);
  }, [session.start_time]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{session.customer_name}</p>
        <p className="text-xs text-muted-foreground">{courtName}</p>
      </div>
      <span className="font-mono-timer text-sm font-bold text-success shrink-0">{elapsed}</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={onEnd}
        disabled={isEnding}
      >
        <Square className="h-3 w-3 mr-1" /> End
      </Button>
    </div>
  );
}

// ─── Quick Actions Grid ──────────────────────────────

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "info" | "violet" | "rose" | "amber" | "slate" | "emerald" | "indigo";
  badge?: string | number;
  module?: ModuleKey;
  show?: boolean;
};

// Soft pastel tile palette (RailOne-inspired: light tinted bg + bold colored icon)
const TONE_STYLES: Record<QuickAction["tone"], { tile: string; icon: string }> = {
  primary: { tile: "bg-blue-50 dark:bg-blue-500/10",     icon: "text-blue-600 dark:text-blue-400" },
  success: { tile: "bg-emerald-50 dark:bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400" },
  emerald: { tile: "bg-green-50 dark:bg-green-500/10",   icon: "text-green-700 dark:text-green-400" },
  warning: { tile: "bg-amber-50 dark:bg-amber-500/10",   icon: "text-amber-600 dark:text-amber-400" },
  amber:   { tile: "bg-orange-50 dark:bg-orange-500/10", icon: "text-orange-600 dark:text-orange-400" },
  info:    { tile: "bg-sky-50 dark:bg-sky-500/10",       icon: "text-sky-600 dark:text-sky-400" },
  violet:  { tile: "bg-violet-50 dark:bg-violet-500/10", icon: "text-violet-600 dark:text-violet-400" },
  indigo:  { tile: "bg-indigo-50 dark:bg-indigo-500/10", icon: "text-indigo-600 dark:text-indigo-400" },
  rose:    { tile: "bg-rose-50 dark:bg-rose-500/10",     icon: "text-rose-600 dark:text-rose-400" },
  slate:   { tile: "bg-slate-100 dark:bg-slate-500/10",  icon: "text-slate-700 dark:text-slate-300" },
};

function OfferingTile({ action }: { action: QuickAction }) {
  const navigate = useNavigate();
  const tone = TONE_STYLES[action.tone];
  const Icon = action.icon;
  return (
    <button
      onClick={() => navigate(action.href)}
      className="group flex flex-col items-center gap-2 touch-manipulation active:scale-95 transition-transform"
    >
      <div className={`relative flex h-[68px] w-full items-center justify-center rounded-2xl ${tone.tile} shadow-sm transition-shadow group-hover:shadow-md`}>
        <Icon className={`h-7 w-7 ${tone.icon}`} strokeWidth={2.2} />
        {action.badge !== undefined && action.badge !== 0 && action.badge !== "" && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
            {action.badge}
          </span>
        )}
      </div>
      <span className="text-[11.5px] font-semibold text-foreground leading-tight text-center">
        {action.label}
      </span>
    </button>
  );
}

function FeatureTile({
  label, href, icon: Icon, tone,
}: { label: string; href: string; icon: LucideIcon; tone: QuickAction["tone"] }) {
  const navigate = useNavigate();
  const styles = TONE_STYLES[tone];
  return (
    <button
      onClick={() => navigate(href)}
      className="group flex flex-col items-center gap-2 touch-manipulation active:scale-95 transition-transform"
    >
      <div className={`relative flex h-[68px] w-full items-center justify-center rounded-2xl ${styles.tile} shadow-sm transition-shadow group-hover:shadow-md`}>
        <Icon className={`h-7 w-7 ${styles.icon}`} strokeWidth={2.2} />
      </div>
      <span className="text-[11.5px] font-semibold text-foreground leading-tight text-center">{label}</span>
    </button>
  );
}

function QuickActionsGrid({
  primaryRole,
  moduleAccess,
  pendingApprovals,
}: {
  primaryRole: ReturnType<typeof useAuth>["primaryRole"];
  moduleAccess?: Record<string, boolean>;
  pendingApprovals: number;
}) {
  const canMng = canManage(primaryRole);
  const isOrg = isOrgAdmin(primaryRole);
  const isSuper = isSuperAdmin(primaryRole);

  // "More Offerings" — secondary tiles
  const offerings: QuickAction[] = [
    { label: "Rapid Book", href: "/staff-booking", icon: Zap, tone: "amber" },
    { label: "Customers", href: "/customers", icon: Users, tone: "info" },
    { label: "Analytics", href: "/analytics", icon: BarChart3, tone: "success", module: "analytics" },
    { label: "Reports", href: "/reports", icon: FileBarChart, tone: "indigo", module: "reports" },
    { label: "Marshal View", href: "/marshal", icon: Eye, tone: "rose", module: "marshal_view" },
    { label: "Approvals", href: "/approvals", icon: CheckSquare, tone: "warning", module: "approvals", badge: pendingApprovals, show: canMng },
    { label: "Pricing Rules", href: "/pricing", icon: TrendingUp, tone: "amber", module: "pricing_rules", show: canMng },
    { label: "Expenses", href: "/expenses", icon: Receipt, tone: "rose", module: "expenses", show: canMng },
    { label: "Payment History", href: "/payment-history", icon: CreditCard, tone: "primary", show: canMng },
    { label: "Audit Log", href: "/audit-log", icon: ScrollText, tone: "slate", show: canMng },
    { label: "Settings", href: "/settings", icon: SettingsIcon, tone: "slate", show: canMng },
    { label: "Organization", href: "/organization", icon: Building2, tone: "indigo", show: isOrg },
    { label: "Super Admin", href: "/super-admin", icon: Shield, tone: "rose", show: isSuper },
  ];

  const visibleOfferings = offerings.filter((a) => {
    if (a.show === false) return false;
    if (a.module && moduleAccess && moduleAccess[a.module] === false) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Booking Hub — compact feature tiles with 3D-style emoji icons */}
      <section>
        <h2 className="mb-3 text-base font-bold tracking-tight text-foreground">Booking Hub</h2>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          <FeatureTile label="Slot Booking" href="/playo-booking" icon={Target} tone="primary" />
          <FeatureTile label="Monthly Plans" href="/monthly-plans" icon={CalendarRange} tone="violet" />
          <FeatureTile label="Courts" href="/resources" icon={Trophy} tone="emerald" />
        </div>
      </section>

      {/* More Offerings — pastel grid */}
      <section>
        <h2 className="mb-3 text-base font-bold tracking-tight text-foreground">More Offerings</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {visibleOfferings.map((a) => (
            <OfferingTile key={a.href} action={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Hero Header (dark navy) ─────────────────────────

function DashboardHero({
  userName,
  selectedDate,
  isToday,
  onPrev, onNext, onToday,
  activeCount, availableCount, todayRevenue,
  formatCurrency,
}: {
  userName: string;
  selectedDate: Date;
  isToday: boolean;
  onPrev: () => void; onNext: () => void; onToday: () => void;
  activeCount: number; availableCount: number; todayRevenue: number;
  formatCurrency: (n: number) => string;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="header-shimmer-group group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(224,76%,12%)] via-[hsl(224,76%,18%)] to-[hsl(217,91%,28%)] p-5 text-white shadow-[0_10px_40px_-12px_hsl(217_91%_53%/0.45)] ring-1 ring-white/10 transition-shadow duration-500 hover:shadow-[0_14px_50px_-12px_hsl(217_91%_53%/0.6)]">
      {/* Layered gradient glows matching primary/secondary tokens */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[hsl(217,91%,53%)]/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-12 h-40 w-40 rounded-full bg-[hsl(224,76%,40%)]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-1/3 bottom-0 h-28 w-28 rounded-full bg-[hsl(280,70%,55%)]/20 blur-3xl" />
      {/* Subtle diagonal sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/10" />
      {/* Animated shimmer sweep */}
      <div className="pointer-events-none absolute inset-y-0 -inset-x-1/2 overflow-hidden">
        <div className="header-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>
      {/* Top inner highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />


      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-300">{greeting},</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight truncate">
            {userName} <span className="inline-block">👋</span>
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 backdrop-blur p-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-white hover:bg-white/10 hover:text-white" onClick={onPrev}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={onToday}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
          >
            {isToday ? "Today" : format(selectedDate, "MMM d")}
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-white hover:bg-white/10 hover:text-white" onClick={onNext}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Inline stat tiles */}
      <div className="relative mt-5 grid grid-cols-3 gap-2.5">
        {[
          { value: String(activeCount), label: "Active", accent: "text-emerald-300" },
          { value: String(availableCount), label: "Available", accent: "text-sky-300" },
          { value: formatCurrency(Math.round(todayRevenue)).replace(/\.00$/, ""), label: "Revenue", accent: "text-amber-300" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 text-center min-w-0"
          >
            <p className={`text-lg sm:text-xl font-bold tabular-nums leading-none truncate ${s.accent}`}>{s.value}</p>
            <p className="mt-1.5 text-[11px] font-medium text-slate-300">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────

const Dashboard = () => {
  const { centerId, user, primaryRole } = useAuth();
  const navigate = useNavigate();
  const { data: resources, isLoading: resourcesLoading } = useResourcesWithSessions();
  const qc = useQueryClient();
  const { format: formatCurrency } = useCurrency();
  const { toast } = useToast();
  const { data: subscription } = useSubscription();

  // Date state — persisted across backgrounding/remounts
  const DATE_KEY = "easyslot_dashboard_date";
  const [selectedDate, setSelectedDateState] = useState<Date>(() => {
    try {
      const stored = sessionStorage.getItem(DATE_KEY);
      if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime()) && d >= startOfDay(new Date())) return d;
      }
    } catch {}
    return new Date();
  });
  const setSelectedDate = useCallback((d: Date | ((prev: Date) => Date)) => {
    setSelectedDateState((prev) => {
      const next = typeof d === "function" ? (d as (p: Date) => Date)(prev) : d;
      try { sessionStorage.setItem(DATE_KEY, next.toISOString()); } catch {}
      return next;
    });
  }, []);
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const todayStart = startOfDay(selectedDate).toISOString();
  const todayEnd = endOfDay(selectedDate).toISOString();

  // Fetch availability schedule for dynamic time range
  const { data: availabilitySchedule } = useQuery({
    queryKey: ["dashboard-availability", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const resourceIds = resources?.map((r) => r.id) ?? [];
      if (resourceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("availability_schedule")
        .select("resource_id, day_of_week, start_time, end_time, is_closed")
        .in("resource_id", resourceIds);
      if (error) throw error;
      return (data ?? []) as AvailabilityScheduleRow[];
    },
    enabled: !!centerId && !!resources?.length,
    staleTime: 0,
  });

  useAvailabilityRealtime({
    enabled: !!centerId,
    queryKeys: [["dashboard-availability", centerId]],
  });

  const { data: monthlyPlans } = useMonthlyPlans();

  // Compute dynamic hour range from availability schedule
  const dynamicHours = useMemo(() => {
    if (!availabilitySchedule?.length) return { startHour: 0, endHour: 24 };
    const dow = selectedDate.getDay();
    // Full 24-hour grid (0–24)
    return { startHour: 0, endHour: 24 };
  }, [availabilitySchedule, selectedDate]);

  // 8-hour sliding window starting from current hour — persisted
  const WINDOW_KEY = "easyslot_dashboard_window_start";
  const [windowStart, setWindowStartState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(WINDOW_KEY);
      if (stored !== null) {
        const n = Number(stored);
        if (!isNaN(n) && n >= 0 && n <= 16) return n;
      }
    } catch {}
    const currentHour = new Date().getHours();
    return Math.min(currentHour, 16);
  });
  const setWindowStart = useCallback((updater: number | ((prev: number) => number)) => {
    setWindowStartState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: number) => number)(prev) : updater;
      try { sessionStorage.setItem(WINDOW_KEY, String(next)); } catch {}
      return next;
    });
  }, []);
  const windowEnd = Math.min(windowStart + 8, 24);

  // Filter state — persisted
  const FILTERS_KEY = "easyslot_dashboard_filters";
  const initialFilters = (() => {
    try {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      if (raw) return JSON.parse(raw) as { sport?: string; status?: string; search?: string };
    } catch {}
    return {};
  })();
  const [sportFilter, setSportFilterState] = useState<string>(initialFilters.sport ?? "all");
  const [statusFilter, setStatusFilterState] = useState<string>(initialFilters.status ?? "all");
  const [searchQuery, setSearchQueryState] = useState(initialFilters.search ?? "");
  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ sport: sportFilter, status: statusFilter, search: searchQuery }),
      );
    } catch {}
  }, [sportFilter, statusFilter, searchQuery]);
  const setSportFilter = setSportFilterState;
  const setStatusFilter = setStatusFilterState;
  const setSearchQuery = setSearchQueryState;

  // Modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingResource, setBookingResource] = useState<{
    id: string;
    name: string;
    hourlyRate: number;
    pricingType?: string;
    capacity?: number;
  } | null>(null);
  const [bookingSlotTime, setBookingSlotTime] = useState<string | undefined>();
  const [bookingSlotDate, setBookingSlotDate] = useState<Date | undefined>();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);

  // Active sessions panel — persisted
  const PANEL_KEY = "easyslot_dashboard_panel_open";
  const [panelOpen, setPanelOpenState] = useState(() => {
    try {
      const v = sessionStorage.getItem(PANEL_KEY);
      if (v !== null) return v === "1";
    } catch {}
    return true;
  });
  const setPanelOpen = useCallback((v: boolean | ((p: boolean) => boolean)) => {
    setPanelOpenState((prev) => {
      const next = typeof v === "function" ? (v as (p: boolean) => boolean)(prev) : v;
      try { sessionStorage.setItem(PANEL_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  // ── Queries ────────────────────────────────────────

  const { data: daySessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["dashboard-sessions", centerId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "id, customer_name, customer_phone, start_time, end_time, status, resource_id, duration_minutes, notes, final_amount",
        )
        .eq("center_id", centerId)
        .in("status", ["active", "scheduled", "completed"])
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
    refetchInterval: 15000,
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ["pending-approvals-count", centerId],
    queryFn: async () => {
      if (!centerId) return 0;
      const { count, error } = await supabase
        .from("approvals")
        .select("id", { count: "exact", head: true })
        .eq("center_id", centerId)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!centerId,
  });

  // ── Realtime ───────────────────────────────────────

  useEffect(() => {
    if (!centerId) return;
    const channel = supabase
      .channel("dashboard-sessions-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `center_id=eq.${centerId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard-sessions", centerId] });
          qc.invalidateQueries({ queryKey: ["resources-with-sessions", centerId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [centerId, qc]);

  // ── Auto-transition scheduled → active ─────────────
  useEffect(() => {
    if (!centerId) return;
    const autoTransition = async () => {
      const now = new Date().toISOString();
      const { data: due } = await supabase
        .from("sessions")
        .select("id")
        .eq("center_id", centerId)
        .eq("status", "scheduled")
        .lte("start_time", now);
      if (due && due.length > 0) {
        const ids = due.map((s) => s.id);
        await supabase
          .from("sessions")
          .update({ status: "active" as any })
          .in("id", ids);
        qc.invalidateQueries({ queryKey: ["dashboard-sessions", centerId] });
        qc.invalidateQueries({ queryKey: ["resources-with-sessions", centerId] });
      }
    };
    autoTransition();
    const iv = setInterval(autoTransition, 30000);
    return () => clearInterval(iv);
  }, [centerId, qc]);

  // ── Auto-end expired active sessions ───────────────
  useEffect(() => {
    if (!centerId) return;
    const autoEnd = async () => {
      try {
        const { data } = await supabase.functions.invoke("end-session", {
          body: { auto: true },
        });
        const ended = data?.auto_ended ?? 0;
        const noShows = data?.no_shows ?? 0;
        if (ended > 0 || noShows > 0) {
          const parts: string[] = [];
          if (ended > 0) parts.push(`${ended} session${ended > 1 ? "s" : ""} completed`);
          if (noShows > 0) parts.push(`${noShows} no-show${noShows > 1 ? "s" : ""}`);
          toast({ title: "Auto-ended sessions", description: parts.join(", ") });
        }
        qc.invalidateQueries({ queryKey: ["dashboard-sessions", centerId] });
        qc.invalidateQueries({ queryKey: ["resources-with-sessions", centerId] });
      } catch (e) {
        console.error("Auto-end error:", e);
      }
    };
    autoEnd();
    const iv = setInterval(autoEnd, 60000);
    return () => clearInterval(iv);
  }, [centerId, qc, toast]);

  // ── Computed Data ──────────────────────────────────

  const allHourLabels = useMemo(() => getHourLabels(dynamicHours.startHour, dynamicHours.endHour), [dynamicHours]);

  const activeResources = useMemo(
    () => resources?.filter((r) => r.is_active && r.status !== "maintenance") ?? [],
    [resources],
  );

  const filteredResources = useMemo(() => {
    let list = activeResources;
    if (sportFilter !== "all") list = list.filter((r) => r.type === sportFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeResources, sportFilter, searchQuery]);

  const gridRows = useMemo(() => {
    if (!filteredResources.length || !daySessions) return [];
    return buildSlotMatrix(
      filteredResources as any,
      daySessions as any,
      selectedDate,
      dynamicHours.startHour,
      dynamicHours.endHour,
      availabilitySchedule ?? [],
      monthlyPlans ?? [],
    );
  }, [filteredResources, daySessions, selectedDate, dynamicHours, availabilitySchedule, monthlyPlans]);

  // Stats
  const activeCount = resources?.filter((r) => r.activeSession).length ?? 0;
  const availableCount = resources?.filter((r) => r.is_active && !r.activeSession).length ?? 0;

  const todayStats = useMemo(() => {
    if (!daySessions) return { customers: 0, revenue: 0 };
    const customers = new Set(daySessions.map((s: any) => s.customer_name)).size;
    const revenue = daySessions
      .filter((s: any) => s.status === "completed")
      .reduce((sum: number, s: any) => sum + Number(s.final_amount ?? 0), 0);
    return { customers, revenue };
  }, [daySessions]);

  const stats: StatItem[] = [
    {
      label: "Active Sessions",
      value: String(activeCount),
      icon: Clock,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Slot Booking",
      value: "Open",
      icon: LayoutGrid,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/playo-booking",
    },
    {
      label: "Available",
      value: resourcesLoading ? "—" : String(availableCount),
      icon: Tv2,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Today's Customers",
      value: String(todayStats.customers),
      icon: Users,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "Today's Revenue",
      value: formatCurrency(todayStats.revenue),
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  // Active sessions for the panel
  const activeSessions = useMemo(() => {
    if (!daySessions || !resources) return [];
    return daySessions
      .filter((s: any) => s.status === "active")
      .map((s: any) => ({
        ...s,
        courtName: resources.find((r) => r.id === s.resource_id)?.name ?? "Unknown",
      }));
  }, [daySessions, resources]);

  // ── Handlers ───────────────────────────────────────

  const handleCellClick = useCallback(
    (row: GridRow, cell: GridCell) => {
      if (cell.status === "available") {
        // Build the time string for the booking modal
        const d = new Date(selectedDate);
        d.setHours(cell.hour, 0, 0, 0);
        const timeStr = format(d, "HH:mm");
        setBookingResource({
          id: row.resourceId,
          name: row.resourceName,
          hourlyRate: row.hourlyRate,
          pricingType: row.pricingType,
          capacity: row.capacity,
        });
        setBookingSlotTime(timeStr);
        setBookingSlotDate(selectedDate);
        setBookingOpen(true);
      }
    },
    [selectedDate],
  );

  const handleEndSession = useCallback(
    async (sessionId: string) => {
      setEndingSessionId(sessionId);
      try {
        await endSession({ session_id: sessionId });
        qc.invalidateQueries({ queryKey: ["dashboard-sessions", centerId] });
        qc.invalidateQueries({ queryKey: ["resources-with-sessions", centerId] });
        toast({ title: "Session ended successfully" });
      } catch (err: any) {
        toast({ title: "Error ending session", description: err.message, variant: "destructive" });
      } finally {
        setEndingSessionId(null);
      }
    },
    [centerId, qc, toast],
  );

  const handleSessionChange = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["dashboard-sessions", centerId] });
    qc.invalidateQueries({ queryKey: ["resources-with-sessions", centerId] });
  }, [centerId, qc]);

  // No need to scroll — windowed view already shows current hours

  // Walk-in resources for QuickWalkInModal
  const walkInResources = useMemo(
    () =>
      activeResources.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        hourly_rate: r.hourly_rate,
      })),
    [activeResources],
  );

  const isLoading = resourcesLoading || sessionsLoading;

  // ── Render ─────────────────────────────────────────

  const userName = useMemo(() => {
    const e = user?.email ?? "";
    const local = e.split("@")[0] ?? "User";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user?.email]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <DashboardHero
        userName={userName}
        selectedDate={selectedDate}
        isToday={isToday}
        onPrev={() => setSelectedDate((d) => subDays(d, 1))}
        onNext={() => setSelectedDate((d) => addDays(d, 1))}
        onToday={() => setSelectedDate(new Date())}
        activeCount={activeCount}
        availableCount={availableCount}
        todayRevenue={todayStats.revenue}
        formatCurrency={formatCurrency}
      />

      {/* Quick Actions */}
      <QuickActionsGrid
        primaryRole={primaryRole}
        moduleAccess={subscription?.moduleAccess}
        pendingApprovals={pendingApprovals ?? 0}
      />

      {/* Active Sessions panel — desktop & mobile */}
      {!isLoading && activeSessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4 text-success" />
              Active Sessions
              <Badge variant="secondary" className="text-xs">{activeSessions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSessions.map((s: any) => (
              <ActiveSessionRow
                key={s.id}
                courtName={s.courtName}
                session={s}
                onEnd={() => handleEndSession(s.id)}
                isEnding={endingSessionId === s.id}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {/* Modals */}
      {bookingResource && (
        <BookingModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          resourceId={bookingResource.id}
          resourceName={bookingResource.name}
          centerId={centerId!}
          hourlyRate={bookingResource.hourlyRate}
          pricingType={bookingResource.pricingType}
          capacity={bookingResource.capacity}
          slotTime={bookingSlotTime}
          slotDate={bookingSlotDate}
          onBooked={handleSessionChange}
        />
      )}
    </div>
  );
};

export default Dashboard;
