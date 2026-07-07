import { lazy, Suspense } from "react";
import { LoadingSkeleton } from "./queries";
const HomepageBuilder = lazy(() => import("@/components/admin/HomepageBuilder"));

export default function HomepagePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Homepage Builder</h2>
        <p className="text-sm text-muted-foreground">Configure public homepage content blocks</p>
      </div>
      <Suspense fallback={<LoadingSkeleton />}><HomepageBuilder /></Suspense>
    </div>
  );
}
