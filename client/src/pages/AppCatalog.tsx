/**
 * Apps & Partners → App catalog (apps plan, Phase 3).
 *
 * Every app, NUMU Apps and Partner Apps together. A published Partner App is
 * invisible to merchants until "Listed in catalog" is on; NUMU Apps are
 * always listed once published. Curation (listed / featured / staff pick) is
 * audited; suspension and the Partner-apps kill switch also need 2FA.
 *
 * The kill switch takes every Partner App out of the catalog and off every
 * storefront at once (the storefront payload cache means up to ~2 minutes).
 * NUMU Apps are untouched.
 *
 * NUMU Apps are priced here (free or recurring, 2FA). A Partner App's price
 * comes from its reviewed manifest, so it has no editor.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Textarea,
  type StatusBadgeProps,
} from "@/ds";
import { formatMoney, parseMoney } from "@/lib/format";
import {
  getKillSwitch,
  listCatalog,
  setAppPricing,
  setKillSwitch,
  setListingFlags,
  suspendApp,
  type CatalogRow,
} from "@/services/appsAdminApi";
import { is2FAError } from "@/services/platformCapabilitiesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const STATUS: Record<CatalogRow["status"], { status: StatusBadgeProps["status"]; label: string }> = {
  draft: { status: "pending", label: "Draft" },
  published: { status: "active", label: "Published" },
  suspended: { status: "suspended", label: "Suspended" },
};

function onError(err: unknown) {
  if (is2FAError(err)) {
    toast.error("2FA step-up required", {
      description: "Verify your second factor again, then retry.",
    });
    return;
  }
  toast.error(err instanceof Error ? err.message : String(err));
}

function KillSwitchCard() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: ["app-catalog", "kill-switch"], queryFn: getKillSwitch });
  const toggle = useMutation({
    mutationFn: setKillSwitch,
    onSuccess: (s) => {
      toast.success(s.enabled ? "Partner apps are back on" : "Partner apps switched off everywhere", {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
    onError,
  });
  const enabled = state.data?.enabled ?? true;
  return (
    <Card title="Partner apps kill switch">
      <Switch
        checked={enabled}
        disabled={state.isLoading || toggle.isPending}
        onChange={(next) => toggle.mutate(next)}
        label={enabled ? "Partner apps are on" : "Partner apps are OFF"}
        description="Off takes every Partner App out of the catalog and off every storefront (allow ~2 minutes for caches). NUMU Apps stay."
      />
    </Card>
  );
}

/** EGP 5 to EGP 100,000 per cycle, as the API validates it. */
const MIN_PRICE = 500;
const MAX_PRICE = 10_000_000;

/**
 * NUMU App price. Starts from the current price when the catalog carries
 * it; otherwise nothing is preselected, so a save is always a deliberate
 * choice rather than a default.
 */
