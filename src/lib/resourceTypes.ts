export interface SportType {
  value: string;
  label: string;
}

export const SPORT_TYPES: SportType[] = [
  { value: "badminton", label: "Badminton Court" },
  { value: "tennis", label: "Tennis Court" },
  { value: "cricket", label: "Cricket Net / Pitch" },
  { value: "football", label: "Football Turf" },
  { value: "basketball", label: "Basketball Court" },
  { value: "swimming", label: "Swimming Pool" },
  { value: "table_tennis", label: "Table Tennis Table" },
  { value: "squash", label: "Squash Court" },
  { value: "volleyball", label: "Volleyball Court" },
  { value: "Pickleball", label: "Pickleball Court" },
];

export const VALID_SPORT_TYPES = new Set(SPORT_TYPES.map((t) => t.value));

// Legacy exports for compatibility
export type ResourceTypeOption = SportType;
export const ALL_RESOURCE_TYPES: SportType[] = SPORT_TYPES;

// No more categories — keep export for any remaining imports but empty
export interface ResourceTypeCategory {
  label: string;
  key: string;
  types: SportType[];
}
export const RESOURCE_TYPE_CATEGORIES: ResourceTypeCategory[] = [];

// Lookup map: value → label
const TYPE_LABEL_MAP = new Map(SPORT_TYPES.map((t) => [t.value, t.label]));

export function getResourceTypeLabel(value: string): string {
  return TYPE_LABEL_MAP.get(value) ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getResourceCategory(value: string): string | undefined {
  return VALID_SPORT_TYPES.has(value) ? "sports" : undefined;
}

export function isValidSportType(value: string): boolean {
  return VALID_SPORT_TYPES.has(value);
}
