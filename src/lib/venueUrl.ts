/**
 * Canonical, SEO-friendly venue URL builder.
 *
 * Priority:
 *   1. `/{citySlug}/venue/{slug}`   (preferred, matches sitemap canonical)
 *   2. `/venue/{slug}`              (slug-only fallback)
 *   3. `/easyslot-booking/center/{id}` (legacy UUID fallback — last resort)
 *
 * Keep this in sync with the sitemap edge function and useSeo canonical
 * logic so search engines see exactly one URL per venue.
 */
export function citySlugify(city?: string | null): string | null {
  if (!city) return null;
  const s = city.toLowerCase().trim().replace(/\s+/g, "-");
  return s || null;
}

export interface VenueUrlInput {
  id: string;
  slug?: string | null;
  city?: string | null;
}

export function buildVenueUrl(v: VenueUrlInput): string {
  const slug = v.slug?.trim();
  if (slug) {
    const city = citySlugify(v.city);
    return city ? `/${city}/venue/${slug}` : `/venue/${slug}`;
  }
  return `/easyslot-booking/center/${v.id}`;
}
