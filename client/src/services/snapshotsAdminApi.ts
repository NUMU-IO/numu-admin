/**
 * Snapshots admin service — Session C (2026-05-28).
 *
 * Wraps:
 *   GET /api/v1/admin/stores/{store_id}/themes/snapshots
 *     → list of {id, reason, theme_id, theme_name, created_at,
 *                restored_at, section_count, section_group_count, ...}
 *
 *   GET /api/v1/admin/stores/{store_id}/themes/snapshots/{snapshot_id}
 *     → full payload incl. customization + customization_v3 JSONB
 *
 * No restore endpoint exists in Session C — the UI's Restore button
 * is disabled with a tooltip explaining the gap. Restore is a
 * production-affecting action; the corresponding endpoint will be
 * built in a follow-up session pending explicit user authorization.
 */

import { apiClient } from "./api";

export interface AdminSnapshotItem {
  id: string;
  store_id: string;
  theme_id: string | null;
  theme_version_id: string | null;
  reason: string;
  created_at: string;
  restored_at: string | null;
  section_count: number;
  section_group_count: number;
  /** Resolved on the server from `themes.name` — null if the theme was
   *  hard-deleted after the snapshot was taken. */
  theme_name: string | null;
}

export interface AdminSnapshotListResponse {
  snapshots: AdminSnapshotItem[];
}

export interface AdminSnapshotPayload {
  id: string;
  store_id: string;
  reason: string;
  created_at: string;
  restored_at: string | null;
  customization: Record<string, unknown>;
  customization_v3: Record<string, unknown>;
}

export function listStoreSnapshots(
  storeId: string,
  limit = 20,
): Promise<AdminSnapshotListResponse> {
  return apiClient<AdminSnapshotListResponse>(
    `/admin/stores/${storeId}/themes/snapshots?limit=${limit}`,
  );
}

export function getStoreSnapshot(
  storeId: string,
  snapshotId: string,
): Promise<AdminSnapshotPayload> {
  return apiClient<AdminSnapshotPayload>(
    `/admin/stores/${storeId}/themes/snapshots/${snapshotId}`,
  );
}
