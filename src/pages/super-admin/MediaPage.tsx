import { lazy, Suspense } from "react";
import { LoadingSkeleton } from "./queries";
const MediaManager = lazy(() => import("@/components/admin/MediaManager"));

export default function MediaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Media Manager</h2>
        <p className="text-sm text-muted-foreground">Upload and manage platform images</p>
      </div>
      <Suspense fallback={<LoadingSkeleton />}><MediaManager /></Suspense>
    </div>
  );
}
