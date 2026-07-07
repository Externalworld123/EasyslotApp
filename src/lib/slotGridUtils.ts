import { addMinutes, startOfDay, endOfDay, format } from "date-fns";
import type { MonthlyPlan } from "@/hooks/useMonthlyPlans";
import { isSlotBlockedByPlan } from "@/hooks/useMonthlyPlans";
import { countBookingsForSlot, isSharedCapacityResource } from "@/lib/capacityService";

export type CellStatus = "available" | "booked" | "active" | "blocked" | "past" | "overdue";

export interface GridCell {
  hour: number;
  timeLabel: string;
  status: CellStatus;
  session?: {
    id: string;
    customer_name: string;
    customer_phone?: string | null;
    start_time: string;
    end_time: string | null;
    status: string;
    duration_minutes?: number | null;
    notes?: string | null;
  };
  /** For shared-capacity resources: how many bookings overlap this slot */
  currentBookings?: number;
  /** For shared-capacity resources: total capacity */
  capacityTotal?: number;
  /** For shared-capacity resources: remaining slots */
  remainingSlots?: number;
}

export interface GridRow {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  hourlyRate: number;
  pricingType?: string;
  capacity?: number;
  resourceStatus?: string;
  cells: GridCell[];
}

export interface SessionRow {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  resource_id: string;
  duration_minutes: number | null;
  notes: string | null;
}

export interface ResourceRow {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  is_active: boolean;
  capacity: number | null;
  pricing_type: string | null;
  status: string | null;
}

