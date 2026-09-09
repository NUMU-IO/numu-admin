/**
 * Trust & risk — the COD review queue.
 *
 * Wraps `/admin/risk`. Every scored order carries the signals behind the
 * score, because a bare number is not something a reviewer can agree or
 * disagree with.
 */

import { apiClient } from "@/lib/apiClient";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type RiskLevelFilter = RiskLevel | "all";
export type RiskStateFilter = "open" | "decided" | "all";
/** `escalate` keeps the case open but marks it for a second reviewer. */
export type RiskDecision = "accept" | "reject" | "escalate";

export interface RiskFactor {
  code: string;
  weight: number;
}

export interface RiskItem {
  id: string;
  order_id: string | null;
  order_number: string | null;
  store_id: string;
  store_name: string | null;
  tenant_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total_cents: number | null;
  currency: string | null;
  payment_method: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  suggested_action: string | null;
  factors: RiskFactor[] | null;
  action_taken: string | null;
  action_taken_at: string | null;
  action_note: string | null;
  created_at: string;
}

export interface RiskListResponse {
  items: RiskItem[];
  total: number;
  counts: Record<string, number>;
}

export function listRisk(params: {
  level?: RiskLevelFilter;
  state?: RiskStateFilter;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RiskListResponse> {
  const q = new URLSearchParams();
  if (params.level && params.level !== "all") q.set("level", params.level);
  if (params.state) q.set("state", params.state);
  if (params.search) q.set("search", params.search);
  q.set("limit", String(params.limit ?? 25));
  q.set("offset", String(params.offset ?? 0));
  return apiClient<RiskListResponse>(`/admin/risk?${q}`);
}

/** The reason is required by the API — an override has to say why. */
export function decideRisk(
  assessmentId: string,
  decision: RiskDecision,
  reason: string,
): Promise<RiskItem> {
  return apiClient<RiskItem>(`/admin/risk/${assessmentId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, reason }),
  });
}
