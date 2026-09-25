import { apiClient } from "./api";

import { formatNumber } from "@/lib/format";

const BASE = "/admin/entitlements";

export type FeatureKind = "boolean" | "limit";
export type EntitlementValue = boolean | number | "unlimited";
export type OverrideSource = "support" | "sales" | "promotion" | "beta" | "contract" | "testing";
export type OverrideStatus = "live" | "scheduled" | "expired" | "revoked";

export const OVERRIDE_SOURCES: OverrideSource[] = [
  "support",
  "sales",
  "promotion",
  "beta",
  "contract",
  "testing",
];

export interface Feature {
  key: string;
  name: string;
  name_ar: string;
  description: string | null;
  category: string | null;
  kind: FeatureKind;
  default_value: EntitlementValue;
  usage: "count" | "counter" | null;
  period: "day" | "month" | null;
  enforcement: "hard" | "soft";
  unit: string | null;
  /** False = killed for every merchant. */
  is_enabled: boolean;
  disabled_reason: string | null;
  grants: Record<string, EntitlementValue>;
  live_overrides: number;
  releases: string[];
}

export interface FeatureCatalog {
  /** Matrix column order; add-ons are "addon:<slug>" and come last. */
  plans: string[];
  tenant_counts: Record<string, number>;
  features: Feature[];
}

export interface FeaturePatch {
  name?: string;
  name_ar?: string;
  description?: string;
  enforcement?: "hard" | "soft";
  reason: string;
}

export interface GrantResult {
  plan_key: string;
  feature_key: string;
  value: EntitlementValue;
  affected_tenants: number;
}

export interface TenantHit {
  id: string;
  name: string;
  subdomain: string | null;
  plan: string;
}

export interface Override {
  id: string;
  tenant_id: string;
  feature_key: string;
  value: EntitlementValue;
  source: string;
  reason: string;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  status: OverrideStatus;
  tenant?: { name: string; subdomain: string | null; plan: string };
}

export interface OverrideInput {
  feature_key: string;
  value: EntitlementValue;
  source: OverrideSource;
  reason: string;
  expires_at: string | null;
}

export interface ResolvedFeature {
  value: EntitlementValue;
  available: boolean;
  in_plan: boolean;
  source: "plan" | "addon" | "override" | "default";
  source_id: string | null;
  expires_at: string | null;
  reason: "disabled_globally" | "blocked" | "not_in_plan" | null;
  kind: FeatureKind;
  usage: string | null;
  period: string | null;
  enforcement: "hard" | "soft";
}

export interface TenantFeature extends ResolvedFeature {
  key: string;
  name: string;
}

export interface TenantFlag {
  key: string;
  description: string;
  enabled: boolean;
  rollout_percent: number;
  on: boolean;
  why: string;
  bucket: number;
  target: { enabled: boolean; expires_at: string | null; reason: string | null } | null;
}

export interface UsageRow {
  feature: string;
  limit: EntitlementValue;
  used: number;
  remaining: EntitlementValue;
  resets_at: string | null;
}

export interface TenantEntitlements {
  tenant: TenantHit & { entitlements_version: number };
  features: TenantFeature[];
  flags: TenantFlag[];
  usage: UsageRow[];
  overrides: Override[];
}

export interface GrantLayer {
  layer: "plan" | "addon";
  id: string | null;
  value: EntitlementValue;
  expires_at: string | null;
  live: boolean;
  shadowed: boolean;
}

export type ExplainLayer =
  | { layer: "kill_switch"; enabled: boolean; reason: string | null }
  | {
      layer: "override";
      row: {
        id: string;
        value: EntitlementValue;
        source: string;
        reason: string;
        created_by: string | null;
        starts_at: string | null;
        expires_at: string | null;
        live: boolean;
      } | null;
    }
  | GrantLayer
  | { layer: "default"; value: EntitlementValue };

export interface Explain extends ResolvedFeature {
  layers: ExplainLayer[];
  cache_agrees: boolean;
}

export interface Flag {
  key: string;
  description: string;
  owner: string | null;
  feature_key: string | null;
  enabled: boolean;
  rollout_percent: number;
  targets: number;
  created_at: string | null;
  updated_at: string | null;
  age_days: number | null;
}

export interface FlagInput {
  key: string;
  description: string;
  owner?: string;
  feature_key?: string;
}

export interface FlagPatch {
  enabled?: boolean;
  rollout_percent?: number;
  reason: string;
}

export interface FlagTarget {
  tenant_id: string;
  tenant: { name: string; subdomain: string | null };
  enabled: boolean;
  expires_at: string | null;
  expired: boolean;
  reason: string | null;
  created_at: string | null;
}

export interface FlagEvaluation {
  on: boolean;
  why: string;
  bucket: number;
}

export interface AuditRow {
  id: string;
  event_type: string;
  action: string;
  severity: string;
  resource_type: string | null;
  resource_id: string | null;
  tenant_id: string | null;
  actor: string | null;
  details: { old_value?: unknown; new_value?: unknown; reason?: string } | null;
  created_at: string | null;
}

export const ENTITLEMENTS_QUERY_KEY = ["admin-entitlements"] as const;
export const FEATURES_QUERY_KEY = [...ENTITLEMENTS_QUERY_KEY, "features"] as const;
export const FLAGS_QUERY_KEY = [...ENTITLEMENTS_QUERY_KEY, "flags"] as const;

