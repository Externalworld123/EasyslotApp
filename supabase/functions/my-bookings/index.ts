import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, phone, session_id } = await req.json();

    if (action === "list" && phone) {
      const cleanPhone = phone.replace(/\s+/g, "").trim();
      if (cleanPhone.length < 5) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, customer_phone, start_time, end_time, duration_minutes, status, base_amount, final_amount, qr_code, resource_id, center_id, resources(name, type), centers(name, address)")
        .or(`customer_phone.eq.${cleanPhone},phone.eq.${cleanPhone}`)
        .order("start_time", { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "detail" && session_id) {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, customer_phone, phone, start_time, end_time, duration_minutes, status, payment_status, base_amount, final_amount, discount_percent, qr_code, notes, resource_id, center_id, created_at, resources(name, type), centers(name, address, phone)")
        .eq("id", session_id)
        .single();

      if (error) throw error;

      // Latest verified public payment (Razorpay/UPI) for this session
      const { data: latestPayment } = await supabase
        .from("public_payments")
        .select("id, amount, payment_method, status, utr_id, transaction_id, verified_at, created_at")
        .eq("session_id", session_id)
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({ ...data, latest_payment: latestPayment || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel" && session_id && phone) {
      const cleanPhone = phone.replace(/\s+/g, "").trim();

      // Fetch session
      const { data: session, error: fetchErr } = await supabase
        .from("sessions")
        .select("id, customer_phone, phone, start_time, status")
        .eq("id", session_id)
        .single();

      if (fetchErr || !session) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership by phone
      if (session.customer_phone !== cleanPhone && session.phone !== cleanPhone) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (session.status !== "scheduled") {
        return new Response(JSON.stringify({ error: "Only scheduled bookings can be cancelled" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check 2-hour window
      const startTime = new Date(session.start_time).getTime();
      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (startTime - now < twoHoursMs) {
        return new Response(JSON.stringify({ error: "Cannot cancel within 2 hours of start time" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabase
        .from("sessions")
        .update({ status: "cancelled" })
        .eq("id", session_id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
