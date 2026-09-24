/**
 * Partner support inbox (`/admin/partner-support`) and the app review
 * moderation queue (`/admin/app-reviews`).
 */

import { apiClient } from "@/lib/apiClient";

export type TicketStatus = "open" | "answered" | "closed";

export interface PartnerTicket {
  id: string;
  kind: "app" | "partner";
  subject: string;
  status: TicketStatus;
  app_name: string | null;
  store_name: string | null;
  partner_name: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface TicketMessage {
  id: string;
  author_role: "merchant" | "partner" | "staff";
  body: string;
  attachments: { url: string; name: string; content_type: string; size: number }[];
  created_at: string;
}

export interface TicketThread {
  ticket: PartnerTicket;
  messages: TicketMessage[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export function listPartnerTickets(params: {
  status?: TicketStatus;
  page: number;
  page_size: number;
}): Promise<Page<PartnerTicket>> {
  const q = new URLSearchParams({ page: String(params.page), page_size: String(params.page_size) });
  if (params.status) q.set("status", params.status);
  return apiClient<Page<PartnerTicket>>(`/admin/partner-support?${q}`);
}

export function getPartnerTicket(id: string): Promise<TicketThread> {
  return apiClient<TicketThread>(`/admin/partner-support/${id}`);
}

export function replyPartnerTicket(id: string, body: string): Promise<TicketThread> {
  const form = new FormData();
  form.append("body", body);
  return apiClient<TicketThread>(`/admin/partner-support/${id}/messages`, {
    method: "POST",
    body: form,
  });
}

export function closePartnerTicket(id: string): Promise<TicketThread> {
  return apiClient<TicketThread>(`/admin/partner-support/${id}/close`, { method: "POST" });
}

export type ReviewQueue = "reported" | "hidden" | "all";

export interface AppReview {
  id: string;
  app_id: string;
  app_name: string | null;
  store_name: string | null;
  rating: number;
  body: string | null;
  reply_body: string | null;
  is_hidden: boolean;
  reported: boolean;
  report_reason: string | null;
  created_at: string;
}

export function listAppReviews(params: {
  queue: ReviewQueue;
  page: number;
  page_size: number;
}): Promise<Page<AppReview>> {
  const q = new URLSearchParams({
    queue: params.queue,
    page: String(params.page),
    page_size: String(params.page_size),
  });
  return apiClient<Page<AppReview>>(`/admin/app-reviews?${q}`);
}

export function moderateAppReview(
  id: string,
  action: "hide" | "unhide" | "dismiss",
): Promise<AppReview> {
  return apiClient<AppReview>(`/admin/app-reviews/${id}/moderate`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
