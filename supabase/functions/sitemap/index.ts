import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://www.easyslot.co.in";

// Aligned with project taxonomy (memory: sports-taxonomy, primary-domain)
const CITIES = [
  "bangalore",
  "chennai",
  "hyderabad",
  "pune",
  "vijayawada",
  "mumbai",
  "delhi-ncr",
  "visakhapatnam",
  "guntur",
];

const SPORTS = [
  "badminton",
  "tennis",
  "cricket",
  "football",
  "basketball",
  "swimming",
  "table_tennis",
  "squash",
  "volleyball",
  "pickleball",
];

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache: Record<string, { xml: string; at: number }> = {};

function cached(key: string): string | null {
  const c = cache[key];
  return c && Date.now() - c.at < CACHE_TTL_MS ? c.xml : null;
}
function setCache(key: string, xml: string) {
  cache[key] = { xml, at: Date.now() };
}

// Sanitize path: trim, collapse double slashes, strip trailing slash
function sanitizePath(path: string): string {
  return path.trim().replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function addUrl(
  seen: Set<string>,
  urls: string[],
  path: string,
  lastmod: string,
  changefreq: string,
  priority: string,
  imageUrl?: string,
) {
  const clean = sanitizePath(path);
  const full = `${BASE_URL}${clean}`;
  if (seen.has(full)) return;
  seen.add(full);
  const imageBlock = imageUrl
    ? `\n    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>\n    </image:image>`
    : "";
  urls.push(
    `  <url>\n    <loc>${escapeXml(full)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${imageBlock}\n  </url>`,
  );
}

function buildUrlset(urls: string[], withImages = false): string {
  const ns = withImages
    ? `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
    : `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns}>\n${urls.join("\n")}\n</urlset>`;
}

function xmlResponse(xml: string, hit: boolean) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Cache": hit ? "HIT" : "MISS",
    },
  });
}

function fnUrl(type: string): string {
  // Self-reference to the deployed function so the sitemap-index
  // resolves regardless of the calling domain.
  return `https://nmaubhbpfmotptcwiovd.supabase.co/functions/v1/sitemap?type=${type}`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "index";

    const hit = cached(type);
    if (hit) return xmlResponse(hit, true);

    const today = new Date().toISOString().split("T")[0];

    if (type === "index") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${fnUrl("pages")}</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${fnUrl("cities")}</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${fnUrl("sports")}</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${fnUrl("city-sports")}</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${fnUrl("venues")}</loc><lastmod>${today}</lastmod></sitemap>
</sitemapindex>`;
      setCache(type, xml);
      return xmlResponse(xml, false);
    }

    if (type === "pages") {
      // Canonical landing is /easyslot-booking. The "/" route renders the
      // same component, so we deliberately omit it to avoid duplicate content.
      const seen = new Set<string>();
      const urls: string[] = [];
      addUrl(seen, urls, "/easyslot-booking", today, "daily", "1.0");
      addUrl(seen, urls, "/trainers", today, "weekly", "0.6");
      const xml = buildUrlset(urls);
      setCache(type, xml);
      return xmlResponse(xml, false);
    }

    if (type === "cities") {
      const seen = new Set<string>();
      const urls: string[] = [];
      for (const city of CITIES) {
        addUrl(seen, urls, `/easyslot-booking/${city}`, today, "daily", "0.9");
      }
      const xml = buildUrlset(urls);
      setCache(type, xml);
      return xmlResponse(xml, false);
    }

    if (type === "sports") {
      const seen = new Set<string>();
      const urls: string[] = [];
      for (const sport of SPORTS) {
        addUrl(seen, urls, `/easyslot-booking/${sport}`, today, "daily", "0.8");
      }
      const xml = buildUrlset(urls);
      setCache(type, xml);
      return xmlResponse(xml, false);
    }

    if (type === "city-sports") {
      const seen = new Set<string>();
      const urls: string[] = [];
      for (const city of CITIES) {
        for (const sport of SPORTS) {
          addUrl(
            seen,
            urls,
            `/easyslot-booking/${city}/${sport}`,
            today,
            "weekly",
            "0.7",
          );
        }
      }
      const xml = buildUrlset(urls);
      setCache(type, xml);
      return xmlResponse(xml, false);
    }

    if (type === "venues") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: venues } = await supabase
        .from("centers")
        .select("slug, updated_at, city, cover_image_url, image_url")
        .eq("is_active", true)
        .not("slug", "is", null);

      const seen = new Set<string>();
      const urls: string[] = [];
      for (const v of (venues || []) as {
        slug: string;
        updated_at: string;
        city: string | null;
        cover_image_url?: string | null;
        image_url?: string | null;
      }[]) {
        if (!v.slug || !v.slug.trim()) continue;
        const lastmod = v.updated_at ? v.updated_at.split("T")[0] : today;
        const citySlug = v.city
          ? v.city.toLowerCase().trim().replace(/\s+/g, "-")
          : null;
        const image = v.cover_image_url || v.image_url || undefined;
        // Emit exactly ONE canonical URL per venue: prefer the city-scoped
        // route when available, otherwise fall back to /venue/:slug.
        if (citySlug) {
          addUrl(
            seen,
            urls,
            `/${citySlug}/venue/${v.slug}`,
            lastmod,
            "weekly",
            "0.8",
            image || undefined,
          );
        } else {
          addUrl(
            seen,
            urls,
            `/venue/${v.slug}`,
            lastmod,
            "weekly",
            "0.6",
            image || undefined,
          );
        }
      }
      const xml = buildUrlset(urls, true);
      setCache(type, xml);
      return xmlResponse(xml, false);
    }

    return new Response("<!-- Unknown sitemap type -->", {
      status: 404,
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`<!-- Error: ${msg} -->`, {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }
});
