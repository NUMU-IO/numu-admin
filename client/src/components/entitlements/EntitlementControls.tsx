import {
  AuditTimeline,
  Badge,
  Banner,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  Switch,
  Textarea,
  type AuditEntry,
  type ConfirmDialogProps,
  type DataTableColumn,
  type KeyValueItem,
} from "@/ds";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  ENTITLEMENTS_QUERY_KEY,
  FEATURES_QUERY_KEY,
  OVERRIDE_SOURCES,
  belowPlan,
  createOverride,
  formatValue,
  listAudit,
  listFeatures,
  parseValue,
  planLabel,
  revokeOverride,
  searchTenants,
  setGrant,
  type AuditRow,
  type EntitlementValue,
  type Feature,
  type FeatureKind,
  type OverrideSource,
  type OverrideStatus,
  type TenantHit,
} from "@/services/entitlementsAdminApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const DAY_MS = 86_400_000;

export const validReason = (reason: string) => reason.trim().length >= 3;

export function toastError(err: unknown) {
  toast.error(err instanceof Error ? err.message : String(err));
}

/** Every entitlement query shares one prefix, so one call refreshes every screen that is open. */
export function useInvalidateEntitlements() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
}

const OVERRIDE_TONE: Record<OverrideStatus, "success" | "info" | "neutral"> = {
  live: "success",
  scheduled: "info",
  expired: "neutral",
  revoked: "neutral",
};

export function OverrideStatusBadge({ status }: { status: OverrideStatus }) {
  return (
    <Badge tone={OVERRIDE_TONE[status]} square>
      {status}
    </Badge>
  );
}

export function ReasonField({
  id,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (reason: string) => void;
  invalid?: boolean;
}) {
  return (
    <FormField
      label="Reason"
      required
      htmlFor={id}
      hint="Recorded in the audit log."
      error={invalid ? "At least 3 characters." : undefined}
    >
      <Textarea id={id} rows={2} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  );
}

export function ReasonConfirmDialog({
  busy = false,
  onConfirm,
  children,
  ...props
}: Omit<ConfirmDialogProps, "open" | "onConfirm"> & {
  busy?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <ConfirmDialog
      {...props}
      open
      onConfirm={() => {
        if (busy) return;
        if (validReason(reason)) onConfirm(reason.trim());
        else setTried(true);
      }}
    >
      {children}
      <ReasonField
        id="confirm-reason"
        value={reason}
        onChange={setReason}
        invalid={tried && !validReason(reason)}
      />
    </ConfirmDialog>
  );
}

