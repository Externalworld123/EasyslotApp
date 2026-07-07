import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  flag_key: string;
  value: any;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = { flag_key: "", description: "", value: "true" };

export default function FeatureFlagsManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: flags, isLoading } = useQuery({
    queryKey: ["sa-feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feature_flags").select("*").order("flag_key");
      if (error) throw error;
      return (data ?? []) as FeatureFlag[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const key = form.flag_key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      if (!key) throw new Error("Key is required");
      let parsedValue: any;
      try { parsedValue = JSON.parse(form.value); } catch { parsedValue = form.value; }

      if (editingId) {
        const { error } = await supabase.from("feature_flags").update({
          flag_key: key,
          description: form.description || null,
          value: parsedValue,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feature_flags").insert({
          flag_key: key,
          description: form.description || null,
          value: parsedValue,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Flag updated" : "Flag created");
      queryClient.invalidateQueries({ queryKey: ["sa-feature-flags"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("feature_flags").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ["sa-feature-flags"] });
      queryClient.setQueryData(["sa-feature-flags"], (old: FeatureFlag[] | undefined) =>
        (old ?? []).map(f => f.id === id ? { ...f, is_active } : f)
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sa-feature-flags"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feature_flags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flag deleted");
      queryClient.invalidateQueries({ queryKey: ["sa-feature-flags"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (flag: FeatureFlag) => {
    setEditingId(flag.id);
    setForm({
      flag_key: flag.flag_key,
      description: flag.description || "",
      value: JSON.stringify(flag.value),
    });
    setDialogOpen(true);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Flag
        </Button>
      </div>

      {(flags ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p>No feature flags yet. Create your first flag to control features dynamically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(flags ?? []).map(flag => (
            <Card key={flag.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${flag.is_active ? "bg-green-500/10" : "bg-muted"}`}>
                  <Flag className={`h-5 w-5 ${flag.is_active ? "text-green-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{flag.flag_key}</span>
                    <Badge variant={flag.is_active ? "default" : "secondary"} className="text-[10px]">
                      {flag.is_active ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  {flag.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{flag.description}</p>}
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Value: {JSON.stringify(flag.value)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={flag.is_active} onCheckedChange={v => toggleMutation.mutate({ id: flag.id, is_active: v })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(flag)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(flag.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Flag" : "Create Flag"}</DialogTitle>
            <DialogDescription>Feature flags control app behavior without code changes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={form.flag_key} onChange={e => setForm(f => ({ ...f, flag_key: e.target.value }))} placeholder="enable_dark_mode" className="font-mono" disabled={!!editingId} />
              <p className="text-[10px] text-muted-foreground">Lowercase, underscores only. Cannot be changed after creation.</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this flag controls" />
            </div>
            <div className="space-y-2">
              <Label>Value (JSON)</Label>
              <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder='true' className="font-mono" />
              <p className="text-[10px] text-muted-foreground">Can be true/false, a string, number, or JSON object</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.flag_key}>
              {saveMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
