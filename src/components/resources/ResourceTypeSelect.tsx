import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORT_TYPES } from "@/lib/resourceTypes";

interface ResourceTypeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function ResourceTypeSelect({ value, onValueChange }: ResourceTypeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select sport" />
      </SelectTrigger>
      <SelectContent>
        {SPORT_TYPES.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
