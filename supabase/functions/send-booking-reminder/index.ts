import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.log("[WhatsApp STUB] Twilio not configured. Reminder would be sent to:", to);
    console.log("[WhatsApp STUB] Message:", message);
    return true;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: fromNumber,
      Body: message,
    });

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("[WhatsApp Reminder] Twilio error:", resp.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[WhatsApp Reminder] Send failed:", e.message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find sessions starting in next 25-35 minutes that haven't been reminded
    const now = new Date();
    const from = new Date(now.getTime() + 25 * 60 * 1000);
    const to = new Date(now.getTime() + 35 * 60 * 1000);

    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("id, customer_name, customer_phone, phone, start_time, resources(name)")
      .eq("status", "scheduled")
      .eq("reminder_sent", false)
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString())
      .limit(50);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;

    for (const session of sessions || []) {
      const rawPhone = session.customer_phone || session.phone;
      if (!rawPhone) { skipped++; continue; }

      const formatted = formatPhone(rawPhone);
      if (!formatted) { skipped++; continue; }

      const courtName = session.resources?.name || "Court";
      const message = `Reminder ⏰

Your game starts in 30 minutes!

Court: ${courtName}
Time: ${formatTime(session.start_time)}

See you soon! 🏸

- EasySlot`;

      const ok = await sendWhatsApp(formatted, message);

      if (ok) {
        await supabase
          .from("sessions")
          .update({ reminder_sent: true })
          .eq("id", session.id);
        sent++;
      }
    }

    console.log(`[Reminder] Processed: ${sent} sent, ${skipped} skipped`);

    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Reminder] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
