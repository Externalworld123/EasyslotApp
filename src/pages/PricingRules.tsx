import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function PricingRules() {
  const { centerId } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    resource_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    price_multiplier: "1.0",
    flat_price: "",
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["pricing-rules", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("*, resources(name)")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const { data: resources } = useQuery({
    queryKey: ["resources-list", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("id, name")
        .eq("center_id", centerId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!centerId) throw new Error("No center");
      const { error } = await supabase.from("pricing_rules").insert({
        center_id: centerId,
        name: form.name.trim(),
        resource_id: form.resource_id || null,
        day_of_week: form.day_of_week ? Number(form.day_of_week) : null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        price_multiplier: form.flat_price ? 1 : Number(form.price_multiplier),
        flat_price: form.flat_price ? Number(form.flat_price) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pricing rule added");
      qc.invalidateQueries({ queryKey: ["pricing-rules", centerId] });
      setShowAdd(false);
      setForm({ name: "", resource_id: "", day_of_week: "", start_time: "", end_time: "", price_multiplier: "1.0", flat_price: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("pricing_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-rules", centerId] }),
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule deleted");
      qc.invalidateQueries({ queryKey: ["pricing-rules", centerId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const formatMultiplier = (m: number) => {
    if (m > 1) return `+${Math.round((m - 1) * 100)}%`;
    if (m < 1) return `-${Math.round((1 - m) * 100)}%`;
    return "Standard";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dynamic Pricing</h1>
          <p className="text-sm text-muted-foreground">Set demand-based pricing rules</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Rule
        </Button>
      </div>

      {!rules?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No pricing rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add rules for peak hours, weekends, or low-demand discounts</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.resources?.name ?? "All"}</TableCell>
                    <TableCell>{r.day_of_week != null ? DAYS[r.day_of_week] : "All"}</TableCell>
                    <TableCell>
                      {r.start_time && r.end_time
                        ? `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}`
                        : "All day"}
                    </TableCell>
                    <TableCell>
                      {r.flat_price != null ? (
                        <Badge variant="default">₹{Number(r.flat_price)}/hr</Badge>
                      ) : (
                        <Badge variant={Number(r.price_multiplier) > 1 ? "default" : "secondary"}>
                          {formatMultiplier(Number(r.price_multiplier))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Pricing Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekend Peak" />
            </div>
            <div className="space-y-2">
              <Label>Resource (optional)</Label>
              <Select value={form.resource_id || "all"} onValueChange={(v) => setForm({ ...form, resource_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="All courts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courts</SelectItem>
                  {resources?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week (optional)</Label>
              <Select value={form.day_of_week || "all"} onValueChange={(v) => setForm({ ...form, day_of_week: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="All days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Flat Price per hour (₹)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 800 (leave empty to use multiplier)"
                value={form.flat_price}
                onChange={(e) => setForm({ ...form, flat_price: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                When set, this fixed hourly price replaces the base rate for matching slots.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Price Multiplier {form.flat_price ? "(ignored — flat price set)" : ""}</Label>
              <Input
                type="number"
                step="0.05"
                min="0.5"
                max="3"
                disabled={!!form.flat_price}
                value={form.price_multiplier}
                onChange={(e) => setForm({ ...form, price_multiplier: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                1.0 = standard, 1.2 = +20%, 0.8 = -20%
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.name.trim()}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