function PricingDialog({ app, onClose }: { app: CatalogRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const current = app.pricing;
  const [model, setModel] = useState(current?.plan === "free" || current?.plan === "recurring" ? current.plan : "");
  const [price, setPrice] = useState(current?.price_cents ? (current.price_cents / 100).toFixed(2) : "");
  const [cycle, setCycle] = useState<"monthly" | "annual">(current?.cycle ?? "monthly");
  const cents = parseMoney(price);
  const priceError = !price.trim()
    ? undefined
    : cents === null
      ? "Digits with up to 2 decimals, e.g. 99 or 99.50"
      : cents < MIN_PRICE || cents > MAX_PRICE
        ? "Between EGP 5 and EGP 100,000"
        : undefined;
  const ready = model === "free" || (model === "recurring" && cents !== null && !priceError);
  const save = useMutation({
    mutationFn: () =>
      setAppPricing(app.id, model === "recurring" ? { model, price_cents: cents ?? 0, cycle } : { model: "free" }),
    onSuccess: (pricing) => {
      toast.success(`${app.name}: ${pricing.locales.en?.label ?? pricing.plan}`, {
        description: "New subscriptions pay this price. Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["app-catalog", "list"] });
      onClose();
    },
    onError,
  });

  return (
    <Dialog
      title={`Price ${app.name}`}
      description="Recurring prices are charged to the merchant's NUMU wallet every cycle. Subscribers keep the price they subscribed at; a new price applies to new subscriptions and to re-subscribing after a lapse."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ready} loading={save.isPending} onClick={() => save.mutate()}>
            Save price
          </Button>
        </>
      }
    >
      <FormField label="Model" required htmlFor="app-price-model" hint={current ? `Now: ${current.locales.en?.label ?? current.plan}` : undefined}>
        <Select
          id="app-price-model"
          placeholder="Choose…"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          options={[
            { value: "free", label: "Free" },
            { value: "recurring", label: "Recurring" },
          ]}
        />
      </FormField>
      {model === "recurring" ? (
        <>
          <FormField
            label="Price per cycle"
            required
            htmlFor="app-price"
            error={priceError}
            hint={
              cents !== null && !priceError
                ? `${formatMoney(cents)} per ${cycle === "annual" ? "year" : "month"}`
                : "EGP 5 to EGP 100,000"
            }
          >
            <Input
              id="app-price"
              dir="ltr"
              numeric
              affix="EGP"
              inputMode="decimal"
              autoComplete="off"
              placeholder="99.00"
              // The affix is absolutely placed; without this an end-aligned amount runs under "EGP".
              style={{ paddingInlineEnd: 48 }}
              value={price}
              error={!!priceError}
              onChange={(e) => setPrice(e.target.value)}
            />
          </FormField>
          <FormField label="Cycle" required htmlFor="app-price-cycle">
            <Select
              id="app-price-cycle"
              value={cycle}
              onChange={(e) => setCycle(e.target.value as "monthly" | "annual")}
              options={[
                { value: "monthly", label: "Monthly (30 days)" },
                { value: "annual", label: "Annual (365 days)" },
              ]}
            />
          </FormField>
        </>
      ) : null}
    </Dialog>
  );
}

function AppCard({ app, onSuspend, onPrice }: { app: CatalogRow; onSuspend: () => void; onPrice: () => void }) {
  const queryClient = useQueryClient();
  const flags = useMutation({
    mutationFn: (next: CatalogRow["listing_flags"]) => setListingFlags(app.id, next),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["app-catalog", "list"] }),
    onError,
  });
  const reinstate = useMutation({
    mutationFn: () => suspendApp(app.id, { suspend: false }),
    onSuccess: () => {
      toast.success(`${app.name} reinstated`);
      void queryClient.invalidateQueries({ queryKey: ["app-catalog", "list"] });
    },
    onError,
  });
  const f = app.listing_flags;

  return (
    <Card
      title={app.name}
      subtitle={app.first_party ? "NUMU App" : `Partner: ${app.partner ?? "—"}`}
      actions={
        <div className="ak-cell-line">
          <Badge tone={app.first_party ? "info" : "neutral"}>{app.first_party ? "من نُمو" : "Partner"}</Badge>
          <StatusBadge {...STATUS[app.status]} />
        </div>
      }
      footer={
        <div className="ak-cell-line">
          {app.status === "suspended" ? (
            <Button size="sm" variant="primary" icon="refresh" loading={reinstate.isPending} onClick={() => reinstate.mutate()}>
              Reinstate
            </Button>
          ) : (
            <Button size="sm" variant="outline" icon="slash" onClick={onSuspend}>
              Suspend app
            </Button>
          )}
          {app.first_party ? (
            <Button size="sm" variant="subtle" icon="tag" onClick={onPrice}>
              Pricing
            </Button>
          ) : null}
        </div>
      }
    >
      <KeyValue
        items={[
          { label: "Slug", value: app.slug, mono: true },
          { label: "Version", value: app.version, mono: true },
          { label: "Category", value: app.category ?? "—" },
          { label: "Installs (active / total)", value: `${app.installs_active} / ${app.installs_total}`, mono: true },
          ...(app.pricing ? [{ label: "Price", value: app.pricing.locales.en?.label ?? app.pricing.plan }] : []),
        ]}
      />
      <div className="space-y-1 mt-3">
        {!app.first_party ? (
          <Switch
            checked={!!f.catalog_visible}
            disabled={flags.isPending}
            onChange={(v) => flags.mutate({ catalog_visible: v })}
            label="Listed in catalog"
            description="Published Partner Apps stay hidden from merchants until this is on."
          />
        ) : null}
        {!app.first_party ? (
          <Switch
            checked={!!f.built_by_numu}
            disabled={flags.isPending}
            onChange={(v) => flags.mutate({ built_by_numu: v })}
            label="Built by NUMU"
            description="Merchants see NUMU as the developer, like Nimo. For apps NUMU builds on the partner platform."
          />
        ) : null}
        <Switch checked={!!f.featured} disabled={flags.isPending} onChange={(v) => flags.mutate({ featured: v })} label="Featured" />
        <Switch checked={!!f.staff_pick} disabled={flags.isPending} onChange={(v) => flags.mutate({ staff_pick: v })} label="Staff pick" />
      </div>
    </Card>
  );
}

export default function AppCatalog() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["app-catalog", "list"], queryFn: listCatalog });
  const [suspending, setSuspending] = useState<CatalogRow | null>(null);
  const [pricing, setPricing] = useState<CatalogRow | null>(null);
  const [reason, setReason] = useState("");
  const suspend = useMutation({
    mutationFn: (app: CatalogRow) => suspendApp(app.id, { suspend: true, reason: reason.trim() }),
    onSuccess: (_r, app) => {
      toast.success(`${app.name} suspended`, { description: "Recorded in the audit log against your account" });
      void queryClient.invalidateQueries({ queryKey: ["app-catalog", "list"] });
    },
    onError,
  });
  const apps = list.data ?? [];

  return (
    <DashboardLayout
      title="App catalog"
      subtitle="NUMU Apps and Partner Apps, one shelf."
      actions={
        <Button variant="subtle" icon="refresh" loading={list.isFetching} onClick={() => void list.refetch()}>
          Refresh
        </Button>
      }
    >
      <KillSwitchCard />
      {list.isLoading ? <Skeleton height={220} variant="block" /> : null}
      {!list.isLoading && apps.length === 0 ? (
        <Card>
          <EmptyState kind="empty" icon="package" title="No apps yet" body="Apps appear here once created." />
        </Card>
      ) : null}
      <div className="ak-2col">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onSuspend={() => {
              setReason("");
              setSuspending(app);
            }}
            onPrice={() => setPricing(app)}
          />
        ))}
      </div>

      {pricing ? <PricingDialog app={pricing} onClose={() => setPricing(null)} /> : null}

      <Dialog
        open={suspending !== null}
        tone="danger"
        title={`Suspend ${suspending?.name ?? "app"}?`}
        description="It leaves the catalog and every storefront. Merchants keep the install; it stops being live."
        onClose={() => setSuspending(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                if (suspending) suspend.mutate(suspending);
                setSuspending(null);
              }}
            >
              Suspend app
            </Button>
          </>
        }
      >
        <FormField label="Reason" required htmlFor="app-suspend-reason" hint="Kept in the audit log.">
          <Textarea id="app-suspend-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Dialog>
    </DashboardLayout>
  );
}
