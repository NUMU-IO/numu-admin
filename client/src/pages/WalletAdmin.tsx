/**
 * WalletAdmin — super-admin control center for the payg merchant wallet.
 *
 * Three tabs:
 *   - **Review queue** — manual top-up receipts (Vodafone Cash / InstaPay)
 *     that failed auto-verification. The merchant already sees the amount
 *     on hold; Approve converts the hold into a real ledger credit,
 *     Reject drops it (with a reason). Shows the receipt image, OCR
 *     extraction, and the exact rules that soft-blocked it.
 *   - **Settings** — platform_config-backed wallet knobs: per-method
 *     switches, default commission rate, thresholds, the platform's
 *     Vodafone Cash number / InstaPay IPA, and the master switches.
 *   - **Wallets** — per-tenant balances (worst first) with manual
 *     adjustments (audited ledger rows) and per-tenant config
 *     (suspend/exempt, negotiated rate, allowance).
 *
 * Cloned from WhatsappAccessRequests.tsx — same card/dialog/react-query
 * shape, same per-row `actingId` in-flight tracking.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import {
  adjustWallet,
  approveTopupProof,
  getWalletSettings,
  listTopupProofs,
  listWallets,
  rejectTopupProof,
  updateWalletConfig,
  updateWalletSettings,
  type AdminWalletItem,
  type ProofStatus,
  type TopupProofItem,
  type WalletAdminSettings,
} from "@/services/walletAdminApi";
import {
  Building2,
  Check,
  Clock,
  Inbox,
  Loader2,
  Percent,
  RefreshCw,
  Save,
  ShieldAlert,
  Smartphone,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

const fmtEGP = (cents: number | null | undefined) =>
  cents == null ? "—" : `${(cents / 100).toLocaleString("en-EG", { minimumFractionDigits: 2 })} EGP`;

const METHOD_LABEL: Record<string, string> = {
  vodafone_cash: "Vodafone Cash",
  instapay: "InstaPay",
  card: "Card",
};

// Human explanations for auto-verification block reasons. Anything not
// mapped falls back to the slug with spaces.
const BLOCK_REASON_LABEL: Record<string, string> = {
  ocr_no_amount_found:
    "OCR read the image but found no payment amount — likely not a receipt",
  ocr_verification_unavailable: "OCR could not read the image",
  amount_above_threshold: "amount above the auto-approve threshold",
  amount_mismatch: "declared amount doesn't match the top-up",
  ocr_amount_mismatch: "OCR amount doesn't match the top-up",
  ocr_ipa_mismatch: "OCR payee doesn't match our receiving account",
  note_missing_reference: "transfer note doesn't contain the reference code",
  daily_cap_exceeded: "daily auto-approve cap reached",
  daily_count_exceeded: "daily auto-approve count reached",
};

// ─── Review queue ────────────────────────────────────────────────────────────

const PROOF_FILTERS: { value: ProofStatus; label: string }[] = [
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
  item: TopupProofItem;
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

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{item.tenant_name ?? item.tenant_id.slice(0, 8)}</span>
              <Badge variant="outline" className="shrink-0 font-normal">
                {METHOD_LABEL[item.method] ?? item.method}
              </Badge>
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
                ? "credited to merchant"
                : item.status === "rejected"
                  ? "not credited"
                  : "on hold for merchant"}
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
                {amountMismatch && " (≠ requested)"}
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
                  {BLOCK_REASON_LABEL[r] ?? r.replaceAll("_", " ")}
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
              Approve &amp; credit
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
              The merchant's on-hold credit of {fmtEGP(item.amount_cents)} will be
              removed and they can upload a new receipt. The reason is kept for
              the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="proof-reject-reason">Reason</Label>
            <Textarea
              id="proof-reject-reason"
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

function ReviewQueueTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ProofStatus>("awaiting_review");
  const [actingId, setActingId] = useState<string | null>(null);

  const proofsQuery = useQuery({
    queryKey: ["wallet-topup-proofs", statusFilter],
    queryFn: () => listTopupProofs(statusFilter),
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
      action === "approve" ? approveTopupProof(id) : rejectTopupProof(id, reason ?? ""),
    onMutate: ({ id }) => setActingId(id),
    onSettled: () => setActingId(null),
    onSuccess: (res, { action }) => {
      toast.success(
        action === "approve"
          ? `Approved — wallet credited (balance ${fmtEGP(res.credited_balance_cents ?? null)})`
          : "Receipt rejected — merchant's hold removed",
      );
      void queryClient.invalidateQueries({ queryKey: ["wallet-topup-proofs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
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
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProofStatus)}>
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
              No {statusFilter.replaceAll("_", " ")} top-up receipts.
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

// ─── Settings tab ────────────────────────────────────────────────────────────

function SettingsTab() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["wallet-admin-settings"],
    queryFn: getWalletSettings,
  });

  const [form, setForm] = useState<WalletAdminSettings | null>(null);
  useEffect(() => {
    if (settingsQuery.data && !form) setForm(settingsQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateWalletSettings,
    onSuccess: (merged) => {
      setForm(merged);
      toast.success("Wallet settings saved");
      void queryClient.invalidateQueries({ queryKey: ["wallet-admin-settings"] });
    },
    onError: (err: unknown) =>
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`),
  });

  if (settingsQuery.isLoading || !form) {
    return <Card className="h-96 animate-pulse bg-muted/30" />;
  }

  const set = <K extends keyof WalletAdminSettings>(key: K, value: WalletAdminSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const commissionPct = form.commission_bps_default != null ? form.commission_bps_default / 100 : "";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Master switches</CardTitle>
          <CardDescription>
            Turn the wallet system on/off without a deploy. Changes take effect
            within ~60 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["topups_enabled", "Top-ups enabled", "Merchants can add balance"],
              [
                "checkout_gate_enabled",
                "Checkout gate",
                "Block storefront checkout when a Pay-as-you-Grow wallet is below the allowance",
              ],
              [
                "golive_gate_enabled",
                "Go-live gate",
                "New merchants can build but can't take orders until they pick a plan or Pay as you Grow (existing tenants are grandfathered)",
              ],
            ] as const
          ).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
            </div>
          ))}
          <Separator />
          <p className="text-sm font-medium">Payment methods</p>
          {(
            [
              ["card_enabled", "Card (Kashier)", "card"],
              ["vodafone_cash_enabled", "Vodafone Cash (manual)", "vodafone_cash"],
              ["instapay_enabled", "InstaPay (manual)", "instapay"],
            ] as const
          ).map(([key, label, method]) => {
            const configured = form.methods_configured?.[method] ?? true;
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm">{label}</p>
                  {form[key] && !configured && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber-300 text-amber-700 dark:text-amber-300 text-[10px] font-normal"
                    >
                      not configured — hidden from merchants
                    </Badge>
                  )}
                </div>
                <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            A method reaches merchants only when it's on AND configured: set the
            Vodafone Cash number / InstaPay IPA below; card needs platform
            Kashier credentials on the server.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commission &amp; thresholds</CardTitle>
          <CardDescription>
            The default rate applies to NEW Pay-as-you-Grow signups — each
            merchant's rate is locked at activation (change it per tenant from
            the Wallets tab). Subscription plans are never charged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> Commission per paid order (%)
            </Label>
            <Input
              type="number"
              step="0.25"
              min={0}
              max={100}
              value={commissionPct}
              placeholder="plan default (3%)"
              onChange={(e) =>
                set(
                  "commission_bps_default",
                  e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the plan's built-in rate.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Negative allowance (EGP)</Label>
              <Input
                type="number"
                min={0}
                value={form.negative_allowance_cents / 100}
                onChange={(e) =>
                  set("negative_allowance_cents", Math.round(Number(e.target.value) * 100))
                }
              />
              <p className="text-xs text-muted-foreground">Checkout blocks below −this</p>
            </div>
            <div className="space-y-1.5">
              <Label>Low-balance warning (EGP)</Label>
              <Input
                type="number"
                min={0}
                value={form.low_balance_threshold_cents / 100}
                onChange={(e) =>
                  set("low_balance_threshold_cents", Math.round(Number(e.target.value) * 100))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Minimum top-up (EGP)</Label>
              <Input
                type="number"
                min={1}
                value={(form.min_topup_cents ?? 5000) / 100}
                onChange={(e) =>
                  set("min_topup_cents", Math.round(Number(e.target.value) * 100))
                }
              />
              <p className="text-xs text-muted-foreground">
                Merchants can't top up less than this
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <Smartphone className="h-4 w-4" /> Receiving accounts
          </CardTitle>
          <CardDescription>
            Where merchants send manual top-ups. These appear verbatim in the
            merchant hub top-up dialog.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Vodafone Cash number</Label>
            <Input
              dir="ltr"
              placeholder="01xxxxxxxxx"
              value={form.vodafone_cash_number ?? ""}
              onChange={(e) => set("vodafone_cash_number", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>InstaPay IPA</Label>
            <Input
              dir="ltr"
              placeholder="numu@instapay"
              value={form.instapay_ipa ?? ""}
              onChange={(e) => set("instapay_ipa", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>InstaPay display name</Label>
            <Input
              placeholder="NUMU"
              value={form.instapay_display_name ?? ""}
              onChange={(e) => set("instapay_display_name", e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button
          onClick={() => {
            // methods_configured / effective_methods are GET-only computed
            // status — never part of the patch.
            const { methods_configured, effective_methods, ...patch } = form;
            saveMutation.mutate(patch);
          }}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 me-1.5" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}

// ─── Wallets tab ─────────────────────────────────────────────────────────────

const WALLET_STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  exempt: "bg-muted text-muted-foreground",
};

function WalletsTab() {
  const queryClient = useQueryClient();
  const walletsQuery = useQuery({ queryKey: ["admin-wallets"], queryFn: listWallets });

  const [adjustFor, setAdjustFor] = useState<AdminWalletItem | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const [configFor, setConfigFor] = useState<AdminWalletItem | null>(null);
  const [cfgStatus, setCfgStatus] = useState<string>("active");
  const [cfgOverridePct, setCfgOverridePct] = useState<string>("");

  const adjustMutation = useMutation({
    mutationFn: ({ tenantId, cents, note }: { tenantId: string; cents: number; note: string }) =>
      adjustWallet(tenantId, cents, note),
    onSuccess: (res) => {
      toast.success(`Adjustment applied — balance ${fmtEGP(res.balance_after_cents)}`);
      setAdjustFor(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (err: unknown) =>
      toast.error(`Adjustment failed: ${err instanceof Error ? err.message : String(err)}`),
  });

  const configMutation = useMutation({
    mutationFn: ({ tenantId }: { tenantId: string }) =>
      updateWalletConfig(tenantId, {
        status: cfgStatus as "active" | "suspended" | "exempt",
        ...(cfgOverridePct === ""
          ? { clear_commission_override: true }
          : { commission_bps_override: Math.round(Number(cfgOverridePct) * 100) }),
      }),
    onSuccess: () => {
      toast.success("Wallet config updated");
      setConfigFor(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (err: unknown) =>
      toast.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`),
  });

  const wallets = walletsQuery.data ?? [];

  return (
    <div className="space-y-4">
      {walletsQuery.isLoading && <Card className="h-64 animate-pulse bg-muted/30" />}

      {!walletsQuery.isLoading && (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-end">Balance</TableHead>
                  <TableHead className="text-end">On hold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Rate override</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No wallets yet — created automatically when a tenant joins payg.
                    </TableCell>
                  </TableRow>
                )}
                {wallets.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      {w.tenant_name ?? w.tenant_id.slice(0, 8)}
                    </TableCell>
                    <TableCell
                      className={`text-end tabular-nums ${w.balance_cents < 0 ? "text-red-600 font-medium" : ""}`}
                    >
                      {fmtEGP(w.balance_cents)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums text-amber-600">
                      {w.pending_balance_cents > 0 ? fmtEGP(w.pending_balance_cents) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-transparent ${WALLET_STATUS_BADGE[w.status] ?? ""}`}>
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {w.commission_bps_override != null
                        ? `${w.commission_bps_override / 100}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdjustFor(w);
                            setAdjAmount("");
                            setAdjNote("");
                          }}
                        >
                          Adjust
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfigFor(w);
                            setCfgStatus(w.status);
                            setCfgOverridePct(
                              w.commission_bps_override != null
                                ? String(w.commission_bps_override / 100)
                                : "",
                            );
                          }}
                        >
                          Config
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Adjust dialog */}
      <Dialog open={adjustFor !== null} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual adjustment</DialogTitle>
            <DialogDescription>
              Signed amount in EGP — positive credits, negative debits. Recorded
              as an audited ledger entry with your admin id.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (EGP)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 100 or -50"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (required)</Label>
              <Textarea
                rows={2}
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Why this adjustment is being made"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                adjustMutation.isPending ||
                adjNote.trim().length < 3 ||
                !adjAmount ||
                Number(adjAmount) === 0
              }
              onClick={() =>
                adjustFor &&
                adjustMutation.mutate({
                  tenantId: adjustFor.tenant_id,
                  cents: Math.round(Number(adjAmount) * 100),
                  note: adjNote.trim(),
                })
              }
            >
              {adjustMutation.isPending && <Loader2 className="h-4 w-4 me-1.5 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config dialog */}
      <Dialog open={configFor !== null} onOpenChange={(o) => !o && setConfigFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wallet config</DialogTitle>
            <DialogDescription>
              Suspended wallets reject all writes; exempt wallets pay no
              commission and are never gated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={cfgStatus} onValueChange={setCfgStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="suspended">suspended</SelectItem>
                  <SelectItem value="exempt">exempt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Commission override (%)</Label>
              <Input
                type="number"
                step="0.25"
                min={0}
                max={100}
                placeholder="empty = use default rate"
                value={cfgOverridePct}
                onChange={(e) => setCfgOverridePct(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={configMutation.isPending}
              onClick={() => configFor && configMutation.mutate({ tenantId: configFor.tenant_id })}
            >
              {configMutation.isPending && <Loader2 className="h-4 w-4 me-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WalletAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("review");

  if (authLoading) return <DashboardLayoutSkeleton />;
  if (!user) {
    const target = getLoginUrl();
    if (target) window.location.href = target;
    return null;
  }

  return (
    <DashboardLayout title="Merchant wallets">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <WalletIcon className="h-6 w-6 text-primary" />
            Merchant wallets
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pay-as-you-go wallet control: review manual top-up receipts (the
            merchant already sees the amount on hold), tune commission and
            payment methods, and manage per-tenant balances.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="review">Top-up review</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "review" && <ReviewQueueTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "wallets" && <WalletsTab />}
      </div>
    </DashboardLayout>
  );
}
