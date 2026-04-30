/**
 * Auth API service — login, logout, get current user.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF token is fetched after login so subsequent requests pass validation.
 */

import { initCSRF, clearCSRFToken } from "./csrf";

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: AdminUser;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
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

  // Fetch CSRF token now that we have auth cookies
  await initCSRF();

  return json.data;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/admin/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  clearCSRFToken();
}

export async function getMe(): Promise<AdminUser> {
  // Use raw fetch — NOT apiClient — to avoid the 401 → redirect loop
  // when the app first loads. But still attempt a single sliding
  // refresh before declaring the user unauthenticated, so a tab that
  // returns from idle inside the 7-day refresh window seamlessly
  // re-authenticates instead of bouncing the user to the OAuth portal.
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
  return json.data;
}
