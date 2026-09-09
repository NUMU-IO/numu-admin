/**
 * Notifications & campaigns.
 *
 * Wraps `/admin/campaigns`, which unions the email/marketing and WhatsApp
 * campaign tables into one shape. Read-only by design — see the endpoint's
 * docstring for why staff do not send on a merchant's behalf.
 */

import { apiClient } from "@/lib/apiClient";

export type CampaignChannelFilter = "all" | "whatsapp" | "email" | "other";

export interface CampaignItem {
  id: string;
  source: "marketing" | "whatsapp";
  name: string;
  channel: string;
  status: string;
  store_id: string | null;
  store_name: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  /** delivered / sent as a percentage; null when nothing has been sent. */
  delivery_rate: number | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CampaignStats {
  campaigns_30d: number;
  recipients_30d: number;
  delivered_30d: number;
  failed_30d: number;
  notifications_30d: number;
  notifications_unread: number;
}

export interface CampaignListResponse {
  items: CampaignItem[];
  total: number;
  stats: CampaignStats;
}

export function listCampaigns(params: {
  channel?: CampaignChannelFilter;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CampaignListResponse> {
  const q = new URLSearchParams();
  if (params.channel && params.channel !== "all") q.set("channel", params.channel);
  if (params.search) q.set("search", params.search);
  q.set("limit", String(params.limit ?? 25));
  q.set("offset", String(params.offset ?? 0));
  return apiClient<CampaignListResponse>(`/admin/campaigns?${q}`);
}
