/**
 * Admin user management — list, invite, revoke platform admins.
 */

// Use the shared /lib/apiClient so we share CSRF state with main.tsx's
// bootstrap initCSRF call. The neighbour ./api has its own in-memory
// csrfToken that never gets seeded, causing a 403 on the first call and
// forcing a retry.
import { apiClient } from "@/lib/apiClient";

export interface AdminUserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string | null;
  last_login_at: string | null;
  /** null = full admin. */
  admin_scope: AdminScope | null;
}

/** Staff role. "all" is a full admin; the API sends it back as null. */
export type AdminScope = "all" | "support" | "finance" | "ops";

export const ADMIN_SCOPE_OPTIONS: { value: AdminScope; label: string }[] = [
  { value: "all", label: "Full access" },
  { value: "support", label: "Support" },
  { value: "finance", label: "Finance" },
  { value: "ops", label: "Ops" },
];

export interface InviteAdminRequest {
  email: string;
  first_name: string;
  last_name?: string;
  admin_scope?: AdminScope;
}

export interface InviteAdminResponse {
  user: AdminUserItem;
  email_sent: boolean;
  /** Only populated when the invite email couldn't be sent (dev / misconfigured). */
  temporary_password: string | null;
}

export async function listAdmins(): Promise<AdminUserItem[]> {
  return apiClient<AdminUserItem[]>("/admin/users");
}

export async function inviteAdmin(payload: InviteAdminRequest): Promise<InviteAdminResponse> {
  return apiClient<InviteAdminResponse>("/admin/users/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeAdmin(userId: string): Promise<void> {
  await apiClient<null>(`/admin/users/${userId}`, { method: "DELETE" });
}

export async function updateAdminScope(
  userId: string,
  admin_scope: AdminScope,
): Promise<AdminUserItem> {
  return apiClient<AdminUserItem>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ admin_scope }),
  });
}
