/**
 * Auth API service — login, logout, get current user.
 * Authentication is handled via httpOnly cookies set by the NUMU-api.
 * CSRF token is fetched after login so subsequent requests pass validation.
 */

import { apiClient, API_BASE } from "@/lib/apiClient";
import { initCSRF, clearCSRFToken } from "@/lib/csrf";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    role: string;
    status: string;
    avatar_url?: string | null;
    is_verified?: boolean;
    created_at: string;
    updated_at: string;
  };
}

function mapUser(raw: AuthResponse["user"]): AdminUser {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.full_name || `${raw.first_name} ${raw.last_name}`.trim(),
    first_name: raw.first_name,
    last_name: raw.last_name,
    role: raw.role,
    status: raw.status,
    avatar_url: raw.avatar_url ?? null,
    is_verified: raw.is_verified ?? false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

// Admin-only auth endpoints — these set the `admin_access_token` /
// `admin_refresh_token` cookie pair so the admin session is isolated from
// the merchant hub's `access_token` pair. Without the split, the
// "Log in as merchant" impersonation flow would overwrite the admin's
// session on .numueg.app and the admin panel would show the merchant's
// email on the next API call.
export async function login(
  email: string,
  password: string,
): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/admin/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Login failed (${res.status})`);
  }

  const json = await res.json();
  const user = mapUser(json.data.user);

  // Server-side already gated on SUPER_ADMIN, but double-check here so a
  // stale response from a mocked backend can't sneak through.
  if (user.role !== "super_admin" && user.role !== "admin") {
    await fetch(`${API_BASE}/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    throw new Error("You do not have admin access to this panel.");
  }

  await initCSRF();
  return user;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/admin/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  clearCSRFToken();
}

export async function getMe(): Promise<AdminUser> {
  // Try /me directly; on 401 attempt a single sliding refresh so a
  // tab returning from idle inside the 7-day refresh window stays
  // signed in instead of bouncing to OAuth. The refresh is
  // server-side sliding (a successful POST mints a fresh 7-day
  // refresh cookie too), so an active user never hits the wall.
  let res = await fetch(`${API_BASE}/admin/auth/me`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 401) {
    const refresh = await fetch(`${API_BASE}/admin/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refresh.ok) {
      res = await fetch(`${API_BASE}/admin/auth/me`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!res.ok) {
    throw new Error("Not authenticated");
  }

  const json = await res.json();
  return mapUser(json.data);
}