const enc = encodeURIComponent;

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function listFeatures(): Promise<FeatureCatalog> {
  return apiClient<FeatureCatalog>(`${BASE}/features`);
}

export function updateFeature(key: string, body: FeaturePatch): Promise<Feature> {
  return send(`/features/${enc(key)}`, "PATCH", body);
}

export function setKillSwitch(key: string, enabled: boolean, reason: string): Promise<Feature> {
  return send(`/features/${enc(key)}/kill-switch`, "POST", { enabled, reason });
}

export function setGrant(
  key: string,
  planKey: string,
  value: EntitlementValue,
  reason: string,
): Promise<GrantResult> {
  return send(`/features/${enc(key)}/grants/${enc(planKey)}`, "PUT", { value, reason });
}

export function listFeatureOverrides(key: string, status: "live" | "all"): Promise<Override[]> {
  return apiClient<Override[]>(`${BASE}/features/${enc(key)}/overrides?status=${status}`);
}

export function createOverride(tenantId: string, body: OverrideInput): Promise<Override> {
  return send(`/tenants/${tenantId}/overrides`, "POST", body);
}

export function revokeOverride(id: string, reason: string): Promise<Override> {
  return send(`/overrides/${id}/revoke`, "POST", { reason });
}

export function searchTenants(search: string): Promise<TenantHit[]> {
  return apiClient<TenantHit[]>(`${BASE}/tenants?search=${enc(search)}`);
}

export function getTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
  return apiClient<TenantEntitlements>(`${BASE}/tenants/${tenantId}`);
}

export function explainFeature(tenantId: string, key: string): Promise<Explain> {
  return apiClient<Explain>(`${BASE}/tenants/${tenantId}/explain/${enc(key)}`);
}

export function listFlags(): Promise<Flag[]> {
  return apiClient<Flag[]>(`${BASE}/flags`);
}

export function createFlag(body: FlagInput): Promise<Flag> {
  return send("/flags", "POST", body);
}

export function updateFlag(key: string, body: FlagPatch): Promise<Flag> {
  return send(`/flags/${enc(key)}`, "PATCH", body);
}

export function deleteFlag(key: string, reason: string): Promise<void> {
  return send(`/flags/${enc(key)}?reason=${enc(reason)}`, "DELETE");
}

export function listFlagTargets(key: string): Promise<FlagTarget[]> {
  return apiClient<FlagTarget[]>(`${BASE}/flags/${enc(key)}/targets`);
}

export function setFlagTarget(
  key: string,
  tenantId: string,
  body: { enabled: boolean; expires_at: string | null; reason: string },
): Promise<unknown> {
  return send(`/flags/${enc(key)}/targets/${tenantId}`, "PUT", body);
}

export function removeFlagTarget(key: string, tenantId: string, reason: string): Promise<void> {
  return send(`/flags/${enc(key)}/targets/${tenantId}?reason=${enc(reason)}`, "DELETE");
}

export function evaluateFlag(key: string, tenantId: string): Promise<FlagEvaluation> {
  return apiClient<FlagEvaluation>(`${BASE}/flags/${enc(key)}/evaluate?tenant_id=${tenantId}`);
}

export function listAudit(filter: { feature?: string; flag?: string; tenant_id?: string }): Promise<AuditRow[]> {
  const q = new URLSearchParams({ limit: "200" });
  for (const [k, v] of Object.entries(filter)) if (v) q.set(k, v);
  return apiClient<AuditRow[]>(`${BASE}/audit?${q}`);
}

/** "✓"/"—" for switches, "∞" or the number for limits; "" when there is no value. */
export function formatValue(kind: FeatureKind, value: EntitlementValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (kind === "boolean") return value === true ? "✓" : "—";
  if (value === "unlimited") return "∞";
  return typeof value === "number" ? formatNumber(value) : String(value);
}

export function planLabel(key: string): string {
  return key.startsWith("addon:") ? `Add-on: ${key.slice("addon:".length)}` : key;
}

export function categoryLabel(category: string | null): string {
  if (!category) return "Other";
  const words = category.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A value typed into a form: "true"/"false", digits, or "unlimited". Null when invalid. */
export function parseValue(kind: FeatureKind, draft: string): EntitlementValue | null {
  if (kind === "boolean") return draft === "true";
  if (draft === "unlimited") return "unlimited";
  const n = Number(draft);
  return /^\d+$/.test(draft) && Number.isSafeInteger(n) ? n : null;
}

/** An override replaces the plan value, so a smaller one takes away what the merchant pays for. */
export function belowPlan(
  kind: FeatureKind,
  value: EntitlementValue | null,
  planValue: EntitlementValue | undefined,
): boolean {
  if (value === null || planValue === undefined) return false;
  if (kind === "boolean") return value === false && planValue === true;
  if (typeof value !== "number") return false;
  return planValue === "unlimited" || (typeof planValue === "number" && value < planValue);
}

export function flagState(flag: Pick<Flag, "enabled" | "rollout_percent" | "targets">): string {
  if (!flag.enabled) return "Off";
  if (flag.rollout_percent >= 100) return "Everyone";
  if (flag.rollout_percent === 0 && flag.targets > 0) return "Selected";
  return `${flag.rollout_percent}%`;
}

export const FLAG_WHY: Record<string, string> = {
  flag_off: "Master switch is off",
  targeted: "Targeted directly",
  everyone: "Rolled out to everyone",
  rollout: "Inside the rollout percentage",
  not_in_rollout: "Outside the rollout percentage",
  unknown_flag: "Unknown flag",
};
