import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CancellationPolicyTab() {
  const { centerId } = useAuth();
  const queryClient = useQueryClient();

  const { data: policy, isLoading } = useQuery({
    queryKey: ["cancellation-policy", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      const { data, error } = await supabase
        .from("cancellation_policies")
        .select("*")
        .eq("center_id", centerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const [hoursBefore, setHoursBefore] = useState(2);
  const [refundPercent, setRefundPercent] = useState(100);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (policy) {
      setHoursBefore(policy.hours_before);
      setRefundPercent(Number(policy.refund_percent));
      setIsActive(policy.is_active);
    }
  }, [policy]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!centerId) throw new Error("No center");
      const payload = {
        center_id: centerId,
        hours_before: hoursBefore,
        refund_percent: refundPercent,
        is_active: isActive,
      };
      if (policy?.id) {
        const { error } = await supabase
          .from("cancellation_policies")
          .update(payload)
          .eq("id", policy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cancellation_policies")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cancellation policy saved");
      queryClient.invalidateQueries({ queryKey: ["cancellation-policy", centerId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-48 max-w-xl rounded-lg" />;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Cancellation Policy</CardTitle>
        <CardDescription>Configure cancellation rules and refund percentages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="policyActive">Policy Enabled</Label>
          <Switch id="policyActive" checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hoursBefore">Cancel Before (hours)</Label>
          <Input
            id="hoursBefore"
            type="number"
            value={hoursBefore}
            onChange={(e) => setHoursBefore(Number(e.target.value))}
            min={0}
            max={72}
          />
          <p className="text-xs text-muted-foreground">
            Customers can cancel up to {hoursBefore} hours before the session
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refundPercent">Refund Percentage (%)</Label>
          <Input
            id="refundPercent"
            type="number"
            value={refundPercent}
            onChange={(e) => setRefundPercent(Number(e.target.value))}
            min={0}
            max={100}
            step={5}
          />
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Policy
        </Button>
      </CardContent>
    </Card>
  );
}
