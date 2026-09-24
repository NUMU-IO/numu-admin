import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import {
  EntitlementHistory,
  GrantDialog,
  OverrideDrawer,
  OverrideStatusBadge,
  ReasonConfirmDialog,
  ReasonField,
  RevokeOverrideDialog,
  toastError,
  useInvalidateEntitlements,
  validReason,
} from "@/components/entitlements/EntitlementControls";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  FormField,
  IconButton,
  Input,
  KeyValue,
  Select,
  Tabs,
  Textarea,
  type DataTableColumn,
  type KeyValueItem,
} from "@/ds";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  ENTITLEMENTS_QUERY_KEY,
  FEATURES_QUERY_KEY,
  FLAGS_QUERY_KEY,
  belowPlan,
  categoryLabel,
  flagState,
  formatValue,
  listFeatureOverrides,
  listFeatures,
  listFlags,
  planLabel,
  setKillSwitch,
  updateFeature,
  type Feature,
  type FeaturePatch,
  type Flag,
  type Override,
} from "@/services/entitlementsAdminApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const METER: Record<string, string> = {
  count: "Counted from the merchant's real rows",
  counter: "Usage counter",
};

const PERIOD: Record<string, string> = { day: "Per day", month: "Per month" };

export default function FeatureDetail() {
  const [, params] = useRoute("/features/:key");
  const [, navigate] = useLocation();
  const key = params?.key ?? "";
  const [tab, setTab] = useState("overview");
  const catalog = useQuery({ queryKey: FEATURES_QUERY_KEY, queryFn: listFeatures });

  if (catalog.isLoading) return <DashboardLayoutSkeleton />;

  const feature = catalog.data?.features.find((f) => f.key === key);
  const breadcrumbs = [
    { label: "Admin", href: "/" },
    { label: "Features & plans", href: "/features" },
    { label: feature?.name ?? key },
  ];

  if (!catalog.data || !feature) {
    return (
      <DashboardLayout title="Feature" breadcrumbs={breadcrumbs}>
        <Card>
          <EmptyState
            kind="error"
            title="Feature not found"
            body={catalog.error?.message ?? `No feature is called ${key}.`}
            action={
              <Button size="sm" onClick={() => void catalog.refetch()}>
                Try again
              </Button>
            }
            secondaryAction={
              <Button size="sm" variant="subtle" onClick={() => navigate("/features")}>
                Back to features
              </Button>
            }
          />
        </Card>
      </DashboardLayout>
    );
  }

  const { plans, tenant_counts: counts } = catalog.data;

  return (
    <DashboardLayout
      title={feature.name}
      breadcrumbs={breadcrumbs}
      badges={
        <>
          <Badge tone="neutral" square>
            {feature.kind === "limit" ? "Limit" : "Switch"}
          </Badge>
          {feature.is_enabled ? null : (
            <Badge tone="danger" icon="slash" square>
              Killed
            </Badge>
          )}
        </>
      }
      meta={
        <>
          <span className="numu-id">{feature.key}</span>
          <span>{categoryLabel(feature.category)}</span>
        </>
      }
      tabs={
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "plans", label: "Plans & add-ons" },
            { id: "overrides", label: "Overrides", count: feature.live_overrides },
            { id: "releases", label: "Releases", count: feature.releases.length },
            { id: "history", label: "History" },
          ]}
          active={tab}
          onChange={setTab}
        />
      }
    >
      {feature.is_enabled ? null : (
        <Banner tone="danger" title="Off for every merchant">
          {feature.disabled_reason ?? "No reason recorded."}
        </Banner>
      )}
      {tab === "overview" && <Overview feature={feature} />}
      {tab === "plans" && <Plans feature={feature} plans={plans} counts={counts} />}
      {tab === "overrides" && <Overrides feature={feature} />}
      {tab === "releases" && <Releases feature={feature} />}
      {tab === "history" && (
        <Card>
          <EntitlementHistory feature={feature.key} />
        </Card>
      )}
    </DashboardLayout>
  );
}

