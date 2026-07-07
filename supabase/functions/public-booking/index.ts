import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      center_id, resource_id, customer_name, customer_phone, start_time,
      duration_minutes, payment_utr, payment_amount,
      local_dow, local_start_minutes, local_duration_minutes,
      razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpay_amount,
    } = await req.json();

    // --- Mandatory Razorpay signature verification for public bookings ---
    const hasRzp = razorpay_order_id && razorpay_payment_id && razorpay_signature;
    if (!hasRzp) {
      return new Response(JSON.stringify({ error: "Payment verification required. Please complete payment via Razorpay." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const RZP_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RZP_SECRET) {
      return new Response(JSON.stringify({ error: "Payment provider not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const expectedSig = await hmacSha256Hex(RZP_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expectedSig !== razorpay_signature) {
      console.error("[public-booking] Invalid Razorpay signature", { razorpay_order_id, razorpay_payment_id });
      return new Response(JSON.stringify({ error: "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Prevent reusing the same payment for multiple bookings
    const supabaseEarly = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: existingPayment } = await supabaseEarly
      .from("public_payments")
      .select("id, session_id")
      .eq("utr_id", razorpay_payment_id)
      .maybeSingle();
    if (existingPayment) {
      return new Response(JSON.stringify({ error: "This payment has already been used for a booking", session_id: existingPayment.session_id }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!center_id || !resource_id || !customer_name || !start_time || !customer_phone) {
      return new Response(JSON.stringify({ error: "Missing required fields (name, phone, center, resource, time)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate duration
    const dur = typeof duration_minutes === "number" && duration_minutes > 0 ? duration_minutes : 60;
    if (dur > 480) {
      return new Response(JSON.stringify({ error: "Duration too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify center exists
    const { data: center } = await supabase
      .from("centers")
      .select("id")
      .eq("id", center_id)
      .eq("is_active", true)
      .single();

    if (!center) {
      return new Response(JSON.stringify({ error: "Center not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Subscription validation: check if org can book ---
    const { data: centerOrg } = await supabase
      .from("centers")
      .select("organization_id")
      .eq("id", center_id)
      .single();

    if (centerOrg?.organization_id) {
      const { data: canBook } = await supabase.rpc("org_can_book", {
        _org_id: centerOrg.organization_id,
      });
      if (canBook === false) {
        return new Response(
          JSON.stringify({ error: "Bookings are currently unavailable for this venue. Please try again later." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch resource to compute pricing server-side
    const { data: resource, error: resErr } = await supabase
      .from("resources")
      .select("hourly_rate, capacity")
      .eq("id", resource_id)
      .eq("center_id", center_id)
      .eq("is_active", true)
      .single();

    // Fetch center UPI ID
    const { data: centerUpi } = await supabase
      .from("centers")
      .select("upi_id, name")
      .eq("id", center_id)
      .single();

    if (resErr || !resource) {
      return new Response(JSON.stringify({ error: "Resource not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resourceCapacity = Number(resource.capacity) || 1;
    const hourlyRate = Number(resource.hourly_rate) || 0;

    // Compute base_amount with pricing rules if local context provided
    let base_amount = (dur / 60) * hourlyRate;
    const hasLocalCtx =
      typeof local_start_minutes === "number" &&
      typeof local_duration_minutes === "number" &&
      typeof local_dow === "number";

    if (hasLocalCtx) {
      try {
        const { data: rules } = await supabase
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
          const minOfDay = ((cursor % (24 * 60)) + 24 * 60) % (24 * 60);
          total += hourlyAt(minOfDay) * (segLen / 60);
          cursor += segLen;
        }
        base_amount = Math.round(total * 100) / 100;
      } catch (priceErr) {
        console.error("[Pricing rules] Failed, falling back to base rate:", (priceErr as Error).message);
      }
    }

    const final_amount = base_amount;

    const qr_code = crypto.randomUUID();

    // Compute scheduled_end_time from start_time + duration
    const startDate = new Date(start_time);
    const scheduledEndTime = new Date(startDate.getTime() + dur * 60000).toISOString();

    // Get a staff user from this center to set as started_by (optional)
    const { data: staffRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("center_id", center_id)
      .limit(1)
      .maybeSingle();

    // Fall back to the organization owner if no staff role exists
    let started_by = staffRole?.user_id;
    if (!started_by) {
      const { data: org } = await supabase
        .from("centers")
        .select("organization_id")
        .eq("id", center_id)
        .single();
      if (org?.organization_id) {
        const { data: orgRow } = await supabase
          .from("organizations")
          .select("owner_id")
          .eq("id", org.organization_id)
          .single();
        started_by = orgRow?.owner_id;
      }
    }
    if (!started_by) {
      // Last resort: use any existing auth user so FK constraint is satisfied
      const { data: anyUser } = await supabase
        .from("profiles")
        .select("id")
        .limit(1)
        .single();
      started_by = anyUser?.id || null;
    }
    if (!started_by) {
      return new Response(JSON.stringify({ error: "No valid user found to assign booking" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Capacity check for shared-capacity resources ---
    if (resourceCapacity > 1) {
      const { count: currentCount, error: countError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("resource_id", resource_id)
        .eq("center_id", center_id)
        .in("status", ["active", "scheduled"])
        .lt("start_time", scheduledEndTime)
        .gt("scheduled_end_time", start_time);

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

    const { data: session, error } = await supabase.from("sessions").insert({
      center_id,
      resource_id,
      customer_name,
      customer_phone: customer_phone || null,
      start_time,
      scheduled_end_time: scheduledEndTime,
      duration_minutes: dur,
      status: "scheduled",
      started_by,
      base_amount,
      final_amount,
      qr_code,
    }).select("id, qr_code").single();

    if (error) throw error;

    // Upsert customer record using phone as the unique key
    try {
      const cleanPhone = customer_phone.replace(/[^0-9]/g, "");
      // Check if customer with this phone exists in this center
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id, total_sessions, lifetime_value")
        .eq("center_id", center_id)
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (existingCustomer) {
        // Update existing customer: increment sessions and add to lifetime value
        await supabase
          .from("customers")
          .update({
            name: customer_name,
            total_sessions: (existingCustomer.total_sessions || 0) + 1,
            lifetime_value: Number(existingCustomer.lifetime_value || 0) + final_amount,
          })
          .eq("id", existingCustomer.id);
      } else {
        // Create new customer
        await supabase
          .from("customers")
          .insert({
            center_id,
            name: customer_name,
            phone: cleanPhone,
            total_sessions: 1,
            lifetime_value: final_amount,
          });
      }
    } catch (custErr) {
      console.error("[Customer upsert] Error:", custErr.message);
      // Don't fail the booking if customer upsert fails
    }

    // Record the verified Razorpay payment and mark session as paid
    try {
      await supabase.from("public_payments").insert({
        session_id: session.id,
        center_id,
        amount: Number(razorpay_amount) ? Number(razorpay_amount) / 100 : final_amount,
        utr_id: razorpay_payment_id,
        transaction_id: razorpay_order_id,
        payment_method: "razorpay",
        status: "verified",
        customer_name,
        customer_phone: customer_phone || null,
        verified_at: new Date().toISOString(),
      });
      await supabase.from("sessions").update({ payment_status: "paid" }).eq("id", session.id);
    } catch (payErr) {
      console.error("[Razorpay payment record] Error:", (payErr as Error).message);
    }


    // Await WhatsApp confirmation so the runtime doesn't exit early
    try {
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-booking-confirmation`;
      const confirmResp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ session_id: session.id }),
      });
      const confirmBody = await confirmResp.text();
      console.log("[Confirmation trigger] Status:", confirmResp.status, "Body:", confirmBody);
    } catch (e) {
      console.error("[Confirmation trigger] Error:", e.message);
    }

    return new Response(JSON.stringify({
      ...session,
      upi_id: centerUpi?.upi_id || null,
      center_name: centerUpi?.name || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
