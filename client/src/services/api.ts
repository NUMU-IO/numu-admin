/**
 * Base API client for the NUMU Admin panel.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF protection: token is stored in memory and sent as X-CSRF-Token
 * on every state-changing request (POST, PUT, PATCH, DELETE).
 *
 * Session lifetime:
 *   - Access token cookie: 30 minutes (server-set).
 *   - Refresh token cookie: 7 days, sliding (server reissues a fresh
 *     7-day window every time ``/admin/auth/refresh`` is called).
 *
 * On 401 we attempt a single in-flight refresh and retry the original
 * request. If the refresh itself 401s the user is genuinely
 * unauthenticated and we redirect to /login. This keeps idle tabs
 * alive for the full 7-day refresh window: the next request after
 * the access cookie expires silently re-mints both tokens.
 */

import { getCSRFToken, initCSRF } from "./csrf";

import { getApiBase } from "@/lib/env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

// Endpoints we MUST NOT auto-retry on 401, even if a refresh succeeds:
// the refresh endpoint itself (would loop), the login endpoint
// (returning 401 there means bad credentials, not an expired session),
// and the me/logout endpoints (where 401 is the legitimate signal that
// the user is signed out).
const _AUTH_ENDPOINTS = new Set([
  "/admin/auth/refresh",
  "/admin/auth/login",
  "/admin/auth/logout",
  "/admin/auth/me",
]);

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
      ...(options?.headers as Record<string, string> || {}),
    },
  });
}

// Single-flight refresh: parallel 401s share one refresh round-trip
// instead of stampeding the refresh endpoint with N concurrent calls
// (and risking N races where each succeeds with a different token).
let _refreshInFlight: Promise<boolean> | null = null;

async function _refreshAccessToken(): Promise<boolean> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const res = await rawFetch("/admin/auth/refresh", { method: "POST" });
      return res.ok;
    } catch {
      return false;
    } finally {
      // Clear the in-flight slot on the next microtask so the boolean
      // resolves to all waiters first, then a future 401 can trigger a
      // fresh refresh.
      queueMicrotask(() => {
        _refreshInFlight = null;
      });
    }
  })();
  return _refreshInFlight;
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

  if (res.status === 401) {
    // Don't try to refresh the auth endpoints themselves — that's
    // either a real bad-credentials 401 (login) or a refresh that
    // already failed.
    const isAuthEndpoint = _AUTH_ENDPOINTS.has(endpoint);
    if (!isAuthEndpoint) {
      const refreshed = await _refreshAccessToken();
      if (refreshed) {
        res = await rawFetch(endpoint, options);
        // Fall through to the normal status-code handling below.
      }
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
