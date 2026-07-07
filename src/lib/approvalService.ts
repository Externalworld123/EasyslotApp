// Approval service — placeholder for approval-related API calls
import { supabase } from "@/integrations/supabase/client";

export interface ApprovalRequest {
  session_id: string;
  center_id: string;
  discount_percent: number;
  reason?: string;
}

/**
 * Fetch pending approvals for a center.
 */
export async function fetchPendingApprovals(centerId: string) {
  const { data, error } = await supabase
    .from("approvals")
    .select("*")
    .eq("center_id", centerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Approve a discount request.
 */
export async function approveRequest(approvalId: string, approvedBy: string) {
  const { data, error } = await supabase
    .from("approvals")
    .update({ status: "approved", approved_by: approvedBy, updated_at: new Date().toISOString() })
    .eq("id", approvalId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Reject a discount request.
 */
export async function rejectRequest(approvalId: string, approvedBy: string) {
  const { data, error } = await supabase
    .from("approvals")
    .update({ status: "rejected", approved_by: approvedBy, updated_at: new Date().toISOString() })
    .eq("id", approvalId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
