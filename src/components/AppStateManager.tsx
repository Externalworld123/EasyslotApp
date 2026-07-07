import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  saveLastRoute,
  getLastRoute,
  saveScrollPosition,
  getScrollPosition,
} from "@/lib/appStatePersistence";

/**
 * Mounts inside the Router. Handles:
 *  - Saving last route on every navigation
 *  - Saving scroll position on navigation away & on backgrounding
 *  - Restoring scroll position when returning to a route
 *  - One-time redirect on first load to last visited route
 *  - Visibility-change handling so state is flushed before tab/app sleep
 */
export function AppStateManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const restoredRef = useRef(false);
  const prevPathRef = useRef<string>(location.pathname);

  // One-time: on first mount, if user landed on "/" but had a last route, restore it
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const last = getLastRoute();
    const isRootLanding = location.pathname === "/" && !location.search;
    if (last && last !== "/" && isRootLanding) {
      navigate(last, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current route + restore scroll on every route change
  useEffect(() => {
    const path = location.pathname + location.search;

    // Save scroll for the route we are leaving
    if (prevPathRef.current && prevPathRef.current !== path) {
      saveScrollPosition(prevPathRef.current, window.scrollY);
    }

    saveLastRoute(path);

    // Restore scroll for the new route (after paint)
    const y = getScrollPosition(path);
    requestAnimationFrame(() => window.scrollTo(0, y));

    prevPathRef.current = path;
  }, [location.pathname, location.search]);

  // Flush state when app goes to background (mobile app switch, tab switch)
  useEffect(() => {
    const flush = () => {
      const path = location.pathname + location.search;
      saveScrollPosition(path, window.scrollY);
      saveLastRoute(path);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [location.pathname, location.search]);

  return null;
}
