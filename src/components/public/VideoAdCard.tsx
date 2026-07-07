import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const AD_CLIENT = "ca-pub-4790368007663293";
const AD_SLOT = "8285040500";
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

let scriptLoadingPromise: Promise<void> | null = null;

/** Load the AdSense script exactly once, on demand. */
function loadAdSenseScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`,
    );
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = SCRIPT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("AdSense script failed to load"));
    document.head.appendChild(s);
  });

  return scriptLoadingPromise;
}

/**
 * VideoAdCard — AdSense ad rendered in the same shape as VenueCard.
 * The AdSense script is loaded lazily, only after the card scrolls
 * into the viewport (IntersectionObserver, 200px rootMargin).
 */
export default function VideoAdCard() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const pushedRef = useRef(false);

  // Observe until the card enters the viewport
  useEffect(() => {
    if (!containerRef.current || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(containerRef.current);
    return () => io.disconnect();
  }, [visible]);

  // Once visible, load the script then push the ad slot
  useEffect(() => {
    if (!visible || pushedRef.current) return;
    let cancelled = false;
    loadAdSenseScript()
      .then(() => {
        if (cancelled || pushedRef.current) return;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
        } catch {
          /* ignore — will retry on next mount */
        }
      })
      .catch(() => {
        /* network/blocker — silently ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-card border border-border shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_10px_15px_-3px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.06)]"
    >
      <div className="relative h-44 sm:h-52 overflow-hidden bg-muted/40">
        {visible && (
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", height: "100%" }}
            data-ad-client={AD_CLIENT}
            data-ad-slot={AD_SLOT}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
        <span className="absolute top-2.5 right-2.5 inline-flex items-center px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-[10px] font-bold text-muted-foreground shadow-sm">
          Ad
        </span>
      </div>
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Sponsored</span>
        <span className="text-[10px] text-muted-foreground">Google Ads</span>
      </div>
    </div>
  );
}
