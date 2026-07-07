import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Simple in-memory cache
const cache = new Map<string, { data: unknown; at: number }>();
function cached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < ttlMs) return entry.data as T;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, at: Date.now() });
}

// Rate limiter: simple sliding window per IP
const rateBuckets = new Map<string, number[]>();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  if (hits.length >= RATE_LIMIT) return true;
  hits.push(now);
  rateBuckets.set(ip, hits);
  return false;
}

function json(cors: Record<string, string>, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}

function err(cors: Record<string, string>, msg: string, status = 400) {
  return json(cors, { error: msg }, status);
}

Deno.serve(async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return err(cors, "Method not allowed", 405);

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) return err(cors, "Too many requests", 429);

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "health";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ──── /health ────
    if (endpoint === "health") {
      return json(cors, { status: "ok", timestamp: new Date().toISOString() });
    }

    // ──── /cities ────
    if (endpoint === "cities") {
      const CACHE_KEY = "cities";
      const hit = cached<string[]>(CACHE_KEY, 5 * 60_000);
      if (hit) return json(cors, hit);

      const { data, error } = await supabase
        .from("centers")
        .select("city")
        .eq("is_active", true)
        .not("city", "is", null);
      if (error) throw error;

      const cities = [...new Set((data || []).map((c: any) => c.city).filter(Boolean))].sort();
      setCache(CACHE_KEY, cities);
      return json(cors, cities);
    }

    // ──── /areas?city= ────
    if (endpoint === "areas") {
      const city = url.searchParams.get("city");
      if (!city) return err(cors, "city parameter required");

      const CACHE_KEY = `areas:${city.toLowerCase()}`;
      const hit = cached<string[]>(CACHE_KEY, 5 * 60_000);
      if (hit) return json(cors, hit);

      const { data, error } = await supabase
        .from("centers")
        .select("area")
        .eq("is_active", true)
        .ilike("city", city)
        .not("area", "is", null);
      if (error) throw error;

      const areas = [...new Set((data || []).map((c: any) => c.area).filter(Boolean))].sort();
      setCache(CACHE_KEY, areas);
      return json(cors, areas);
    }

    // ──── /centers?city=&area=&sport= ────
    if (endpoint === "centers") {
      const city = url.searchParams.get("city");
      const area = url.searchParams.get("area");
      const sport = url.searchParams.get("sport");

      const CACHE_KEY = `centers:${city || ""}:${area || ""}:${sport || ""}`.toLowerCase();
      const hit = cached<unknown>(CACHE_KEY, 5 * 60_000);
      if (hit) return json(cors, hit);

      // Fetch centers
      let centerQuery = supabase
        .from("centers")
        .select("id, name, city, area, address, slug, image_url, latitude, longitude")
        .eq("is_active", true);

      if (city) centerQuery = centerQuery.ilike("city", city);
      if (area) centerQuery = centerQuery.ilike("area", area);

      const { data: centers, error: cErr } = await centerQuery.order("name");
      if (cErr) throw cErr;

      const centerIds = (centers || []).map((c: any) => c.id);
      if (centerIds.length === 0) {
        setCache(CACHE_KEY, []);
        return json(cors, []);
      }

      // Fetch resources for these centers
      let resQuery = supabase
        .from("resources")
        .select("id, name, type, hourly_rate, pricing_type, capacity, center_id")
        .eq("is_active", true)
        .in("center_id", centerIds);
      if (sport) resQuery = resQuery.ilike("type", sport);

      const [resResult, feedbackResult] = await Promise.all([
        resQuery.order("name"),
        supabase.from("feedback").select("center_id, rating").in("center_id", centerIds),
      ]);

      if (resResult.error) throw resResult.error;

      // Build rating map
      const ratingMap = new Map<string, { sum: number; count: number }>();
      for (const f of feedbackResult.data || []) {
        const e = ratingMap.get(f.center_id) || { sum: 0, count: 0 };
        e.sum += f.rating;
        e.count++;
        ratingMap.set(f.center_id, e);
      }

      // Build resource map
      const resourceMap = new Map<string, any[]>();
      for (const r of resResult.data || []) {
        const list = resourceMap.get(r.center_id) || [];
        list.push({ id: r.id, name: r.name, sport: r.type, price: r.hourly_rate, capacity: r.capacity });
        resourceMap.set(r.center_id, list);
      }

      // If filtering by sport, only include centers that have matching resources
      const result = (centers || [])
        .filter((c: any) => !sport || (resourceMap.get(c.id)?.length ?? 0) > 0)
        .map((c: any) => {
          const r = ratingMap.get(c.id);
          const resources = resourceMap.get(c.id) || [];
          const sports = [...new Set(resources.map((res: any) => res.sport))];
          const minPrice = resources.length > 0 ? Math.min(...resources.map((res: any) => res.price)) : null;
          return {
            id: c.id,
            name: c.name,
            city: c.city,
            area: c.area,
            address: c.address,
            slug: c.slug,
            venueUrl: c.slug && c.city
              ? `/${c.city.toLowerCase().replace(/\s+/g, "-")}/venue/${c.slug}`
              : c.slug ? `/venue/${c.slug}` : null,
            image_url: c.image_url,
            latitude: c.latitude,
            longitude: c.longitude,
            sports,
            price: minPrice,
            rating: r ? Math.round((r.sum / r.count) * 10) / 10 : null,
            reviewCount: r ? r.count : 0,
            resourceCount: resources.length,
          };
        });

      setCache(CACHE_KEY, result);
      return json(cors, result);
    }

    // ──── /slots?centerId=&date= ────
    if (endpoint === "slots") {
      const centerId = url.searchParams.get("centerId");
      const date = url.searchParams.get("date"); // YYYY-MM-DD
      if (!centerId) return err(cors, "centerId parameter required");

      const targetDate = date || new Date().toISOString().split("T")[0];
      const CACHE_KEY = `slots:${centerId}:${targetDate}`;
      const hit = cached<unknown>(CACHE_KEY, 60_000); // 1 min cache
      if (hit) return json(cors, hit);

      // Get resources for center
      const { data: resources, error: rErr } = await supabase
        .from("resources")
        .select("id, name, type, hourly_rate, capacity")
        .eq("center_id", centerId)
        .eq("is_active", true);
      if (rErr) throw rErr;
      if (!resources || resources.length === 0) {
        setCache(CACHE_KEY, []);
        return json(cors, []);
      }

      const resourceIds = resources.map((r: any) => r.id);
      const dayStart = `${targetDate}T00:00:00.000Z`;
      const dayEnd = `${targetDate}T23:59:59.999Z`;

      // Fetch booked sessions + availability schedule in parallel
      const dayOfWeek = new Date(targetDate).getDay(); // 0=Sun

      const [sessionsRes, scheduleRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("resource_id, start_time, scheduled_end_time, status")
          .in("resource_id", resourceIds)
          .lt("start_time", dayEnd)
          .gt("scheduled_end_time", dayStart)
          .in("status", ["active", "scheduled"]),
        supabase
          .from("availability_schedule")
          .select("resource_id, start_time, end_time, is_closed")
          .in("resource_id", resourceIds)
          .eq("day_of_week", dayOfWeek),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (scheduleRes.error) throw scheduleRes.error;

      // Build schedule map (resource_id → open hours)
      const scheduleMap = new Map<string, { start: string; end: string; closed: boolean }>();
      for (const s of scheduleRes.data || []) {
        scheduleMap.set(s.resource_id, { start: s.start_time, end: s.end_time, closed: s.is_closed });
      }

      // Build sessions map (resource_id → booked slots count per hour)
      const bookingMap = new Map<string, Map<string, number>>();
      for (const s of sessionsRes.data || []) {
        const rMap = bookingMap.get(s.resource_id) || new Map<string, number>();
        const startHour = new Date(s.start_time).getUTCHours();
        const endHour = new Date(s.scheduled_end_time).getUTCHours() || 24;
        for (let h = startHour; h < endHour; h++) {
          const key = `${h.toString().padStart(2, "0")}:00`;
          rMap.set(key, (rMap.get(key) || 0) + 1);
        }
        bookingMap.set(s.resource_id, rMap);
      }

      // Generate slot grid
      const slots: any[] = [];
      for (const resource of resources) {
        const sched = scheduleMap.get(resource.id);
        if (!sched || sched.closed) continue;

        const openHour = parseInt(sched.start.split(":")[0], 10);
        const closeHour = parseInt(sched.end.split(":")[0], 10) || 24;
        const capacity = resource.capacity || 1;
        const rBookings = bookingMap.get(resource.id) || new Map();

        for (let h = openHour; h < closeHour; h++) {
          const timeKey = `${h.toString().padStart(2, "0")}:00`;
          const booked = rBookings.get(timeKey) || 0;
          const available = booked < capacity;
          const spotsLeft = capacity - booked;

          slots.push({
            resourceId: resource.id,
            resourceName: resource.name,
            sport: resource.type,
            time: timeKey,
            available,
            spotsLeft: capacity > 1 ? spotsLeft : undefined,
            capacity: capacity > 1 ? capacity : undefined,
            price: resource.hourly_rate,
          });
        }
      }

      setCache(CACHE_KEY, slots);
      return json(cors, slots);
    }

    // ──── /sports ────
    if (endpoint === "sports") {
      const CACHE_KEY = "sports";
      const hit = cached<unknown>(CACHE_KEY, 5 * 60_000);
      if (hit) return json(cors, hit);

      const { data, error } = await supabase
        .from("resources")
        .select("type")
        .eq("is_active", true);
      if (error) throw error;

      const sports = [...new Set((data || []).map((r: any) => r.type).filter(Boolean))].sort();
      setCache(CACHE_KEY, sports);
      return json(cors, sports);
    }

    // ──── /payment-info?centerId= ────
    // Returns the UPI ID for a center to power the public checkout UPI screen.
    // Kept behind the edge function so anon SQL clients cannot enumerate UPI IDs.
    if (endpoint === "payment-info") {
      const centerId = url.searchParams.get("centerId");
      if (!centerId) return err(cors, "centerId parameter required");

      const { data, error } = await supabase
        .from("centers")
        .select("upi_id, name")
        .eq("id", centerId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return err(cors, "Center not found", 404);

      return json(cors, { upi_id: data.upi_id, name: data.name });
    }

    return err(cors, "Unknown endpoint. Use: health, cities, areas, centers, slots, sports, payment-info", 404);
  } catch (e: any) {
    console.error("public-api error:", e);
    return err(cors, "Internal server error", 500);
  }
});
