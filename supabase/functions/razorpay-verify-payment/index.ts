// Verifies a Razorpay payment signature. Optionally records the payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_SECRET) {
      return new Response(JSON.stringify({ error: "Razorpay secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      // optional context for recording
      session_id, center_id, amount, customer_name, customer_phone,
      organization_id, purpose, // 'booking' | 'subscription'
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing payment fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expected = await hmacSha256Hex(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    const valid = expected === razorpay_signature;
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature", verified: false }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record outcome based on purpose
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (purpose === "booking" && session_id && center_id && amount) {
      await supabase.from("public_payments").insert({
        session_id, center_id,
        amount: Number(amount) / 100,
        utr_id: razorpay_payment_id,
        transaction_id: razorpay_order_id,
        payment_method: "razorpay",
        status: "verified",
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        verified_at: new Date().toISOString(),
      });
      await supabase.from("sessions").update({ payment_status: "paid" }).eq("id", session_id);
    } else if (purpose === "subscription" && organization_id) {
      // Extend subscription_end by 30 days
      const { data: org } = await supabase
        .from("organizations")
        .select("subscription_end")
        .eq("id", organization_id)
        .maybeSingle();
      const base = org?.subscription_end && new Date(org.subscription_end) > new Date()
        ? new Date(org.subscription_end)
        : new Date();
      base.setDate(base.getDate() + 30);
      await supabase.from("organizations").update({
        subscription_end: base.toISOString(),
        subscription_start: new Date().toISOString(),
        billing_status: "active",
        is_active: true,
      }).eq("id", organization_id);
    }

    return new Response(JSON.stringify({ verified: true, payment_id: razorpay_payment_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[razorpay-verify-payment] fail", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
