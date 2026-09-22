/**
 * Partner program admin API — /api/v1/admin/partners (apps plan, Phase 2).
 *
 * Every write (open/close the program, approve, reject, suspend, reinstate)
 * needs the 2FA step-up and lands in audit_logs. Notes the partner reads are
 * sent in Arabic and English. An illegal transition comes back as a 409 whose
 * `detail` apiClient re-throws as the Error message.
 */

import { apiClient } from "./api";

export type PartnerStatus = "pending" | "approved" | "rejected" | "suspended";

export interface AdminPartner {
  id: string;
  user_id: string;
  user_email: string;
  email_verified: boolean;
  kind: "individual" | "company";
  display_name: string;
  legal_name: string | null;
  country: string;
  website_url: string | null;
  support_email: string;
  support_phone: string | null;
  status: PartnerStatus;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
  review_notes: { ar?: string; en?: string } | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  dev_store_count: number;
  theme_count: number;
}

export function listPartners(status?: PartnerStatus): Promise<AdminPartner[]> {
  return apiClient<AdminPartner[]>(`/admin/partners${status ? `?status=${status}` : ""}`);
}

export function getProgram(): Promise<{ enabled: boolean }> {
  return apiClient<{ enabled: boolean }>("/admin/partners/program");
}

export function setProgram(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiClient<{ enabled: boolean }>("/admin/partners/program", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export function decidePartner(
  id: string,
  body: { decision: "approve" | "reject"; notes_ar?: string; notes_en?: string },
): Promise<AdminPartner> {
  return apiClient<AdminPartner>(`/admin/partners/${id}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function suspendPartner(
  id: string,
  body: { suspend: boolean; reason_ar?: string; reason_en?: string },
): Promise<AdminPartner> {
  return apiClient<AdminPartner>(`/admin/partners/${id}/suspension`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
