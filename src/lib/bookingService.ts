import { supabase } from "@/integrations/supabase/client";
import { addMinutes, format, parseISO, startOfDay, endOfDay } from "date-fns";

export interface SlotInfo {
  time: string; // "09:00"
  status: "available" | "booked" | "active" | "past" | "pending";
  session?: {
    id: string;
    customer_name: string;
    start_time: string;
    end_time: string | null;
    status: string;
  };
}

export interface BookSessionInput {
  resource_id: string;
  center_id: string;
  customer_name: string;
  customer_phone?: string;
  notes?: string;
  scheduled_start: string; // ISO
  scheduled_end: string;   // ISO
}

/**
 * Fetch sessions for a resource on a given date.
 */
export async function fetchResourceSlots(
  resourceId: string,
  centerId: string,
  date: Date,
  startHour = 6,
  endHour = 23
): Promise<SlotInfo[]> {
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, customer_name, start_time, end_time, status")
    .eq("resource_id", resourceId)
    .eq("center_id", centerId)
    .in("status", ["active", "scheduled", "completed"])
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd)
    .order("start_time");

  if (error) throw error;

  const now = new Date();
  const slots: SlotInfo[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = addMinutes(slotStart, 60);
    const timeLabel = format(slotStart, "HH:mm");

    // Check if slot is in the past
    if (slotEnd <= now) {
      // Check if there was a completed/active session
      const pastSession = sessions?.find((s) => {
        const sStart = new Date(s.start_time);
        const sEnd = s.end_time ? new Date(s.end_time) : addMinutes(sStart, 60);
        return sStart < slotEnd && sEnd > slotStart;
      });
      slots.push({
        time: timeLabel,
        status: pastSession ? "booked" : "past",
        session: pastSession ? {
          id: pastSession.id,
          customer_name: pastSession.customer_name,
          start_time: pastSession.start_time,
          end_time: pastSession.end_time,
          status: pastSession.status,
        } : undefined,
      });
      continue;
    }

    // Check overlapping sessions
    const overlapping = sessions?.find((s) => {
      const sStart = new Date(s.start_time);
      const sEnd = s.end_time ? new Date(s.end_time) : addMinutes(sStart, 60);
      return sStart < slotEnd && sEnd > slotStart;
    });

    if (overlapping) {
      slots.push({
        time: timeLabel,
        status: overlapping.status === "active" ? "active" : "booked",
        session: {
          id: overlapping.id,
          customer_name: overlapping.customer_name,
          start_time: overlapping.start_time,
          end_time: overlapping.end_time,
          status: overlapping.status,
        },
      });
    } else {
      slots.push({ time: timeLabel, status: "available" });
    }
  }

  return slots;
}

/**
 * Check for booking conflicts before creating a session.
 */
export async function checkConflict(
  resourceId: string,
  centerId: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("resource_id", resourceId)
    .eq("center_id", centerId)
    .in("status", ["active", "scheduled"])
    .lt("start_time", endTime)
    .gt("scheduled_end_time", startTime)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Check capacity-based resource availability (e.g., parking).
 */
export async function checkCapacity(
  resourceId: string,
  capacity: number,
  startTime: string,
  endTime: string
): Promise<{ used: number; available: boolean }> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("resource_id", resourceId)
    .in("status", ["active", "scheduled"])
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  if (error) throw error;
  const used = data?.length ?? 0;
  return { used, available: used < capacity };
}

/**
 * Book a future session via edge function.
 */
export async function bookSession(input: BookSessionInput) {
  const { data, error } = await supabase.functions.invoke("start-session", {
    body: {
      resource_id: input.resource_id,
      center_id: input.center_id,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      notes: input.notes,
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
    },
  });

  if (error) throw new Error(error.message || "Failed to book session");
  if (data?.error) throw new Error(data.error);
  return data;
}
