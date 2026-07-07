import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeToMinute = (date: Date) => {
  const normalized = new Date(date);
  normalized.setUTCSeconds(0, 0);
  return normalized;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const {
      resource_id,
      center_id,
      customer_name,
      customer_phone,
      notes,
      scheduled_start,
      scheduled_end,
      local_dow,
      local_start_minutes,
      local_duration_minutes,
    } = await req.json();

    if (!resource_id || !center_id || !customer_name) {
      return new Response(
        JSON.stringify({ error: "resource_id, center_id, and customer_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();

    // Validate resource through user-scoped client
    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, is_active, center_id, status, hourly_rate, capacity, type")
      .eq("id", resource_id)
      .eq("center_id", center_id)
      .single();

    if (resourceError || !resource) {
      return new Response(JSON.stringify({ error: "Resource not found or invalid" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resource.is_active || resource.status === "maintenance") {
      return new Response(JSON.stringify({ error: "Resource not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Subscription validation: check if org can book ---
    const { data: centerOrg } = await adminSupabase
      .from("centers")
      .select("organization_id")
      .eq("id", center_id)
      .single();

    if (centerOrg?.organization_id) {
      const { data: canBook } = await adminSupabase.rpc("org_can_book", {
        _org_id: centerOrg.organization_id,
      });
      if (canBook === false) {
        return new Response(
          JSON.stringify({ error: "Bookings are disabled for your plan. Please upgrade or renew your subscription." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Cleanup stale sessions before conflict checks
    const nowIso = now.toISOString();

    const { error: staleActiveError } = await adminSupabase
      .from("sessions")
      .update({ status: "completed", end_time: nowIso })
      .eq("resource_id", resource_id)
      .eq("center_id", center_id)
      .eq("status", "active")
      .lt("scheduled_end_time", nowIso);

    if (staleActiveError) {
      return new Response(JSON.stringify({ error: staleActiveError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: staleScheduledError } = await adminSupabase
      .from("sessions")
      .update({ status: "no_show", end_time: nowIso })
      .eq("resource_id", resource_id)
      .eq("center_id", center_id)
      .eq("status", "scheduled")
      .lt("scheduled_end_time", nowIso);

    if (staleScheduledError) {
      return new Response(JSON.stringify({ error: staleScheduledError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = scheduled_start
      ? normalizeToMinute(new Date(scheduled_start))
      : now;
    if (Number.isNaN(start.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid start time" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let end = scheduled_end
      ? normalizeToMinute(new Date(scheduled_end))
      : new Date(start.getTime() + 60 * 60000);

    // Walk-in: cap end time at the next scheduled booking start
    if (!scheduled_start) {
      const { data: nextScheduled, error: nextScheduledError } = await adminSupabase
        .from("sessions")
        .select("start_time")
        .eq("resource_id", resource_id)
        .eq("center_id", center_id)
        .eq("status", "scheduled")
        .gte("start_time", start.toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextScheduledError) {
        return new Response(JSON.stringify({ error: nextScheduledError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (nextScheduled?.start_time) {
        const nextStart = new Date(nextScheduled.start_time);
        if (!Number.isNaN(nextStart.getTime()) && nextStart < end) {
          end = nextStart;
        }
      }
    }

    if (Number.isNaN(end.getTime()) || end <= start) {
      return new Response(JSON.stringify({ error: "No free time window available for this walk-in" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duration_minutes = Math.ceil((end.getTime() - start.getTime()) / 60000);
    const sessionStatus = scheduled_start ? "scheduled" : "active";

    // Check monthly plan conflicts
    const startDateStr = start.toISOString().split("T")[0];
    const startHour = start.getUTCHours !== undefined ? start.getHours() : 0;
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = startMinutes + duration_minutes;
    const dow = start.getDay();

    const { data: conflictingPlans } = await adminSupabase
      .from("monthly_plans")
      .select("id, slot_time, duration_minutes, days_of_week")
      .eq("resource_id", resource_id)
      .eq("center_id", center_id)
      .eq("is_active", true)
      .lte("start_date", startDateStr)
      .gte("end_date", startDateStr);

    if (conflictingPlans && conflictingPlans.length > 0) {
      const hasConflict = conflictingPlans.some((plan: any) => {
        if (!plan.days_of_week?.includes(dow)) return false;
        const [ph, pm] = (plan.slot_time || "0:0").split(":").map(Number);
        const planStart = ph * 60 + (pm || 0);
        const planEnd = planStart + (plan.duration_minutes || 60);
        return startMinutes < planEnd && endMinutes > planStart;
      });

      if (hasConflict) {
        return new Response(
          JSON.stringify({ error: "This slot is reserved by a monthly plan" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // --- Capacity check for shared-capacity resources (e.g., swimming pools) ---
    const resourceCapacity = Number(resource.capacity) || 1;

    if (resourceCapacity > 1) {
      // Atomic count of overlapping active/scheduled sessions
      const { count: currentCount, error: countError } = await adminSupabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("resource_id", resource_id)
        .eq("center_id", center_id)
        .in("status", ["active", "scheduled"])
        .lt("start_time", end.toISOString())
        .gt("scheduled_end_time", start.toISOString());

      if (countError) {
        return new Response(JSON.stringify({ error: countError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ((currentCount ?? 0) >= resourceCapacity) {
        return new Response(
          JSON.stringify({
            error: `Slot full — all ${resourceCapacity} spots are booked`,
            capacity: resourceCapacity,
            current: currentCount,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Compute pricing — apply active pricing_rules in 30-min segments so
    // slots that straddle a boundary (e.g. 17:30 → 18:30) are billed correctly.
    const hourlyRate = Number(resource.hourly_rate) || 0;

    // Default to base hourly rate × duration
    let base_amount = (duration_minutes / 60) * hourlyRate;

    // If client passed local time context, evaluate pricing rules in that frame
    const hasLocalCtx =
      typeof local_start_minutes === "number" &&
      typeof local_duration_minutes === "number" &&
      typeof local_dow === "number";

    if (hasLocalCtx) {
      try {
        const { data: rules } = await adminSupabase
          .from("pricing_rules")
          .select("resource_id, day_of_week, start_time, end_time, price_multiplier, flat_price, is_active")
          .eq("center_id", center_id)
          .eq("is_active", true);

        const activeRules = (rules ?? []).filter((r: any) => {
          if (r.resource_id !== null && r.resource_id !== resource_id) return false;
          if (r.day_of_week !== null && r.day_of_week !== local_dow) return false;
          return true;
        });

        const toMin = (t: string | null): number | null => {
          if (!t) return null;
          const [h = "0", m = "0"] = t.split(":");
          return Number(h) * 60 + Number(m);
        };

        const hourlyAt = (minOfDay: number): number => {
          const matching = activeRules.filter((r: any) => {
            const s = toMin(r.start_time);
            const e = toMin(r.end_time);
            if (s == null || e == null) return true;
            if (s <= e) return minOfDay >= s && minOfDay < e;
            // overnight
            return minOfDay >= s || minOfDay < e;
          });
          if (!matching.length) return hourlyRate;
          const flats = matching
            .map((r: any) => r.flat_price)
            .filter((p: any) => p !== null && p !== undefined && !Number.isNaN(Number(p)))
            .map((p: any) => Number(p));
          if (flats.length) return Math.max(...flats);
          const mult = Math.max(...matching.map((r: any) => Number(r.price_multiplier) || 1));
          return hourlyRate * mult;
        };

        const segMin = 30;
        let total = 0;
        let cursor = local_start_minutes as number;
        const endMin = (local_start_minutes as number) + (local_duration_minutes as number);
        while (cursor < endMin - 1e-6) {
          const segLen = Math.min(segMin, endMin - cursor);
          // Wrap minute-of-day for overnight bookings
          const minOfDay = ((cursor % (24 * 60)) + 24 * 60) % (24 * 60);
          total += hourlyAt(minOfDay) * (segLen / 60);
          cursor += segLen;
        }
        base_amount = Math.round(total * 100) / 100;
      } catch (priceErr) {
        console.error("[Pricing rules] Failed, falling back to base rate:", priceErr);
      }
    }

    const final_amount = base_amount;

    const { data: session, error: insertError } = await supabase
      .from("sessions")
      .insert({
        resource_id,
        center_id,
        customer_name,
        customer_phone: customer_phone || null,
        notes: notes || null,
        started_by: userId,
        start_time: start.toISOString(),
        scheduled_end_time: end.toISOString(),
        end_time: null,
        duration_minutes,
        status: sessionStatus,
        base_amount,
        final_amount,
        discount_percent: 0,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.message?.includes("no_overlap_sessions")) {
        return new Response(
          JSON.stringify({ error: "Time slot conflicts with an existing booking" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert customer record using phone as unique key (same logic as public-booking)
    if (customer_phone) {
      try {
        const cleanPhone = customer_phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length >= 10) {
          const { data: existingCustomer } = await adminSupabase
            .from("customers")
            .select("id, total_sessions, lifetime_value")
            .eq("center_id", center_id)
            .eq("phone", cleanPhone)
            .maybeSingle();

          if (existingCustomer) {
            await adminSupabase
              .from("customers")
              .update({
                name: customer_name,
                total_sessions: (existingCustomer.total_sessions || 0) + 1,
                lifetime_value: Number(existingCustomer.lifetime_value || 0) + final_amount,
              })
              .eq("id", existingCustomer.id);
          } else {
            await adminSupabase
              .from("customers")
              .insert({
                center_id,
                name: customer_name,
                phone: cleanPhone,
                total_sessions: 1,
                lifetime_value: final_amount,
              });
          }
        }
      } catch (custErr) {
        console.error("[Customer upsert] Error:", custErr);
      }
    }

    return new Response(JSON.stringify(session), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
