import { apiClient } from "@/lib/apiClient";

export interface MetaCredentials {
  meta_app_id: string;
  meta_app_secret: string;
  meta_webhook_verify_token: string;
  meta_login_config_id: string;
  meta_config_id: string;
  meta_graph_api_version: string;
}

export type MetaCredentialsUpdate = Partial<MetaCredentials>;

export function getMetaCredentials(): Promise<MetaCredentials> {
  return apiClient<MetaCredentials>("/admin/platform-config/meta");
}

export function updateMetaCredentials(
  values: MetaCredentialsUpdate,
): Promise<MetaCredentials> {
  return apiClient<MetaCredentials>("/admin/platform-config/meta", {
    method: "POST",
    body: JSON.stringify(values),
  });
}
