/**
 * WhatsApp access-request admin service.
 *
 * Wraps `/admin/whatsapp/access-requests*` — the super-admin approval
 * queue that gates which stores may switch on WhatsApp notifications.
 *
 * Endpoints (all SUPER_ADMIN, cookie-authed; apiClient unwraps `data`):
 *
 *   GET  /admin/whatsapp/access-requests?status=<pending|awaiting_payment|
 *          approved|expired|rejected|disabled|all>
 *     → { requests: AdminWhatsAppAccessItem[]; counts: {...} }
 *       `counts` are GLOBAL per-status totals (independent of the
 *       `status` filter) so the queue can label its tabs.
 *
 *   POST /admin/whatsapp/access-requests/{id}/approve  { notes? }
 *   POST /admin/whatsapp/access-requests/{id}/reject   { notes? }
 *   POST /admin/whatsapp/access-requests/{id}/disable  { notes? }
 *   POST /admin/whatsapp/access-requests/{id}/enable   { notes? }
 *     → the updated AdminWhatsAppAccessItem.
 *
 *   POST /admin/whatsapp/access-requests/{id}/price
 *          { amount_cents, billing_cycle, message_allowance?, plan_key?, notes? }
 *     → { request, intent_id, special_reference, amount_cents, currency,
 *         destination }. 503 when InstaPay is not configured.
 *
 * approve + enable both land on status "approved" as a free grant;
 * disable → "disabled"; reject → "rejected". Pricing opens an InstaPay
 * payment and moves the request to "awaiting_payment", unless it is already
 * approved inside a paid period (a renewal, which stays "approved"). The
 * merchant's receipt lands in the subscription payment proofs queue, and
 * approving it switches access on. An illegal transition comes back as a 409 whose
 * `detail` apiClient re-throws as an Error message — the page surfaces
 * that in an error toast.
 */

import { apiClient } from "./api";

/** Lifecycle status of a single access request. */
export type WhatsappAccessStatus =
  | "pending"
  | "awaiting_payment"
  | "approved"
  | "expired"
  | "rejected"
  | "disabled";

/** Status filter accepted by the list endpoint (adds the `all` view). */
export type WhatsappAccessStatusFilter = WhatsappAccessStatus | "all";

/** A mutating action → its matching POST sub-path. */
export type WhatsappAccessAction = "approve" | "reject" | "disable" | "enable";

export type WhatsappBillingCycle = "monthly" | "quarterly" | "yearly";

export interface AdminWhatsAppAccessItem {
  id: string;
  store_id: string;
  store_name: string | null;
  store_subdomain: string | null;
  store_slug: string | null;
  tenant_id: string;
  status: WhatsappAccessStatus;
  note: string | null;
  contact_phone: string | null;
  expected_volume: string | null;
  requester_user_id: string;
  requester_email: string | null;
  reviewer_user_id: string | null;
  reviewed_at: string | null; // ISO
  review_reason: string | null;
  plan_key: string | null;
  amount_cents: number | null; // piasters, per billing cycle
  currency: string | null;
  billing_cycle: WhatsappBillingCycle | null;
  active_until: string | null; // ISO; null = no expiry
  message_allowance: number | null; // null = uncapped
  messages_used: number | null; // current period; approved rows only
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface WhatsappAccessListResponse {
  requests: AdminWhatsAppAccessItem[];
  counts: Record<WhatsappAccessStatus, number>;
}

export interface WhatsappAccessActionRequest {
  notes?: string;
}

export interface WhatsappAccessPriceRequest {
  amount_cents: number;
  billing_cycle: WhatsappBillingCycle;
  message_allowance?: number | null;
  plan_key?: string;
  notes?: string;
}

export interface WhatsappAccessPriceResponse {
  request: AdminWhatsAppAccessItem;
  intent_id: string;
  special_reference: string;
  amount_cents: number;
  currency: string;
  destination: string | null;
}

/**
 * GET /admin/whatsapp/access-requests?status=… — list requests plus the
 * global per-status counts. Defaults to the pending queue.
 */
export function listWhatsappAccessRequests(
  status: WhatsappAccessStatusFilter = "pending",
): Promise<WhatsappAccessListResponse> {
  const q = encodeURIComponent(status);
  return apiClient<WhatsappAccessListResponse>(
    `/admin/whatsapp/access-requests?status=${q}`,
  );
}

function actOnWhatsappAccessRequest(
  id: string,
  action: WhatsappAccessAction,
  notes?: string,
): Promise<AdminWhatsAppAccessItem> {
  return apiClient<AdminWhatsAppAccessItem>(
    `/admin/whatsapp/access-requests/${id}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes } satisfies WhatsappAccessActionRequest),
    },
  );
}

/** POST …/{id}/approve — grant (or re-grant) WhatsApp access. */
export function approveWhatsappAccessRequest(
  id: string,
  notes?: string,
): Promise<AdminWhatsAppAccessItem> {
  return actOnWhatsappAccessRequest(id, "approve", notes);
}

/** POST …/{id}/reject — deny a pending request. */
export function rejectWhatsappAccessRequest(
  id: string,
  notes?: string,
): Promise<AdminWhatsAppAccessItem> {
  return actOnWhatsappAccessRequest(id, "reject", notes);
}

/** POST …/{id}/disable — switch off access for an approved store. */
export function disableWhatsappAccessRequest(
  id: string,
  notes?: string,
): Promise<AdminWhatsAppAccessItem> {
  return actOnWhatsappAccessRequest(id, "disable", notes);
}

/** POST …/{id}/enable — re-enable a disabled store. */
export function enableWhatsappAccessRequest(
  id: string,
  notes?: string,
): Promise<AdminWhatsAppAccessItem> {
  return actOnWhatsappAccessRequest(id, "enable", notes);
}

/** POST …/{id}/price — bill the store for a period of access. */
export function priceWhatsappAccessRequest(
  id: string,
  body: WhatsappAccessPriceRequest,
): Promise<WhatsappAccessPriceResponse> {
  return apiClient<WhatsappAccessPriceResponse>(
    `/admin/whatsapp/access-requests/${id}/price`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/**
 * action → typed call. Lets the queue page drive one mutation and
 * dispatch by the requested action (mirrors MarketplaceReview's single
 * `reviewMutation`).
 */
export const whatsappAccessActions: Record<
  WhatsappAccessAction,
  (id: string, notes?: string) => Promise<AdminWhatsAppAccessItem>
> = {
  approve: approveWhatsappAccessRequest,
  reject: rejectWhatsappAccessRequest,
  disable: disableWhatsappAccessRequest,
  enable: enableWhatsappAccessRequest,
};
