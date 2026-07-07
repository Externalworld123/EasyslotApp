import { useState, useEffect, useCallback } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Auto-hide after 10s
  useEffect(() => {
    if (!visible || dismissed) return;
    const t = setTimeout(() => {
      setAnimateOut(true);
      setTimeout(() => setVisible(false), 400);
    }, 10000);
    return () => clearTimeout(t);
  }, [visible, dismissed]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      toast.success("App installed successfully!");
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setAnimateOut(true);
    setTimeout(() => setVisible(false), 400);
  }, []);

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-[60] transition-all duration-400",
        animateOut
          ? "translate-y-full opacity-0"
          : "translate-y-0 opacity-100 animate-in slide-in-from-bottom-8 fade-in duration-500"
      )}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/95 to-primary shadow-2xl shadow-primary/25 border border-primary-foreground/10 backdrop-blur-xl">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-primary-foreground/10" />
        <div className="absolute -bottom-4 -left-4 h-14 w-14 rounded-full bg-primary-foreground/5" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative flex items-center gap-3.5 px-4 py-3.5">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20 backdrop-blur-sm ring-1 ring-primary-foreground/10">
            <Smartphone className="h-6 w-6 text-primary-foreground" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary-foreground leading-tight">
              Download the App
            </p>
            <p className="text-[11px] text-primary-foreground/70 mt-0.5 leading-snug">
              Quick access · Offline ready · Instant bookings
            </p>
          </div>

          {/* Install CTA */}
          <button
            onClick={handleInstall}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary-foreground px-3.5 py-2 text-xs font-bold text-primary shadow-lg hover:scale-105 active:scale-95 transition-all touch-manipulation"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
        </div>

        {/* Progress bar for auto-dismiss */}
        {!dismissed && (
          <div className="h-0.5 bg-primary-foreground/10">
            <div className="h-full bg-primary-foreground/40 animate-[shrink_10s_linear_forwards]" />
          </div>
        )}
      </div>
    </div>
  );
}
