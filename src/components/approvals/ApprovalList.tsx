// ApprovalList — renders a list/table of approval items
import { ReactNode } from "react";

interface ApprovalListProps {
  children: ReactNode;
}

export function ApprovalList({ children }: ApprovalListProps) {
  return <div className="space-y-3">{children}</div>;
}
