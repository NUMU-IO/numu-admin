import DashboardLayout from "@/components/DashboardLayout";
import { GrantDialog } from "@/components/entitlements/EntitlementControls";
import { Badge, Banner, Button, Card, DataTable, EmptyState, FilterBar, type DataTableColumn } from "@/ds";
import { formatNumber } from "@/lib/format";
import {
  FEATURES_QUERY_KEY,
  categoryLabel,
  formatValue,
  listFeatures,
  planLabel,
  type EntitlementValue,
  type Feature,
} from "@/services/entitlementsAdminApi";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Link } from "wouter";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "limits", label: "Limits" },
  { id: "switches", label: "Switches" },
  { id: "killed", label: "Killed" },
  { id: "overrides", label: "With overrides" },
];

const IN_VIEW: Record<string, (f: Feature) => boolean> = {
  all: () => true,
  limits: (f) => f.kind === "limit",
  switches: (f) => f.kind === "boolean",
  killed: (f) => !f.is_enabled,
  overrides: (f) => f.live_overrides > 0,
};

function spoken(f: Feature, value: EntitlementValue | undefined): string {
  if (value === undefined) return "no grant";
  if (f.kind === "boolean") return value ? "included" : "not included";
  return String(value);
}

export default function Features() {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ feature: Feature; plan: string } | null>(null);
  const catalog = useQuery({ queryKey: FEATURES_QUERY_KEY, queryFn: listFeatures });

  const plans = catalog.data?.plans ?? [];
  const counts = catalog.data?.tenant_counts ?? {};
  const features = catalog.data?.features ?? [];
  const killed = features.filter((f) => !f.is_enabled);
  const needle = search.trim().toLowerCase();
  const rows = features.filter(
    (f) => IN_VIEW[view](f) && (!needle || f.key.includes(needle) || f.name.toLowerCase().includes(needle)),
  );

  const columns: DataTableColumn<Feature>[] = [
    {
      key: "category",
      header: "Category",
      render: (f, i) =>
        i === 0 || rows[i - 1].category !== f.category ? (
          <span className="numu-label">{categoryLabel(f.category)}</span>
        ) : null,
    },
    {
      key: "feature",
      header: "Feature",
      render: (f) => (
        <div>
          <div className="ntb__primary ak-cell-line">
            <Link href={`/features/${f.key}`}>{f.name}</Link>
            {f.is_enabled ? null : (
              <Badge tone="danger" icon="slash" square>
                Killed
              </Badge>
            )}
            {f.live_overrides ? (
              <Badge tone="info" square>
                {f.live_overrides} {f.live_overrides === 1 ? "override" : "overrides"}
              </Badge>
            ) : null}
          </div>
          <div className="ntb__sub numu-id">{f.key}</div>
        </div>
      ),
    },
    ...plans.map<DataTableColumn<Feature>>((plan) => ({
      key: plan,
      header: plan.startsWith("addon:") ? planLabel(plan) : `${plan} · ${formatNumber(counts[plan] ?? 0)}`,
      align: "end",
      mono: true,
      render: (f) => (
        <button
          type="button"
          className="w-full cursor-pointer rounded px-2 text-end hover:bg-muted"
          style={{ minHeight: 28 }}
          aria-label={`${f.name} on ${planLabel(plan)}: ${spoken(f, f.grants[plan])}`}
          onClick={() => setEditing({ feature: f, plan })}
        >
          {formatValue(f.kind, f.grants[plan])}
        </button>
      ),
    })),
  ];

  return (
    <DashboardLayout
      title="Features & plans"
      subtitle="What each plan and add-on includes. Click a cell to change it; changes are live as soon as they are saved."
    >
      {killed.length ? (
        <Banner
          tone="danger"
          title={`${killed.length} ${killed.length === 1 ? "feature is" : "features are"} off for every merchant`}
          actions={
            <Button size="sm" variant="subtle" onClick={() => setView("killed")}>
              Show
            </Button>
          }
        >
          {killed.map((f, i) => (
            <Fragment key={f.key}>
              {i ? ", " : null}
              <Link href={`/features/${f.key}`}>{f.name}</Link>
            </Fragment>
          ))}
          . Merchants cannot use {killed.length === 1 ? "it" : "them"}, whatever their plan says.
        </Banner>
      ) : null}

      <Card flush>
        <FilterBar
          savedViews={VIEWS}
          activeView={view}
          onViewChange={setView}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Feature name or key"
          actions={<span className="numu-label">{rows.length} features</span>}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(f) => f.key}
          dense
          loading={catalog.isLoading}
          caption="Features and what each plan grants"
          isFlagged={(f) => !f.is_enabled}
          empty={
            catalog.isError ? (
              <EmptyState
                kind="error"
                title="Features failed to load"
                body={catalog.error.message}
                action={
                  <Button size="sm" onClick={() => void catalog.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <EmptyState kind="noResults" title="Nothing matches" body="Widen the search or switch to another view." />
            )
          }
        />
      </Card>

      {editing ? (
        <GrantDialog
          feature={editing.feature}
          plan={editing.plan}
          tenants={counts[editing.plan]}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </DashboardLayout>
  );
}
