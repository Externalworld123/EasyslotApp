import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus, Loader2, Shield, Search, MoreHorizontal,
  ShieldCheck, UserCog, Building2, Power, Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  organization_admin: "Org Admin",
  center_admin: "Center Admin",
  staff: "Staff",
  marshal: "Marshal",
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  super_admin: "bg-primary/15 text-primary border-primary/30",
  organization_admin: "bg-accent/15 text-accent-foreground border-accent/30",
  center_admin: "bg-green-500/15 text-green-700 border-green-200",
  staff: "bg-muted text-muted-foreground border-border",
  marshal: "bg-yellow-500/15 text-yellow-700 border-yellow-200",
};

interface UserData {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  role: string | null;
  role_id: string | null;
  center_id: string | null;
  center_name: string | null;
  all_roles: { id: string; role: string; center_id: string | null; center_name: string | null }[];
  created_at: string;
  last_sign_in_at: string | null;
}

interface CenterOption {
  id: string;
  name: string;
}

export default function Users() {
  const { primaryRole } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");

  // Modals
  const [roleModal, setRoleModal] = useState<UserData | null>(null);
  const [centerModal, setCenterModal] = useState<UserData | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newCenterId, setNewCenterId] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", role: "staff", center_id: "" });

  const isSuperAdmin = primaryRole === "super_admin";

  // Fetch all users via edge function
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-users");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { users: UserData[]; centers: CenterOption[] };
    },
    enabled: isSuperAdmin,
  });

  const users = data?.users || [];
  const centers = data?.centers || [];

  // Filter users
  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.includes(search));
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchCenter = centerFilter === "all" || u.center_id === centerFilter;
    return matchSearch && matchRole && matchCenter;
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ target_user_id, new_role, center_id }: any) => {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "change_role", target_user_id, new_role, center_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setRoleModal(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Assign center mutation
  const assignCenterMutation = useMutation({
    mutationFn: async ({ target_user_id, center_id }: any) => {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "assign_center", target_user_id, center_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Center assigned");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCenterModal(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ target_user_id, is_active }: any) => {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "toggle_active", target_user_id, is_active },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("User status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Add user via invite
  const addUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: addForm.email.trim(),
          role: addForm.role,
          center_id: addForm.center_id || centers[0]?.id,
          mode: "direct",
          full_name: addForm.name.trim(),
          password: "Temp@1234",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowAddUser(false);
      setAddForm({ name: "", email: "", phone: "", role: "staff", center_id: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {users.length} total users across all centers
          </p>
        </div>
        <Button onClick={() => setShowAddUser(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="organization_admin">Org Admin</SelectItem>
            <SelectItem value="center_admin">Center Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="marshal">Marshal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={centerFilter} onValueChange={setCenterFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Centers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Centers</SelectItem>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card className="shadow-md border-border/50">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Center</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="space-y-2">
                        <UsersIcon className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                        <p className="text-muted-foreground font-medium">
                          {users.length === 0 ? "Add your first user" : "No users match your filters"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id} className="group">
                      <TableCell className="font-medium">
                        {u.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ROLE_BADGE_CLASSES[u.role || "staff"] || ROLE_BADGE_CLASSES.staff}
                        >
                          {ROLE_LABELS[u.role || ""] || "No Role"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.center_name || (u.role === "super_admin" ? (
                          <span className="text-muted-foreground italic">Global</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={u.is_active
                            ? "bg-green-500/15 text-green-700 border-green-200"
                            : "bg-destructive/15 text-destructive border-destructive/30"
                          }
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setRoleModal(u);
                              setNewRole(u.role || "staff");
                              setNewCenterId(u.center_id || "");
                            }}>
                              <ShieldCheck className="h-4 w-4 mr-2" /> Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setCenterModal(u);
                              setNewCenterId(u.center_id || "");
                            }}>
                              <Building2 className="h-4 w-4 mr-2" /> Assign Center
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleActiveMutation.mutate({
                                target_user_id: u.id,
                                is_active: !u.is_active,
                              })}
                              className={u.is_active ? "text-destructive" : "text-green-600"}
                            >
                              <Power className="h-4 w-4 mr-2" />
                              {u.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Change Role Modal */}
      <Dialog open={!!roleModal} onOpenChange={() => setRoleModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Change Role
            </DialogTitle>
            <DialogDescription>
              Update role for <strong>{roleModal?.full_name || roleModal?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="organization_admin">Org Admin</SelectItem>
                  <SelectItem value="center_admin">Center Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="marshal">Marshal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRole !== "super_admin" && (
              <div className="space-y-2">
                <Label>Center</Label>
                <Select value={newCenterId} onValueChange={setNewCenterId}>
                  <SelectTrigger><SelectValue placeholder="Select center" /></SelectTrigger>
                  <SelectContent>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModal(null)}>Cancel</Button>
            <Button
              onClick={() => changeRoleMutation.mutate({
                target_user_id: roleModal!.id,
                new_role: newRole,
                center_id: newRole === "super_admin" ? null : newCenterId,
              })}
              disabled={changeRoleMutation.isPending || (!newRole)}
            >
              {changeRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Center Modal */}
      <Dialog open={!!centerModal} onOpenChange={() => setCenterModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Assign Center
            </DialogTitle>
            <DialogDescription>
              Assign center for <strong>{centerModal?.full_name || centerModal?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Center</Label>
              <Select value={newCenterId} onValueChange={setNewCenterId}>
                <SelectTrigger><SelectValue placeholder="Select center" /></SelectTrigger>
                <SelectContent>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCenterModal(null)}>Cancel</Button>
            <Button
              onClick={() => assignCenterMutation.mutate({
                target_user_id: centerModal!.id,
                center_id: newCenterId,
              })}
              disabled={assignCenterMutation.isPending || !newCenterId}
            >
              {assignCenterMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Add User
            </DialogTitle>
            <DialogDescription>
              Create a new user account with a temporary password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="center_admin">Center Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="marshal">Marshal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addForm.role !== "super_admin" && (
              <div className="space-y-2">
                <Label>Center *</Label>
                <Select value={addForm.center_id} onValueChange={(v) => setAddForm({ ...addForm, center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select center" /></SelectTrigger>
                  <SelectContent>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
            <Button
              onClick={() => addUserMutation.mutate()}
              disabled={
                addUserMutation.isPending ||
                !addForm.name.trim() ||
                !addForm.email.trim() ||
                (addForm.role !== "super_admin" && !addForm.center_id)
              }
            >
              {addUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
