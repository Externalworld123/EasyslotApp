import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hub3DIcon — a consistent "3D" icon used across Booking Hub tiles.
 * Renders a Lucide icon inside a glossy gradient sphere with a top
 * highlight and soft drop shadow, giving an Apple-style 3D look while
 * keeping a unified, themeable icon set (no emoji).
 */
export type Hub3DTone =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "sky";

const TONE_GRADIENT: Record<Hub3DTone, string> = {
  blue:    "from-blue-400 via-blue-500 to-indigo-700",
  violet:  "from-violet-400 via-fuchsia-500 to-purple-700",
  emerald: "from-emerald-400 via-emerald-500 to-teal-700",
  amber:   "from-amber-300 via-orange-500 to-rose-600",
  rose:    "from-rose-400 via-rose-500 to-red-700",
  sky:     "from-sky-300 via-cyan-500 to-blue-700",
};

const TONE_GLOW: Record<Hub3DTone, string> = {
  blue:    "shadow-[0_8px_18px_-6px_rgba(59,130,246,0.55)]",
  violet:  "shadow-[0_8px_18px_-6px_rgba(168,85,247,0.55)]",
  emerald: "shadow-[0_8px_18px_-6px_rgba(16,185,129,0.55)]",
  amber:   "shadow-[0_8px_18px_-6px_rgba(249,115,22,0.55)]",
  rose:    "shadow-[0_8px_18px_-6px_rgba(244,63,94,0.55)]",
  sky:     "shadow-[0_8px_18px_-6px_rgba(14,165,233,0.55)]",
};

interface Props {
  icon: LucideIcon;
  tone: Hub3DTone;
  size?: "sm" | "md";
  className?: string;
}

export function Hub3DIcon({ icon: Icon, tone, size = "md", className }: Props) {
  const dim = size === "sm" ? "h-11 w-11" : "h-14 w-14";
  const iconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-2xl",
        "bg-gradient-to-br ring-1 ring-white/30",
        dim,
        TONE_GRADIENT[tone],
        TONE_GLOW[tone],
        className,
      )}
      aria-hidden
    >
      {/* Top glossy highlight */}
      <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/55 to-transparent" />
      {/* Bottom inner shadow */}
      <span className="pointer-events-none absolute inset-x-2 bottom-0.5 h-1/3 rounded-b-2xl bg-gradient-to-t from-black/20 to-transparent" />
      <Icon
        className={cn("relative text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]", iconSize)}
        strokeWidth={2.4}
      />
    </span>
  );
}
