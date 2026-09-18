/**
 * Marketing — reaching leads, the copy we reach them with, and referrals.
 *
 * Wraps `/admin/marketing`. Two things about this surface differ from every
 * other service here and are worth knowing before reading the page:
 *
 *  1. WhatsApp is NOT sent by the platform. `send` returns a `wa.me` link per
 *     lead with the message already typed, and the operator sends it from
 *     their own WhatsApp. Sending marketing through the Business API needs a
 *     Meta-approved template per message and is bounded by the 24-hour
 *     session window, neither of which fits outreach to a prospect who has
 *     never messaged us.
 *  2. Referral MILESTONES are fixed — each is a condition the backend
 *     evaluates — while their AMOUNTS are editable. The page can change what
 *     a milestone pays, never invent one.
 */

import { apiClient } from "@/lib/apiClient";

// `apiClient` already unwraps the API's `{ data: … }` envelope, so every
// annotation below is the payload itself.

export type MarketingChannel = "email" | "whatsapp";
export type MarketingLanguage = "en" | "ar";

export interface MarketingTemplate {
  id: string;
  key: string;
  channel: MarketingChannel;
  language: string;
  name: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
}

export interface MarketingSettings {
  email_from: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  referral_link_base: string;
}

export interface SendRequest {
  lead_ids: string[];
  channel: MarketingChannel;
  /** Omit to use each lead's own language, which is the right default. */
  language?: MarketingLanguage | null;
  template_key?: string | null;
  subject?: string | null;
  body?: string | null;
}

export interface SendDetail {
  lead_id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  status: "sent" | "failed" | "skipped";
  reason?: string;
  /** WhatsApp only — the prefilled link for this lead. */
  whatsapp_url?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  details: SendDetail[];
}

export interface MessagePreview {
  recipient: string;
  subject: string | null;
  body: string;
  whatsapp_url: string | null;
}

export interface OutreachEntry {
  id: string;
  lead_id: string | null;
  lead_email: string | null;
  recipient: string;
  channel: MarketingChannel;
  template_key: string | null;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  created_at: string;
}

export interface MilestoneSetting {
  milestone: string;
  label: string;
  description: string;
  amount_cents: number;
  is_active: boolean;
}

export interface ReferralReward {
  id: string;
  referrer_email: string | null;
  referred_email: string | null;
  milestone: string;
  milestone_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  earned_at: string;
  paid_at: string | null;
}

export interface ReferralSummary {
  pending_count: number;
  pending_cents: number;
  approved_count: number;
  approved_cents: number;
  paid_count: number;
  paid_cents: number;
  referred_leads: number;
  activated_referrals: number;
}

export function getMarketingSettings(): Promise<MarketingSettings> {
  return apiClient<MarketingSettings>("/admin/marketing/settings");
}

export function listTemplates(
  channel?: MarketingChannel
): Promise<MarketingTemplate[]> {
  const query = channel ? `?channel=${channel}` : "";
  return apiClient<MarketingTemplate[]>(`/admin/marketing/templates${query}`);
}

export function createTemplate(
  body: Omit<MarketingTemplate, "id" | "updated_at">
): Promise<MarketingTemplate> {
  return apiClient<MarketingTemplate>("/admin/marketing/templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTemplate(
  id: string,
  patch: Partial<
    Pick<MarketingTemplate, "name" | "subject" | "body" | "is_active">
  >
): Promise<MarketingTemplate> {
  return apiClient<MarketingTemplate>(`/admin/marketing/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient(`/admin/marketing/templates/${id}`, { method: "DELETE" });
}

export function previewMessage(body: SendRequest): Promise<MessagePreview> {
  return apiClient<MessagePreview>("/admin/marketing/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function sendMessage(body: SendRequest): Promise<SendResult> {
  return apiClient<SendResult>("/admin/marketing/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listOutreach(params?: {
  leadId?: string;
  limit?: number;
}): Promise<OutreachEntry[]> {
  const query = new URLSearchParams();
  if (params?.leadId) query.set("lead_id", params.leadId);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query}` : "";
  return apiClient<OutreachEntry[]>(`/admin/marketing/outreach${suffix}`);
}

export function listMilestones(): Promise<MilestoneSetting[]> {
  return apiClient<MilestoneSetting[]>("/admin/marketing/referrals/milestones");
}

export function updateMilestone(
  milestone: string,
  body: { amount_cents: number; is_active: boolean }
): Promise<MilestoneSetting> {
  return apiClient<MilestoneSetting>(
    `/admin/marketing/referrals/milestones/${milestone}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

export function listRewards(
  status: "pending" | "approved" | "paid" | "void" | "all" = "pending"
): Promise<ReferralReward[]> {
  return apiClient<ReferralReward[]>(
    `/admin/marketing/referrals?status=${status}`
  );
}

export function getReferralSummary(): Promise<ReferralSummary> {
  return apiClient<ReferralSummary>("/admin/marketing/referrals/summary");
}

export function decideReward(
  id: string,
  body: { action: "approve" | "pay" | "void"; note?: string }
): Promise<{ status: string }> {
  return apiClient<{ status: string }>(
    `/admin/marketing/referrals/${id}/decision`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function recalculateReferrals(): Promise<{
  leads_scanned: number;
  rewards_created: number;
}> {
  return apiClient<{ leads_scanned: number; rewards_created: number }>(
    "/admin/marketing/referrals/recalculate",
    { method: "POST" }
  );
}
