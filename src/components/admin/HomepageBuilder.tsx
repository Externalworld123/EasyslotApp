import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { toast } from "sonner";

const SECTION_TYPES = [
  { value: "hero", label: "Hero Banner" },
  { value: "offer_card", label: "Offer Card (Carousel)" },
  { value: "featured_centers", label: "Featured Centers" },
  { value: "cta", label: "Call to Action" },
  { value: "testimonial", label: "Testimonial" },
  { value: "banner", label: "Promo Banner" },
  { value: "info", label: "Info Block" },
];

interface ContentItem {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: any;
}

const emptyForm = { section_key: "hero", title: "", subtitle: "", description: "", image_url: "", link_url: "" };

export default function HomepageBuilder() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items, isLoading } = useQuery({
    queryKey: ["sa-homepage-content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("homepage_content").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("homepage_content").update({
          section_key: form.section_key,
          title: form.title || null,
          subtitle: form.subtitle || null,
          description: form.description || null,
          image_url: form.image_url || null,
          link_url: form.link_url || null,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const maxOrder = Math.max(0, ...(items ?? []).map(i => i.sort_order));
        const { error } = await supabase.from("homepage_content").insert({
          section_key: form.section_key,
          title: form.title || null,
          subtitle: form.subtitle || null,
          description: form.description || null,
          image_url: form.image_url || null,
          link_url: form.link_url || null,
          sort_order: maxOrder + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Section updated" : "Section added");
      queryClient.invalidateQueries({ queryKey: ["sa-homepage-content"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("homepage_content").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ["sa-homepage-content"] });
      queryClient.setQueryData(["sa-homepage-content"], (old: ContentItem[] | undefined) =>
        (old ?? []).map(i => i.id === id ? { ...i, is_active } : i)
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sa-homepage-content"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const sorted = [...(items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex(i => i.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx], b = sorted[swapIdx];
      await supabase.from("homepage_content").update({ sort_order: b.sort_order }).eq("id", a.id);
      await supabase.from("homepage_content").update({ sort_order: a.sort_order }).eq("id", b.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sa-homepage-content"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homepage_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section removed");
      queryClient.invalidateQueries({ queryKey: ["sa-homepage-content"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: ContentItem) => {
    setEditingId(item.id);
    setForm({
      section_key: item.section_key,
      title: item.title || "",
      subtitle: item.subtitle || "",
      description: item.description || "",
      image_url: item.image_url || "",
      link_url: item.link_url || "",
    });
    setDialogOpen(true);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>
      </div>

      {(items ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No homepage sections yet. Add your first section to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(items ?? []).sort((a, b) => a.sort_order - b.sort_order).map((item, idx) => (
            <Card key={item.id} className={`${!item.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => reorderMutation.mutate({ id: item.id, direction: "up" })}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === (items?.length ?? 1) - 1} onClick={() => reorderMutation.mutate({ id: item.id, direction: "down" })}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                {item.image_url && (
                  <img src={item.image_url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{SECTION_TYPES.find(s => s.value === item.section_key)?.label || item.section_key}</Badge>
                    {!item.is_active && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                  </div>
                  <p className="font-medium text-sm mt-1 truncate">{item.title || "(No title)"}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={item.is_active} onCheckedChange={v => toggleMutation.mutate({ id: item.id, is_active: v })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Section" : "Add Section"}</DialogTitle>
            <DialogDescription>Configure homepage content block</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Section Type</Label>
              <Select value={form.section_key} onValueChange={v => setForm(f => ({ ...f, section_key: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Section title" />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Subtitle" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Longer description text" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Link URL</Label>
                <Input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="/venue/..." />
              </div>
            </div>
            {form.image_url && (
              <div className="rounded-lg overflow-hidden border">
                <img src={form.image_url} alt="Preview" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
