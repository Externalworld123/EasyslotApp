import { useMemo } from "react";
import { useAvailabilitySchedule, useUpsertAvailability, DAY_NAMES } from "@/hooks/useAvailabilitySchedule";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvailabilityEditorProps {
  resourceId: string;
}

/** Format hours label e.g. "06:00–22:00" or "00:00–23:59 (24h)" */
function formatHoursLabel(start: string, end: string): string {
  if (start === "00:00" && (end === "23:59" || end === "00:00")) return "24 hrs";
  // Overnight detection
  if (end <= start && end !== "00:00") return `${start}–${end} (overnight)`;
  return `${start}–${end}`;
}

export function AvailabilityEditor({ resourceId }: AvailabilityEditorProps) {
  const { data: schedule, isLoading } = useAvailabilitySchedule(resourceId);
  const upsert = useUpsertAvailability();

  const scheduleMap = useMemo(() => {
    const map = new Map<number, { start_time: string; end_time: string; is_closed: boolean }>();
    schedule?.forEach((s) => map.set(s.day_of_week, s));
    return map;
  }, [schedule]);

  const handleChange = async (day: number, field: string, value: string | boolean) => {
    const existing = scheduleMap.get(day);
    const payload = {
      resource_id: resourceId,
      day_of_week: day,
      start_time: existing?.start_time ?? "06:00",
      end_time: existing?.end_time ?? "22:00",
      is_closed: existing?.is_closed ?? false,
      [field]: value,
    };
    try {
      await upsert.mutateAsync(payload);
      toast.success(`${DAY_NAMES[day]} updated`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const set24Hours = async (day: number) => {
    try {
      await upsert.mutateAsync({
        resource_id: resourceId,
        day_of_week: day,
        start_time: "00:00",
        end_time: "23:59",
        is_closed: false,
      });
      toast.success(`${DAY_NAMES[day]} set to 24 hours`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Weekly Availability</h3>
      <p className="text-xs text-muted-foreground">Supports overnight hours (e.g. 12:00 PM – 6:00 AM). Tap "24h" for round-the-clock.</p>
      <div className="grid gap-2">
        {DAY_NAMES.map((name, i) => {
          const slot = scheduleMap.get(i);
          const isClosed = slot?.is_closed ?? false;
          const startTime = slot?.start_time ?? "06:00";
          const endTime = slot?.end_time ?? "22:00";

          return (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 bg-card text-sm">
              <span className="w-20 font-medium text-foreground text-xs">{name}</span>
              <Switch
                checked={!isClosed}
                onCheckedChange={(open) => handleChange(i, "is_closed", !open)}
                aria-label={`${name} open`}
              />
              {!isClosed && (
                <>
                  <Input
                    type="time"
                    className="w-[110px] h-8 text-xs"
                    defaultValue={startTime}
                    key={`start-${i}-${startTime}`}
                    onBlur={(e) => handleChange(i, "start_time", e.target.value)}
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="time"
                    className="w-[110px] h-8 text-xs"
                    defaultValue={endTime}
                    key={`end-${i}-${endTime}`}
                    onBlur={(e) => handleChange(i, "end_time", e.target.value)}
                  />
                  <Badge
                    variant="outline"
                    className="cursor-pointer text-[10px] px-1.5 py-0.5 hover:bg-accent"
                    onClick={() => set24Hours(i)}
                  >
                    24h
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatHoursLabel(startTime, endTime)}
                  </span>
                </>
              )}
              {isClosed && <span className="text-muted-foreground text-xs">Closed</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
