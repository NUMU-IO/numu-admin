import DashboardLayout from "@/components/DashboardLayout";
import {
  EntitlementHistory,
  ReasonConfirmDialog,
  ReasonField,
  TenantSearch,
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
  Drawer,
  EmptyState,
  FormField,
  IconButton,
  Input,
  KeyValue,
  Select,
  Switch,
  Tabs,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime } from "@/lib/format";
import {
  ENTITLEMENTS_QUERY_KEY,
  FEATURES_QUERY_KEY,
  FLAGS_QUERY_KEY,
  FLAG_WHY,
  createFlag,
  deleteFlag,
  evaluateFlag,
  flagState,
  listFeatures,
  listFlagTargets,
  listFlags,
  removeFlagTarget,
  setFlagTarget,
  updateFlag,
  type Flag,
  type FlagPatch,
  type FlagTarget,
  type TenantHit,
} from "@/services/entitlementsAdminApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

const FLAG_KEY = /^[a-z][a-z0-9_]*$/;
const PRESETS = [1, 5, 25, 50, 100];

const isStale = (f: Flag) =>
  (f.age_days ?? 0) > 30 && [0, 100].includes(f.enabled ? f.rollout_percent : 0);

const startOfDay = (date: string) => new Date(`${date}T00:00`);

export default function Flags() {
  const search = useSearch();
  const [openKey, setOpenKey] = useState(() => new URLSearchParams(search).get("flag"));
  const [creating, setCreating] = useState(false);
  const flags = useQuery({ queryKey: FLAGS_QUERY_KEY, queryFn: listFlags });
  const rows = flags.data ?? [];
  const open = rows.find((f) => f.key === openKey);

  const columns: DataTableColumn<Flag>[] = [
    {
      key: "key",
      header: "Flag",
      render: (f) => (
        <div className="ak-cell-line">
          <span className="ntb__primary numu-id">{f.key}</span>
          {isStale(f) ? (
            <Badge tone="warning" icon="clock" square title="Over 30 days at 0% or 100%: finish the rollout and delete it">
              Stale
            </Badge>
          ) : null}
        </div>
      ),
    },
    { key: "description", header: "Description" },
    { key: "owner", header: "Owner", render: (f) => f.owner ?? "—" },
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
    {
      key: "age_days",
      header: "Age",
      align: "end",
      mono: true,
      render: (f) => (f.age_days === null ? "—" : `${f.age_days}d`),
    },
  ];

  return (
    <DashboardLayout
      title="Release flags"
      subtitle="Ship code dark, then switch it on for some merchants and finally everyone. What merchants pay for lives in Features & plans."
      actions={
        <Button icon="plus" onClick={() => setCreating(true)}>
          New flag
        </Button>
      }
    >
      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(f) => f.key}
          dense
          loading={flags.isLoading}
          caption="Release flags"
          onRowClick={(f) => setOpenKey(f.key)}
          empty={
            flags.isError ? (
              <EmptyState kind="error" title="Flags failed to load" body={flags.error.message} />
            ) : (
              <EmptyState icon="flag" title="No release flags yet" body="A new flag starts off for everyone." />
            )
          }
        />
      </Card>

      {open ? <FlagDrawer key={open.key} flag={open} onClose={() => setOpenKey(null)} /> : null}

      {creating ? (
        <NewFlagDialog
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false);
            setOpenKey(key);
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}

function NewFlagDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const invalidate = useInvalidateEntitlements();
  const catalog = useQuery({ queryKey: FEATURES_QUERY_KEY, queryFn: listFeatures });
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [featureKey, setFeatureKey] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFlag({
        key,
        description: description.trim(),
        owner: owner.trim() || undefined,
        feature_key: featureKey || undefined,
      }),
    onSuccess: (f) => {
      toast.success(`Flag ${f.key} created`, { description: "Off for everyone until you turn it on" });
      invalidate();
      onCreated(f.key);
    },
    onError: toastError,
  });

  return (
    <Dialog
      open
      title="New release flag"
      description="It starts off for everyone."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!FLAG_KEY.test(key) || description.trim().length < 3}
            onClick={() => create.mutate()}
          >
            Create flag
          </Button>
        </>
      }
    >
      <FormField
        label="Key"
        required
        htmlFor="flag-key"
        error={key && !FLAG_KEY.test(key) ? "Lowercase letters, digits and underscores, starting with a letter." : undefined}
        hint="What the code asks for, e.g. new_checkout. It cannot be renamed."
      >
        <Input
          id="flag-key"
          autoFocus
          mono
          maxLength={64}
          autoComplete="off"
          placeholder="new_checkout"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </FormField>
      <FormField label="Description" required htmlFor="flag-description" hint="What turns on when this flag is on.">
        <Textarea id="flag-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <FormField label="Owner" htmlFor="flag-owner" hint="Who to ask before changing it.">
        <Input id="flag-owner" maxLength={120} value={owner} onChange={(e) => setOwner(e.target.value)} />
      </FormField>
      <FormField label="Feature" htmlFor="flag-feature" hint="Optional. Lists the flag on that feature's Releases tab.">
        <Select
          id="flag-feature"
          value={featureKey}
          onChange={(e) => setFeatureKey(e.target.value)}
          placeholder="None"
          options={(catalog.data?.features ?? []).map((f) => ({ value: f.key, label: f.name }))}
        />
      </FormField>
    </Dialog>
  );
}

