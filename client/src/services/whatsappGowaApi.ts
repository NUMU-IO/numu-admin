/**
 * Admin API for the GOWA WhatsApp transport.
 *
 * GOWA sends from a real WhatsApp account linked as a companion device, rather
 * than through Meta's Business API. That means no template approval and no
 * marketing frequency cap — and a genuine risk that WhatsApp bans the number,
 * which for a BYO merchant is the number their customers already know.
 *
 * Both the provider switch and pairing therefore REQUIRE `acknowledge_risk`;
 * the backend refuses without it and records which admin accepted.
 */

import { apiClient } from "./api";

export type WhatsAppProvider = "meta_cloud" | "gowa";

export interface GowaDeviceStatus {
  provider: WhatsAppProvider;
  paired: boolean;
  device_id?: string | null;
  phone?: string | null;
  /** pending | connected | disconnected | logged_out */
  status?: string | null;
  /** Live probe of the GOWA session; null when GOWA is unreachable. */
  is_connected?: boolean | null;
  is_logged_in?: boolean | null;
  last_seen_at?: string | null;
  /** GOWA's own wording — the only thing distinguishing a ban from a drop. */
  last_error?: string | null;
}

export interface PairResult {
  device_id: string;
  method: "code" | "qr";
  /** Read this to the merchant. Short-lived. */
  pair_code?: string | null;
  /** data: URI — GOWA's own QR link is loopback-only, so the API inlines it. */
  qr_data_uri?: string | null;
  expires_in_seconds?: number | null;
}

// NOTE: `apiClient` already returns `json.data` from the {success,data,message}
// envelope. Wrapping the generic in an Envelope and reading `.data` again
// yielded undefined on every call — which rendered as "Meta Cloud" / "Not set"
// everywhere, i.e. silently wrong rather than an error. Call it with the
// payload type directly, as the other services do.

export async function getGowaStatus(storeId: string): Promise<GowaDeviceStatus> {
  return apiClient<GowaDeviceStatus>(`/admin/whatsapp/gowa/${storeId}/status`);
}

export async function setWhatsAppProvider(
  storeId: string,
  provider: WhatsAppProvider,
  acknowledgeRisk: boolean,
): Promise<void> {
  await apiClient<void>(`/admin/whatsapp/gowa/${storeId}/provider`, {
    method: "PUT",
    body: JSON.stringify({ provider, acknowledge_risk: acknowledgeRisk }),
  });
}

export async function pairGowaDevice(
  storeId: string,
  phone: string,
  method: "code" | "qr",
  acknowledgeRisk: boolean,
): Promise<PairResult> {
  return apiClient<PairResult>(`/admin/whatsapp/gowa/${storeId}/pair`, {
    method: "POST",
    body: JSON.stringify({ phone, method, acknowledge_risk: acknowledgeRisk }),
  });
}

export async function unpairGowaDevice(storeId: string): Promise<void> {
  await apiClient<void>(`/admin/whatsapp/gowa/${storeId}/unpair`, {
    method: "POST",
  });
}

export interface GowaDeviceListItem {
  device_id: string;
  state?: string | null;
  jid?: string | null;
  phone?: string | null;
  is_platform: boolean;
  claimed_by_store_id?: string | null;
}

/** Every session GOWA is holding, so the platform number can be adopted by clicking. */
export async function listGowaDevices(): Promise<GowaDeviceListItem[]> {
  return apiClient<GowaDeviceListItem[]>("/admin/whatsapp/gowa/devices");
}

export async function getPlatformStatus(): Promise<GowaDeviceStatus> {
  return apiClient<GowaDeviceStatus>("/admin/whatsapp/gowa/platform/status");
}

export async function pairPlatformDevice(
  phone: string,
  acknowledgeRisk: boolean,
): Promise<PairResult> {
  return apiClient<PairResult>("/admin/whatsapp/gowa/platform/pair", {
    method: "POST",
    body: JSON.stringify({ phone, method: "code", acknowledge_risk: acknowledgeRisk }),
  });
}

/** Claim an ALREADY-LINKED session as the platform device, without re-pairing. */
export async function adoptPlatformDevice(deviceId: string): Promise<void> {
  await apiClient<void>(
    `/admin/whatsapp/gowa/platform/adopt?device_id=${encodeURIComponent(deviceId)}`,
    { method: "POST" },
  );
}

export async function unpairPlatformDevice(): Promise<void> {
  await apiClient<void>("/admin/whatsapp/gowa/platform/unpair", {
    method: "POST",
  });
}
