import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Plus, Pencil, Trash2, ExternalLink, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useCenters, useOrgs, LoadingSkeleton } from "./queries";

interface CenterForm { name: string; city: string; address: string; phone: string; email: string; image_url: string; }
const empty: CenterForm = { name: "", city: "", address: "", phone: "", email: "", image_url: "" };
const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

export default function Centers() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: centers, isLoading } = useCenters();
  const { data: orgs } = useOrgs();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CenterForm>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `centers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("resource-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("resource-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Image uploaded");
    } catch (e: any) { toast.error(e.message || "Upload failed"); } finally { setUploading(false); }
  };

  const save = useMutation({
    mutationFn: async (f: CenterForm) => {
      if (editingId) {
        const { error } = await supabase.from("centers").update({
          name: f.name, city: f.city, address: f.address || null, phone: f.phone || null,
          email: f.email || null, image_url: f.image_url || null,
          slug: generateSlug(f.name) + "-" + editingId.substring(0, 8),
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const orgId = orgs?.[0]?.id;
        const { error } = await supabase.from("centers").insert({
          name: f.name, city: f.city, address: f.address || null, phone: f.phone || null,
          email: f.email || null, image_url: f.image_url || null, organization_id: orgId || null,
          slug: generateSlug(f.name) + "-" + Date.now().toString(36),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Center updated" : "Center created");
      qc.invalidateQueries({ queryKey: ["sa-centers"] });
      qc.invalidateQueries({ queryKey: ["public-discover"] });
      setOpen(false); setEditingId(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("centers").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Center deactivated");
      qc.invalidateQueries({ queryKey: ["sa-centers"] });
      qc.invalidateQueries({ queryKey: ["public-discover"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ name: c.name, city: c.city || "", address: c.address || "", phone: c.phone || "", email: c.email || "", image_url: c.image_url || "" });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">Centers</h2>
          <p className="text-sm text-muted-foreground">{centers?.filter((c) => c.is_active).length ?? 0} active centers</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/super-admin/bulk-import")}>
            <Plus className="h-4 w-4 mr-1" /> Bulk
          </Button>
          <Button size="sm" onClick={() => { setEditingId(null); setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingSkeleton /> : (
        <div className="rounded-xl border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Center</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(c as any).city || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(c.organizations as any)?.name ?? "—"}</TableCell>
                  <TableCell>
                    {(c as any).slug ? (
                      <a href={`/venue/${(c as any).slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-mono hover:underline inline-flex items-center gap-1">
                        {(c as any).slug} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><span className={`inline-flex h-2 w-2 rounded-full ${c.is_active ? "bg-green-500" : "bg-destructive"}`} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {c.is_active && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Center" : "Add New Center"}</DialogTitle>
            <DialogDescription>{editingId ? "Update center details below." : "Fill in the details to create a new center."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cn">Name *</Label>
              <Input id="cn" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sports Arena" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc">City *</Label>
              <Input id="cc" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca">Address</Label>
              <Input id="ca" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main Street" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cp">Phone</Label>
                <Input id="cp" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce">Email</Label>
                <Input id="ce" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="info@venue.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Venue Card Image</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />
              {form.image_url ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={form.image_url} alt="Venue" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      <Upload className="h-3 w-3 mr-1" /> Replace
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}>
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full h-24 border-dashed" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <span className="text-xs text-muted-foreground">Uploading...</span> : (
                    <span className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-xs">Click to upload venue image</span>
                    </span>
                  )}
                </Button>
              )}
            </div>
            {form.name && (
              <p className="text-xs text-muted-foreground">
                SEO URL: <span className="font-mono text-primary">/venue/{generateSlug(form.name)}-...</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.name || !form.city || save.isPending}>
              {save.isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Center?</AlertDialogTitle>
            <AlertDialogDescription>This will hide the center from public listings. You can reactivate it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
