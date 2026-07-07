import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  className?: string;
  /** Color hint: "up" (green pulse) for available increases, "down" (red pulse) for booked increases */
  pulseOn?: "up" | "down" | "any";
}

/**
 * Tiny counter that briefly scales + flashes when its numeric value changes.
 * Used in PlayoSlotMatrix so staff can clearly see optimistic +/- updates.
 */
export function AnimatedCounter({ value, className, pulseOn = "any" }: Props) {
  const prev = useRef(value);
  const [bump, setBump] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prev.current === value) return;
    const dir = value > prev.current ? "up" : "down";
    prev.current = value;
    if (pulseOn !== "any" && pulseOn !== dir) return;
    setBump(dir);
    const t = setTimeout(() => setBump(null), 380);
    return () => clearTimeout(t);
  }, [value, pulseOn]);

  return (
    <span
      key={value}
      className={cn(
        "inline-block tabular-nums transition-transform duration-300 will-change-transform",
        bump === "up" && "animate-[counter-bump_0.38s_ease-out]",
        bump === "down" && "animate-[counter-bump_0.38s_ease-out]",
        className,
      )}
    >
      {value}
    </span>
  );
}
