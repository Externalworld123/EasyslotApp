import { useEffect } from "react";

interface SeoOptions {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "product";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const BASE_URL = "https://www.easyslot.co.in";
const DEFAULT_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7615763e-929c-4d1e-bd9f-954a0759bf53";

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function buildCanonical(path?: string): string {
  if (!path) return `${BASE_URL}${window.location.pathname}`.replace(/\/$/, "") || BASE_URL;
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path}`.replace(/\/$/, "") || BASE_URL;
}

/**
 * Per-route SEO: updates title, description, canonical, OG/Twitter tags
 * and optional JSON-LD. Lightweight alternative to react-helmet-async.
 */
export function useSeo(options: SeoOptions) {
  const {
    title,
    description,
    canonical,
    image = DEFAULT_IMAGE,
    type = "website",
    jsonLd,
    noindex = false,
  } = options;

  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', { name: "description", content: description });
      upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
      upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    }

    if (title) {
      upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
      upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    }

    const canonicalUrl = buildCanonical(canonical);
    upsertLink("canonical", canonicalUrl);
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });

    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large",
    });

    // JSON-LD
    const existingLd = document.head.querySelector<HTMLScriptElement>('script[data-seo-jsonld="true"]');
    if (existingLd) existingLd.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = "true";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, canonical, image, type, jsonLd, noindex]);
}
