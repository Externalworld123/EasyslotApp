import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PricingRule {
  id: string;
  name: string;
  price_multiplier: number;
  flat_price: number | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  resource_id: string | null;
  is_active: boolean;
}

export function usePricingRules() {
  const { centerId } = useAuth();

  return useQuery({
    queryKey: ["pricing-rules", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("*")
        .eq("center_id", centerId)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as PricingRule[];
    },
    enabled: !!centerId,
    staleTime: 30_000,
  });
}

function findMatchingRules(
  rules: PricingRule[],
  resourceId: string,
  date: Date,
  timeStr: string,
): PricingRule[] {
  if (!rules.length) return [];
  const dow = date.getDay();
  // Normalize "HH:MM" or "HH:MM:SS" → minutes since midnight for safe numeric comparison.
  // String compare ("18:00" < "18:00:00") is TRUE because the shorter string is "less",
  // which incorrectly excluded boundary hours from matching rules.
  const toMin = (t: string): number => {
    const [h = "0", m = "0"] = t.split(":");
    return Number(h) * 60 + Number(m);
  };
  const tMin = toMin(timeStr);
  return rules.filter((r) => {
    if (r.day_of_week !== null && r.day_of_week !== dow) return false;
    if (r.resource_id !== null && r.resource_id !== resourceId) return false;
    if (r.start_time && r.end_time) {
      const sMin = toMin(r.start_time);
      const eMin = toMin(r.end_time);
      // Support overnight ranges, e.g. 18:00 -> 06:00
      if (sMin <= eMin) {
        if (tMin < sMin || tMin >= eMin) return false;
      } else {
        if (tMin < sMin && tMin >= eMin) return false;
      }
    }
    return true;
  });
}

/**
 * Calculate the effective price multiplier (legacy — ignores flat_price overrides).
 * Prefer getEffectiveHourlyPrice for accurate billing.
 */
export function getEffectiveMultiplier(
  rules: PricingRule[],
  resourceId: string,
  date: Date,
  timeStr: string,
): number {
  const matching = findMatchingRules(rules, resourceId, date, timeStr);
  if (!matching.length) return 1;
  return Math.max(...matching.map((r) => r.price_multiplier));
}

/**
 * Resolve the effective hourly price for a slot.
 * - If any matching rule has a `flat_price`, the highest flat_price wins.
 * - Otherwise apply the highest price_multiplier to the base hourly rate.
 */
export function getEffectiveHourlyPrice(
  rules: PricingRule[],
  resourceId: string,
  date: Date,
  timeStr: string,
  baseHourlyRate: number,
): number {
  const matching = findMatchingRules(rules, resourceId, date, timeStr);
  if (!matching.length) return baseHourlyRate;

  const flatPrices = matching
    .map((r) => r.flat_price)
    .filter((p): p is number => p !== null && p !== undefined && !Number.isNaN(Number(p)))
    .map((p) => Number(p));

  if (flatPrices.length) return Math.max(...flatPrices);

  const mult = Math.max(...matching.map((r) => r.price_multiplier));
  return baseHourlyRate * mult;
}

/**
 * Price an arbitrary time range [startHour, startHour+durationHours) in 30-minute
 * segments, where each segment is priced by its OWN start time. This correctly
 * handles slots that straddle a pricing boundary (e.g. 17:30 → 18:30 is half
 * daytime + half night). Returns the rounded total.
 */
export function priceRange(
  rules: PricingRule[],
  resourceId: string,
  date: Date,
  startHour: number,
  durationHours: number,
  baseHourlyRate: number,
  segmentMinutes: number = 30,
): number {
  if (durationHours <= 0) return 0;
  const segHours = segmentMinutes / 60;
  let total = 0;
  let cursor = startHour;
  const end = startHour + durationHours;
  while (cursor < end - 1e-9) {
    const segLen = Math.min(segHours, end - cursor);
    const h = Math.floor(cursor);
    const m = Math.round((cursor % 1) * 60);
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const hourly = getEffectiveHourlyPrice(rules, resourceId, date, timeStr, baseHourlyRate);
    total += hourly * segLen;
    cursor += segLen;
  }
  return Math.round(total);
}
