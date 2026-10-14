/**
 * One merchant's API tokens, and the lever to kill them.
 *
 * Switching API access off refuses every token without deleting any; revoking
 * here ends a token for good — the merchant has to mint a new one. Both ask
 * for a reason, which lands in the audit log with the operator's name.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  listApiTokens,
  revokeAllApiTokens,
  revokeApiToken,
  type ApiTokenItem,
} from "@/services/apiTokensApi";

export const isLiveToken = (t: ApiTokenItem) =>
  !t.revoked_at && !(t.expires_at && new Date(t.expires_at) < new Date());

function TokenStatus({ token }: { token: ApiTokenItem }) {
  if (token.revoked_at) {
    return (
      <Badge tone="neutral" icon="slash" square>
        Revoked
      </Badge>
    );
  }
  if (!isLiveToken(token)) {
    return (
      <Badge tone="neutral" icon="clock" square>
        Expired
      </Badge>
    );
  }
  return (
    <Badge tone="success" icon="check" square>
      Live
    </Badge>
  );
}

/** Reason-gated revoke confirmation, shared by this panel and the API tokens page. */
export function RevokeTokensDialog({
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <Dialog
      open
      tone="danger"
      icon="alertTriangle"
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={!valid}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <FormField label="Reason" required hint="3–500 characters. Recorded in the audit log.">
        <Textarea
          value={reason}
          maxLength={500}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </FormField>
    </Dialog>
  );
}

export function ApiTokensPanel({
  tenantId,
  storeName,
}: {
  tenantId: string | null | undefined;
  storeName?: string;
}) {
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<ApiTokenItem | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const tokens = useQuery({
    queryKey: ["api-tokens", "tenant", tenantId],
    queryFn: () => listApiTokens(tenantId!),
    enabled: Boolean(tenantId),
  });

  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err));

  const revokeOne = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => revokeApiToken(id, reason),
    onSuccess: (t) => {
      toast.success(`Token "${t.name}" revoked`, {
        description: "It is refused from its next request.",
      });
      setRevoking(null);
      void queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError,
  });

  const revokeAll = useMutation({
    mutationFn: (reason: string) => revokeAllApiTokens(tenantId!, reason),
    onSuccess: ({ revoked }) => {
      toast.success(`${revoked} token${revoked === 1 ? "" : "s"} revoked`, {
        description: `${storeName ?? "The merchant"} has to mint new ones to use the API again.`,
      });
      setRevokingAll(false);
      void queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError,
  });

  const rows = tokens.data ?? [];
  const live = rows.filter(isLiveToken).length;

  const columns: DataTableColumn<ApiTokenItem>[] = [
    {
      key: "name",
      header: "Token",
      render: (t) => (
        <div>
          <div className="ntb__primary">{t.name}</div>
          <div className="ntb__sub" dir="ltr">
            {t.token_prefix}…
          </div>
        </div>
      ),
    },
    { key: "store", header: "Store", render: (t) => t.store_name ?? "—" },
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
    { key: "status", header: "Status", render: (t) => <TokenStatus token={t} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (t) =>
        isLiveToken(t) ? (
          <Button size="sm" variant="danger-outline" onClick={() => setRevoking(t)}>
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Card
        title="API tokens"
        subtitle="Tokens this merchant has minted"
        flush
        actions={
          <Button
            size="sm"
            variant="danger-outline"
            icon="slash"
            disabled={!live || !tenantId}
            onClick={() => setRevokingAll(true)}
          >
            Revoke all tokens
          </Button>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(t) => t.id}
          dense
          loading={tokens.isLoading}
          caption={`API tokens for ${storeName ?? "this merchant"}`}
          empty={
            <EmptyState
              kind={tokens.isError ? "error" : "empty"}
              icon="plug"
              title={tokens.isError ? "Tokens failed to load" : "No API tokens"}
              body={
                tokens.isError
                  ? tokens.error instanceof Error
                    ? tokens.error.message
                    : "The request did not complete."
                  : "Tokens appear here once the merchant mints one in their hub."
              }
            />
          }
        />
      </Card>

      {revoking ? (
        <RevokeTokensDialog
          title={`Revoke "${revoking.name}"?`}
          description={`${revoking.token_prefix}… stops working on its next request. This cannot be undone — the merchant has to mint a new token.`}
          confirmLabel="Revoke token"
          pending={revokeOne.isPending}
          onConfirm={(reason) => revokeOne.mutate({ id: revoking.id, reason })}
          onClose={() => setRevoking(null)}
        />
      ) : null}

      {revokingAll ? (
        <RevokeTokensDialog
          title="Revoke every live token?"
          description={`Every token ${storeName ?? "this merchant"} holds stops working on its next request, and any integration built on them goes down. This cannot be undone.`}
          confirmLabel="Revoke all tokens"
          pending={revokeAll.isPending}
          onConfirm={(reason) => revokeAll.mutate(reason)}
          onClose={() => setRevokingAll(false)}
        />
      ) : null}
    </>
  );
}
