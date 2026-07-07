import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExternalLink, Check, X, Pencil, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

export default function SlugManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");

  const { data: centers, isLoading } = useQuery({
    queryKey: ["sa-slugs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centers").select("id, name, slug, city, is_active").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const generateSlug = (name: string, id: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") + "-" + id.substring(0, 8);

  const updateSlugMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
      if (!cleanSlug) throw new Error("Slug cannot be empty");
      // Check uniqueness
      const { data: existing } = await supabase.from("centers").select("id").eq("slug", cleanSlug).neq("id", id).maybeSingle();
      if (existing) throw new Error("Slug already in use by another center");
      const { error } = await supabase.from("centers").update({ slug: cleanSlug }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slug updated");
      queryClient.invalidateQueries({ queryKey: ["sa-slugs"] });
      queryClient.invalidateQueries({ queryKey: ["sa-centers"] });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const autoGenerateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const slug = generateSlug(name, id);
      const { error } = await supabase.from("centers").update({ slug }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slug auto-generated");
      queryClient.invalidateQueries({ queryKey: ["sa-slugs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (centers ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.slug || "").includes(search.toLowerCase())
  );

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search centers or slugs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Center</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Preview URL</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.city || "—"}</TableCell>
                <TableCell>
                  {editingId === c.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editSlug}
                        onChange={e => setEditSlug(e.target.value)}
                        className="h-8 w-48 text-xs font-mono"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSlugMutation.mutate({ id: c.id, slug: editSlug })}>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-primary">{c.slug || "—"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex h-2 w-2 rounded-full ${c.is_active ? "bg-green-500" : "bg-destructive"}`} />
                </TableCell>
                <TableCell>
                  {c.slug ? (
                    <a href={`/venue/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      /venue/{c.slug} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(c.id); setEditSlug(c.slug || ""); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => autoGenerateMutation.mutate({ id: c.id, name: c.name })}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
