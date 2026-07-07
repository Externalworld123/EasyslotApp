import { lazy, Suspense } from "react";
import { LoadingSkeleton } from "./queries";
const FeatureFlagsManager = lazy(() => import("@/components/admin/FeatureFlagsManager"));

export default function FlagsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Feature Flags</h2>
        <p className="text-sm text-muted-foreground">Toggle platform features without code changes</p>
      </div>
      <Suspense fallback={<LoadingSkeleton />}><FeatureFlagsManager /></Suspense>
    </div>
  );
}
