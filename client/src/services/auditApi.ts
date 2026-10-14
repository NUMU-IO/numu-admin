/**
 * Staff audit log — every audited action across the platform, newest first.
 * Paged by cursor: pass the previous page's `next_cursor` as `before`.
 */

import { apiClient } from "./api";

export interface AuditLogRow {
  id: string;
  created_at: string;
  event_type: string;
  action: string | null;
  severity: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  actor_email: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_subdomain: string | null;
  store_id: string | null;
  store_name: string | null;
  details: Record<string, unknown>;
}

export interface AuditLogPage {
  items: AuditLogRow[];
  next_cursor: string | null;
}

export interface AuditLogFilters {
  user_id?: string;
  merchant?: string;
  event_type?: string;
  actor?: "" | "staff" | "system";
  since?: string;
}

export function listAuditLog(filters: AuditLogFilters, before?: string | null) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, before })) {
    if (value) params.set(key, value);
  }
  return apiClient<AuditLogPage>(`/admin/audit?${params}`);
}

export function listAuditActors() {
  return apiClient<{ id: string; email: string }[]>("/admin/audit/actors");
}
