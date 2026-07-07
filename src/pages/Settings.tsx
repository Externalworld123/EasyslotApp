import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CancellationPolicyTab } from "@/components/settings/CancellationPolicyTab";

export default function Settings() {
  const { centerId } = useAuth();
  const queryClient = useQueryClient();

  const { data: center, isLoading: centerLoading } = useQuery({
    queryKey: ["center", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      const { data, error } = await supabase
        .from("centers")
        .select("*")
        .eq("id", centerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["center-settings", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      const { data, error } = await supabase
        .from("center_settings")
        .select("*")
        .eq("center_id", centerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const [centerName, setCenterName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [sessionDuration, setSessionDuration] = useState(60);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paymentMode, setPaymentMode] = useState("optional");
  const [minDepositPercent, setMinDepositPercent] = useState(50);

  useEffect(() => {
    if (center) {
      setCenterName(center.name);
      setUpiId((center as any).upi_id || "");
    }
  }, [center]);

  useEffect(() => {
    if (settings) {
      setCurrency(settings.default_currency);
      setSessionDuration(settings.default_session_duration);
      setTaxPercent(Number(settings.tax_percent));
      setPaymentMode((settings as any).payment_mode || "optional");
      setMinDepositPercent(Number((settings as any).min_deposit_percent ?? 50));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!centerId) throw new Error("No center");
      const { error: cErr } = await supabase
        .from("centers")
        .update({ name: centerName.trim(), upi_id: upiId.trim() || null } as any)
        .eq("id", centerId);
      if (cErr) throw cErr;

      const payload: any = {
        center_id: centerId,
        default_currency: currency,
        default_session_duration: sessionDuration,
        tax_percent: taxPercent,
        payment_mode: paymentMode,
        min_deposit_percent: minDepositPercent,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from("center_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("center_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["center", centerId] });
      queryClient.invalidateQueries({ queryKey: ["center-settings", centerId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isLoading = centerLoading || settingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 max-w-xl rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your center preferences</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="cancellation">Cancellation Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Manage your center configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="centerName">Center Name</Label>
                <Input id="centerName" value={centerName} onChange={(e) => setCenterName(e.target.value)} placeholder="Enter center name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="upiId">UPI ID (for online payments)</Label>
                <Input id="upiId" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi or 9876543210@ybl" />
                <p className="text-xs text-muted-foreground">Customers will see this on the public booking payment screen</p>
              </div>

              {upiId && (
                <>
                  <div className="space-y-2">
                    <Label>Payment Mode (Public Bookings)</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optional">Optional – Pay later at venue</SelectItem>
                        <SelectItem value="deposit">Deposit – Min deposit required</SelectItem>
                        <SelectItem value="full">Full – Full payment required</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {paymentMode === "optional" && "Customers can book without paying. Payment is collected at the venue."}
                      {paymentMode === "deposit" && "Customers must pay a minimum deposit via UPI before booking."}
                      {paymentMode === "full" && "Customers must pay the full amount via UPI before booking."}
                    </p>
                  </div>
                  {paymentMode === "deposit" && (
                    <div className="space-y-2">
                      <Label htmlFor="minDeposit">Minimum Deposit (%)</Label>
                      <Input
                        id="minDeposit"
                        type="number"
                        value={minDepositPercent}
                        onChange={(e) => setMinDepositPercent(Math.min(100, Math.max(10, Number(e.target.value))))}
                        min={10}
                        max={100}
                        step={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        Customers must pay at least {minDepositPercent}% of the total amount before booking
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionDuration">Default Session Duration (minutes)</Label>
                <Input id="sessionDuration" type="number" value={sessionDuration} onChange={(e) => setSessionDuration(Number(e.target.value))} min={1} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxPercent">Tax Percentage (%)</Label>
                <Input id="taxPercent" type="number" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} min={0} max={100} step={0.5} />
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !centerName.trim()}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancellation" className="mt-4">
          <CancellationPolicyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
