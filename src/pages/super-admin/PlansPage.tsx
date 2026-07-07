import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { usePlans, LoadingSkeleton } from "./queries";

const MODULE_KEYS = [
  "analytics", "reports", "expenses", "approvals",
  "monthly_plans", "pricing_rules", "marshal_view",
  "multi_user", "api_access",
] as const;

type ModuleKey = typeof MODULE_KEYS[number];

interface PlanForm {
  id?: string;
  name: string;
  price_monthly: number;
  max_centers: number;
  max_resources: number;
  max_users: number;
  is_active: boolean;
  allow_bookings: boolean;
  features: string; // textarea, comma or newline separated
  module_access: Record<ModuleKey, boolean>;
}

const DEFAULT_FORM: PlanForm = {
  name: "",
  price_monthly: 0,
  max_centers: 1,
  max_resources: 5,
  max_users: 10,
  is_active: true,
  allow_bookings: true,
  features: "",
  module_access: MODULE_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<ModuleKey, boolean>),
};

function parseFeatures(text: string): string[] {
  return text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

export default function PlansPage() {
  const qc = useQueryClient();
  const { data: plans, isLoading } = usePlans();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const upsert = useMutation({
    mutationFn: async (f: PlanForm) => {
      const payload = {
        name: f.name.trim(),
        price_monthly: Number(f.price_monthly) || 0,
        max_centers: Number(f.max_centers) || 0,
        max_resources: Number(f.max_resources) || 0,
        max_users: Number(f.max_users) || 0,
        is_active: f.is_active,
        allow_bookings: f.allow_bookings,
        features: parseFeatures(f.features),
        module_access: f.module_access,
      };
      if (f.id) {
        const { error } = await supabase.from("plans").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Plan updated" : "Plan created");
      qc.invalidateQueries({ queryKey: ["sa-plans"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save plan"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      qc.invalidateQueries({ queryKey: ["sa-plans"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete plan"),
  });

  const openNew = () => {
    setForm(DEFAULT_FORM);
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name,
      price_monthly: Number(p.price_monthly),
      max_centers: p.max_centers,
      max_resources: p.max_resources,
      max_users: p.max_users,
      is_active: p.is_active,
      allow_bookings: p.allow_bookings ?? true,
      features: Array.isArray(p.features) ? p.features.join("\n") : "",
      module_access: MODULE_KEYS.reduce((acc, k) => ({
        ...acc,
        [k]: Boolean(p.module_access?.[k]),
      }), {} as Record<ModuleKey, boolean>),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">Subscription Plans</h2>
          <p className="text-sm text-muted-foreground">Manage platform pricing tiers</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Plan
        </Button>
      </div>

      {isLoading ? <LoadingSkeleton /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans?.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{p.name}</h3>
                  <Badge variant={p.is_active ? "default" : "secondary"}>
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-primary">
                  ₹{p.price_monthly}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Max Centers: {p.max_centers}</p>
                  <p>Max Resources: {p.max_resources}</p>
                  <p>Max Users: {p.max_users}</p>
                  <p>Bookings: {p.allow_bookings ? "Allowed" : "Disabled"}</p>
                </div>
                {Array.isArray(p.features) && p.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.features.slice(0, 4).map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Plan" : "New Plan"}</DialogTitle>
            <DialogDescription>Define pricing, limits, and module access.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plan Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (₹/mo)</Label>
                <Input type="number" min={0} value={form.price_monthly}
                  onChange={(e) => setForm({ ...form, price_monthly: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label className="text-sm cursor-pointer">Active</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Max Centers</Label>
                <Input type="number" min={0} value={form.max_centers}
                  onChange={(e) => setForm({ ...form, max_centers: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Resources</Label>
                <Input type="number" min={0} value={form.max_resources}
                  onChange={(e) => setForm({ ...form, max_resources: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Users</Label>
                <Input type="number" min={0} value={form.max_users}
                  onChange={(e) => setForm({ ...form, max_users: Number(e.target.value) })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label className="text-sm cursor-pointer">Allow Bookings</Label>
              <Switch checked={form.allow_bookings}
                onCheckedChange={(v) => setForm({ ...form, allow_bookings: v })} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Module Access</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {MODULE_KEYS.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <Label className="text-xs cursor-pointer capitalize">{k.replace(/_/g, " ")}</Label>
                    <Switch checked={form.module_access[k]}
                      onCheckedChange={(v) => setForm({
                        ...form,
                        module_access: { ...form.module_access, [k]: v },
                      })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Features (one per line or comma-separated)</Label>
              <Textarea rows={4} value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder="Unlimited bookings&#10;WhatsApp notifications&#10;Priority support" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => upsert.mutate(form)}
              disabled={upsert.isPending || !form.name.trim()}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {form.id ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Organizations currently on this plan will keep working but new orgs won't be able to select it.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {del.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
