// Creates a Razorpay order. Returns { order_id, amount, currency, key_id }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) {
      return new Response(JSON.stringify({ error: "Razorpay keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount); // amount in paise
    const currency = (body.currency || "INR").toString();
    const receipt = (body.receipt || `rcpt_${Date.now()}`).toString().slice(0, 40);
    const notes = body.notes && typeof body.notes === "object" ? body.notes : {};

    if (!Number.isFinite(amount) || amount < 100) {
      return new Response(JSON.stringify({ error: "amount must be >= 100 paise" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = btoa(`${KEY_ID}:${KEY_SECRET}`);
    const resp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: Math.round(amount), currency, receipt, notes }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[razorpay-create-order] error", resp.status, data);
      return new Response(JSON.stringify({ error: data?.error?.description || "Razorpay error", details: data }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      key_id: KEY_ID,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[razorpay-create-order] fail", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
