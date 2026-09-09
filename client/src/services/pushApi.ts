/**
 * Web Push subscription plumbing for the backoffice.
 *
 * Goes through `apiClient` so the CSRF token and the 401 refresh-and-retry
 * apply exactly as they do everywhere else.
 *
 * These endpoints are `/admin/push/*` rather than the merchant hub's
 * `/auth/me/push-token`: that one resolves the caller's owner tenant and
 * rejects anyone without one, and a platform operator has no tenant. A
 * subscription registered here receives platform notifications only.
 */
import { apiClient } from "@/lib/apiClient";

export interface PushKeyResponse {
  public_key: string | null;
  enabled: boolean;
}

// `apiClient` already unwraps the API's `{ data: … }` envelope, so these
// annotate the payload itself.
export function getPushKey(): Promise<PushKeyResponse> {
  return apiClient<PushKeyResponse>("/admin/push/key");
}

export async function registerPushSubscription(
  sub: PushSubscription
): Promise<void> {
  const json = sub.toJSON();
  await apiClient("/admin/push/subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      // The backoffice is English-only; the field exists because the same
      // table serves the Arabic merchant hub.
      locale: "en",
      platform: "web",
    }),
  });
}

export async function revokePushSubscription(endpoint?: string): Promise<void> {
  const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
  await apiClient(`/admin/push/subscribe${query}`, { method: "DELETE" });
}

/** Send a test notification to every device this operator has registered. */
export function sendTestPush(): Promise<{ queued: boolean; reason?: string }> {
  return apiClient<{ queued: boolean; reason?: string }>("/admin/push/test", {
    method: "POST",
  });
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Returns an ArrayBuffer rather than the Uint8Array every snippet online
 * shows: TypeScript 5.9 types `Uint8Array` as `Uint8Array<ArrayBufferLike>`,
 * which is not assignable to `BufferSource` because it could be backed by a
 * SharedArrayBuffer. The buffer itself is what the API wants anyway.
 */
export function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return buffer;
}
