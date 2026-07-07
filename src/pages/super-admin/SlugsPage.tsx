import { lazy, Suspense } from "react";
import { LoadingSkeleton } from "./queries";
const SlugManager = lazy(() => import("@/components/admin/SlugManager"));

export default function SlugsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">URL Slug Manager</h2>
        <p className="text-sm text-muted-foreground">Manage public venue URLs</p>
      </div>
      <Suspense fallback={<LoadingSkeleton />}><SlugManager /></Suspense>
    </div>
  );
}
