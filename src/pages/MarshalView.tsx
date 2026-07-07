import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertTriangle, User, QrCode, CheckCircle2 } from "lucide-react";
import { QRScanner } from "@/components/QRScanner";
import { toast } from "sonner";

function formatElapsed(startTime: string): { text: string; totalMinutes: number } {
  const diff = Date.now() - new Date(startTime).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    totalMinutes: totalSec / 60,
  };
}

interface SessionWithResource {
  id: string;
  customer_name: string;
  start_time: string;
  qr_code: string | null;
  checked_in_at: string | null;
  resources: { name: string; type: string };
}

function SessionCard({ session }: { session: SessionWithResource }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(session.start_time));

  useEffect(() => {
    setElapsed(formatElapsed(session.start_time));
    const interval = setInterval(() => setElapsed(formatElapsed(session.start_time)), 1000);
    return () => clearInterval(interval);
  }, [session.start_time]);

  const isUnderFive = elapsed.totalMinutes < 5;

  return (
    <Card className={`shadow-md transition-colors ${isUnderFive ? "border-warning bg-warning/5 ring-1 ring-warning/30" : ""}`}>
      <CardContent className="p-6 flex flex-col items-center gap-4">
        <div className={`text-5xl font-bold font-mono-timer tracking-wider ${isUnderFive ? "text-warning animate-pulse" : "text-timer-active"}`}>
          {elapsed.text}
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-foreground">{session.resources.name}</p>
          <p className="text-sm text-muted-foreground">{session.resources.type}</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          {session.customer_name}
        </div>
        <div className="flex gap-2">
          {isUnderFive && (
            <Badge className="bg-warning/15 text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3 mr-1" />Under 5 min
            </Badge>
          )}
          {session.checked_in_at && (
            <Badge className="bg-green-500/15 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />Checked In
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const MarshalView = () => {
  const { centerId } = useAuth();
  const queryClient = useQueryClient();
  const [lastScan, setLastScan] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["marshal-sessions", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, start_time, qr_code, checked_in_at, resources!inner(name, type)")
        .eq("center_id", centerId)
        .eq("status", "active")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as unknown as SessionWithResource[];
    },
    enabled: !!centerId,
    refetchInterval: 30000,
  });

  const checkInMutation = useMutation({
    mutationFn: async (qrCode: string) => {
      // Find session by QR code
      const { data: session, error: findErr } = await supabase
        .from("sessions")
        .select("id, customer_name, checked_in_at")
        .eq("qr_code", qrCode)
        .eq("center_id", centerId!)
        .in("status", ["active", "scheduled"])
        .maybeSingle();

      if (findErr) throw findErr;
      if (!session) throw new Error("No session found for this QR code");
      if (session.checked_in_at) throw new Error(`${session.customer_name} is already checked in`);

      const { error: updateErr } = await supabase
        .from("sessions")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", session.id);

      if (updateErr) throw updateErr;
      return session;
    },
    onSuccess: (session) => {
      toast.success(`${session.customer_name} checked in!`);
      queryClient.invalidateQueries({ queryKey: ["marshal-sessions"] });
      setLastScan(session.customer_name);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleScan = (value: string) => {
    checkInMutation.mutate(value);
  };

  const activeCount = sessions?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marshal View</h1>
          <p className="text-sm text-muted-foreground">Live monitoring & QR check-in</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          {activeCount} active
        </Badge>
      </div>

      <Tabs defaultValue="monitor">
        <TabsList>
          <TabsTrigger value="monitor">
            <Clock className="h-4 w-4 mr-1.5" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="checkin">
            <QrCode className="h-4 w-4 mr-1.5" />
            QR Check-In
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            </div>
          ) : activeCount === 0 ? (
            <Card className="shadow-md">
              <CardContent className="py-16 text-center text-muted-foreground">No active sessions</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sessions!.map((session) => <SessionCard key={session.id} session={session} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checkin" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <QRScanner onScan={handleScan} />

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Check-In Status
                </h3>
                {lastScan ? (
                  <p className="text-lg text-foreground">
                    ✅ <strong>{lastScan}</strong> checked in successfully
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Scan a customer's QR code to check them in.
                  </p>
                )}

                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Check-Ins</h4>
                  {sessions?.filter(s => s.checked_in_at).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No check-ins yet</p>
                  ) : (
                    sessions?.filter(s => s.checked_in_at).map(s => (
                      <div key={s.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                        <span>{s.customer_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {s.resources.name}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarshalView;
