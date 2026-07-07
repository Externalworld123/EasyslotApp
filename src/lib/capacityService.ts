/**
 * Capacity Service — handles multi-user capacity booking for shared resources (e.g., swimming pools).
 *
 * Rules:
 * - capacity == null or capacity == 1 → standard single-slot behavior
 * - capacity > 1 → allow multiple bookings per slot up to capacity
 * - If service fails → allow booking (fail-safe)
 */

import { supabase } from "@/integrations/supabase/client";

export interface CapacityCheck {
  allowed: boolean;
  capacity: number;
  currentBookings: number;
  remaining: number;
  reason?: string;
}

/**
 * Check how many bookings exist for a resource in a given time window.
 * Returns count of active/scheduled sessions overlapping the window.
 */
export async function countOverlappingBookings(
  resourceId: string,
  startTime: string,
  endTime: string
): Promise<number> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("resource_id", resourceId)
    .in("status", ["active", "scheduled"])
    .lt("start_time", endTime)
    .gt("scheduled_end_time", startTime);

  if (error) {
    console.error("[CapacityService] countOverlappingBookings error:", error);
    return 0; // fail-safe: assume no bookings
  }

  return data?.length ?? 0;
}

/**
 * Check if a resource has capacity for another booking in the given time window.
 *
 * For capacity <= 1 or null: returns allowed=true (defer to existing conflict logic).
 * For capacity > 1: counts overlapping bookings and checks against capacity.
 */
export async function checkCapacity(
  resourceId: string,
  capacity: number | null | undefined,
  startTime: string,
  endTime: string
): Promise<CapacityCheck> {
  const effectiveCapacity = capacity ?? 1;

  // For single-capacity resources, defer to existing booking logic
  if (effectiveCapacity <= 1) {
    return {
      allowed: true,
      capacity: effectiveCapacity,
      currentBookings: 0,
      remaining: effectiveCapacity,
    };
  }

  try {
    const currentBookings = await countOverlappingBookings(resourceId, startTime, endTime);
    const remaining = effectiveCapacity - currentBookings;

    if (remaining <= 0) {
      return {
        allowed: false,
        capacity: effectiveCapacity,
        currentBookings,
        remaining: 0,
        reason: "SLOT_FULL",
      };
    }

    return {
      allowed: true,
      capacity: effectiveCapacity,
      currentBookings,
      remaining,
    };
  } catch (err) {
    console.error("[CapacityService] checkCapacity error:", err);
    // Fail-safe: allow booking
    return {
      allowed: true,
      capacity: effectiveCapacity,
      currentBookings: 0,
      remaining: effectiveCapacity,
    };
  }
}

/**
 * For a given resource and hour slot on a date, count how many bookings overlap.
 * Useful for the grid display.
 */
export function countBookingsForSlot(
  sessions: Array<{ start_time: string; end_time: string | null; scheduled_end_time?: string; status: string; duration_minutes?: number | null }>,
  slotStart: Date,
  slotEnd: Date
): number {
  return sessions.filter((s) => {
    if (!["active", "scheduled"].includes(s.status)) return false;
    const sStart = new Date(s.start_time);
    const sEndRaw = s.end_time || s.scheduled_end_time;
    const sEnd = sEndRaw
      ? new Date(sEndRaw)
      : new Date(sStart.getTime() + (s.duration_minutes ?? 60) * 60000);
    return sStart < slotEnd && sEnd > slotStart;
  }).length;
}

/**
 * Check if a resource is a shared-capacity type (capacity > 1).
 */
export function isSharedCapacityResource(capacity: number | null | undefined): boolean {
  return (capacity ?? 1) > 1;
}
