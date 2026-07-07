import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tv2, Play, Square, Loader2, Users, CalendarPlus } from "lucide-react";
import { startSession, endSession } from "@/lib/sessionService";
import { getResourceTypeLabel } from "@/lib/resourceTypes";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { BookingModal } from "@/components/booking/BookingModal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export interface ActiveSession {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  start_time: string;
  notes?: string | null;
}

export interface ResourceCardProps {
  resourceId: string;
  name: string;
  type: string;
  hourlyRate: number;
  isActive: boolean;
  centerId: string;
  activeSession?: ActiveSession | null;
  onSessionChange?: () => void;
  imageUrl?: string | null;
  capacity?: number;
  pricingType?: string;
  resourceStatus?: string;
}

const STATUS_CONFIG = {
  available: { label: "Available", className: "bg-success text-success-foreground" },
  occupied: { label: "Occupied", className: "bg-warning text-warning-foreground" },
  inactive: { label: "Inactive", className: "" },
  maintenance: { label: "Maintenance", className: "bg-muted text-muted-foreground" },
};

const PRICING_SUFFIX: Record<string, string> = {
  hourly: "/hr",
};

function formatElapsed(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ResourceCard({
  resourceId, name, type, hourlyRate, isActive, centerId,
  activeSession, onSessionChange, imageUrl, capacity, pricingType, resourceStatus,
}: ResourceCardProps) {
  const { toast } = useToast();
  const { symbol } = useCurrency();
  const [elapsed, setElapsed] = useState("00:00:00");
  const [loading, setLoading] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const isMaintenance = resourceStatus === "maintenance";
  const status: keyof typeof STATUS_CONFIG = isMaintenance
    ? "maintenance"
    : !isActive
    ? "inactive"
    : activeSession
    ? "occupied"
    : "available";

  const statusConfig = STATUS_CONFIG[status];

  useEffect(() => {
    if (!activeSession) return;
    setElapsed(formatElapsed(activeSession.start_time));
    const interval = setInterval(() => setElapsed(formatElapsed(activeSession.start_time)), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStart = useCallback(async () => {
    if (!customerName.trim()) return;
    setLoading(true);
    try {
      await startSession({ resource_id: resourceId, center_id: centerId, customer_name: customerName.trim(), customer_phone: customerPhone.trim() || undefined });
      setShowStartDialog(false); setCustomerName(""); setCustomerPhone("");
      onSessionChange?.();
    } catch (err: any) {
      toast({ title: "Failed to start session", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [resourceId, centerId, customerName, customerPhone, onSessionChange, toast]);

  const handleEnd = useCallback(async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const result = await endSession({ session_id: activeSession.id });
      toast({ title: "Session ended", description: `Duration: ${result?.calculation?.duration_minutes ?? result?.duration_minutes ?? '—'}min` });
      onSessionChange?.();
    } catch (err: any) {
      toast({ title: "Failed to end session", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [activeSession, onSessionChange, toast]);

  return (
    <>
      <Card className="shadow-md overflow-hidden">
        {/* Image header */}
        <div className="h-28 bg-muted relative overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv2 className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <Badge className={`absolute top-2 right-2 text-xs ${statusConfig.className}`} variant={status === "inactive" ? "secondary" : "default"}>
            {statusConfig.label}
          </Badge>
        </div>

        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{getResourceTypeLabel(type)}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{capacity ?? 1}</span>
          </div>
          <div className="text-sm font-medium text-foreground">{symbol}{hourlyRate}{PRICING_SUFFIX[pricingType ?? "hourly"]}</div>

          {status === "occupied" && activeSession && (
            <div className="space-y-2 pt-1">
              <div className="text-2xl font-bold font-mono-timer text-timer-active">{elapsed}</div>
              <p className="text-xs text-muted-foreground truncate">{activeSession.customer_name}</p>
              <Button variant="destructive" size="sm" className="w-full" onClick={handleEnd} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} End Session
              </Button>
            </div>
          )}

          {status === "available" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={() => setShowStartDialog(true)} disabled={loading}>
                <Play className="h-4 w-4" /> Start
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowBookingModal(true)} disabled={loading}>
                <CalendarPlus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {status === "inactive" && <div className="text-xs text-muted-foreground">Disabled</div>}
          {status === "maintenance" && <div className="text-xs text-muted-foreground">Under maintenance</div>}
        </CardContent>
      </Card>

      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Start Session — {name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone (optional)</Label>
              <Input id="customer-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
            <Button onClick={handleStart} disabled={loading || !customerName.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        resourceId={resourceId}
        resourceName={name}
        centerId={centerId}
        hourlyRate={hourlyRate}
        pricingType={pricingType}
        capacity={capacity}
        onBooked={onSessionChange}
      />
    </>
  );
}
