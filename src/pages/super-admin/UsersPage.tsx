import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRolesList, LoadingSkeleton } from "./queries";

export default function UsersPage() {
  const { data: roles, isLoading } = useRolesList();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">User Roles</h2>
        <p className="text-sm text-muted-foreground">Recent role assignments across the platform</p>
      </div>
      {isLoading ? <LoadingSkeleton /> : (
        <div className="rounded-xl border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Center</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{(r.profiles as any)?.full_name || "Unknown"}</TableCell>
                  <TableCell>
                    <Badge variant={r.role === "super_admin" ? "default" : "outline"} className="text-xs">
                      {r.role.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(r.centers as any)?.name ?? "Global"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
