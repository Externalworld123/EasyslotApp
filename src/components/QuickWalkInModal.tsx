import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { startSession } from "@/lib/sessionService";
import { useToast } from "@/hooks/use-toast";
import { getResourceTypeLabel, SPORT_TYPES } from "@/lib/resourceTypes";

export interface WalkInResource {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
}

interface QuickWalkInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string;
  resources: WalkInResource[];
  onSessionStarted?: () => void;
}

const DURATION_OPTIONS = [
  { label: "30 min", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "1.5 hours", value: "90" },
  { label: "2 hours", value: "120" },
  { label: "3 hours", value: "180" },
  { label: "4 hours", value: "240" },
  { label: "5 hours", value: "300" },
  { label: "6 hours", value: "360" },
  { label: "Open-ended", value: "0" },
];

export function QuickWalkInModal({
  open,
  onOpenChange,
  centerId,
  resources,
  onSessionStarted,
}: QuickWalkInModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [duration, setDuration] = useState("60");
  const [resourceId, setResourceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sportFilter, setSportFilter] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setDuration("60");
      setResourceId("");
      setSportFilter("");
    }
  }, [open]);

  const filteredResources = sportFilter
    ? resources.filter((r) => r.type === sportFilter)
    : resources;

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !resourceId) return;
    setLoading(true);
    try {
      await startSession({
        resource_id: resourceId,
        center_id: centerId,
        customer_name: name.trim(),
        customer_phone: phone.trim() || undefined,
        notes: duration !== "0" ? `Planned duration: ${duration} min` : undefined,
      });
      toast({ title: "Session started", description: `Walk-in for ${name.trim()}` });
      onOpenChange(false);
      onSessionStarted?.();
    } catch (err: any) {
      toast({
        title: "Failed to start session",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [name, phone, duration, resourceId, centerId, onOpenChange, onSessionStarted, toast]);

  const isValid = name.trim().length > 0 && resourceId.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Walk-In</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="walkin-name">Name *</Label>
            <Input
              id="walkin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="walkin-phone">Phone</Label>
            <Input
              id="walkin-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number (optional)"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sport */}
          <div className="space-y-2">
            <Label>Sport</Label>
            <Select value={sportFilter} onValueChange={(v) => { setSportFilter(v); setResourceId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent>
                {SPORT_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Court */}
          <div className="space-y-2">
            <Label>Court *</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select court" />
              </SelectTrigger>
              <SelectContent>
                {filteredResources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {getResourceTypeLabel(r.type)} (${r.hourly_rate}/hr)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isValid}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Start Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