function FlagDrawer({ flag, onClose }: { flag: Flag; onClose: () => void }) {
  const invalidate = useInvalidateEntitlements();
  const [tab, setTab] = useState("rollout");
  const [switchTo, setSwitchTo] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);

  const patch = useMutation({
    mutationFn: (body: FlagPatch) => updateFlag(flag.key, body),
    onSuccess: (f) => {
      toast.success(`${f.key}: ${flagState(f)}`, { description: "Recorded in the audit log" });
      invalidate();
      setSwitchTo(null);
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: (reason: string) => deleteFlag(flag.key, reason),
    onSuccess: () => {
      toast.success(`Flag ${flag.key} deleted`, { description: "Recorded in the audit log" });
      invalidate();
      onClose();
    },
    onError: toastError,
  });

  return (
    <>
      <Drawer
        title={flag.key}
        subtitle="Release flag"
        width={720}
        onClose={onClose}
        footer={
          <>
            <Button variant="danger-outline" icon="trash" onClick={() => setDeleting(true)}>
              Delete flag
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        {/* One flex child: the drawer body is a scrolling flex column, which squeezes tables and tabs to 1px. */}
        <div className="ak-stack">
          <p>{flag.description}</p>
          <KeyValue
            items={[
              { label: "State", value: flagState(flag) },
              {
                label: "Feature",
                value: flag.feature_key ? (
                  <Link href={`/features/${flag.feature_key}`}>{flag.feature_key}</Link>
                ) : (
                  "—"
                ),
                mono: true,
              },
              { label: "Owner", value: flag.owner ?? "—" },
              { label: "Created", value: formatDateTime(flag.created_at), mono: true },
            ]}
          />
          <Tabs
            tabs={[
              { id: "rollout", label: "Rollout" },
              { id: "targets", label: "Targets", count: flag.targets },
              { id: "history", label: "History" },
            ]}
            active={tab}
            onChange={setTab}
          />
          {tab === "rollout" && (
            <>
              <Switch
                checked={flag.enabled}
                onChange={setSwitchTo}
                label="Master switch"
                description={
                  flag.enabled
                    ? "On: targets and the percentage decide who gets it."
                    : "Off for every merchant, targeted ones included."
                }
              />
              <Rollout
                key={flag.rollout_percent}
                flag={flag}
                busy={patch.isPending}
                onSave={(rollout_percent, reason) => patch.mutate({ rollout_percent, reason })}
              />
              <Evaluate flagKey={flag.key} />
            </>
          )}
          {tab === "targets" && <Targets flag={flag} />}
          {tab === "history" && <EntitlementHistory flag={flag.key} />}
        </div>
      </Drawer>

      {switchTo !== null ? (
        <ReasonConfirmDialog
          tone={switchTo ? "warning" : "danger"}
          title={switchTo ? `Turn ${flag.key} on?` : `Turn ${flag.key} off?`}
          consequences={
            switchTo
              ? [
                  flag.rollout_percent >= 100
                    ? "Every merchant gets it at once."
                    : `Targeted merchants and ${flag.rollout_percent}% of the rest get it at once.`,
                ]
              : [
                  "Off for every merchant at once, targeted ones included.",
                  "Targets and the percentage are kept for when it goes back on.",
                ]
          }
          confirmLabel={switchTo ? "Turn on" : "Turn off"}
          busy={patch.isPending}
          onConfirm={(reason) => patch.mutate({ enabled: switchTo, reason })}
          onClose={() => setSwitchTo(null)}
        />
      ) : null}

      {deleting ? (
        <ReasonConfirmDialog
          title={`Delete ${flag.key}?`}
          entity={[{ label: "Flag", value: flag.key, mono: true }]}
          consequences={[
            "Code that still asks for this flag gets off for every merchant.",
            `Its ${flag.targets} targets are deleted with it.`,
            "Delete a flag once its code path is gone.",
          ]}
          confirmPhrase={flag.key}
          confirmLabel="Delete flag"
          busy={remove.isPending}
          onConfirm={(reason) => remove.mutate(reason)}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}

function Rollout({
  flag,
  busy,
  onSave,
}: {
  flag: Flag;
  busy: boolean;
  onSave: (percent: number, reason: string) => void;
}) {
  const [percent, setPercent] = useState(String(flag.rollout_percent));
  const [reason, setReason] = useState("");
  const n = Number(percent);
  const valid = /^\d+$/.test(percent) && n <= 100;

  return (
    <Card variant="outlined" title="Rollout" subtitle="Merchants without a target">
      <div className="ak-stack">
        {flag.enabled ? null : (
          <Banner tone="info">The master switch is off, so the percentage does nothing until it is on.</Banner>
        )}
        <FormField
          label="Percentage"
          htmlFor="flag-percent"
          error={percent && !valid ? "0 to 100." : undefined}
          hint="Each merchant keeps its slot, so raising the percentage only adds merchants."
        >
          <div className="ak-cell-line">
            <Input
              id="flag-percent"
              type="number"
              min={0}
              max={100}
              numeric
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              style={{ maxWidth: 96 }}
            />
            {PRESETS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={percent === String(p) ? "primary" : "subtle"}
                onClick={() => setPercent(String(p))}
              >
                {p}%
              </Button>
            ))}
          </div>
        </FormField>
        <ReasonField id="flag-percent-reason" value={reason} onChange={setReason} />
        <div>
          <Button
            loading={busy}
            disabled={!valid || n === flag.rollout_percent || !validReason(reason)}
            onClick={() => onSave(n, reason.trim())}
          >
            Save rollout
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Evaluate({ flagKey }: { flagKey: string }) {
  const [tenant, setTenant] = useState<TenantHit | null>(null);
  const result = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "evaluate", flagKey, tenant?.id ?? ""],
    queryFn: () => evaluateFlag(flagKey, tenant?.id ?? ""),
    enabled: Boolean(tenant),
  });
  const r = result.data;

  return (
    <Card variant="outlined" title="Evaluate for a merchant">
      <div className="ak-stack">
        <TenantSearch id="flag-evaluate" value={tenant} onChange={setTenant} />
        {tenant && r ? (
          <KeyValue
            items={[
              {
                label: "Answer",
                value: (
                  <Badge tone={r.on ? "success" : "neutral"} square>
                    {r.on ? "On" : "Off"}
                  </Badge>
                ),
              },
              { label: "Why", value: FLAG_WHY[r.why] ?? r.why },
              {
                label: "Bucket",
                value: `${r.bucket} of 10,000: in the rollout from ${Math.floor(r.bucket / 100) + 1}%`,
                mono: true,
              },
            ]}
          />
        ) : null}
        {tenant && result.isError ? <Banner tone="danger">{result.error.message}</Banner> : null}
      </div>
    </Card>
  );
}

function Targets({ flag }: { flag: Flag }) {
  const invalidate = useInvalidateEntitlements();
  const targets = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, "flag-targets", flag.key],
    queryFn: () => listFlagTargets(flag.key),
  });
  const [tenant, setTenant] = useState<TenantHit | null>(null);
  const [on, setOn] = useState(true);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState<FlagTarget | null>(null);
  const untilError = until && startOfDay(until).getTime() <= Date.now() ? "Pick a future date." : undefined;

  const add = useMutation({
    mutationFn: (t: TenantHit) =>
      setFlagTarget(flag.key, t.id, {
        enabled: on,
        expires_at: until ? startOfDay(until).toISOString() : null,
        reason: reason.trim(),
      }),
    onSuccess: (_r, t) => {
      toast.success(on ? `${t.name} gets ${flag.key}` : `${t.name} is held out of ${flag.key}`, {
        description: "Recorded in the audit log",
      });
      invalidate();
      setTenant(null);
      setOn(true);
      setUntil("");
      setReason("");
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: (vars: { target: FlagTarget; reason: string }) =>
      removeFlagTarget(flag.key, vars.target.tenant_id, vars.reason),
    onSuccess: () => {
      toast.success("Target removed", { description: "Recorded in the audit log" });
      invalidate();
      setRemoving(null);
    },
    onError: toastError,
  });

  const columns: DataTableColumn<FlagTarget>[] = [
    {
      key: "tenant",
      header: "Merchant",
      render: (t) => (
        <div>
          <div className="ntb__primary">{t.tenant.name}</div>
          <div className="ntb__sub numu-domain">{t.tenant.subdomain}</div>
        </div>
      ),
    },
    {
      key: "enabled",
      header: "State",
      render: (t) =>
        t.expired ? (
          <Badge tone="neutral" square>
            Expired
          </Badge>
        ) : (
          <Badge tone={t.enabled ? "success" : "warning"} square>
            {t.enabled ? "On" : "Held out"}
          </Badge>
        ),
    },
    {
      key: "expires_at",
      header: "Expires",
      mono: true,
      render: (t) => (t.expires_at ? formatDateTime(t.expires_at) : "Never"),
    },
    { key: "reason", header: "Reason", render: (t) => t.reason ?? "—" },
    {
      key: "actions",
      header: "",
      width: 48,
      render: (t) => (
        <IconButton icon="trash" label={`Remove ${t.tenant.name}`} size="sm" onClick={() => setRemoving(t)} />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={targets.data ?? []}
        rowKey={(t) => t.tenant_id}
        dense
        loading={targets.isLoading}
        caption={`Merchants targeted by ${flag.key}`}
        empty={
          targets.isError ? (
            <EmptyState kind="error" title="Targets failed to load" body={targets.error.message} />
          ) : (
            <EmptyState
              icon="users"
              title="No targets"
              body="A target switches the flag on, or holds it off, for one merchant whatever the percentage."
            />
          )
        }
      />

      <Card variant="outlined" title="Add a target" subtitle="Replaces the merchant's target if they have one">
        <div className="ak-stack">
          <FormField label="Merchant" required htmlFor="target-tenant">
            <TenantSearch id="target-tenant" value={tenant} onChange={setTenant} />
          </FormField>
          <Switch
            checked={on}
            onChange={setOn}
            label={on ? "On for this merchant" : "Held out: off for this merchant"}
          />
          <FormField
            label="Expires"
            htmlFor="target-until"
            error={untilError}
            hint="Optional. At the start of that day, your time. Empty keeps it until removed."
          >
            <Input id="target-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </FormField>
          <ReasonField id="target-reason" value={reason} onChange={setReason} />
          <div>
            <Button
              icon="plus"
              loading={add.isPending}
              disabled={!tenant || Boolean(untilError) || !validReason(reason)}
              onClick={() => tenant && add.mutate(tenant)}
            >
              Add target
            </Button>
          </div>
        </div>
      </Card>

      {removing ? (
        <ReasonConfirmDialog
          tone="warning"
          title={`Remove ${removing.tenant.name} from ${flag.key}?`}
          consequences={["They follow the master switch and the percentage again, straight away."]}
          confirmLabel="Remove target"
          busy={remove.isPending}
          onConfirm={(reason) => remove.mutate({ target: removing, reason })}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