/** `draft` is "true"/"false" for a switch, digits or "unlimited" for a limit. */
export function ValueInput({
  id,
  kind,
  unit,
  draft,
  onChange,
}: {
  id: string;
  kind: FeatureKind;
  unit?: string | null;
  draft: string;
  onChange: (draft: string) => void;
}) {
  if (kind === "boolean") {
    return <Switch checked={draft === "true"} onChange={(on) => onChange(String(on))} label="Included" />;
  }
  const unlimited = draft === "unlimited";
  return (
    <FormField
      label={unit ? `Limit (${unit})` : "Limit"}
      required
      htmlFor={id}
      error={draft && parseValue(kind, draft) === null ? "A whole number, 0 or more." : undefined}
    >
      <div className="ak-cell-line">
        <Input
          id={id}
          type="number"
          min={0}
          step={1}
          numeric
          disabled={unlimited}
          value={unlimited ? "" : draft}
          onChange={(e) => onChange(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <Checkbox
          label="Unlimited"
          checked={unlimited}
          onChange={(e) => onChange(e.target.checked ? "unlimited" : "")}
        />
      </div>
    </FormField>
  );
}

const TENANT_COLUMNS: DataTableColumn<TenantHit>[] = [
  {
    key: "name",
    header: "Merchant",
    render: (t) => (
      <div>
        <div className="ntb__primary">{t.name}</div>
        {t.subdomain ? <div className="ntb__sub numu-domain">{t.subdomain}</div> : null}
      </div>
    ),
  },
  {
    key: "plan",
    header: "Plan",
    render: (t) => (
      <Badge tone="neutral" square>
        {t.plan}
      </Badge>
    ),
  },
];

export function TenantSearch({
  id,
  value,
  onChange,
}: {
  id: string;
  value: TenantHit | null;
  onChange: (tenant: TenantHit | null) => void;
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const hits = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "tenant-search", query],
    queryFn: () => searchTenants(query),
    enabled: !value && query.length >= 2,
  });

  if (value) {
    return (
      <div className="ak-cell-line">
        <span className="ntb__primary">{value.name}</span>
        {value.subdomain ? <span className="numu-domain">{value.subdomain}</span> : null}
        <Badge tone="neutral" square>
          {value.plan}
        </Badge>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="ak-stack" style={{ gap: "var(--sp-2)" }}>
      <Input
        id={id}
        icon="search"
        autoComplete="off"
        placeholder="Store name or subdomain"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {query.length >= 2 ? (
        <DataTable
          dense
          columns={TENANT_COLUMNS}
          rows={hits.data ?? []}
          rowKey={(t) => t.id}
          loading={hits.isLoading}
          skeletonRows={2}
          caption="Matching merchants"
          onRowClick={onChange}
          empty={
            hits.isError ? (
              <EmptyState kind="error" title="Search failed" body={hits.error.message} />
            ) : (
              <EmptyState kind="noResults" title="No merchant matches" body="Try the subdomain." />
            )
          }
        />
      ) : null}
    </div>
  );
}

export function GrantDialog({
  feature,
  plan,
  tenants,
  onClose,
}: {
  feature: Feature;
  plan: string;
  tenants?: number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEntitlements();
  const current = feature.grants[plan];
  const [draft, setDraft] = useState(String(current ?? feature.default_value));
  const [reason, setReason] = useState("");
  const value = parseValue(feature.kind, draft);
  const addon = plan.startsWith("addon:");

  const save = useMutation({
    mutationFn: (next: EntitlementValue) => setGrant(feature.key, plan, next, reason.trim()),
    onSuccess: (r) => {
      toast.success(`${feature.name} on ${planLabel(plan)}: ${formatValue(feature.kind, r.value)}`, {
        description: `${formatNumber(r.affected_tenants)} tenants affected · recorded in the audit log`,
      });
      invalidate();
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog
      open
      title={`${feature.name} · ${planLabel(plan)}`}
      description={
        current === undefined
          ? addon
            ? "No grant yet: this add-on adds nothing to this feature."
            : `No grant yet: merchants on ${plan} get the default, ${formatValue(feature.kind, feature.default_value)}.`
          : `Now ${formatValue(feature.kind, current)}.`
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={value === null || value === current || !validReason(reason)}
            onClick={() => value !== null && save.mutate(value)}
          >
            Save
          </Button>
        </>
      }
    >
      <ValueInput id="grant-value" kind={feature.kind} unit={feature.unit} draft={draft} onChange={setDraft} />
      <ReasonField id="grant-reason" value={reason} onChange={setReason} />
      <Banner tone="info" icon="users">
        {addon
          ? "Affects every tenant subscribed to this add-on"
          : `Affects ${formatNumber(tenants ?? 0)} tenants on ${plan}`}
        , as soon as you save.
      </Banner>
    </Dialog>
  );
}

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "365 days" },
  { value: "custom", label: "Custom date" },
  { value: "never", label: "No expiry" },
];

export function OverrideDrawer({
  featureKey,
  tenant,
  onClose,
}: {
  featureKey: string;
  tenant?: TenantHit;
  onClose: () => void;
}) {
  const catalog = useQuery({ queryKey: FEATURES_QUERY_KEY, queryFn: listFeatures });
  const feature = catalog.data?.features.find((f) => f.key === featureKey);
  return (
    <Drawer
      title="Add override"
      subtitle={featureKey}
      width={560}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      {feature ? (
        <OverrideForm feature={feature} tenant={tenant} onDone={onClose} />
      ) : catalog.isLoading ? (
        <Skeleton lines={6} />
      ) : (
        <EmptyState
          kind="error"
          title="Feature not found"
          body={catalog.error?.message ?? `No feature is called ${featureKey}.`}
        />
      )}
    </Drawer>
  );
}

function OverrideForm({ feature, tenant, onDone }: { feature: Feature; tenant?: TenantHit; onDone: () => void }) {
  const invalidate = useInvalidateEntitlements();
  const [target, setTarget] = useState<TenantHit | null>(tenant ?? null);
  const [draft, setDraft] = useState(feature.kind === "boolean" ? "true" : "");
  const [source, setSource] = useState<OverrideSource>("support");
  const [expiry, setExpiry] = useState("30");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const value = parseValue(feature.kind, draft);
  const contract = source === "contract";
  const expiresAt =
    expiry === "never"
      ? null
      : expiry === "custom"
        ? date
          ? new Date(`${date}T00:00`)
          : undefined
        : new Date(Date.now() + Number(expiry) * DAY_MS);
  const expiryError =
    expiresAt === undefined
      ? "Pick a date."
      : expiresAt && expiresAt.getTime() <= Date.now()
        ? "The date has to be in the future."
        : expiresAt && !contract && expiresAt.getTime() - Date.now() > 366 * DAY_MS
          ? "Only a contract override may run longer than a year."
          : undefined;
  const planValue = target ? feature.grants[target.plan] : undefined;

  const save = useMutation({
    mutationFn: (vars: { tenantId: string; value: EntitlementValue }) =>
      createOverride(vars.tenantId, {
        feature_key: feature.key,
        value: vars.value,
        source,
        reason: reason.trim(),
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      }),
    onSuccess: (o) => {
      toast.success(`Override added for ${target?.name ?? "the merchant"}`, {
        description: `${feature.name}: ${formatValue(feature.kind, o.value)} · recorded in the audit log`,
      });
      invalidate();
      onDone();
    },
    onError: invalidate,
  });

  return (
    <div className="ak-stack">
      <FormField label="Merchant" required htmlFor="override-tenant">
        <TenantSearch id="override-tenant" value={target} onChange={setTarget} />
      </FormField>
      <ValueInput id="override-value" kind={feature.kind} unit={feature.unit} draft={draft} onChange={setDraft} />
      {target && belowPlan(feature.kind, value, planValue) ? (
        <Banner tone="warning" title={`Less than the ${target.plan} plan gives`}>
          Their plan grants {formatValue(feature.kind, planValue)}. An override replaces the plan value; it does not
          add to it.
        </Banner>
      ) : null}
      <FormField label="Source" htmlFor="override-source">
        <Select
          id="override-source"
          value={source}
          onChange={(e) => {
            const next = e.target.value as OverrideSource;
            setSource(next);
            if (next !== "contract" && expiry === "never") setExpiry("30");
          }}
          options={OVERRIDE_SOURCES}
        />
      </FormField>
      <FormField
        label="Expires"
        htmlFor="override-expiry"
        error={expiryError}
        hint={
          expiresAt
            ? `Ends ${formatDateTime(expiresAt)}`
            : contract
              ? "Runs until someone revokes it."
              : "Only a contract override may run without an end date."
        }
      >
        <Select
          id="override-expiry"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          options={contract ? EXPIRY_OPTIONS : EXPIRY_OPTIONS.filter((o) => o.value !== "never")}
        />
      </FormField>
      {expiry === "custom" ? (
        <FormField label="Ends on" htmlFor="override-date" hint="At the start of that day, your time.">
          <Input id="override-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      ) : null}
      <ReasonField id="override-reason" value={reason} onChange={setReason} />
      {save.isError ? (
        <Banner tone="danger" title="Not saved">
          {save.error.message}
        </Banner>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Replaces this merchant&apos;s current override for {feature.name}, if they have one.
      </p>
      <div>
        <Button
          icon="check"
          loading={save.isPending}
          disabled={!target || value === null || Boolean(expiryError) || !validReason(reason)}
          onClick={() => target && value !== null && save.mutate({ tenantId: target.id, value })}
        >
          Add override
        </Button>
      </div>
    </div>
  );
}

export function RevokeOverrideDialog({
  overrideId,
  entity,
  onClose,
}: {
  overrideId: string;
  entity: KeyValueItem[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateEntitlements();
  const revoke = useMutation({
    mutationFn: (reason: string) => revokeOverride(overrideId, reason),
    onSuccess: () => {
      toast.success("Override revoked", { description: "Recorded in the audit log" });
      invalidate();
      onClose();
    },
    onError: toastError,
  });
  return (
    <ReasonConfirmDialog
      title="Revoke this override?"
      entity={entity}
      consequences={[
        "The merchant falls back to their plan and add-ons straight away.",
        "The override stays in the history, marked revoked.",
      ]}
      confirmLabel="Revoke override"
      busy={revoke.isPending}
      onConfirm={(reason) => revoke.mutate(reason)}
      onClose={onClose}
    />
  );
}

const ACTIONS: Record<string, string> = {
  "entitlement.feature.update": "Edited the details",
  "entitlement.override.create": "Added an override",
  "entitlement.override.revoke": "Revoked an override",
  "flag.create": "Created the flag",
  "flag.update": "Changed the flag",
  "flag.delete": "Deleted the flag",
  "flag.target.set": "Targeted a merchant",
  "flag.target.remove": "Removed a target",
};

function actionLabel(row: AuditRow): string {
  if (row.event_type === "entitlement.feature.kill_switch") {
    return row.action === "disable" ? "Disabled globally" : "Re-enabled";
  }
  if (row.event_type === "entitlement.plan_grant.update") {
    const plan = record(row.details?.new_value).plan_key;
    return `Changed the ${typeof plan === "string" ? planLabel(plan) : "plan"} grant`;
  }
  return ACTIONS[row.event_type] ?? row.event_type;
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function shown(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}T/.test(v) ? formatDateTime(v) : v;
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function changes(details: AuditRow["details"]): string | undefined {
  const before = record(details?.old_value);
  const after = record(details?.new_value);
  return (
    Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter((k) => k !== "id" && k !== "plan_key" && shown(before[k]) !== shown(after[k]))
      .map((k) => `${k} ${shown(before[k])} → ${shown(after[k])}`)
      .join(" · ") || undefined
  );
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    action: actionLabel(row),
    actor: row.actor ?? "system",
    actorType: row.actor ? "staff" : "system",
    timestamp: formatDateTime(row.created_at),
    entity: row.tenant_id ?? undefined,
    meta: changes(row.details),
    note: row.details?.reason,
    tone: row.severity === "warning" ? "warning" : undefined,
  };
}

export function EntitlementHistory({ feature, flag }: { feature?: string; flag?: string }) {
  const audit = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "audit", feature ?? "", flag ?? ""],
    queryFn: () => listAudit({ feature, flag }),
  });
  if (audit.isLoading) return <Skeleton lines={5} />;
  if (audit.isError) {
    return <EmptyState kind="error" title="History failed to load" body={audit.error.message} />;
  }
  if (!audit.data?.length) {
    return (
      <EmptyState icon="history" title="No changes yet" body="Every change made here is recorded with who made it and why." />
    );
  }
  return <AuditTimeline entries={audit.data.map(toEntry)} />;
}
