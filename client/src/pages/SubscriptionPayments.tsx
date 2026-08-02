/**
 * SubscriptionPayments — admin control center for plan subscriptions.
 *
 * Three tabs:
 *   - **Review queue** — InstaPay receipts that failed auto-verification.
 *     Approve activates/renews the subscription (idempotent server-side);
 *     Reject reopens the intent so the merchant can re-upload.
 *   - **Plans & features** — the REAL plan catalog (/admin/plan-limits):
 *     per-plan limits, feature switches, and prices. Hot-patched live —
 *     these prices are what InstaPay payments charge.
 *   - **Lifecycle** — pre-expiry warning windows (trial ending / renewal
 *     upcoming, with a master email switch) and the dunning ladder
 *     (retries / backoff / window before read-only).
 *
 * Cloned from WalletAdmin.tsx — same card/dialog/react-query shape,
 * same per-row `actingId` tracking.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import {
  getPlanLimits,
  updatePlanLimits,
  type PlanLimitsItem,
} from "@/services/planLimitsAdminApi";
import {
  getWalletSettings,
  updateWalletSettings,
} from "@/services/walletAdminApi";
import {
  approveSubscriptionProof,
  getBillingLifecycleSettings,
  listSubscriptionProofs,
  rejectSubscriptionProof,
  updateBillingLifecycleSettings,
  type BillingLifecycleSettings,
  type SubscriptionProofItem,
  type SubscriptionProofStatus,
} from "@/services/subscriptionPaymentsAdminApi";
import {
  BadgeCheck,
  BellRing,
  Building2,
  Check,
  Clock,
  Inbox,
  Landmark,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

const fmtEGP = (cents: number | null | undefined) =>
  cents == null ? "—" : `${(cents / 100).toLocaleString("en-EG", { minimumFractionDigits: 2 })} EGP`;

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
};

const PROOF_FILTERS: { value: SubscriptionProofStatus; label: string }[] = [
  { value: "awaiting_review", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "auto_approved", label: "Auto-approved" },
];

function ProofCard({
  item,
  onApprove,
  onReject,
  pending,
}: {
  item: SubscriptionProofItem;
  onApprove: () => void;
  onReject: (reason: string) => void;
  pending: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [imageOpen, setImageOpen] = useState(false);

  const amountMismatch =
    item.ocr_extracted_amount_cents != null &&
    item.ocr_extracted_amount_cents !== item.amount_cents;

  const planBadge = `${PLAN_LABEL[item.plan] ?? item.plan} · ${
    item.billing_cycle === "annual" ? "Annual" : "Monthly"
  }`;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{item.tenant_name ?? item.tenant_id.slice(0, 8)}</span>
              <Badge variant="outline" className="shrink-0 font-normal">
                {planBadge}
              </Badge>
              {item.purpose === "renewal" && (
                <Badge variant="outline" className="shrink-0 font-normal gap-1 border-blue-300 text-blue-700">
                  <RotateCcw className="h-3 w-3" />
                  Renewal
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}
              </span>
              <span className="font-mono">{item.reference}</span>
            </CardDescription>
          </div>
          <div className="text-end shrink-0">
            <p className="text-lg font-bold tabular-nums">{fmtEGP(item.amount_cents)}</p>
            <p
              className={`text-[11px] ${
                item.status === "approved" || item.status === "auto_approved"
                  ? "text-green-600"
                  : item.status === "rejected"
                    ? "text-red-600"
                    : "text-muted-foreground"
              }`}
            >
              {item.status === "approved" || item.status === "auto_approved"
                ? "subscription activated"
                : item.status === "rejected"
                  ? "not activated"
                  : "merchant waiting"}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div className="text-muted-foreground">Transaction ref</div>
          <div className="font-mono truncate">{item.transaction_ref}</div>
          <div className="text-muted-foreground">Paid to</div>
          <div className="font-mono truncate" dir="ltr">{item.destination ?? "—"}</div>
          {item.ocr_status && (
            <>
              <div className="text-muted-foreground">OCR amount</div>
              <div className={amountMismatch ? "text-red-600 font-medium" : ""}>
                {fmtEGP(item.ocr_extracted_amount_cents)}
                {amountMismatch && " (≠ plan price)"}
              </div>
            </>
          )}
        </div>

        {item.block_reasons && item.block_reasons.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30 p-2.5">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Auto-verification blocked because:
            </p>
            <div className="flex flex-wrap gap-1">
              {item.block_reasons.map((r) => (
                <Badge key={r} variant="outline" className="text-[10px] border-amber-300 text-amber-800 dark:text-amber-300">
                  {r.replaceAll("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {item.rejection_reason && (
          <p className="text-xs text-red-600">Rejected: {item.rejection_reason}</p>
        )}

        {item.image_url && (
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            className="block w-full overflow-hidden rounded-md border hover:opacity-90"
          >
            <img
              src={item.image_url}
              alt="Transfer receipt"
              className="max-h-44 w-full object-cover object-top"
            />
            <span className="block bg-muted/60 py-1 text-center text-[11px] text-muted-foreground">
              Click to enlarge receipt
            </span>
          </button>
        )}

        {item.status === "awaiting_review" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={onApprove}
              disabled={pending}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 me-1.5" />
              )}
              Approve &amp; activate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setReason("");
                setRejectOpen(true);
              }}
              disabled={pending}
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt — {item.reference}</DialogTitle>
          </DialogHeader>
          {item.image_url && (
            <img src={item.image_url} alt="Transfer receipt" className="w-full rounded-md" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this receipt</DialogTitle>
            <DialogDescription>
              The subscription will NOT be activated. The payment reopens so the
              merchant can upload a better receipt while the window is open. The
              reason is kept for the audit trail and shown to the merchant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sub-proof-reject-reason">Reason</Label>
            <Textarea
              id="sub-proof-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Amount not received / receipt does not match"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              onClick={() => {
                onReject(reason.trim());
                setRejectOpen(false);
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ReviewQueue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] =
    useState<SubscriptionProofStatus>("awaiting_review");
  const [actingId, setActingId] = useState<string | null>(null);

  const proofsQuery = useQuery({
    queryKey: ["subscription-payment-proofs", statusFilter],
    queryFn: () => listSubscriptionProofs(statusFilter),
    refetchInterval: 30 * 1000,
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "approve" | "reject";
      reason?: string;
    }) =>
      action === "approve"
        ? approveSubscriptionProof(id)
        : rejectSubscriptionProof(id, reason ?? ""),
    onMutate: ({ id }) => setActingId(id),
    onSettled: () => setActingId(null),
    onSuccess: (res, { action }) => {
      toast.success(
        action === "approve"
          ? `Approved — ${PLAN_LABEL[res.plan ?? ""] ?? res.plan} subscription activated`
          : "Receipt rejected — merchant can re-upload",
      );
      void queryClient.invalidateQueries({ queryKey: ["subscription-payment-proofs"] });
    },
    onError: (err: unknown) => {
      toast.error(`Action failed: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const proofs = proofsQuery.data?.proofs ?? [];
  const counts = proofsQuery.data?.counts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as SubscriptionProofStatus)}
        >
          <TabsList>
            {PROOF_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                {counts[f.value] != null && (
                  <span className="ms-1 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {counts[f.value]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void proofsQuery.refetch()}
          disabled={proofsQuery.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 me-1.5${proofsQuery.isFetching ? " animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {proofsQuery.isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">
              {proofsQuery.error instanceof Error ? proofsQuery.error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      )}

      {proofsQuery.isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted/30" />
          ))}
        </div>
      )}

      {!proofsQuery.isLoading && proofs.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">Queue is clear</p>
            <p className="text-sm text-muted-foreground mt-1">
              No {statusFilter.replaceAll("_", " ")} subscription receipts.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {proofs.map((item) => (
          <ProofCard
            key={item.proof_id}
            item={item}
            pending={actionMutation.isPending && actingId === item.proof_id}
            onApprove={() => actionMutation.mutate({ id: item.proof_id, action: "approve" })}
            onReject={(reason) =>
              actionMutation.mutate({ id: item.proof_id, action: "reject", reason })
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Plans & features tab ────────────────────────────────────────────────────

const PLAN_ORDER = ["starter", "pro", "payg", "trial", "demo", "enterprise", "free"];

const LIMIT_FIELDS: { key: keyof PlanLimitsItem; label: string }[] = [
  { key: "max_products", label: "Max products" },
  { key: "max_orders_per_month", label: "Max orders / month" },
  { key: "max_stores", label: "Max stores" },
  { key: "max_staff_members", label: "Max staff" },
  { key: "max_customers", label: "Max customers" },
];

const FEATURE_FIELDS: { key: keyof PlanLimitsItem; label: string }[] = [
  { key: "webhooks_enabled", label: "Webhooks" },
  { key: "custom_domain_enabled", label: "Custom domain" },
  { key: "api_access_enabled", label: "API access" },
  { key: "analytics_enabled", label: "Analytics" },
  { key: "discount_codes_enabled", label: "Discount codes" },
];

function PlansTab() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({
    queryKey: ["admin-plan-limits"],
    queryFn: getPlanLimits,
  });

  const [draft, setDraft] = useState<PlanLimitsItem[] | null>(null);

  useEffect(() => {
    if (plansQuery.data) {
      const sorted = [...plansQuery.data.plans].sort(
        (a, b) => PLAN_ORDER.indexOf(a.key) - PLAN_ORDER.indexOf(b.key),
      );
      setDraft(sorted);
    }
  }, [plansQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (plans: PlanLimitsItem[]) => updatePlanLimits(plans),
    onSuccess: () => {
      toast.success("Plans saved — changes are live immediately");
      void queryClient.invalidateQueries({ queryKey: ["admin-plan-limits"] });
    },
    onError: (err: unknown) =>
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`),
  });

  const patch = (key: string, field: keyof PlanLimitsItem, value: number | boolean | string) => {
    setDraft((d) =>
      d ? d.map((p) => (p.key === key ? { ...p, [field]: value } : p)) : d,
    );
  };

  if (plansQuery.isLoading || !draft) {
    return <Card className="h-64 animate-pulse bg-muted/30" />;
  }
  if (plansQuery.isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm">
            {plansQuery.error instanceof Error ? plansQuery.error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(
    [...(plansQuery.data?.plans ?? [])].sort(
      (a, b) => PLAN_ORDER.indexOf(a.key) - PLAN_ORDER.indexOf(b.key),
    ),
  );

  const egp = (piasters: number) => (piasters < 0 ? piasters : piasters / 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          -1 = unlimited (limits) / custom contract (prices). Prices are in
          EGP and are exactly what InstaPay subscription payments charge.
        </p>
        <Button
          size="sm"
          onClick={() => draft && saveMutation.mutate(draft)}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 me-1.5" />
          )}
          Save all changes
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {draft.map((plan) => (
          <Card key={plan.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {plan.display_name}
                  <Badge variant="outline" className="font-mono text-[10px]">{plan.key}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-8 w-24 text-end tabular-nums"
                      value={egp(plan.monthly_price_piasters)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        patch(plan.key, "monthly_price_piasters", v < 0 ? v : Math.round(v * 100));
                      }}
                    />
                    <span className="text-xs text-muted-foreground">EGP/mo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-8 w-24 text-end tabular-nums"
                      value={egp(plan.annual_price_piasters)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        patch(plan.key, "annual_price_piasters", v < 0 ? v : Math.round(v * 100));
                      }}
                    />
                    <span className="text-xs text-muted-foreground">EGP/yr</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LIMIT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input
                      type="number"
                      className="h-8 tabular-nums"
                      value={plan[f.key] as number}
                      onChange={(e) => patch(plan.key, f.key, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {FEATURE_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={plan[f.key] as boolean}
                      onCheckedChange={(v) => patch(plan.key, f.key, v)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Lifecycle settings tab ──────────────────────────────────────────────────

const LIFECYCLE_NUMBER_FIELDS: {
  key: keyof BillingLifecycleSettings;
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    key: "renewal_warning_days",
    label: "Renewal warning (days before)",
    hint: "Email + hub \"renewal due\" banner this many days before next_renewal_at.",
    min: 1,
    max: 30,
  },
  {
    key: "trial_warning_days",
    label: "Trial warning (days before)",
    hint: "Email this many days before the trial expires.",
    min: 1,
    max: 30,
  },
  {
    key: "dunning_max_retries",
    label: "Dunning: max retries",
    hint: "Failed renewal attempts before the store goes read-only.",
    min: 1,
    max: 10,
  },
  {
    key: "dunning_retry_backoff_hours",
    label: "Dunning: retry backoff (hours)",
    hint: "Gap between renewal retry attempts.",
    min: 1,
    max: 168,
  },
  {
    key: "dunning_window_hours",
    label: "Dunning: minimum window (hours)",
    hint: "Read-only can't trigger before this much time since subscription start.",
    min: 0,
    max: 720,
  },
];

function LifecycleTab() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["billing-lifecycle-settings"],
    queryFn: getBillingLifecycleSettings,
  });

  const [draft, setDraft] = useState<BillingLifecycleSettings | null>(null);

  useEffect(() => {
    if (settingsQuery.data) setDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (patch: BillingLifecycleSettings) =>
      updateBillingLifecycleSettings(patch),
    onSuccess: () => {
      toast.success("Lifecycle settings saved — live within a minute");
      void queryClient.invalidateQueries({ queryKey: ["billing-lifecycle-settings"] });
    },
    onError: (err: unknown) =>
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`),
  });

  // InstaPay receiving account — SHARED with wallet top-ups (same
  // wallet_settings platform_config the Merchant Wallets page edits).
  // Surfaced here too because subscription payments transfer into it.
  const walletSettingsQuery = useQuery({
    queryKey: ["admin-wallet-settings"],
    queryFn: getWalletSettings,
  });
  const [ipa, setIpa] = useState("");
  const [ipaName, setIpaName] = useState("");
  useEffect(() => {
    if (walletSettingsQuery.data) {
      setIpa(walletSettingsQuery.data.instapay_ipa ?? "");
      setIpaName(walletSettingsQuery.data.instapay_display_name ?? "");
    }
  }, [walletSettingsQuery.data]);

  const saveIpaMutation = useMutation({
    mutationFn: () =>
      updateWalletSettings({
        instapay_ipa: ipa.trim() || null,
        instapay_display_name: ipaName.trim() || null,
      }),
    onSuccess: () => {
      toast.success("InstaPay receiving account saved — live within a minute");
      void queryClient.invalidateQueries({ queryKey: ["admin-wallet-settings"] });
    },
    onError: (err: unknown) =>
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`),
  });
  const ipaDirty =
    walletSettingsQuery.data != null &&
    (ipa !== (walletSettingsQuery.data.instapay_ipa ?? "") ||
      ipaName !== (walletSettingsQuery.data.instapay_display_name ?? ""));

  if (settingsQuery.isLoading || !draft) {
    return <Card className="h-64 animate-pulse bg-muted/30" />;
  }
  if (settingsQuery.isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm">
            {settingsQuery.error instanceof Error ? settingsQuery.error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settingsQuery.data);

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            InstaPay receiving account
          </CardTitle>
          <CardDescription>
            NUMU's own IPA — where subscription payments AND wallet top-ups
            are transferred. Shared with the Merchant Wallets page; editing
            it here updates both flows. Empty = InstaPay payments disabled
            (merchants get "not configured").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletSettingsQuery.isLoading ? (
            <div className="h-20 animate-pulse rounded-md bg-muted/30" />
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-sm">InstaPay IPA</Label>
                <Input
                  dir="ltr"
                  className="h-9 font-mono"
                  placeholder="e.g. numu@instapay"
                  value={ipa}
                  onChange={(e) => setIpa(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown verbatim to merchants in the payment dialog and
                  cross-checked by OCR against the uploaded receipt.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Display name (optional)</Label>
                <Input
                  className="h-9"
                  placeholder="e.g. NUMU Technologies"
                  value={ipaName}
                  onChange={(e) => setIpaName(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveIpaMutation.mutate()}
                  disabled={!ipaDirty || saveIpaMutation.isPending}
                >
                  {saveIpaMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 me-1.5" />
                  )}
                  Save receiving account
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            Pre-expiry warnings
          </CardTitle>
          <CardDescription>
            Bilingual heads-up emails before the trial ends or a paid period
            renews. The renewal window also drives the hub's "renewal due —
            pay now" banner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            Warning emails enabled
            <Switch
              checked={draft.warning_emails_enabled}
              onCheckedChange={(v) => setDraft({ ...draft, warning_emails_enabled: v })}
            />
          </label>
          {LIFECYCLE_NUMBER_FIELDS.slice(0, 2).map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-sm">{f.label}</Label>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                className="h-9 w-32 tabular-nums"
                value={draft[f.key] as number}
                onChange={(e) =>
                  setDraft({ ...draft, [f.key]: Number(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Dunning ladder
          </CardTitle>
          <CardDescription>
            What happens when a renewal can't be collected (no saved card,
            or the card declined): retries with backoff, then the store goes
            read-only. A dunning email pointing at card/InstaPay fires on
            every failed try.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {LIFECYCLE_NUMBER_FIELDS.slice(2).map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-sm">{f.label}</Label>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                className="h-9 w-32 tabular-nums"
                value={draft[f.key] as number}
                onChange={(e) =>
                  setDraft({ ...draft, [f.key]: Number(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => draft && saveMutation.mutate(draft)}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 me-1.5" />
          )}
          Save lifecycle settings
        </Button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SubscriptionPayments() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("review");

  if (authLoading) return <DashboardLayoutSkeleton />;
  if (!user) {
    const target = getLoginUrl();
    if (target) window.location.href = target;
    return null;
  }

  return (
    <DashboardLayout title="Subscription payments">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-primary" />
            Subscription payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            InstaPay plan payments, the plan catalog (limits, features,
            prices), and the subscription lifecycle: pre-expiry warnings and
            the dunning ladder.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="review">Review queue</TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Plans &amp; features
            </TabsTrigger>
            <TabsTrigger value="lifecycle" className="gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              Lifecycle
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "review" && <ReviewQueue />}
        {tab === "plans" && <PlansTab />}
        {tab === "lifecycle" && <LifecycleTab />}
      </div>
    </DashboardLayout>
  );
}
