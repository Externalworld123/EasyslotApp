/**
 * App state persistence utilities.
 * Saves last route + scroll position so users resume exactly where they left off
 * after backgrounding the app, switching tabs, or reloading.
 */

const LAST_ROUTE_KEY = "easyslot_last_route";
const SCROLL_KEY_PREFIX = "easyslot_scroll_";

// Routes we never restore to (transient flows)
const EXCLUDED_ROUTES = [
  "/login",
  "/accept-invite",
  "/booking-success",
  "/onboarding",
];

export function saveLastRoute(path: string) {
  if (!path || path === "/") return;
  if (EXCLUDED_ROUTES.some((r) => path.startsWith(r))) return;
  try {
    localStorage.setItem(LAST_ROUTE_KEY, path);
  } catch {}
}

export function getLastRoute(): string | null {
  try {
    return localStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}

export function clearLastRoute() {
  try {
    localStorage.removeItem(LAST_ROUTE_KEY);
  } catch {}
}

export function saveScrollPosition(path: string, y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY_PREFIX + path, String(y));
  } catch {}
}

export function getScrollPosition(path: string): number {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY_PREFIX + path);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}
