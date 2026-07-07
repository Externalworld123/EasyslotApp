import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0")) cleaned = "91" + cleaned.slice(1);
  if (!cleaned.startsWith("+")) cleaned = "+91" + cleaned.replace(/^91/, "");
  if (cleaned.startsWith("+91") && cleaned.length !== 13) return "";
  return cleaned;
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    console.error("[WhatsApp] Missing API keys");
    return false;
  }

  const fromNumber = "whatsapp:+14155238886";

  try {
    const body = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: fromNumber,
      Body: message,
    });

    const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const respText = await resp.text();
    if (!resp.ok) {
      console.error("[WhatsApp] Gateway error:", resp.status, respText);
      return false;
    }
    console.log("[WhatsApp] Payment notification sent to", to);
    return true;
  } catch (e) {
    console.error("[WhatsApp] Send failed:", e.message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payment_id, action } = await req.json();

    if (!payment_id || !["verify", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "payment_id and action (verify/reject) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the payment record
    const { data: payment, error: payErr } = await supabase
      .from("public_payments")
      .select("*, sessions(customer_name, customer_phone, phone, resource_id, center_id, resources(name), centers(name))")
      .eq("id", payment_id)
      .single();

    if (payErr || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user belongs to center
    const { data: hasAccess } = await supabase.rpc("user_belongs_to_center", {
      _user_id: user.id,
      _center_id: payment.center_id,
    });

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "verify" ? "verified" : "rejected";
    const sessionPaymentStatus = action === "verify" ? "paid" : "failed";

    // Update payment status
    await supabase
      .from("public_payments")
      .update({
        status: newStatus,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", payment_id);

    // Update session payment_status
    await supabase
      .from("sessions")
      .update({ payment_status: sessionPaymentStatus })
      .eq("id", payment.session_id);

    // Send WhatsApp notification
    const phone = payment.customer_phone || payment.sessions?.customer_phone || payment.sessions?.phone;
    if (phone) {
      const formatted = formatPhone(phone);
      if (formatted) {
        const venueName = payment.sessions?.centers?.name || "EasySlot";
        const courtName = payment.sessions?.resources?.name || "Court";

        let message = "";
        if (action === "verify") {
          message = `Payment Verified ✅

💰 Amount: ₹${Number(payment.amount).toFixed(0)}
📍 Venue: ${venueName}
🎯 Court: ${courtName}
🔖 UTR: ${payment.utr_id}
🧾 Txn: ${payment.transaction_id}

Your payment has been confirmed. See you at the venue!

- EasySlot`;
        } else {
          message = `Payment Not Verified ❌

💰 Amount: ₹${Number(payment.amount).toFixed(0)}
📍 Venue: ${venueName}
🔖 UTR: ${payment.utr_id}

Your payment could not be verified. Please contact the venue or try again.

- EasySlot`;
        }

        await sendWhatsApp(formatted, message);
      }
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[verify-payment] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
