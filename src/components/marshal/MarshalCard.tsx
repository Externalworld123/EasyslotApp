// MarshalCard — displays a single active session with a large timer
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User } from "lucide-react";

interface MarshalCardProps {
  customerName: string;
  resourceName: string;
  resourceType: string;
  startTime: string;
}

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

export function MarshalCard({ customerName, resourceName, resourceType, startTime }: MarshalCardProps) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime));

  useEffect(() => {
    setElapsed(formatElapsed(startTime));
    const interval = setInterval(() => setElapsed(formatElapsed(startTime)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const isUnderFive = elapsed.totalMinutes < 5;

  return (
    <Card
      className={`shadow-md transition-colors ${
        isUnderFive ? "border-warning bg-warning/5 ring-1 ring-warning/30" : ""
      }`}
    >
      <CardContent className="p-6 flex flex-col items-center gap-4">
        <div
          className={`text-5xl font-bold font-mono-timer tracking-wider ${
            isUnderFive ? "text-warning animate-pulse" : "text-timer-active"
          }`}
        >
          {elapsed.text}
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-foreground">{resourceName}</p>
          <p className="text-sm text-muted-foreground">{resourceType}</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          {customerName}
        </div>
        {isUnderFive && (
          <Badge className="bg-warning/15 text-warning border-warning/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Under 5 min
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
