/**
 * Admin user management — list, invite, revoke platform admins.
 */

import { apiClient } from "./api";

export interface AdminUserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string | null;
  last_login_at: string | null;
}

export interface InviteAdminRequest {
  email: string;
  first_name: string;
  last_name?: string;
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

export async function inviteAdmin(
  payload: InviteAdminRequest,
): Promise<InviteAdminResponse> {
  return apiClient<InviteAdminResponse>("/admin/users/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeAdmin(userId: string): Promise<void> {
  await apiClient<null>(`/admin/users/${userId}`, { method: "DELETE" });
}
