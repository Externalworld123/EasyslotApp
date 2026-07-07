import { addMinutes, startOfDay, endOfDay, format } from "date-fns";
import type { MonthlyPlan } from "@/hooks/useMonthlyPlans";
import { isSlotBlockedByPlan } from "@/hooks/useMonthlyPlans";

export interface PlayoResource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  capacity: number | null;
  status: string | null;
}

export interface PlayoSession {
  id: string;
  resource_id: string;
  start_time: string;
  scheduled_end_time: string;
  end_time: string | null;
  status: string;
}

export interface PlayoSlotCount {
  hour: number;
  timeLabel: string;
  totalCourts: number;
  bookedCourts: number;
  availableCourts: number;
  isPast: boolean;
}

export interface CartItem {
  resourceId: string;
  resourceName: string;
  hourlyRate: number;
  date: string; // yyyy-MM-dd
  hour: number; // 0-23 (start hour)
  hours: number; // duration in hours (1+) for drag-selected ranges
  amount: number;
}

const DEFAULT_START_HOUR = 0;
const DEFAULT_END_HOUR = 24;

/**
 * Format an hour as "05:00 am - 06:00 am" style label.
 */
export function formatHourRange(hour: number): string {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date();
  end.setHours(hour + 1, 0, 0, 0);
  return `${format(start, "hh:mm a").toLowerCase()} - ${format(end, "hh:mm a").toLowerCase()}`;
}

export function getSportFromResources(resources: PlayoResource[]): string[] {
  return Array.from(new Set(resources.map((r) => r.type))).sort();
}

/**
 * Build per-hour aggregate counts for a single sport across all its courts.
 * Each "court" of capacity > 1 is counted as `capacity` available slots.
 */
export function buildPlayoMatrix(
  resourcesOfSport: PlayoResource[],
  sessions: PlayoSession[],
  monthlyPlans: MonthlyPlan[],
  date: Date,
  cart: CartItem[] = [],
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
): PlayoSlotCount[] {
  const now = new Date();
  const totalCourts = resourcesOfSport.reduce(
    (sum, r) => sum + Math.max(1, r.capacity ?? 1),
    0,
  );
  const dateKey = format(date, "yyyy-MM-dd");

  const sessionsByResource = new Map<string, PlayoSession[]>();
  for (const s of sessions) {
    if (!resourcesOfSport.some((r) => r.id === s.resource_id)) continue;
    const list = sessionsByResource.get(s.resource_id) ?? [];
    list.push(s);
    sessionsByResource.set(s.resource_id, list);
  }

  const rows: PlayoSlotCount[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = addMinutes(slotStart, 60);

    let booked = 0;
    for (const r of resourcesOfSport) {
      const cap = Math.max(1, r.capacity ?? 1);
      const rSessions = sessionsByResource.get(r.id) ?? [];
      const overlapping = rSessions.filter((s) => {
        if (!["active", "scheduled"].includes(s.status)) return false;
        const sStart = new Date(s.start_time);
        const sEnd = s.end_time
          ? new Date(s.end_time)
          : new Date(s.scheduled_end_time);
        return sStart < slotEnd && sEnd > slotStart;
      }).length;

      const planBlocked = isSlotBlockedByPlan(monthlyPlans, r.id, date, hour) ? 1 : 0;
      const cartCount = cart.filter(
        (c) =>
          c.resourceId === r.id &&
          c.date === dateKey &&
          hour >= c.hour &&
          hour < c.hour + c.hours,
      ).length;
      booked += Math.min(cap, overlapping + planBlocked + cartCount);

      // maintenance status: treat all of its capacity as "booked"
      if (r.status === "maintenance")
        booked += cap - Math.min(cap, overlapping + planBlocked + cartCount);
    }

    rows.push({
      hour,
      timeLabel: formatHourRange(hour),
      totalCourts,
      bookedCourts: booked,
      availableCourts: Math.max(0, totalCourts - booked),
      isPast: slotEnd <= now,
    });
  }
  return rows;
}

/**
 * Find the next available court for a sport at a given hour.
 * Returns the resource + 1-based court number within its capacity.
 */
export function pickAvailableCourt(
  resourcesOfSport: PlayoResource[],
  sessions: PlayoSession[],
  monthlyPlans: MonthlyPlan[],
  cart: CartItem[],
  date: Date,
  hour: number,
): { resource: PlayoResource; courtIndex: number } | null {
  const slotStart = new Date(date);
  slotStart.setHours(hour, 0, 0, 0);
  const slotEnd = addMinutes(slotStart, 60);
  const dateKey = format(date, "yyyy-MM-dd");

  for (const r of resourcesOfSport) {
    if (r.status === "maintenance") continue;
    const cap = Math.max(1, r.capacity ?? 1);
    const rSessions = sessions.filter((s) => s.resource_id === r.id);
    const overlapping = rSessions.filter((s) => {
      if (!["active", "scheduled"].includes(s.status)) return false;
      const sStart = new Date(s.start_time);
      const sEnd = s.end_time ? new Date(s.end_time) : new Date(s.scheduled_end_time);
      return sStart < slotEnd && sEnd > slotStart;
    }).length;
    const planBlocked = isSlotBlockedByPlan(monthlyPlans, r.id, date, hour) ? 1 : 0;
    const cartCount = cart.filter(
      (c) => c.resourceId === r.id && c.date === dateKey && hour >= c.hour && hour < c.hour + c.hours,
    ).length;

    const used = overlapping + planBlocked + cartCount;
    if (used < cap) {
      return { resource: r, courtIndex: used + 1 };
    }
  }
  return null;
}

/**
 * Check if a specific resource has free capacity at the given hour (considering existing
 * sessions, monthly plans and other cart items — but NOT the current cart item being extended).
 */
export function isHourFreeOnResource(
  resource: PlayoResource,
  sessions: PlayoSession[],
  monthlyPlans: MonthlyPlan[],
  cart: CartItem[],
  date: Date,
  hour: number,
  ignoreCartKey?: string,
): boolean {
  if (resource.status === "maintenance") return false;
  const cap = Math.max(1, resource.capacity ?? 1);
  const slotStart = new Date(date);
  slotStart.setHours(hour, 0, 0, 0);
  const slotEnd = addMinutes(slotStart, 60);
  const dateKey = format(date, "yyyy-MM-dd");

  const overlapping = sessions.filter((s) => {
    if (s.resource_id !== resource.id) return false;
    if (!["active", "scheduled"].includes(s.status)) return false;
    const sStart = new Date(s.start_time);
    const sEnd = s.end_time ? new Date(s.end_time) : new Date(s.scheduled_end_time);
    return sStart < slotEnd && sEnd > slotStart;
  }).length;
  const planBlocked = isSlotBlockedByPlan(monthlyPlans, resource.id, date, hour) ? 1 : 0;
  const cartCount = cart.filter(
    (c) =>
      `${c.resourceId}|${c.date}|${c.hour}` !== ignoreCartKey &&
      c.resourceId === resource.id &&
      c.date === dateKey &&
      hour >= c.hour &&
      hour < c.hour + c.hours,
  ).length;
  return overlapping + planBlocked + cartCount < cap;
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.amount, 0);
}

export function cartKey(item: { resourceId: string; date: string; hour: number }): string {
  return `${item.resourceId}|${item.date}|${item.hour}`;
}
