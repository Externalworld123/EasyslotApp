import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Users, User } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  const label = `${h % 12 || 12}:${m === 0 ? "00" : "30"} ${h < 12 ? "AM" : "PM"}`;
  return { label, value: `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}` };
});

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
];

interface Resource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
}

interface Step1Props {
  planType: string;
  setPlanType: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  groupName: string;
  setGroupName: (v: string) => void;
  leaderName: string;
  setLeaderName: (v: string) => void;
  resourceId: string;
  setResourceId: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  slotTime: string;
  setSlotTime: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  daysOfWeek: number[];
  toggleDay: (d: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  resources: Resource[];
}

export default function PlanWizardStep1({
  planType, setPlanType,
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
  groupName, setGroupName,
  leaderName, setLeaderName,
  resourceId, setResourceId,
  startDate, setStartDate,
  endDate, setEndDate,
  slotTime, setSlotTime,
  duration, setDuration,
  daysOfWeek, toggleDay,
  notes, setNotes,
  resources,
}: Step1Props) {
  return (
    <div className="space-y-4">
      {/* Plan Type Toggle */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Plan Type</Label>
        <ToggleGroup type="single" value={planType} onValueChange={(v) => v && setPlanType(v)} className="justify-start">
          <ToggleGroupItem value="members" className="gap-1.5 text-xs px-3">
            <User className="h-3.5 w-3.5" /> Members
          </ToggleGroupItem>
          <ToggleGroupItem value="group" className="gap-1.5 text-xs px-3">
            <Users className="h-3.5 w-3.5" /> Group
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {planType === "group" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Group Name *</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Morning Batch" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Leader Phone *</Label>
            <Input
              type="tel"
              inputMode="numeric"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              placeholder="10-digit phone"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Customer Name *</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone *</Label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Court *</Label>
        <Select value={resourceId} onValueChange={setResourceId}>
          <SelectTrigger><SelectValue placeholder="Select court" /></SelectTrigger>
          <SelectContent>
            {resources.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name} (₹{r.hourly_rate}/hr)</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Start Date *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End Date *</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Slot Time *</Label>
          <Select value={slotTime} onValueChange={setSlotTime}>
            <SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Duration</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Days of Week *</Label>
        <div className="flex gap-2 flex-wrap">
          {DAY_LABELS.map((label, idx) => (
            <label key={idx} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox checked={daysOfWeek.includes(idx)} onCheckedChange={() => toggleDay(idx)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
      </div>
    </div>
  );
}
