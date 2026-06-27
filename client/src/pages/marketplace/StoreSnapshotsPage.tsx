/**
 * StoreSnapshotsPage — Session C (2026-05-28).
 *
 * Per-store snapshot browser at `/marketplace/snapshots/:storeId`.
 * Used by support to inspect "what state was this store in before a
 * theme switch." Backed by GET /api/v1/admin/stores/{store_id}/themes/snapshots
 * (Session C backend addition).
 *
 * **Restore button is intentionally disabled** in this session. The
 * restore endpoint is production-affecting and isn't shipped yet —
 * shipping it without explicit user authorization would put sawsaw +
 * rabbit at risk if an admin clicked by accident. Tooltip explains the
 * gap; the button surfaces an alert when clicked.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, History, Eye, RotateCcw, RefreshCw } from "lucide-react";
import {
  getStoreSnapshot,
  listStoreSnapshots,
  type AdminSnapshotItem,
} from "@/services/snapshotsAdminApi";

export const snapshotsQueryKey = (storeId: string) =>
  ["admin-snapshots", storeId] as const;

export default function StoreSnapshotsPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;

  const query = useQuery({
    enabled: Boolean(storeId),
    queryKey: snapshotsQueryKey(storeId ?? ""),
    queryFn: () => listStoreSnapshots(storeId as string, 50),
    staleTime: 30_000,
  });

  if (!storeId) {
    return (
      <DashboardLayout title="Snapshots">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot browser</CardTitle>
              <CardDescription>
                Pick a store from the merchants list, or paste a store UUID into
                the URL: <code>/marketplace/snapshots/&lt;store-uuid&gt;</code>.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (query.isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (query.isError) {
    const msg =
      query.error instanceof Error ? query.error.message : "Unknown error";
    return (
      <DashboardLayout title="Snapshots">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Couldn't load snapshots</CardTitle>
              <CardDescription>{msg}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => query.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const snapshots = query.data?.snapshots ?? [];

  return (
    <DashboardLayout title="Snapshots">
      <div className="p-6 max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/merchants">
              <Button variant="ghost" size="sm" className="-ml-2 mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Merchants
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold">Theme snapshots</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only audit trail. A snapshot is captured every time the
              store's theme is swapped, so support can see exactly what state
              the merchant was in before the change.
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              store_id: {storeId}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={
                "h-4 w-4 mr-2" + (query.isFetching ? " animate-spin" : "")
              }
            />
            Refresh
          </Button>
        </div>

        {snapshots.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No snapshots for this store.</p>
              <p className="text-xs mt-1">
                The first theme swap will create one automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {snapshots.map((s) => (
              <SnapshotRow key={s.id} snapshot={s} storeId={storeId} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface SnapshotRowProps {
  snapshot: AdminSnapshotItem;
  storeId: string;
}

function SnapshotRow({ snapshot, storeId }: SnapshotRowProps) {
  const [jsonOpen, setJsonOpen] = useState(false);

  const created = new Date(snapshot.created_at);
  const friendlyDate = isNaN(created.getTime())
    ? snapshot.created_at
    : created.toLocaleString();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline">{snapshot.reason}</Badge>
              {snapshot.restored_at ? (
                <Badge variant="secondary">
                  Restored {new Date(snapshot.restored_at).toLocaleDateString()}
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-sm font-medium">{friendlyDate}</CardTitle>
            <CardDescription className="text-xs mt-1">
              From theme:{" "}
              <span className="font-mono">
                {snapshot.theme_name ?? "(unknown)"}
              </span>
              {" · "}
              <span>{snapshot.section_count}</span>{" "}
              <span>section{snapshot.section_count === 1 ? "" : "s"}</span>
              {" · "}
              <span>{snapshot.section_group_count}</span>{" "}
              <span>group{snapshot.section_group_count === 1 ? "" : "s"}</span>
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setJsonOpen(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View JSON
            </Button>
            <RestoreButton storeId={storeId} snapshotId={snapshot.id} />
          </div>
        </div>
      </CardHeader>

      <ViewJsonDialog
        open={jsonOpen}
        onOpenChange={setJsonOpen}
        storeId={storeId}
        snapshotId={snapshot.id}
      />
    </Card>
  );
}

/**
 * Restore button — Session C ships this as **disabled with tooltip**.
 *
 * The backend restore endpoint isn't built. Building it without explicit
 * user authorization would risk an admin accidentally clicking Restore
 * on sawsaw or rabbit, which would mutate `store_themes` for a
 * production store — the exact case M10 exists to prevent.
 *
 * When the restore endpoint ships (separate user-authorized session),
 * replace the disabled state with the double-confirm modal from
 * file 05 §6.1.
 */
function RestoreButton({
  storeId,
  snapshotId,
}: {
  storeId: string;
  snapshotId: string;
}) {
  // Mark args as intentionally unused — they're here to match the
  // shape this component will have when the endpoint lands, so the
  // caller doesn't need to be updated then.
  void storeId;
  void snapshotId;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled
      title="Restore endpoint not yet shipped — pending separate authorization. Click View JSON to inspect the snapshot's payload."
    >
      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
      Restore
    </Button>
  );
}

function ViewJsonDialog({
  open,
  onOpenChange,
  storeId,
  snapshotId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  snapshotId: string;
}) {
  const query = useQuery({
    enabled: open,
    queryKey: ["admin-snapshot-payload", storeId, snapshotId] as const,
    queryFn: () => getStoreSnapshot(storeId, snapshotId),
    staleTime: Infinity, // snapshot payload never mutates
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            Snapshot {snapshotId.slice(0, 8)}…
          </DialogTitle>
          <DialogDescription>
            Read-only JSON dump. Helpful for forensic look at the
            customization payload that was in place before the snapshot
            was taken.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : query.isError ? (
            <p className="text-sm text-destructive">
              {query.error instanceof Error
                ? query.error.message
                : "Couldn't load"}
            </p>
          ) : query.data ? (
            <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto">
              {JSON.stringify(
                {
                  reason: query.data.reason,
                  created_at: query.data.created_at,
                  restored_at: query.data.restored_at,
                  customization_v3: query.data.customization_v3,
                  customization: query.data.customization,
                },
                null,
                2,
              )}
            </pre>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
