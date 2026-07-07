import BulkCenterImport from "@/components/admin/BulkCenterImport";
import { useOrgs } from "./queries";

export default function BulkImportPage() {
  const { data: orgs } = useOrgs();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Bulk Center Import</h2>
        <p className="text-sm text-muted-foreground">Import multiple centers at once</p>
      </div>
      <BulkCenterImport orgId={orgs?.[0]?.id} />
    </div>
  );
}
