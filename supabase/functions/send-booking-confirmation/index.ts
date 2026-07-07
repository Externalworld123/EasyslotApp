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

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY) {
    console.error("[WhatsApp] LOVABLE_API_KEY not configured");
    return false;
  }
  if (!TWILIO_API_KEY) {
    console.error("[WhatsApp] TWILIO_API_KEY not configured");
    return false;
  }

  // Use the WhatsApp-enabled number from the Twilio account
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
    console.log("[WhatsApp] Message sent to", to);
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
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error } = await supabase
      .from("sessions")
      .select("*, resources(name), centers(name)")
      .eq("id", session_id)
      .single();

    if (error || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = session.customer_phone || session.phone;
    if (!phone) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatted = formatPhone(phone);
    if (!formatted) {
      return new Response(JSON.stringify({ ok: true, skipped: "invalid_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bookingLink = `https://www.easyslot.co.in/booking/${session_id}`;

    const courtName = session.resources?.name || "Court";
    const venueName = session.centers?.name || "EasySlot";
    const message = `Booking Confirmed ✅

📍 Venue: ${venueName}
🎯 Court: ${courtName}
⏰ Time: ${formatTime(session.start_time)}
⏱️ Duration: ${session.duration_minutes || 60} min
💰 Amount: ₹${Number(session.final_amount || 0).toFixed(0)}

Show this at center:
${bookingLink}

- EasySlot`;

    const sent = await sendWhatsApp(formatted, message);

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Confirmation] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
