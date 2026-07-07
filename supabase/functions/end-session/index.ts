import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRACE_MINUTES = 5;
const OVERTIME_MULTIPLIER = 1.5;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for auto-mode (bypasses RLS)
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));

    // ── AUTO MODE: batch end expired sessions ──
    if (body.auto === true) {
      const now = new Date().toISOString();

      // Complete expired active sessions
      const { data: expiredActive, error: fetchErr1 } = await adminSupabase
        .from("sessions")
        .select("id, scheduled_end_time")
        .eq("status", "active")
        .lt("scheduled_end_time", now);

      if (fetchErr1) {
        return new Response(JSON.stringify({ error: fetchErr1.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let processed = 0;
      for (const s of expiredActive || []) {
        const { error: updateError } = await adminSupabase
          .from("sessions")
          .update({
            status: "completed",
            end_time: s.scheduled_end_time,
          })
          .eq("id", s.id);
        if (!updateError) processed++;
      }

      // Also mark past scheduled sessions as no_show
      const { data: expiredScheduled } = await adminSupabase
        .from("sessions")
        .select("id")
        .eq("status", "scheduled")
        .lt("scheduled_end_time", now);

      let noShows = 0;
      for (const s of expiredScheduled || []) {
        const { error: updateError } = await adminSupabase
          .from("sessions")
          .update({ status: "no_show", end_time: now })
          .eq("id", s.id);
        if (!updateError) noShows++;
      }

      return new Response(
        JSON.stringify({ success: true, auto_ended: processed, no_shows: noShows }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── MANUAL MODE: end a specific session ──
    const { session_id } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("*, resources:resource_id(hourly_rate)")
      .eq("id", session_id)
      .eq("status", "active")
      .single();

    if (fetchError || !session) {
      return new Response(JSON.stringify({ error: "Active session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hourlyRate = (session as any).resources?.hourly_rate ?? 0;
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const totalMs = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.max(0, Math.ceil(totalMs / 60000));

    const billedHours = Math.max(1, Math.floor(totalMinutes / 60));
    const billedMinutes = billedHours * 60;
    const excessMinutes = totalMinutes - billedMinutes;
    let overtimeMinutes = 0;

    if (excessMinutes > GRACE_MINUTES) {
      overtimeMinutes = excessMinutes - GRACE_MINUTES;
    }

    const baseAmount = billedHours * hourlyRate;
    const overtimeRate = (hourlyRate / 60) * OVERTIME_MULTIPLIER;
    const overtimeAmount = Math.round(overtimeMinutes * overtimeRate * 100) / 100;

    const subtotal = baseAmount + overtimeAmount;
    const discountPercent = session.discount_percent || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const finalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    const graceApplied = excessMinutes > 0 && excessMinutes <= GRACE_MINUTES;

    const { data: updated, error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        end_time: endTime.toISOString(),
        duration_minutes: totalMinutes,
        base_amount: baseAmount,
        final_amount: finalAmount,
      })
      .eq("id", session_id)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        session: updated,
        calculation: {
          duration_minutes: totalMinutes,
          grace_applied: graceApplied,
          overtime_minutes: overtimeMinutes,
          base_amount: baseAmount,
          overtime_amount: overtimeAmount,
          final_amount: finalAmount,
          hourly_rate: hourlyRate,
          discount_percent: discountPercent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
