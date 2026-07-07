import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Trash2, Copy, Search, Image as ImageIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
}

export default function MediaManager() {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ["sa-media"],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("resource-images").list("", {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      // Also list centers folder
      const { data: centerFiles } = await supabase.storage.from("resource-images").list("centers", {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
      const allFiles: { path: string; name: string; created_at: string; size: number }[] = [];
      (data ?? []).forEach(f => {
        if (f.name && f.metadata) {
          allFiles.push({ path: f.name, name: f.name, created_at: f.created_at, size: (f.metadata as any)?.size ?? 0 });
        }
      });
      (centerFiles ?? []).forEach(f => {
        if (f.name && f.metadata) {
          allFiles.push({ path: `centers/${f.name}`, name: f.name, created_at: f.created_at, size: (f.metadata as any)?.size ?? 0 });
        }
      });
      return allFiles;
    },
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("resource-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `centers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("resource-images").upload(path, file, { upsert: true });
      if (error) throw error;
      toast.success("Image uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["sa-media"] });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      const { error } = await supabase.storage.from("resource-images").remove([path]);
      if (error) throw error;
      toast.success("File deleted");
      queryClient.invalidateQueries({ queryKey: ["sa-media"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setDeleteTarget(null);
  };

  const copyUrl = (path: string) => {
    navigator.clipboard.writeText(getPublicUrl(path));
    toast.success("URL copied to clipboard");
  };

  const filtered = (files ?? []).filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="sm">
          <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Upload Image"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No images found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(f => (
            <Card key={f.path} className="group overflow-hidden">
              <div className="relative aspect-square bg-muted">
                <img src={getPublicUrl(f.path)} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => copyUrl(f.path)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => window.open(getPublicUrl(f.path), "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setDeleteTarget(f.path)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-mono text-muted-foreground truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(f.size)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
