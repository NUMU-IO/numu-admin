/**
 * Platform capability registry service — the control plane for what may
 * extend NUMU (ADR-0 / ADR-6).
 *
 * Backend: `src/api/v1/routes/admin/platform_capabilities.py`, mounted at
 * `/admin/platform/capabilities` by `admin/__init__.py`. Every route is
 * SUPER_ADMIN; `POST /{slug}/lifecycle` additionally carries a 2FA step-up
 * (`require_admin_2fa(max_age_seconds=300)`), which surfaces as a 403 whose
 * `detail` mentions 2FA — see `is2FAError` below.
 *
 * All responses are `{data: ...}`; `apiClient` unwraps `data` already, so
 * every function here returns the inner payload directly.
 *
 * NOTE ON ENUMS: this module deliberately types the vocabulary fields as
 * plain `string`. The server owns the vocabulary and serves it from
 * `GET /vocabulary` — hardcoding a union here is exactly how the
 * dynamic-source enum ended up triplicated across hub / SDK / host. The UI
 * builds every select from the fetched vocabulary. The only knowledge this
 * client keeps is *presentational* (which lifecycle state gets which colour),
 * and that degrades gracefully for values it doesn't recognise.
 */

import { apiClient } from "./api";

const BASE = "/admin/platform/capabilities";

export interface CapabilityItem {
  id: string;
  slug: string;
  kind: string;
  owner: string;
  description: string | null;
  lifecycle_state: string;
  data_classification: string;
  /** The tier stored on the row. May be overridden upward — see below. */
  min_tier: string;
  /**
   * The tier actually required once the data classification's floor is
   * applied. When this differs from `min_tier` the server is correcting a
   * misconfigured row upward; the UI must say so out loud rather than let an
   * operator wonder why a grant failed.
   */
  effective_min_tier: string;
  unavailable_behavior: string;
  active_version: string | null;
  supported_versions: string[];
  placements: string[];
  dependencies: string[];
  /**
   * Whether this capability can be granted *at all* (evaluated at
   * first_party, so it reflects lifecycle only, not any requester's tier).
   * draft / retired / suspended → false.
   */
  grantable: boolean;
}

export interface CapabilityListResponse {
  capabilities: CapabilityItem[];
  total: number;
}

export interface CapabilityVocabulary {
  kinds: string[];
  lifecycle_states: string[];
  tiers: string[];
  data_classifications: string[];
  unavailable_behaviors: string[];
}

export interface CapabilityCreateInput {
  slug: string;
  kind: string;
  owner: string;
  description?: string | null;
  lifecycle_state: string;
  data_classification: string;
  min_tier: string;
  unavailable_behavior: string;
  active_version?: string | null;
  supported_versions: string[];
  placements: string[];
  dependencies: string[];
}

/**
 * Metadata patch. `lifecycle_state` is intentionally absent — the server
 * strips it from PATCH bodies so that a general-purpose edit can never
 * bypass the 2FA-gated lifecycle endpoint. Keeping it off the type means the
 * client can't even try.
 */
export type CapabilityPatchInput = Partial<
  Omit<CapabilityCreateInput, "slug" | "kind" | "owner" | "lifecycle_state">
>;

export interface GrantCheckRequest {
  tier: string;
  requested_slugs: string[];
}

export interface GrantDenial {
  capability_slug: string;
  reason: string;
}

export interface GrantCheckResponse {
  tier: string;
  ok: boolean;
  granted: string[];
  denied: GrantDenial[];
}

export interface CapabilityFilters {
  kind?: string | null;
  lifecycle_state?: string | null;
}

export const CAPABILITIES_QUERY_KEY = ["admin-platform-capabilities"] as const;
export const CAPABILITY_VOCAB_QUERY_KEY = [
  "admin-platform-capability-vocabulary",
] as const;

export function listCapabilities(
  filters: CapabilityFilters = {},
): Promise<CapabilityListResponse> {
  const params = new URLSearchParams();
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.lifecycle_state)
    params.set("lifecycle_state", filters.lifecycle_state);
  const qs = params.toString();
  return apiClient<CapabilityListResponse>(`${BASE}${qs ? `?${qs}` : ""}`);
}

/**
 * The server-owned enum vocabulary. Cache it hard — it only changes when the
 * backend deploys.
 */
export function getCapabilityVocabulary(): Promise<CapabilityVocabulary> {
  return apiClient<CapabilityVocabulary>(`${BASE}/vocabulary`);
}

/** 409 on duplicate slug — surfaced as a thrown Error with the API detail. */
export function createCapability(
  body: CapabilityCreateInput,
): Promise<CapabilityItem> {
  return apiClient<CapabilityItem>(BASE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCapability(
  slug: string,
  body: CapabilityPatchInput,
): Promise<CapabilityItem> {
  return apiClient<CapabilityItem>(`${BASE}/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Move a capability through its lifecycle — including SUSPEND, the
 * platform-wide kill switch. Requires a 2FA step-up completed within the
 * last 300s (production only; dev/staging skip the gate unless
 * NUMU_FORCE_ADMIN_2FA is set).
 */
export function setCapabilityLifecycle(
  slug: string,
  lifecycleState: string,
  reason?: string,
): Promise<CapabilityItem> {
  return apiClient<CapabilityItem>(
    `${BASE}/${encodeURIComponent(slug)}/lifecycle`,
    {
      method: "POST",
      body: JSON.stringify({
        lifecycle_state: lifecycleState,
        reason: reason?.trim() ? reason.trim() : null,
      }),
    },
  );
}

/** Dry-run a manifest against the live registry. Never mutates anything. */
export function checkGrant(
  body: GrantCheckRequest,
): Promise<GrantCheckResponse> {
  return apiClient<GrantCheckResponse>(`${BASE}/check`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * The lifecycle endpoint's 403 detail is the only signal the client gets
 * that the step-up expired. Same heuristic MarketplaceReview.tsx uses.
 */
export function is2FAError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /2fa|mfa|step.up/i.test(msg);
}
