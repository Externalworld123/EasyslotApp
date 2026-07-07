import { supabase } from "@/integrations/supabase/client";

// Grace period in minutes before overtime kicks in
export const GRACE_MINUTES = 5;

// Overtime multiplier (e.g., 1.5x after grace)
export const OVERTIME_MULTIPLIER = 1.5;

export interface StartSessionInput {
  resource_id: string;
  center_id: string;
  customer_name: string;
  customer_phone?: string;
  notes?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  /** Local day-of-week (0=Sun..6=Sat) at the customer's center — used for pricing rule lookup. */
  local_dow?: number;
  /** Local start time in minutes since midnight — used for pricing rule lookup. */
  local_start_minutes?: number;
  /** Local duration in minutes — used for segmented pricing. */
  local_duration_minutes?: number;
}

export interface EndSessionInput {
  session_id: string;
}

export interface SessionCalculation {
  duration_minutes: number;
  grace_applied: boolean;
  overtime_minutes: number;
  base_amount: number;
  overtime_amount: number;
  final_amount: number;
}

/**
 * Calculate session pricing based on duration, hourly rate, grace time, and overtime.
 */
export function calculateSession(
  startTime: string,
  endTime: string,
  hourlyRate: number,
  discountPercent: number = 0
): SessionCalculation {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const totalMs = end.getTime() - start.getTime();
  const totalMinutes = Math.max(0, Math.ceil(totalMs / 60000));

  // Minimum billing is 1 hour. For longer sessions, bill full hours.
  const billedHours = Math.max(1, Math.floor(totalMinutes / 60));
  const billedMinutes = billedHours * 60;

  // Overtime only applies when total minutes EXCEED the billed hours boundary
  const excessMinutes = totalMinutes - billedMinutes;
  let overtimeMinutes = 0;

  if (excessMinutes > GRACE_MINUTES) {
    overtimeMinutes = excessMinutes - GRACE_MINUTES;
  }

  const baseAmount = billedHours * hourlyRate;

  // Overtime is billed at the multiplier rate, pro-rated per minute
  const overtimeRate = (hourlyRate / 60) * OVERTIME_MULTIPLIER;
  const overtimeAmount = overtimeMinutes * overtimeRate;

  const subtotal = baseAmount + overtimeAmount;
  const discountAmount = subtotal * (discountPercent / 100);
  const finalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

  return {
    duration_minutes: totalMinutes,
    grace_applied: excessMinutes > 0 && excessMinutes <= GRACE_MINUTES,
    overtime_minutes: overtimeMinutes,
    base_amount: baseAmount,
    overtime_amount: Math.round(overtimeAmount * 100) / 100,
    final_amount: finalAmount,
  };
}

/**
 * Check if a resource is currently occupied (has an active session).
 */
export async function isResourceAvailable(resourceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("resource_id", resourceId)
    .eq("status", "active")
    .limit(1);

  if (error) {
    console.error("Error checking resource availability:", error);
    return false;
  }

  return (data?.length ?? 0) === 0;
}

/**
 * Start a session via edge function (server-side start_time).
 */
export async function startSession(input: StartSessionInput) {
  const { data, error } = await supabase.functions.invoke("start-session", {
    body: input,
  });

  if (error) throw new Error(error.message || "Failed to start session");
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * End a session via edge function (server-side end_time + pricing).
 */
export async function endSession(input: EndSessionInput) {
  const { data, error } = await supabase.functions.invoke("end-session", {
    body: input,
  });

  if (error) throw new Error(error.message || "Failed to end session");
  if (data?.error) throw new Error(data.error);
  return data;
}
