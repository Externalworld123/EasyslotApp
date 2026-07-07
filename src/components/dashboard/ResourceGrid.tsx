// ResourceGrid — renders a responsive grid of ResourceCard components
import { ReactNode } from "react";

interface ResourceGridProps {
  children: ReactNode;
}

export function ResourceGrid({ children }: ResourceGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
