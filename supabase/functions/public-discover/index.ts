import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://easyslot-app.vercel.app',
  'https://www.easyslot.co.in',
  'http://localhost:5173'
];

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* GET or empty body */ }

    // Return availability_schedule for a center's resources
    if (body?.action === "availability") {
      const { center_id } = body;
      if (!center_id) {
        return new Response(JSON.stringify({ error: "center_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: resourceIds } = await supabase
        .from("resources")
        .select("id")
        .eq("center_id", center_id)
        .eq("is_active", true);

      const ids = (resourceIds || []).map((r: any) => r.id);
      if (ids.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: schedules, error: sErr } = await supabase
        .from("availability_schedule")
        .select("resource_id, day_of_week, start_time, end_time, is_closed")
        .in("resource_id", ids);

      if (sErr) throw sErr;
      return new Response(JSON.stringify(schedules || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve center by slug
    if (body?.action === "center_by_slug") {
      const { slug } = body;
      if (!slug) {
        return new Response(JSON.stringify({ error: "slug required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: c, error: sErr } = await supabase
        .from("centers")
        .select("id")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!c) {
        return new Response(JSON.stringify({ error: "Center not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Redirect to center_detail flow
      body.action = "center_detail";
      body.center_id = c.id;
    }

    // If action=center_detail, return a single center with resources + stats
    if (body?.action === "center_detail") {
      const { center_id } = body;
      if (!center_id) {
        return new Response(JSON.stringify({ error: "center_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [centerRes, resourcesRes, gamesRes, feedbackRes] = await Promise.all([
        supabase.from("centers").select("id, name, address, phone, email, is_active, slug, city").eq("id", center_id).eq("is_active", true).maybeSingle(),
        supabase.from("resources").select("id, name, type, hourly_rate, pricing_type, capacity, image_url").eq("center_id", center_id).eq("is_active", true).order("name"),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("center_id", center_id).in("status", ["completed", "active"]),
        supabase.from("feedback").select("rating, comment, customer_name, created_at").eq("center_id", center_id).order("created_at", { ascending: false }).limit(10),
      ]);

      if (centerRes.error) throw centerRes.error;
      if (!centerRes.data) {
        return new Response(JSON.stringify({ error: "Center not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ratings = feedbackRes.data || [];
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((s: number, f: any) => s + f.rating, 0) / ratings.length) * 10) / 10
        : null;

      return new Response(JSON.stringify({
        center: centerRes.data,
        resources: resourcesRes.data || [],
        totalGames: gamesRes.count || 0,
        rating: avgRating ? { avg: avgRating, count: ratings.length } : null,
        reviews: ratings,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If action=sessions, return sessions for a center+date
    if (body?.action === "sessions") {
      const { center_id, date, day_start, day_end } = body;
      if (!center_id || (!date && (!day_start || !day_end))) {
        return new Response(JSON.stringify({ error: "center_id and date or day_start/day_end required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dayStart = typeof day_start === "string" && day_start
        ? day_start
        : `${date}T00:00:00.000Z`;
      const dayEnd = typeof day_end === "string" && day_end
        ? day_end
        : `${date}T23:59:59.999Z`;

      if (Number.isNaN(new Date(dayStart).getTime()) || Number.isNaN(new Date(dayEnd).getTime())) {
        return new Response(JSON.stringify({ error: "Invalid day range" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch sessions that overlap with the selected day (handles overnight bookings)
      const { data: sessions, error } = await supabase
        .from("sessions")
        .select("resource_id, start_time, end_time, scheduled_end_time, duration_minutes, status")
        .eq("center_id", center_id)
        .lt("start_time", dayEnd)
        .gt("scheduled_end_time", dayStart)
        .in("status", ["active", "scheduled"]);

      if (error) throw error;
      return new Response(JSON.stringify(sessions || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: return all active centers with their active resources + ratings
    const [centersRes, resourcesRes, feedbackAll] = await Promise.all([
      supabase
        .from("centers")
        .select("id, name, address, slug, city, image_url, latitude, longitude")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("resources")
        .select("id, name, type, hourly_rate, pricing_type, capacity, center_id")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("feedback")
        .select("center_id, rating"),
    ]);

    if (centersRes.error) throw centersRes.error;
    if (resourcesRes.error) throw resourcesRes.error;

    // Build rating map per center
    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const f of feedbackAll.data || []) {
      const entry = ratingMap.get(f.center_id) || { sum: 0, count: 0 };
      entry.sum += f.rating;
      entry.count += 1;
      ratingMap.set(f.center_id, entry);
    }

    const result = (centersRes.data || []).map((c: any) => {
      const r = ratingMap.get(c.id);
      return {
        ...c,
        resources: (resourcesRes.data || [])
          .filter((res: any) => res.center_id === c.id)
          .map(({ center_id, ...rest }: any) => rest),
        rating: r ? Math.round((r.sum / r.count) * 10) / 10 : null,
        reviewCount: r ? r.count : 0,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
