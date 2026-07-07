import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useResources, useCreateResource, useUpdateResource, useDeleteResource, Resource } from "@/hooks/useResources";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Users, Tv2, MoreVertical, Pencil, Trash2, Power, PowerOff, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ResourceTypeSelect } from "@/components/resources/ResourceTypeSelect";
import { ResourceFilters } from "@/components/resources/ResourceFilters";
import { ResourceImageUpload } from "@/components/resources/ResourceImageUpload";
import { getResourceTypeLabel, isValidSportType } from "@/lib/resourceTypes";
import { useCurrency } from "@/hooks/useCurrency";

const SPORT_BADGE_COLORS: Record<string, string> = {
  badminton: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  tennis: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cricket: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  football: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  basketball: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  swimming: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  table_tennis: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  squash: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  volleyball: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

export default function Resources() {
  const navigate = useNavigate();
  const { centerId } = useAuth();
  const { data: resources, isLoading } = useResources();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const deleteResource = useDeleteResource();
  const { symbol } = useCurrency();

  const [showAdd, setShowAdd] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Resource | null>(null);

  // Persisted filters/view
  const FILTERS_KEY = "easyslot_resources_filters";
  const persisted = (() => {
    try {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  })();

  // View
  const [viewMode, setViewMode] = useState<"grid" | "table">(persisted.viewMode ?? "grid");
  const [showInactive, setShowInactive] = useState<boolean>(persisted.showInactive ?? false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("badminton");
  const [newRate, setNewRate] = useState("0");
  const [newCapacity, setNewCapacity] = useState("1");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editCapacity, setEditCapacity] = useState("1");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("active");
  const [editDescription, setEditDescription] = useState("");

  // Filters
  const [search, setSearch] = useState<string>(persisted.search ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(persisted.typeFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(persisted.statusFilter ?? "all");

  // Persist on change
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify({
        search, typeFilter, statusFilter, viewMode, showInactive,
      }));
    } catch {}
  }, [search, typeFilter, statusFilter, viewMode, showInactive]);

  // Sort (table view)
  const [sortBy, setSortBy] = useState<"name" | "hourly_rate" | "updated_at">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    let list = resources.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q)) return false;
      }
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all") {
        const isActive = r.status === "active" && r.is_active;
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "inactive" && isActive) return false;
      }
      if (!showInactive && (r.status === "inactive" || !r.is_active)) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "hourly_rate") cmp = a.hourly_rate - b.hourly_rate;
      else cmp = a.updated_at.localeCompare(b.updated_at);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [resources, search, typeFilter, statusFilter, showInactive, sortBy, sortDir]);

  const resetAddForm = () => {
    setNewName(""); setNewType("badminton"); setNewRate("0");
    setNewCapacity("1"); setNewImage(null); setNewDescription("");
    setShowAdd(false);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !centerId) return;
    if (!isValidSportType(newType)) { toast.error("Invalid sport type"); return; }
    try {
      await createResource.mutateAsync({
        name: newName.trim(),
        type: newType,
        hourly_rate: Number(newRate) || 0,
        center_id: centerId,
        capacity: Number(newCapacity) || 1,
        pricing_type: "hourly",
        image_url: newImage ?? undefined,
      });
      toast.success("Court created");
      resetAddForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (r: Resource) => {
    setEditName(r.name); setEditType(r.type); setEditRate(String(r.hourly_rate));
    setEditCapacity(String(r.capacity ?? 1));
    setEditImage(r.image_url); setEditStatus(r.status ?? "active");
    setEditDescription("");
    setEditingResource(r);
  };

  const handleEditSave = async () => {
    if (!editingResource || !editName.trim()) return;
    if (!isValidSportType(editType)) { toast.error("Invalid sport type"); return; }
    try {
      await updateResource.mutateAsync({
        id: editingResource.id,
        name: editName.trim(),
        type: editType,
        hourly_rate: Number(editRate) || 0,
        capacity: Number(editCapacity) || 1,
        pricing_type: "hourly",
        image_url: editImage,
        status: editStatus,
        is_active: editStatus !== "inactive",
      });
      toast.success("Court updated");
      setEditingResource(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggleStatus = async (r: Resource) => {
    const newStatus = r.status === "active" ? "inactive" : "active";
    try {
      await updateResource.mutateAsync({
        id: r.id,
        status: newStatus,
        is_active: newStatus === "active",
      });
      toast.success(`Court ${newStatus === "active" ? "activated" : "deactivated"}`);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteResource.mutateAsync(deleteConfirm.id);
      toast.success("Court deleted");
      setDeleteConfirm(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleSort = (col: "name" | "hourly_rate" | "updated_at") => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const isInactive = (r: Resource) => r.status === "inactive" || !r.is_active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Courts Management</h1>
          <p className="text-sm text-muted-foreground">Manage all your sports courts and facilities</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Court
        </Button>
      </div>

      {/* Filters */}
      <ResourceFilters
        search={search} onSearchChange={setSearch}
        typeFilter={typeFilter} onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        viewMode={viewMode} onViewModeChange={setViewMode}
        showInactive={showInactive} onShowInactiveChange={setShowInactive}
      />

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : !filteredResources.length ? (
        <Card className="rounded-xl py-16 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">No courts added yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add your first court to start managing bookings</p>
            </div>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Your First Court
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* ─── GRID VIEW ─── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((r) => (
            <Card
              key={r.id}
              className={`rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer ${isInactive(r) ? "opacity-60" : ""}`}
              onClick={() => navigate(`/resources/${r.id}`)}
            >
              {/* Image */}
              <div className="h-32 bg-muted relative overflow-hidden">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tv2 className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                {/* Status dot */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${isInactive(r) ? "bg-muted-foreground/50" : "bg-green-500"}`} />
                  <span className="text-xs font-medium text-white drop-shadow-sm capitalize">
                    {r.status ?? "active"}
                  </span>
                </div>
                {/* 3-dot menu */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <CourtActions resource={r} onEdit={() => openEdit(r)} onToggle={() => handleToggleStatus(r)} onDelete={() => setDeleteConfirm(r)} />
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                  <Badge variant="secondary" className={`text-xs shrink-0 ${SPORT_BADGE_COLORS[r.type] || ""}`}>
                    {getResourceTypeLabel(r.type)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {r.capacity ?? 1}
                  </span>
                  <span className="font-medium text-foreground">{symbol}{r.hourly_rate}/hr</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ─── TABLE VIEW ─── */
        <Card className="rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    Court Name {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Sport Type</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("hourly_rate")}>
                    Price/hr {sortBy === "hourly_rate" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("updated_at")}>
                    Last Updated {sortBy === "updated_at" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.map((r) => (
                  <TableRow key={r.id} className={`cursor-pointer hover:bg-muted/50 ${isInactive(r) ? "opacity-60" : ""}`} onClick={() => navigate(`/resources/${r.id}`)}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${SPORT_BADGE_COLORS[r.type] || ""}`}>
                        {getResourceTypeLabel(r.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{symbol}{r.hourly_rate}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${isInactive(r) ? "bg-muted-foreground/50" : "bg-green-500"}`} />
                        <span className="capitalize text-sm">{r.status ?? "active"}</span>
                      </span>
                    </TableCell>
                    <TableCell>{r.capacity ?? 1}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <CourtActions resource={r} onEdit={() => openEdit(r)} onToggle={() => handleToggleStatus(r)} onDelete={() => setDeleteConfirm(r)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => !open && resetAddForm()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Add Court</DialogTitle>
            <DialogDescription>Create a new sport facility.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ResourceImageUpload imageUrl={newImage} onImageChange={setNewImage} />
            <div className="space-y-2">
              <Label>Court Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Court 1" />
            </div>
            <div className="space-y-2">
              <Label>Sport Type</Label>
              <ResourceTypeSelect value={newType} onValueChange={setNewType} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price per hour</Label>
                <Input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" min={1} value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Court details..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAddForm}>Cancel</Button>
            <Button onClick={handleAdd} disabled={createResource.isPending || !newName.trim()}>
              {createResource.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Court
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingResource} onOpenChange={(open) => !open && setEditingResource(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Court</DialogTitle>
            <DialogDescription>Update the court details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ResourceImageUpload imageUrl={editImage} onImageChange={setEditImage} />
            <div className="space-y-2">
              <Label>Court Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sport Type</Label>
              <ResourceTypeSelect value={editType} onValueChange={setEditType} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price per hour</Label>
                <Input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" min={1} value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Court details..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingResource(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateResource.isPending || !editName.trim()}>
              {updateResource.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Court
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Court?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The court "{deleteConfirm?.name}" and its associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteResource.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── 3-dot action menu ─── */
function CourtActions({
  resource,
  onEdit,
  onToggle,
  onDelete,
}: {
  resource: Resource;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const inactive = resource.status === "inactive" || !resource.is_active;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggle}>
          {inactive ? <Power className="h-4 w-4 mr-2" /> : <PowerOff className="h-4 w-4 mr-2" />}
          {inactive ? "Activate" : "Deactivate"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
