/**
 * Base API client for the NUMU admin dashboard.
 * Authentication is handled via httpOnly cookies set by the NUMU-api.
 * CSRF protection: token is stored in memory and sent as X-CSRF-Token
 * on every state-changing request (POST, PUT, PATCH, DELETE).
 * On 401, attempts a silent token refresh via the refresh cookie
 * (valid for 7 days) and retries the original request once. Only
 * redirects to /login if the refresh itself fails.
 * On 403 with CSRF failure, refreshes the CSRF token and retries once.
 */

import { getCSRFToken, initCSRF } from "./csrf";
import { getApiBase } from "./env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

// Singleton refresh promise so concurrent 401s don't fire multiple
// refresh requests — the first one wins and the rest piggy-back.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(`${getApiBase()}/admin/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function rawFetch(
  endpoint: string,
  options?: RequestInit,
): Promise<Response> {
  const isFormData = options?.body instanceof FormData;
  const method = (options?.method || "GET").toUpperCase();

  const csrfHeaders: Record<string, string> = {};
  if (!SAFE_METHODS.has(method)) {
    const token = getCSRFToken();
    if (token) {
      csrfHeaders["X-CSRF-Token"] = token;
    }
  }

  return fetch(`${getApiBase()}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...csrfHeaders,
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  let res = await rawFetch(endpoint, options);

  // Handle CSRF token expiry: refresh token and retry once
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (body?.detail === "CSRF validation failed") {
      await initCSRF();
      res = await rawFetch(endpoint, options);
    } else {
      throw new Error(body?.detail || `API error: ${res.status}`);
    }
  }

  // Handle expired access token: silently refresh and retry once.
  // The refresh cookie is valid for 7 days (sliding), so active
  // users should never be bounced to the login page.
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(endpoint, options);
    }

    if (res.status === 401) {
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `API error: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  return json.data;
}

// Re-exported so other services can build absolute URLs against the
// currently-selected env (used in authService for /auth endpoints).
export { getApiBase };
