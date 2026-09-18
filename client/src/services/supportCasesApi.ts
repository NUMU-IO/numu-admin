/**
 * Support cases — what staff owe a merchant.
 *
 * Wraps `/admin/support-cases`. `unresolved` is the default filter because
 * that is the only state anyone works: open plus waiting-on-merchant.
 */

import { apiClient } from "@/lib/apiClient";

export type CaseStatus = "open" | "pending_merchant" | "resolved" | "closed";
export type CasePriority = "low" | "normal" | "high" | "urgent";
export type CaseStatusFilter = CaseStatus | "unresolved" | "all";

export interface SupportCase {
  id: string;
  subject: string;
  body: string | null;
  status: CaseStatus;
  priority: CasePriority;
  category: string | null;
  tenant_id: string | null;
  store_id: string | null;
  store_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  reporter_email: string | null;
  assignee_user_id: string | null;
  assignee_email: string | null;
  resolution: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseListResponse {
  items: SupportCase[];
  total: number;
  counts: Record<string, number>;
}

export function listSupportCases(params: {
  status?: CaseStatusFilter;
  priority?: CasePriority;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CaseListResponse> {
  const q = new URLSearchParams();
  q.set("status", params.status ?? "unresolved");
  if (params.priority) q.set("priority", params.priority);
  if (params.search) q.set("search", params.search);
  q.set("limit", String(params.limit ?? 25));
  q.set("offset", String(params.offset ?? 0));
  return apiClient<CaseListResponse>(`/admin/support-cases?${q}`);
}

export interface CreateCasePayload {
  subject: string;
  body?: string;
  priority?: CasePriority;
  category?: string;
  store_id?: string;
  entity_type?: string;
  entity_id?: string;
  reporter_email?: string;
}

export function createSupportCase(payload: CreateCasePayload): Promise<SupportCase> {
  return apiClient<SupportCase>("/admin/support-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateCasePayload {
  status?: CaseStatus;
  priority?: CasePriority;
  assignee_user_id?: string;
  /** Required by the API when moving to resolved or closed. */
  resolution?: string;
}

export function updateSupportCase(
  id: string,
  payload: UpdateCasePayload,
): Promise<SupportCase> {
  return apiClient<SupportCase>(`/admin/support-cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