function Overview({ feature }: { feature: Feature }) {
  const invalidate = useInvalidateEntitlements();
  const [editing, setEditing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const enabled = feature.is_enabled;
  const limit = feature.kind === "limit";

  const toggle = useMutation({
    mutationFn: (reason: string) => setKillSwitch(feature.key, !enabled, reason),
    onSuccess: (f) => {
      toast.success(f.is_enabled ? `${f.name} is back on` : `${f.name} is off for every merchant`, {
        description: "Recorded in the audit log",
      });
      invalidate();
      setSwitching(false);
    },
    onError: toastError,
  });

  const items: KeyValueItem[] = [
    { label: "Name", value: feature.name },
    { label: "Arabic name", value: <span dir="rtl">{feature.name_ar}</span> },
    { label: "Key", value: feature.key, mono: true },
    { label: "Description", value: feature.description || "—" },
    { label: "Category", value: categoryLabel(feature.category) },
    { label: "Kind", value: limit ? "Limit" : "Switch" },
    { label: "Default", value: formatValue(feature.kind, feature.default_value), mono: true },
    ...(limit
      ? [
          { label: "Metered by", value: METER[feature.usage ?? ""] ?? "—" },
          { label: "Period", value: PERIOD[feature.period ?? ""] ?? "Lifetime" },
          {
            label: "Enforcement",
            value:
              feature.enforcement === "hard"
                ? "Hard: refuses past the limit"
                : "Soft: allows it, records it and notifies",
          },
          { label: "Unit", value: feature.unit ?? "—" },
        ]
      : []),
    { label: "Status", value: enabled ? "Enabled" : "Off for every merchant" },
    { label: "Live overrides", value: formatNumber(feature.live_overrides) },
    { label: "Releases", value: feature.releases.join(", ") || "—", mono: true },
  ];

  return (
    <>
      <Card
        title="Details"
        actions={
          <Button size="sm" variant="subtle" icon="settings" onClick={() => setEditing(true)}>
            Edit
          </Button>
        }
      >
        <KeyValue items={items} />
      </Card>

      <Card
        title="Kill switch"
        subtitle="Every merchant at once"
        footer={
          <Button
            variant={enabled ? "danger-outline" : "primary"}
            icon={enabled ? "slash" : "playCircle"}
            onClick={() => setSwitching(true)}
          >
            {enabled ? "Disable globally" : "Re-enable"}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "For incidents: switches the feature off for every merchant, whatever their plan, add-ons or overrides grant."
            : "Off for every merchant. Re-enabling restores what each plan, add-on and override grants."}
        </p>
      </Card>

      {editing ? <EditFeatureDialog feature={feature} onClose={() => setEditing(false)} /> : null}

      {switching ? (
        <ReasonConfirmDialog
          tone={enabled ? "danger" : "warning"}
          title={enabled ? `Disable ${feature.name} for every merchant?` : `Re-enable ${feature.name}?`}
          entity={[
            { label: "Feature", value: feature.name },
            { label: "Key", value: feature.key, mono: true },
          ]}
          consequences={
            enabled
              ? [
                  "Every merchant loses it at once, whatever they pay for.",
                  "Plan grants and overrides are kept, so re-enabling restores them.",
                ]
              : ["Merchants get it back according to their plan, add-ons and overrides."]
          }
          confirmPhrase={feature.key}
          confirmLabel={enabled ? "Disable globally" : "Re-enable"}
          busy={toggle.isPending}
          onConfirm={(reason) => toggle.mutate(reason)}
          onClose={() => setSwitching(false)}
        />
      ) : null}
    </>
  );
}

function EditFeatureDialog({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  const invalidate = useInvalidateEntitlements();
  const [name, setName] = useState(feature.name);
  const [nameAr, setNameAr] = useState(feature.name_ar);
  const [description, setDescription] = useState(feature.description ?? "");
  const [enforcement, setEnforcement] = useState(feature.enforcement);
  const [reason, setReason] = useState("");

  const patch: FeaturePatch = { reason: reason.trim() };
  if (name.trim() !== feature.name) patch.name = name.trim();
  if (nameAr.trim() !== feature.name_ar) patch.name_ar = nameAr.trim();
  if (description.trim() !== (feature.description ?? "")) patch.description = description.trim();
  if (enforcement !== feature.enforcement) patch.enforcement = enforcement;
  const changed = Object.keys(patch).length > 1;

  const save = useMutation({
    mutationFn: () => updateFeature(feature.key, patch),
    onSuccess: () => {
      toast.success(`${feature.key} updated`, { description: "Recorded in the audit log" });
      invalidate();
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog
      open
      title={`Edit ${feature.name}`}
      description="Kind, meter and period are set in code and change only with a migration."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!changed || !name.trim() || !nameAr.trim() || !validReason(reason)}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <FormField label="Name" required htmlFor="feature-name">
        <Input id="feature-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Arabic name" required htmlFor="feature-name-ar">
        <Input
          id="feature-name-ar"
          arabic
          maxLength={120}
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
        />
      </FormField>
      <FormField label="Description" htmlFor="feature-description">
        <Textarea
          id="feature-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>
      {feature.kind === "limit" ? (
        <FormField
          label="Enforcement"
          htmlFor="feature-enforcement"
          hint="Hard refuses past the limit; soft allows it, records it and notifies."
        >
          <Select
            id="feature-enforcement"
            value={enforcement}
            onChange={(e) => setEnforcement(e.target.value as Feature["enforcement"])}
            options={[
              { value: "hard", label: "Hard" },
              { value: "soft", label: "Soft" },
            ]}
          />
        </FormField>
      ) : null}
      <ReasonField id="feature-reason" value={reason} onChange={setReason} />
    </Dialog>
  );
}

function Plans({
  feature,
  plans,
  counts,
}: {
  feature: Feature;
  plans: string[];
  counts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const columns: DataTableColumn<string>[] = [
    { key: "plan", header: "Plan or add-on", render: (p) => <span className="ntb__primary">{planLabel(p)}</span> },
    {
      key: "tenants",
      header: "Tenants",
      align: "end",
      mono: true,
      render: (p) => (p.startsWith("addon:") ? "—" : formatNumber(counts[p] ?? 0)),
    },
    {
      key: "grant",
      header: "Grant",
      align: "end",
      mono: true,
      render: (p) =>
        p in feature.grants
          ? formatValue(feature.kind, feature.grants[p])
          : p.startsWith("addon:")
            ? "none"
            : `none (default ${formatValue(feature.kind, feature.default_value)})`,
    },
  ];
  return (
    <>
      <Card flush title="Plans & add-ons" subtitle="Click a row to change what it grants">
        <DataTable
          columns={columns}
          rows={plans}
          rowKey={(p) => p}
          dense
          caption={`What each plan and add-on grants for ${feature.name}`}
          onRowClick={setEditing}
        />
      </Card>
      {editing ? (
        <GrantDialog feature={feature} plan={editing} tenants={counts[editing]} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function Overrides({ feature }: { feature: Feature }) {
  const [status, setStatus] = useState<"live" | "all">("live");
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<Override | null>(null);
  const overrides = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "overrides", feature.key, status],
    queryFn: () => listFeatureOverrides(feature.key, status),
  });
  const below = (o: Override) =>
    (o.status === "live" || o.status === "scheduled") &&
    belowPlan(feature.kind, o.value, o.tenant ? feature.grants[o.tenant.plan] : undefined);

  const columns: DataTableColumn<Override>[] = [
    { key: "status", header: "Status", render: (o) => <OverrideStatusBadge status={o.status} /> },
    {
      key: "tenant",
      header: "Merchant",
      render: (o) => (
        <div>
          <div className="ntb__primary">{o.tenant?.name ?? o.tenant_id}</div>
          <div className="ntb__sub">
            <span className="numu-domain">{o.tenant?.subdomain}</span> · {o.tenant?.plan}
          </div>
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "end",
      mono: true,
      render: (o) => (
        <span title={below(o) ? "Less than their plan grants" : undefined}>
          {formatValue(feature.kind, o.value)}
          {below(o) ? " ↓" : ""}
        </span>
      ),
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
      header: "Created by",
      render: (o) => (
        <div>
          <div className="numu-email">{o.created_by ?? "system"}</div>
          <div className="ntb__sub">{formatDateTime(o.created_at)}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 48,
      render: (o) =>
        o.status === "live" || o.status === "scheduled" ? (
          <IconButton icon="x" label="Revoke this override" size="sm" onClick={() => setRevoking(o)} />
        ) : null,
    },
  ];

  return (
    <>
      <Card flush>
        <FilterBar
          savedViews={[
            { id: "live", label: "Live and scheduled" },
            { id: "all", label: "All, with history" },
          ]}
          activeView={status}
          onViewChange={(id) => setStatus(id as "live" | "all")}
          actions={
            <Button size="sm" icon="plus" onClick={() => setAdding(true)}>
              Add override
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={overrides.data ?? []}
          rowKey={(o) => o.id}
          dense
          loading={overrides.isLoading}
          caption={`Merchant overrides for ${feature.name}`}
          isFlagged={below}
          empty={
            overrides.isError ? (
              <EmptyState kind="error" title="Overrides failed to load" body={overrides.error.message} />
            ) : (
              <EmptyState
                icon="users"
                title="No overrides"
                body="Every merchant gets what their plan and add-ons grant."
              />
            )
          }
        />
      </Card>

      {adding ? <OverrideDrawer featureKey={feature.key} onClose={() => setAdding(false)} /> : null}

      {revoking ? (
        <RevokeOverrideDialog
          overrideId={revoking.id}
          entity={[
            { label: "Merchant", value: revoking.tenant?.name ?? revoking.tenant_id },
            { label: "Feature", value: feature.name },
            { label: "Value", value: formatValue(feature.kind, revoking.value), mono: true },
          ]}
          onClose={() => setRevoking(null)}
        />
      ) : null}
    </>
  );
}

function Releases({ feature }: { feature: Feature }) {
  const [, navigate] = useLocation();
  const flags = useQuery({ queryKey: FLAGS_QUERY_KEY, queryFn: listFlags });
  const rows = (flags.data ?? []).filter((f) => feature.releases.includes(f.key));
  const columns: DataTableColumn<Flag>[] = [
    { key: "key", header: "Flag", mono: true },
    { key: "description", header: "Description" },
    {
      key: "state",
      header: "State",
      render: (f) => (
        <Badge tone={f.enabled ? "success" : "neutral"} square>
          {flagState(f)}
        </Badge>
      ),
    },
    { key: "targets", header: "Targets", align: "end", mono: true },
  ];
  return (
    <Card
      flush
      title="Release flags"
      subtitle="Flags filed under this feature"
      actions={
        <Button size="sm" variant="subtle" iconEnd="arrowRight" onClick={() => navigate("/flags")}>
          All flags
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(f) => f.key}
        dense
        loading={flags.isLoading}
        caption={`Release flags for ${feature.name}`}
        onRowClick={(f) => navigate(`/flags?flag=${encodeURIComponent(f.key)}`)}
        empty={
          <EmptyState icon="flag" title="No release flags" body="A flag is listed here when it is filed under this feature." />
        }
      />
    </Card>
  );
}
