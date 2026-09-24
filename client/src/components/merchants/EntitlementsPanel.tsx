import {
  OverrideDrawer,
  OverrideStatusBadge,
  RevokeOverrideDialog,
} from "@/components/entitlements/EntitlementControls";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  KeyValue,
  Skeleton,
  Tabs,
  type DataTableColumn,
} from "@/ds";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  ENTITLEMENTS_QUERY_KEY,
  FLAG_WHY,
  explainFeature,
  formatValue,
  getTenantEntitlements,
  planLabel,
  type Explain,
  type ExplainLayer,
  type GrantLayer,
  type Override,
  type TenantFeature,
  type TenantFlag,
  type UsageRow,
} from "@/services/entitlementsAdminApi";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

type OverrideLayer = Extract<ExplainLayer, { layer: "override" }>;
type Revoking = { id: string; feature: TenantFeature; value: Override["value"] };

const SOURCE_LABEL: Record<TenantFeature["source"], string> = {
  plan: "Plan",
  addon: "Add-on",
  override: "Override",
  default: "Default",
};

const UNAVAILABLE: Record<string, string> = {
  disabled_globally: "off for every merchant",
  blocked: "blocked by an override",
  not_in_plan: "not in their plan",
};

export function EntitlementsPanel({ tenantId }: { tenantId: string | null | undefined }) {
  const [tab, setTab] = useState("features");
  const [why, setWhy] = useState<TenantFeature | null>(null);
  const [adding, setAdding] = useState<TenantFeature | null>(null);
  const [revoking, setRevoking] = useState<Revoking | null>(null);
  const q = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "tenant", tenantId ?? ""],
    queryFn: () => getTenantEntitlements(tenantId ?? ""),
    enabled: Boolean(tenantId),
  });

  if (!tenantId) return null;
  const d = q.data;
  const features = d?.features ?? [];
  const byKey = new Map(features.map((f) => [f.key, f]));

  const sourceBadge = (f: TenantFeature) => {
    if (f.reason === "disabled_globally") {
      return (
        <Badge tone="danger" icon="slash" square>
          Killed
        </Badge>
      );
    }
    if (f.source === "override") {
      const source = d?.overrides.find((o) => o.id === f.source_id)?.source ?? "admin";
      return (
        <Badge tone="warning" square>
          Override ({source}){f.expires_at ? ` until ${formatDate(f.expires_at)}` : ""}
        </Badge>
      );
    }
    return (
      <Badge tone={f.source === "default" ? "neutral" : "info"} square>
        {SOURCE_LABEL[f.source]}
      </Badge>
    );
  };

  const featureColumns: DataTableColumn<TenantFeature>[] = [
    {
      key: "name",
      header: "Feature",
      render: (f) => (
        <div>
          <div className="ntb__primary">{f.name}</div>
          <div className="ntb__sub numu-id">{f.key}</div>
        </div>
      ),
    },
    { key: "value", header: "Value", align: "end", mono: true, render: (f) => formatValue(f.kind, f.value) },
    { key: "source", header: "Source", render: sourceBadge },
    {
      key: "in_plan",
      header: "",
      render: (f) =>
        f.in_plan ? (
          <Badge tone="success" icon="check" square>
            In plan
          </Badge>
        ) : null,
    },
  ];

  const usageColumns: DataTableColumn<UsageRow>[] = [
    { key: "feature", header: "Meter", render: (u) => byKey.get(u.feature)?.name ?? u.feature },
    {
      key: "used",
      header: "Used / limit",
      align: "end",
      mono: true,
      render: (u) => `${formatNumber(u.used)} / ${formatValue("limit", u.limit)}`,
    },
    { key: "remaining", header: "Remaining", align: "end", mono: true, render: (u) => formatValue("limit", u.remaining) },
    {
      key: "resets_at",
      header: "Resets",
      mono: true,
      render: (u) => (u.resets_at ? formatDateTime(u.resets_at) : "Never"),
    },
  ];

  const flagColumns: DataTableColumn<TenantFlag>[] = [
    {
      key: "key",
      header: "Flag",
      render: (f) => (
        <div>
          <div className="ntb__primary numu-id">{f.key}</div>
          <div className="ntb__sub">{f.description}</div>
        </div>
      ),
    },
    {
      key: "on",
      header: "For this merchant",
      render: (f) => (
        <Badge tone={f.on ? "success" : "neutral"} square>
          {f.on ? "On" : "Off"}
        </Badge>
      ),
    },
    { key: "why", header: "Why", render: (f) => FLAG_WHY[f.why] ?? f.why },
    { key: "bucket", header: "Bucket", align: "end", mono: true },
  ];

  const overrideColumns: DataTableColumn<Override>[] = [
    { key: "status", header: "Status", render: (o) => <OverrideStatusBadge status={o.status} /> },
    { key: "feature_key", header: "Feature", render: (o) => byKey.get(o.feature_key)?.name ?? o.feature_key },
    {
      key: "value",
      header: "Value",
      align: "end",
      mono: true,
      render: (o) => formatValue(byKey.get(o.feature_key)?.kind ?? "limit", o.value),
    },
    {
      key: "source",
      header: "Source",
      render: (o) => (
        <Badge tone="neutral" square>
          {o.source}
        </Badge>
      ),
    },
    { key: "reason", header: "Reason" },
    {
      key: "expires_at",
      header: "Expires",
      mono: true,
      render: (o) => (o.expires_at ? formatDateTime(o.expires_at) : "Never"),
    },
    {
      key: "created_by",
      header: "By",
      render: (o) => (
        <div>
          <div className="numu-email">{o.created_by ?? "system"}</div>
          <div className="ntb__sub">
            {formatDateTime(o.created_at)}
            {o.revoked_at ? ` · revoked ${formatDateTime(o.revoked_at)} by ${o.revoked_by ?? "system"}` : ""}
          </div>
        </div>
      ),
    },
  ];

  const tables: Record<string, ReactNode> = {
    features: (
      <DataTable
        dense
        loading={q.isLoading}
        columns={featureColumns}
        rows={features}
        rowKey={(f) => f.key}
        caption="Features for this merchant; click one to see why"
        onRowClick={setWhy}
        isFlagged={(f) => f.reason === "disabled_globally"}
      />
    ),
    usage: (
      <DataTable
        dense
        loading={q.isLoading}
        columns={usageColumns}
        rows={d?.usage ?? []}
        rowKey={(u) => u.feature}
        caption="Metered usage"
        isFlagged={(u) => u.remaining === 0}
        empty={<EmptyState icon="activity" title="Nothing metered" body="None of this merchant's limits counts usage." />}
      />
    ),
    flags: (
      <DataTable
        dense
        loading={q.isLoading}
        columns={flagColumns}
        rows={d?.flags ?? []}
        rowKey={(f) => f.key}
        caption="Release flags for this merchant"
        empty={<EmptyState icon="flag" title="No release flags" body="No flag exists yet." />}
      />
    ),
    overrides: (
      <DataTable
        dense
        loading={q.isLoading}
        columns={overrideColumns}
        rows={d?.overrides ?? []}
        rowKey={(o) => o.id}
        caption="Override history"
        empty={
          <EmptyState icon="history" title="No overrides" body="This merchant gets what their plan and add-ons grant." />
        }
      />
    ),
  };

  return (
    <>
      <Card
        flush
        title="Entitlements"
        subtitle="What this merchant may use, and why. Click a feature."
        actions={
          d ? (
            <Badge tone="neutral" square>
              {d.tenant.plan}
            </Badge>
          ) : null
        }
      >
        <Tabs
          tabs={[
            { id: "features", label: "Features", count: d?.features.length },
            { id: "usage", label: "Usage", count: d?.usage.length },
            { id: "flags", label: "Flags", count: d?.flags.length },
            { id: "overrides", label: "Overrides", count: d?.overrides.length },
          ]}
          active={tab}
          onChange={setTab}
        />
        {q.isError ? (
          <EmptyState
            kind="error"
            title="Entitlements failed to load"
            body={q.error.message}
            action={
              <Button size="sm" onClick={() => void q.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          tables[tab]
        )}
      </Card>

      {why ? (
        <WhyDrawer
          tenantId={tenantId}
          feature={why}
          onClose={() => setWhy(null)}
          onAdd={() => {
            setAdding(why);
            setWhy(null);
          }}
          onRevoke={(row) => setRevoking({ id: row.id, feature: why, value: row.value })}
        />
      ) : null}

      {adding && d ? <OverrideDrawer featureKey={adding.key} tenant={d.tenant} onClose={() => setAdding(null)} /> : null}

      {revoking ? (
        <RevokeOverrideDialog
          overrideId={revoking.id}
          entity={[
            { label: "Merchant", value: d?.tenant.name ?? tenantId },
            { label: "Feature", value: revoking.feature.name },
            { label: "Value", value: formatValue(revoking.feature.kind, revoking.value), mono: true },
          ]}
          onClose={() => setRevoking(null)}
        />
      ) : null}
    </>
  );
}

function WhyDrawer({
  tenantId,
  feature,
  onClose,
  onAdd,
  onRevoke,
}: {
  tenantId: string;
  feature: TenantFeature;
  onClose: () => void;
  onAdd: () => void;
  onRevoke: (row: NonNullable<OverrideLayer["row"]>) => void;
}) {
  const explain = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "explain", tenantId, feature.key],
    queryFn: () => explainFeature(tenantId, feature.key),
  });
  const overrideRow = explain.data?.layers.find((l): l is OverrideLayer => l.layer === "override")?.row;

  return (
    <Drawer
      title={`Why: ${feature.name}`}
      subtitle={feature.key}
      width={620}
      onClose={onClose}
      footer={
        <>
          {overrideRow ? (
            <Button variant="danger-outline" icon="x" onClick={() => onRevoke(overrideRow)}>
              Revoke override
            </Button>
          ) : null}
          <Button icon="plus" onClick={onAdd}>
            Add override
          </Button>
        </>
      }
    >
      {explain.data ? (
        <Layers explain={explain.data} />
      ) : explain.isError ? (
        <EmptyState kind="error" title="Explain failed" body={explain.error.message} />
      ) : (
        <Skeleton lines={8} />
      )}
    </Drawer>
  );
}