export interface AvailabilityScheduleRow {
  resource_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 23;

function getResourceAvailabilityBounds(
  resourceId: string,
  date: Date,
  availability: AvailabilityScheduleRow[] = []
): { start: number; end: number } {
  if (availability.length === 0) return { start: 0, end: 24 };

  const schedule = availability.find(
    (slot) => slot.resource_id === resourceId && slot.day_of_week === date.getDay(),
  );

  if (!schedule) return { start: 0, end: 24 };
  if (schedule.is_closed) return { start: -1, end: -1 };

  const startParts = schedule.start_time.split(":");
  const endParts = schedule.end_time.split(":");
  const startHour = Number.parseInt(startParts[0] ?? "0", 10);
  const endHour = Number.parseInt(endParts[0] ?? "0", 10);
  const endMinute = Number.parseInt(endParts[1] ?? "0", 10);
  const effectiveEnd = endHour === 0 && endMinute === 0 ? 24 : endMinute > 0 ? endHour + 1 : endHour;

  if (effectiveEnd <= startHour) return { start: startHour, end: 24 };

  return { start: startHour, end: effectiveEnd };
}

/**
 * Determine cell status based on session data and current time.
 */
function getCellStatus(
  session: SessionRow | undefined,
  slotStart: Date,
  slotEnd: Date,
  now: Date
): CellStatus {
  if (!session) {
    if (slotEnd <= now) return "past";
    return "available";
  }

  if (session.status === "active") {
    // Check overdue: active session running longer than scheduled or > 1hr
    const sessionStart = new Date(session.start_time);
    const expectedEnd = session.duration_minutes
      ? addMinutes(sessionStart, session.duration_minutes)
      : addMinutes(sessionStart, 60);
    if (now > expectedEnd) return "overdue";
    return "active";
  }

  if (session.status === "scheduled") return "booked";
  if (session.status === "completed") {
    if (slotEnd <= now) return "past";
    return "booked";
  }

  return "past";
}

/**
 * Build the full slot grid matrix.
 */
export function buildSlotMatrix(
  resources: ResourceRow[],
  sessions: SessionRow[],
  date: Date,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  availability: AvailabilityScheduleRow[] = [],
  monthlyPlans: MonthlyPlan[] = []
): GridRow[] {
  const now = new Date();
  const sessionsByResource = new Map<string, SessionRow[]>();

  for (const s of sessions) {
    const list = sessionsByResource.get(s.resource_id) ?? [];
    list.push(s);
    sessionsByResource.set(s.resource_id, list);
  }

  return resources
    .filter((r) => r.is_active && r.status !== "maintenance")
    .map((r) => {
      const rSessions = sessionsByResource.get(r.id) ?? [];
      const resourceHours = getResourceAvailabilityBounds(r.id, date, availability);
      const cells: GridCell[] = [];

      for (let hour = startHour; hour < endHour; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = addMinutes(slotStart, 60);
        const timeLabel = format(slotStart, "h a");

        // Check blocked (maintenance resource)
        if (r.status === "maintenance") {
          cells.push({ hour, timeLabel, status: "blocked" });
          continue;
        }

        const isSharedCapacity = isSharedCapacityResource(r.capacity);
        const totalCapacity = r.capacity ?? 1;

        // Find ALL overlapping sessions for this slot
        const overlappingSessions = rSessions.filter((s) => {
          const sStart = new Date(s.start_time);
          const sEnd = s.end_time
            ? new Date(s.end_time)
            : addMinutes(sStart, s.duration_minutes ?? 60);
          return sStart < slotEnd && sEnd > slotStart;
        });

        const overlapping = overlappingSessions[0];
        const bookingCount = overlappingSessions.filter(
          (s) => s.status === "active" || s.status === "scheduled"
        ).length;

        if (!overlapping && (resourceHours.start === -1 || hour < resourceHours.start || hour >= resourceHours.end)) {
          cells.push({ hour, timeLabel, status: "blocked" });
          continue;
        }

        // Check monthly plan blocking
        if (!overlapping) {
          const blockingPlan = isSlotBlockedByPlan(monthlyPlans, r.id, date, hour);
          if (blockingPlan) {
            cells.push({
              hour,
              timeLabel,
              status: "booked",
              session: {
                id: `plan-${blockingPlan.id}`,
                customer_name: blockingPlan.customer_name,
                customer_phone: blockingPlan.customer_phone,
                start_time: `${format(date, "yyyy-MM-dd")}T${blockingPlan.slot_time}:00`,
                end_time: null,
                status: "scheduled",
                duration_minutes: blockingPlan.duration_minutes,
                notes: `Monthly Plan`,
              },
            });
            continue;
          }
        }

        // --- Shared capacity logic ---
        if (isSharedCapacity) {
          const remaining = totalCapacity - bookingCount;
          const slotIsFull = remaining <= 0;
          const isPast = slotEnd <= now;

          let cellStatus: CellStatus;
          if (isPast) {
            cellStatus = "past";
          } else if (slotIsFull) {
            cellStatus = "booked";
          } else {
            cellStatus = "available";
          }

          cells.push({
            hour,
            timeLabel,
            status: cellStatus,
            currentBookings: bookingCount,
            capacityTotal: totalCapacity,
            remainingSlots: Math.max(0, remaining),
            session: overlapping
              ? {
                  id: overlapping.id,
                  customer_name: `${bookingCount}/${totalCapacity} booked`,
                  customer_phone: overlapping.customer_phone,
                  start_time: overlapping.start_time,
                  end_time: overlapping.end_time,
                  status: overlapping.status,
                  duration_minutes: overlapping.duration_minutes,
                  notes: overlapping.notes,
                }
              : undefined,
          });
          continue;
        }

        // --- Standard single-capacity logic ---
        const status = getCellStatus(overlapping, slotStart, slotEnd, now);

        cells.push({
          hour,
          timeLabel,
          status,
          session: overlapping
            ? {
                id: overlapping.id,
                customer_name: overlapping.customer_name,
                customer_phone: overlapping.customer_phone,
                start_time: overlapping.start_time,
                end_time: overlapping.end_time,
                status: overlapping.status,
                duration_minutes: overlapping.duration_minutes,
                notes: overlapping.notes,
              }
            : undefined,
        });
      }

      return {
        resourceId: r.id,
        resourceName: r.name,
        resourceType: r.type,
        hourlyRate: r.hourly_rate,
        pricingType: r.pricing_type ?? undefined,
        capacity: r.capacity ?? undefined,
        resourceStatus: r.status ?? undefined,
        cells,
      };
    });
}

/**
 * Format elapsed time as HH:MM:SS
 */
export function formatElapsed(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Generate hour labels for the grid header.
 */
export function getHourLabels(startHour = DEFAULT_START_HOUR, endHour = DEFAULT_END_HOUR): string[] {
  const labels: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    labels.push(format(d, "h a"));
  }
  return labels;
}
