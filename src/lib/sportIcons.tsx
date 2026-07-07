import { LucideIcon } from "lucide-react";
import {
  Trophy,
  Volleyball,
  Dumbbell,
  Waves,
  CircleDot,
  Target,
} from "lucide-react";

/**
 * Sport → emoji icon (chosen for instant recognition like Playo's tabs).
 * Falls back to a generic ball.
 */
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸",
  tennis: "🎾",
  cricket: "🏏",
  football: "⚽",
  basketball: "🏀",
  swimming: "🏊",
  table_tennis: "🏓",
  squash: "🥎",
  volleyball: "🏐",
  Pickleball: "🎾",
  pickleball: "🎾",
};

export function getSportEmoji(value: string): string {
  return SPORT_EMOJI[value] ?? "🏟️";
}

/**
 * Short tab label without "Court / Pool / Turf" suffix.
 */
export function getSportShortLabel(value: string, fullLabel: string): string {
  return fullLabel.replace(/\s*(Court|Table|Net.*|Turf|Pool)\s*$/i, "").trim();
}