function Layers({ explain }: { explain: Explain }) {
  const { kind, source } = explain;
  const grants = explain.layers.filter((l): l is GrantLayer => l.layer === "plan" || l.layer === "addon");
  const live = grants.filter((g) => g.live);
  const merged = kind === "limit" ? live : live.filter((g) => g.value === true);
  const winners: ExplainLayer[] =
    source === "plan" || source === "addon"
      ? merged.length
        ? merged
        : live.slice(0, 1)
      : explain.layers.filter((l) => l.layer === source);

  const describe = (l: ExplainLayer): { title: string; value: string; detail?: string; badges?: ReactNode; struck?: boolean } => {
    switch (l.layer) {
      case "kill_switch":
        return {
          title: "Kill switch",
          value: l.enabled ? "not engaged" : "engaged",
          detail: l.reason ?? undefined,
          badges: l.enabled ? null : (
            <Badge tone="danger" icon="slash" square>
              Blocks
            </Badge>
          ),
        };
      case "override":
        return l.row
          ? {
              title: `Override (${l.row.source})`,
              value: formatValue(kind, l.row.value),
              detail: `${l.row.reason} · ${l.row.expires_at ? `until ${formatDateTime(l.row.expires_at)}` : "no end date"}`,
              badges: l.row.live ? null : (
                <Badge tone="neutral" square>
                  Not live
                </Badge>
              ),
            }
          : { title: "Override", value: "none" };
      case "default":
        return { title: "Default", value: formatValue(kind, l.value) };
      default:
        return {
          title: l.layer === "addon" ? planLabel(`addon:${l.id}`) : `Plan: ${l.id}`,
          value: formatValue(kind, l.value),
          detail: l.expires_at ? `Covered until ${formatDateTime(l.expires_at)}` : undefined,
          struck: l.shadowed,
          badges: (
            <>
              {l.live ? null : (
                <Badge tone="warning" square>
                  Lapsed
                </Badge>
              )}
              {l.shadowed ? (
                <Badge tone="neutral" square>
                  Shadowed
                </Badge>
              ) : null}
            </>
          ),
        };
    }
  };

  return (
    <div className="ak-stack">
      <KeyValue
        items={[
          { label: "Answer", value: formatValue(kind, explain.value), mono: true },
          {
            label: "Available",
            value: explain.available ? "Yes" : `No: ${UNAVAILABLE[explain.reason ?? ""] ?? explain.reason}`,
          },
          { label: "Decided by", value: SOURCE_LABEL[source] },
          {
            label: "Changes on its own",
            value: explain.expires_at ? formatDateTime(explain.expires_at) : "Never",
            mono: true,
          },
        ]}
      />
      {explain.cache_agrees ? (
        <div>
          <Badge tone="success" icon="check" square>
            Cache agrees
          </Badge>
        </div>
      ) : (
        <Banner tone="warning" title="The cache disagrees">
          The merchant&apos;s cached answer differs or is not built yet. It is rebuilt on their next request after a
          change, and within 5 minutes at most.
        </Banner>
      )}
      <p className="numu-label">Layers, in the order they are checked</p>
      {explain.layers.map((l, i) => {
        const d = describe(l);
        const wins = winners.includes(l);
        const struck = d.struck ? { textDecoration: "line-through" } : undefined;
        return (
          <div
            key={i}
            className="ak-note"
            style={wins ? { background: "var(--status-success-tint)", borderColor: "var(--status-success)" } : undefined}
          >
            <div className="ak-cell-line">
              <strong style={struck}>{d.title}</strong>
              {wins ? (
                <Badge tone="success" icon="check" square>
                  Decides
                </Badge>
              ) : null}
              {d.badges}
              <span className="numu-id" style={{ marginInlineStart: "auto", ...struck }}>
                {d.value}
              </span>
            </div>
            {d.detail ? <span className="text-muted-foreground">{d.detail}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
