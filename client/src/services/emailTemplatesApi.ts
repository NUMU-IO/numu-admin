/**
 * Email Templates (admin) API service.
 *
 * Read-only registry-default endpoints for the super-admin panel.
 * The backend is at `/api/v1/admin/email-templates/*` and is purely
 * read-only for the MVP — admins cannot edit registry defaults yet.
 */

import { apiClient } from "@/lib/apiClient";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailTemplateEventInfo {
  event_type: string;
  label_en: string;
  label_ar: string;
  variables: Record<string, string>;
  sample_data: Record<string, unknown>;
  default_subject_en: string;
  default_subject_ar: string;
}

export interface DefaultTemplate {
  event_type: string;
  language: "en" | "ar";
  subject: string;
  html_body: string;
}

export interface PreviewResponse {
  subject: string;
  html: string;
}

export interface SendTestResponse {
  sent: boolean;
  message_id: string | null;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export async function listAdminEmailTemplateEvents(): Promise<
  EmailTemplateEventInfo[]
> {
  return apiClient<EmailTemplateEventInfo[]>("/admin/email-templates/events");
}

export async function getAdminEmailDefault(
  eventType: string,
  language: "en" | "ar",
): Promise<DefaultTemplate> {
  const qs = new URLSearchParams({ language });
  return apiClient<DefaultTemplate>(
    `/admin/email-templates/events/${encodeURIComponent(eventType)}?${qs.toString()}`,
  );
}

export async function previewAdminEmailDefault(
  eventType: string,
  language: "en" | "ar",
  variables?: Record<string, unknown>,
): Promise<PreviewResponse> {
  return apiClient<PreviewResponse>(
    `/admin/email-templates/events/${encodeURIComponent(eventType)}/preview`,
    {
      method: "POST",
      body: JSON.stringify({ language, variables: variables ?? null }),
    },
  );
}

export async function sendTestAdminEmail(
  eventType: string,
  language: "en" | "ar",
  payload: { recipient: string; variables?: Record<string, unknown> },
): Promise<SendTestResponse> {
  return apiClient<SendTestResponse>(
    `/admin/email-templates/events/${encodeURIComponent(eventType)}/send-test`,
    {
      method: "POST",
      body: JSON.stringify({
        recipient: payload.recipient,
        language,
        variables: payload.variables ?? null,
      }),
    },
  );
}
