/**
 * API tokens — every merchant token, and what each one has been doing.
 *
 * Read-only. Merchants mint and revoke their own tokens in the hub; the lever
 * we hold is the per-merchant API access switch on the merchant page. This
 * page is for watching: who holds a token, from where, and whether it has
 * tried anything it is not allowed to (refused requests are flagged).
 *
 * Requests made through the NUMU MCP server arrive from the MCP box, so their
 * IP is that server's, not the end client's.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import {
  listApiTokenRequests,
  listApiTokens,
  type ApiTokenItem,
  type ApiTokenRequest,
} from "@/services/apiTokensApi";

const REFUSED = new Set([401, 402, 403]);

function statusTone(status: number) {
  if (status < 300) return "success" as const;
  if (REFUSED.has(status) || status >= 500) return "danger" as const;
  return "warning" as const;
}

const tokenColumns: DataTableColumn<ApiTokenItem>[] = [
  {
    key: "name",
    header: "Token",
    render: (t) => (
      <div>
        <div className="ntb__primary">
          {t.name}{" "}
          {t.revoked_at ? (
            <Badge tone="neutral" icon="slash" square>
              Revoked
            </Badge>
          ) : null}
        </div>
        <div className="ntb__sub" dir="ltr">
          {t.token_prefix}… · {(t.scopes ?? ["legacy: all"]).join(", ")}
        </div>
      </div>
    ),
  },
  {
    key: "store",
    header: "Store",
    render: (t) => (
      <div>
        <div className="ntb__primary">{t.store_name ?? "—"}</div>
        <div className="ntb__sub">{t.minted_by ?? t.tenant ?? "—"}</div>
      </div>
    ),
  },
  {
    key: "created_at",
    header: "Created",
    mono: true,
    render: (t) => formatDateTime(t.created_at),
  },
  {
    key: "last_used_at",
    header: "Last used",
    mono: true,
    render: (t) => formatRelative(t.last_used_at),
  },
  {
    key: "requests",
    header: "Requests",
    align: "end",
    mono: true,
    render: (t) => formatNumber(t.trail.requests),
  },
  {
    key: "refused",
    header: "Refused",
    align: "end",
    mono: true,
    render: (t) =>
      t.trail.refused ? (
        <Badge tone="danger" icon="alertTriangle" square>
          {formatNumber(t.trail.refused)}
        </Badge>
      ) : (
        "0"
      ),
  },
  {
    key: "ips",
    header: "IPs",
    align: "end",
    mono: true,
    render: (t) => formatNumber(t.trail.distinct_ips),
  },
  {
    key: "last",
    header: "Last request",
    mono: true,
    render: (t) =>
      t.trail.last ? (
        <span dir="ltr">
          {t.trail.last.method} {t.trail.last.path.slice(0, 48)}
        </span>
      ) : (
        "—"
      ),
  },
];

const requestColumns: DataTableColumn<ApiTokenRequest>[] = [
  { key: "at", header: "Time", mono: true, render: (r) => formatDateTime(r.at) },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <Badge tone={statusTone(r.status)} square>
        {r.status}
      </Badge>
    ),
  },
  {
    key: "path",
    header: "Request",
    mono: true,
    render: (r) => (
      <span dir="ltr" style={{ wordBreak: "break-all" }}>
        {r.method} {r.path}
      </span>
    ),
  },
  {
    key: "ip",
    header: "From",
    render: (r) => (
      <div>
        <div className="ntb__primary" dir="ltr">
          {r.ip}
        </div>
        <div className="ntb__sub" dir="ltr">
          {r.user_agent || "—"}
        </div>
      </div>
    ),
  },
];

function TokenTrail({ token, onClose }: { token: ApiTokenItem; onClose: () => void }) {
  const trail = useQuery({
    queryKey: ["api-token-requests", token.id],
    queryFn: () => listApiTokenRequests(token.id),
    refetchInterval: 15_000,
  });

  return (
    <Drawer
      open
      width={880}
      title={`${token.name} · ${token.store_name ?? token.tenant ?? ""}`}
      subtitle={token.token_prefix}
      onClose={onClose}
      footer={
        <Button
          variant="subtle"
          icon="refresh"
          loading={trail.isFetching}
          onClick={() => void trail.refetch()}
        >
          Refresh
        </Button>
      }
    >
      <DataTable
        columns={requestColumns}
        rows={trail.data ?? []}
        rowKey={(r, i) => `${r.at}:${i}`}
        dense
        loading={trail.isLoading}
        caption="Requests made with this token, newest first"
        isFlagged={(r) => REFUSED.has(r.status)}
        empty={
          <EmptyState
            kind={trail.isError ? "error" : "empty"}
            icon="activity"
            title={trail.isError ? "Trail failed to load" : "No requests recorded yet"}
            body={
              trail.isError
                ? trail.error instanceof Error
                  ? trail.error.message
                  : "The request did not complete."
                : "Requests appear here the next time this token is used."
            }
          />
        }
      />
    </Drawer>
  );
}

export default function ApiTokens() {
  const [open, setOpen] = useState<ApiTokenItem | null>(null);
  const tokens = useQuery({
    queryKey: ["api-tokens"],
    queryFn: listApiTokens,
    refetchInterval: 30_000,
  });

  return (
    <DashboardLayout
      title="API tokens"
      subtitle="Every merchant API token and what it has been doing. Refused requests are flagged."
      actions={
        <Button
          variant="subtle"
          icon="refresh"
          loading={tokens.isFetching}
          onClick={() => void tokens.refetch()}
        >
          Refresh
        </Button>
      }
    >
      <Card flush>
        <DataTable
          columns={tokenColumns}
          rows={tokens.data ?? []}
          rowKey={(t) => t.id}
          dense
          loading={tokens.isLoading}
          caption="Merchant API tokens"
          isFlagged={(t) => t.trail.refused > 0}
          onRowClick={setOpen}
          empty={
            <EmptyState
              kind={tokens.isError ? "error" : "empty"}
              icon="plug"
              title={tokens.isError ? "Tokens failed to load" : "No API tokens yet"}
              body={
                tokens.isError
                  ? tokens.error instanceof Error
                    ? tokens.error.message
                    : "The request did not complete."
                  : "Tokens appear here once a merchant mints one in their hub."
              }
            />
          }
        />
      </Card>

      {open ? <TokenTrail token={open} onClose={() => setOpen(null)} /> : null}
    </DashboardLayout>
  );
}
