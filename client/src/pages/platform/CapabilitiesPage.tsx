/**
 * Platform Control — capability registry.
 *
 * The operator surface for ADR-0 / ADR-6: which capabilities exist, who may
 * hold each one, and the kill switch that takes one out of service
 * everywhere at once. Backend: `/admin/platform/capabilities`.
 *
 * Three domain rules drive every design decision on this page:
 *
 *  1. `effective_min_tier` can differ from `min_tier`. A capability's
 *     data classification imposes a FLOOR (cross_merchant_aggregate →
 *     first_party, tenant_private → verified, otherwise partner). A row that
 *     stores a lower tier is corrected upward by the server. Wherever the two
 *     differ this page says so explicitly — a silent mismatch is how an
 *     operator ends up staring at a denied grant with no explanation.
 *  2. `lifecycle_state` gates grants. pilot / ga / deprecated grant;
 *     draft / retired / suspended grant nothing. The item's `grantable` flag
 *     already encodes this, so the table renders that flag rather than
 *     re-deriving the rule client-side (re-deriving it is how the client and
 *     server drift).
 *  3. Suspend is a platform-wide kill switch. It lives behind a destructive
 *     confirmation dialog that names the capability, not next to "edit
 *     description". The endpoint also requires a 2FA step-up within 300s; an
 *     expired step-up comes back as a 403 and is translated into actionable
 *     copy rather than a raw API string.
 *
 * The enum vocabulary is NEVER hardcoded here — it comes from
 * `GET /vocabulary`. Only presentation (badge colours) is local, and it
 * degrades to a neutral badge for values it doesn't recognise, so adding a
 * lifecycle state server-side can't break this page.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CAPABILITIES_QUERY_KEY,
  CAPABILITY_VOCAB_QUERY_KEY,
  checkGrant,
  createCapability,
  getCapabilityVocabulary,
  is2FAError,
  listCapabilities,
  setCapabilityLifecycle,
  updateCapability,
  type CapabilityCreateInput,
  type CapabilityItem,
  type CapabilityPatchInput,
  type CapabilityVocabulary,
  type GrantCheckResponse,
} from "@/services/platformCapabilitiesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// Radix Select can't hold an empty string as an item value, so filters use a
// sentinel that maps back to "no filter" at query time.
const ANY = "__any__";

/**
 * Lifecycle states that need a destructive confirmation before firing.
 * Suspend takes a capability out of service for every store at once;
 * retire is a one-way door. Everything else is a routine promotion.
 *
 * Deliberately a lookup rather than a closed union — an unknown state coming
 * back from the vocabulary is treated as non-destructive and still works.
 */
const DESTRUCTIVE_TRANSITIONS = new Set(["suspended", "retired"]);

/** Purely presentational. Unknown values fall through to a neutral badge. */
const LIFECYCLE_STYLES: Record<string, string> = {
  draft:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
  pilot:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  ga: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  deprecated:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  retired:
    "bg-zinc-200 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  suspended:
    "bg-red-600 text-white border-red-700 hover:bg-red-600 dark:bg-red-700 dark:border-red-800",
};

function lifecycleClass(state: string): string {
  return (
    LIFECYCLE_STYLES[state] ??
    "bg-muted text-muted-foreground border-border"
  );
}

/** "cross_merchant_aggregate" → "cross merchant aggregate" */
function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CapabilitiesPage() {
  const queryClient = useQueryClient();

  const [kindFilter, setKindFilter] = useState<string>(ANY);
  const [lifecycleFilter, setLifecycleFilter] = useState<string>(ANY);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CapabilityItem | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    capability: CapabilityItem;
    nextState: string;
  } | null>(null);

  // Vocabulary is server-owned and changes only on deploy — cache it for the
  // session rather than refetching alongside every list query.
  const vocabQuery = useQuery({
    queryKey: CAPABILITY_VOCAB_QUERY_KEY,
    queryFn: getCapabilityVocabulary,
    staleTime: Infinity,
  });

  const filters = useMemo(
    () => ({
      kind: kindFilter === ANY ? null : kindFilter,
      lifecycle_state: lifecycleFilter === ANY ? null : lifecycleFilter,
    }),
    [kindFilter, lifecycleFilter],
  );

  const listQuery = useQuery({
    queryKey: [...CAPABILITIES_QUERY_KEY, filters.kind, filters.lifecycle_state],
    queryFn: () => listCapabilities(filters),
    staleTime: 15_000,
  });

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: CAPABILITIES_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: (body: CapabilityCreateInput) => createCapability(body),
    onSuccess: (item) => {
      void invalidateList();
      setCreateOpen(false);
      toast.success(`Registered ${item.slug}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't register");
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({
      slug,
      body,
    }: {
      slug: string;
      body: CapabilityPatchInput;
    }) => updateCapability(slug, body),
    onSuccess: (item) => {
      void invalidateList();
      setEditing(null);
      toast.success(`Updated ${item.slug}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      slug,
      nextState,
      reason,
    }: {
      slug: string;
      nextState: string;
      reason?: string;
    }) => setCapabilityLifecycle(slug, nextState, reason),
    onSuccess: (item) => {
      void invalidateList();
      setLifecycleTarget(null);
      if (item.lifecycle_state === "suspended") {
        toast.success(`${item.slug} is suspended platform-wide`);
      } else {
        toast.success(`${item.slug} → ${item.lifecycle_state}`);
      }
    },
    onError: (err) => {
      if (is2FAError(err)) {
        toast.error(
          "Re-verify MFA before changing a lifecycle state. Confirm MFA in your profile → Security, then try again.",
        );
      } else {
        toast.error(
          err instanceof Error ? err.message : "Lifecycle change failed",
        );
      }
    },
  });

  if (listQuery.isLoading || vocabQuery.isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (listQuery.isError || vocabQuery.isError) {
    const err = listQuery.error ?? vocabQuery.error;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return (
      <DashboardLayout title="Capability registry">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Couldn't load the capability registry</CardTitle>
              <CardDescription>{msg}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void listQuery.refetch();
                  void vocabQuery.refetch();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const vocab = vocabQuery.data as CapabilityVocabulary;
  const capabilities = listQuery.data?.capabilities ?? [];
  const isFiltered = kindFilter !== ANY || lifecycleFilter !== ANY;
  const suspendedCount = capabilities.filter(
    (c) => c.lifecycle_state === "suspended",
  ).length;

  return (
    <DashboardLayout title="Capability registry">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold">Capability registry</h1>
            <p className="text-sm text-muted-foreground">
              The control plane for what may extend NUMU. Every capability an
              extension can request — dynamic sources, sections, layout
              injections, app embeds, data types, guarantees — is registered
              here with the tier allowed to hold it. A manifest is a{" "}
              <em>request</em>; this registry is what turns it into a grant.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              {listQuery.isFetching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Register capability
            </Button>
          </div>
        </div>

        {/* Kill-switch banner. If anything is suspended right now that is the
            single most important fact on the page — an operator debugging a
            missing feature should see it before they read the table. */}
        {suspendedCount > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-md border border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">
                {suspendedCount} capabilit{suspendedCount === 1 ? "y is" : "ies are"}{" "}
                suspended
              </p>
              <p className="text-xs mt-1">
                Suspension is platform-wide and takes effect at grant time —
                every extension requesting these is being denied right now.
              </p>
            </div>
          </div>
        )}

        <ManifestCheckPanel tiers={vocab.tiers} />

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Registered capabilities</CardTitle>
                <CardDescription>
                  {listQuery.data?.total ?? 0} record
                  {(listQuery.data?.total ?? 0) === 1 ? "" : "s"}
                  {isFiltered ? " matching the current filter" : ""}.
                </CardDescription>
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <FilterSelect
                  id="filter-kind"
                  label="Kind"
                  value={kindFilter}
                  options={vocab.kinds}
                  onChange={setKindFilter}
                />
                <FilterSelect
                  id="filter-lifecycle"
                  label="Lifecycle"
                  value={lifecycleFilter}
                  options={vocab.lifecycle_states}
                  onChange={setLifecycleFilter}
                />
                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setKindFilter(ANY);
                      setLifecycleFilter(ANY);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {capabilities.length === 0 ? (
              <EmptyState
                filtered={isFiltered}
                onRegister={() => setCreateOpen(true)}
                onClearFilters={() => {
                  setKindFilter(ANY);
                  setLifecycleFilter(ANY);
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Capability</TableHead>
                      <TableHead>Lifecycle</TableHead>
                      <TableHead>Required tier</TableHead>
                      <TableHead>On failure</TableHead>
                      <TableHead>Versions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capabilities.map((cap) => (
                      <CapabilityRow
                        key={cap.id}
                        capability={cap}
                        lifecycleStates={vocab.lifecycle_states}
                        onEdit={() => setEditing(cap)}
                        onLifecycle={(nextState) =>
                          setLifecycleTarget({ capability: cap, nextState })
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create ------------------------------------------------------- */}
      <CapabilityFormDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        mode="create"
        vocab={vocab}
        capability={null}
        pending={createMutation.isPending}
        onOpenChange={(open) => !open && setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
      />

      {/* Edit --------------------------------------------------------- */}
      <CapabilityFormDialog
        key={editing ? `edit-${editing.id}` : "edit-closed"}
        open={Boolean(editing)}
        mode="edit"
        vocab={vocab}
        capability={editing}
        pending={patchMutation.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={(body) => {
          if (!editing) return;
          // slug / kind / owner are immutable server-side (they're not on
          // CapabilityPatch), and lifecycle_state is deliberately ignored by
          // PATCH — it has its own 2FA-gated endpoint.
          const {
            description,
            data_classification,
            min_tier,
            unavailable_behavior,
            active_version,
            supported_versions,
            placements,
            dependencies,
          } = body;
          patchMutation.mutate({
            slug: editing.slug,
            body: {
              description,
              data_classification,
              min_tier,
              unavailable_behavior,
              active_version,
              supported_versions,
              placements,
              dependencies,
            },
          });
        }}
      />

      {/* Lifecycle confirmation --------------------------------------- */}
      <LifecycleConfirmDialog
        key={
          lifecycleTarget
            ? `${lifecycleTarget.capability.id}-${lifecycleTarget.nextState}`
            : "lifecycle-closed"
        }
        target={lifecycleTarget}
        pending={lifecycleMutation.isPending}
        onCancel={() => setLifecycleTarget(null)}
        onConfirm={(reason) => {
          if (!lifecycleTarget) return;
          lifecycleMutation.mutate({
            slug: lifecycleTarget.capability.slug,
            nextState: lifecycleTarget.nextState,
            reason,
          });
        }}
      />
    </DashboardLayout>
  );
}

/* ── Filters ──────────────────────────────────────────────────────────── */

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}

function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-47.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>
            <span className="text-muted-foreground">All {label.toLowerCase()}s</span>
          </SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {humanize(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────── */

function EmptyState({
  filtered,
  onRegister,
  onClearFilters,
}: {
  filtered: boolean;
  onRegister: () => void;
  onClearFilters: () => void;
}) {
  if (filtered) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          No capabilities match this filter.
        </p>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="py-10 max-w-2xl mx-auto text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-2">
        <p className="font-medium">Nothing is registered yet</p>
        <p className="text-sm text-muted-foreground">
          NUMU already has five capability-shaped mechanisms — dynamic sources,
          theme sections, layout injections, app embeds and metafields — each
          with its own ad-hoc control surface and no single record of what
          exists or who may hold it. This registry is that record.
        </p>
        <p className="text-sm text-muted-foreground">
          Register one capability per thing an extension can request. Each row
          declares its data classification (which sets the{" "}
          <em>minimum tier</em> that may hold it), its lifecycle state (which
          decides whether it can be granted at all), and what happens when it
          can't be served. Until a capability is registered, nothing can be
          granted it — an unknown slug in a manifest is denied, never ignored.
        </p>
      </div>
      <Button size="sm" onClick={onRegister}>
        <Plus className="h-4 w-4 mr-2" />
        Register the first capability
      </Button>
    </div>
  );
}

/* ── Table row ────────────────────────────────────────────────────────── */

interface CapabilityRowProps {
  capability: CapabilityItem;
  lifecycleStates: string[];
  onEdit: () => void;
  onLifecycle: (nextState: string) => void;
}

function CapabilityRow({
  capability: cap,
  lifecycleStates,
  onEdit,
  onLifecycle,
}: CapabilityRowProps) {
  const isSuspended = cap.lifecycle_state === "suspended";
  // The server corrected the stored tier upward because of the data
  // classification's floor. Say so — the alternative is an operator staring
  // at a denial that contradicts the min_tier column.
  const tierRaised = cap.effective_min_tier !== cap.min_tier;

  return (
    <TableRow
      className={cn(
        isSuspended && "bg-red-50/60 dark:bg-red-950/20",
        cap.lifecycle_state === "retired" && "opacity-60",
      )}
    >
      <TableCell className="align-top">
        <div className="space-y-1 min-w-55">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium">{cap.slug}</span>
            <Badge variant="outline" className="text-[10px]">
              {humanize(cap.kind)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            owner: <span className="font-mono">{cap.owner}</span>
            {" · "}
            {humanize(cap.data_classification)} data
          </p>
          {cap.description && (
            <p className="text-xs text-muted-foreground max-w-md">
              {cap.description}
            </p>
          )}
          {(cap.placements.length > 0 || cap.dependencies.length > 0) && (
            <p className="text-[11px] text-muted-foreground font-mono">
              {cap.placements.length > 0 && (
                <>placements: {cap.placements.join(", ")}</>
              )}
              {cap.placements.length > 0 && cap.dependencies.length > 0 && " · "}
              {cap.dependencies.length > 0 && (
                <>depends on: {cap.dependencies.join(", ")}</>
              )}
            </p>
          )}
        </div>
      </TableCell>

      <TableCell className="align-top">
        <div className="space-y-1.5">
          <Badge className={cn("border", lifecycleClass(cap.lifecycle_state))}>
            {isSuspended && <Ban className="h-3 w-3 mr-1" />}
            {humanize(cap.lifecycle_state)}
          </Badge>
          <p
            className={cn(
              "text-[11px] flex items-center gap-1",
              cap.grantable ? "text-emerald-600" : "text-red-600",
            )}
          >
            {cap.grantable ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> grantable
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" /> grants nothing
              </>
            )}
          </p>
        </div>
      </TableCell>

      <TableCell className="align-top">
        <div className="space-y-1">
          <Badge variant="secondary" className="font-mono text-[11px]">
            {cap.effective_min_tier}
          </Badge>
          {tierRaised && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1 max-w-55">
              <ArrowUpCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                raised from <span className="font-mono">{cap.min_tier}</span> by{" "}
                {humanize(cap.data_classification)} classification
              </span>
            </p>
          )}
        </div>
      </TableCell>

      <TableCell className="align-top">
        {cap.unavailable_behavior === "fail_closed" ? (
          <Badge className="border bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
            <AlertTriangle className="h-3 w-3 mr-1" />
            fail closed
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[11px]">
            fail open
          </Badge>
        )}
        <p className="text-[11px] text-muted-foreground mt-1 max-w-42.5">
          {cap.unavailable_behavior === "fail_closed"
            ? "Blocks the surface when unavailable — merchant's explicit risk decision."
            : "Storefront keeps rendering when unavailable."}
        </p>
      </TableCell>

      <TableCell className="align-top text-xs font-mono">
        <div>{cap.active_version ?? <span className="text-muted-foreground">—</span>}</div>
        {cap.supported_versions.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            supports {cap.supported_versions.join(", ")}
          </div>
        )}
      </TableCell>

      <TableCell className="align-top">
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <LifecyclePicker
            current={cap.lifecycle_state}
            states={lifecycleStates}
            onPick={onLifecycle}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Lifecycle transition menu. Deliberately a menu of explicit actions rather
 * than a select or a toggle — every pick opens a confirmation dialog, and
 * destructive picks get a destructive one. The current state is excluded so a
 * no-op transition can't burn a 2FA step-up.
 */
function LifecyclePicker({
  current,
  states,
  onPick,
}: {
  current: string;
  states: string[];
  onPick: (next: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Change lifecycle state">
          Lifecycle
          <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Move from {humanize(current)} to…
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {states
          .filter((s) => s !== current)
          .map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => onPick(s)}
              className={cn(
                DESTRUCTIVE_TRANSITIONS.has(s) &&
                  "text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40",
              )}
            >
              {DESTRUCTIVE_TRANSITIONS.has(s) && (
                <Ban className="h-3.5 w-3.5 mr-2" />
              )}
              {humanize(s)}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Lifecycle confirmation ───────────────────────────────────────────── */

function LifecycleConfirmDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: { capability: CapabilityItem; nextState: string } | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  if (!target) return null;

  const { capability, nextState } = target;
  const destructive = DESTRUCTIVE_TRANSITIONS.has(nextState);
  const isSuspend = nextState === "suspended";

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn("flex items-center gap-2", destructive && "text-red-600")}
          >
            {destructive && <ShieldAlert className="h-5 w-5" />}
            {isSuspend
              ? "Suspend this capability platform-wide?"
              : nextState === "retired"
                ? "Retire this capability?"
                : `Move to ${humanize(nextState)}?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-mono font-medium text-foreground">
                  {capability.slug}
                </span>{" "}
                — {humanize(capability.kind)}, owned by{" "}
                <span className="font-mono">{capability.owner}</span> — moves
                from <span className="font-mono">{capability.lifecycle_state}</span>{" "}
                to <span className="font-mono">{nextState}</span>.
              </p>
              {isSuspend && (
                <p className="text-red-600">
                  This is the kill switch. Every extension holding this
                  capability stops being granted it immediately, on every store,
                  at grant time — not on next render. Extensions declaring{" "}
                  <span className="font-mono">fail_closed</span> will block their
                  surface rather than degrade.
                </p>
              )}
              {nextState === "retired" && (
                <p className="text-red-600">
                  Retired capabilities grant nothing and are not meant to come
                  back. Suspend instead if this is temporary.
                </p>
              )}
              <p className="text-muted-foreground">
                Requires a 2FA verification completed in the last 5 minutes.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="lifecycle-reason">Reason (optional, ≤500 chars)</Label>
          <Textarea
            id="lifecycle-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isSuspend
                ? "e.g. leaking cross-merchant rows via the aggregate endpoint"
                : "Why this transition?"
            }
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              // Keep the dialog mounted while the request is in flight so the
              // pending state is visible; the mutation's onSuccess closes it.
              e.preventDefault();
              onConfirm(reason);
            }}
            className={cn(
              destructive &&
                "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
            )}
          >
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuspend ? "Suspend platform-wide" : `Move to ${humanize(nextState)}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Create / edit form ───────────────────────────────────────────────── */

interface CapabilityFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  vocab: CapabilityVocabulary;
  capability: CapabilityItem | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: CapabilityCreateInput) => void;
}

function CapabilityFormDialog({
  open,
  mode,
  vocab,
  capability,
  pending,
  onOpenChange,
  onSubmit,
}: CapabilityFormDialogProps) {
  // Remounted per open/target via `key` in the parent, so plain useState is
  // the whole "reset the form" story — no effect syncing.
  const [slug, setSlug] = useState(capability?.slug ?? "");
  const [kind, setKind] = useState(capability?.kind ?? vocab.kinds[0] ?? "");
  const [owner, setOwner] = useState(capability?.owner ?? "");
  const [description, setDescription] = useState(capability?.description ?? "");
  const [lifecycleState, setLifecycleState] = useState(
    capability?.lifecycle_state ?? vocab.lifecycle_states[0] ?? "",
  );
  const [dataClassification, setDataClassification] = useState(
    capability?.data_classification ?? "tenant_scoped",
  );
  const [minTier, setMinTier] = useState(capability?.min_tier ?? "partner");
  const [unavailableBehavior, setUnavailableBehavior] = useState(
    capability?.unavailable_behavior ?? "fail_open",
  );
  const [activeVersion, setActiveVersion] = useState(
    capability?.active_version ?? "",
  );
  const [supportedVersions, setSupportedVersions] = useState(
    (capability?.supported_versions ?? []).join(", "),
  );
  const [placements, setPlacements] = useState(
    (capability?.placements ?? []).join(", "),
  );
  const [dependencies, setDependencies] = useState(
    (capability?.dependencies ?? []).join(", "),
  );

  const canSubmit =
    mode === "edit" || (slug.trim().length > 0 && owner.trim().length > 0);

  const submit = () => {
    if (!canSubmit) {
      toast.error("Slug and owner are required");
      return;
    }
    onSubmit({
      slug: slug.trim(),
      kind,
      owner: owner.trim(),
      description: description.trim() ? description.trim() : null,
      lifecycle_state: lifecycleState,
      data_classification: dataClassification,
      min_tier: minTier,
      unavailable_behavior: unavailableBehavior,
      active_version: activeVersion.trim() ? activeVersion.trim() : null,
      supported_versions: splitList(supportedVersions),
      placements: splitList(placements),
      dependencies: splitList(dependencies),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Register a capability"
              : `Edit ${capability?.slug ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "One row per thing an extension can request. An unknown slug in a manifest is denied, never ignored."
              : "Identity (slug, kind, owner) is immutable, and the lifecycle state has its own 2FA-gated control — a general-purpose edit must not be able to flip the kill switch."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cap-slug">Slug</Label>
              <Input
                id="cap-slug"
                value={slug}
                disabled={mode === "edit"}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="trust.risk_score"
                className="font-mono text-sm"
                maxLength={128}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-owner">Owner</Label>
              <Input
                id="cap-owner"
                value={owner}
                disabled={mode === "edit"}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="platform-risk"
                className="font-mono text-sm"
                maxLength={128}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VocabSelect
              id="cap-kind"
              label="Kind"
              value={kind}
              options={vocab.kinds}
              disabled={mode === "edit"}
              onChange={setKind}
            />
            <VocabSelect
              id="cap-lifecycle"
              label="Lifecycle state"
              value={lifecycleState}
              options={vocab.lifecycle_states}
              disabled={mode === "edit"}
              onChange={setLifecycleState}
              help={
                mode === "edit"
                  ? "Change this from the row's lifecycle control (2FA-gated)."
                  : "draft registers the record without granting anything."
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cap-description">Description</Label>
            <Textarea
              id="cap-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this capability exposes, in one line."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VocabSelect
              id="cap-classification"
              label="Data classification"
              value={dataClassification}
              options={vocab.data_classifications}
              onChange={setDataClassification}
            />
            <VocabSelect
              id="cap-min-tier"
              label="Minimum tier"
              value={minTier}
              options={vocab.tiers}
              onChange={setMinTier}
            />
          </div>

          {/* Live preview of the floor rule so the operator sees the override
              BEFORE saving, not as a surprise in the table afterwards. */}
          <TierFloorHint
            classification={dataClassification}
            minTier={minTier}
            tiers={vocab.tiers}
          />

          <VocabSelect
            id="cap-unavailable"
            label="When unavailable"
            value={unavailableBehavior}
            options={vocab.unavailable_behaviors}
            onChange={setUnavailableBehavior}
            help="fail_open keeps the storefront up when the capability can't be served. fail_closed blocks the surface — only where proceeding without it is worse."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cap-active-version">Active version</Label>
              <Input
                id="cap-active-version"
                value={activeVersion}
                onChange={(e) => setActiveVersion(e.target.value)}
                placeholder="1.0.0"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-supported">Supported versions</Label>
              <Input
                id="cap-supported"
                value={supportedVersions}
                onChange={(e) => setSupportedVersions(e.target.value)}
                placeholder="1.0.0, 0.9.0"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cap-placements">Placements</Label>
              <Input
                id="cap-placements"
                value={placements}
                onChange={(e) => setPlacements(e.target.value)}
                placeholder="product, cart, checkout"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-dependencies">Dependencies</Label>
              <Input
                id="cap-dependencies"
                value={dependencies}
                onChange={(e) => setDependencies(e.target.value)}
                placeholder="other.capability.slug"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Comma- or newline-separated lists.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !canSubmit}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Register" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface VocabSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
  disabled?: boolean;
  help?: string;
}

function VocabSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  help,
}: VocabSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}…`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {humanize(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}

/**
 * Mirrors the server's `_CLASSIFICATION_FLOOR` for *preview only*. The server
 * remains the authority — this never changes what gets sent, it only warns
 * the operator that the value they picked will be raised. Tier ordering comes
 * from the vocabulary array (the backend serves it in rank order), so this
 * doesn't hardcode a ranking either.
 */
const CLASSIFICATION_FLOOR: Record<string, string> = {
  public: "partner",
  tenant_scoped: "partner",
  tenant_private: "verified",
  cross_merchant_aggregate: "first_party",
};

function TierFloorHint({
  classification,
  minTier,
  tiers,
}: {
  classification: string;
  minTier: string;
  tiers: string[];
}) {
  const floor = CLASSIFICATION_FLOOR[classification];
  if (!floor) return null;

  const rank = (t: string) => tiers.indexOf(t);
  const raised = rank(minTier) < rank(floor);
  if (!raised) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900">
      <ArrowUpCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-xs">
        <p className="font-medium">
          Effective tier will be raised to{" "}
          <span className="font-mono">{floor}</span>
        </p>
        <p className="mt-1">
          <span className="font-mono">{humanize(classification)}</span> data
          imposes a floor above <span className="font-mono">{minTier}</span>. The
          server stores what you pick but grants against the floor — the table
          will show both.
        </p>
      </div>
    </div>
  );
}

/* ── Manifest check ───────────────────────────────────────────────────── */

/**
 * Dry-run panel. The point of this is the DENIAL REASONS: "would this
 * extension be allowed, and if not exactly why" without installing anything.
 * Granted slugs are a chip list; denials get the full server-authored reason
 * verbatim, because that string names the required tier, the classification
 * behind it, and the requester's tier.
 */
function ManifestCheckPanel({ tiers }: { tiers: string[] }) {
  const [tier, setTier] = useState(tiers[0] ?? "partner");
  const [slugsRaw, setSlugsRaw] = useState("");
  const [result, setResult] = useState<GrantCheckResponse | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      checkGrant({ tier, requested_slugs: splitList(slugsRaw) }),
    onSuccess: setResult,
    onError: (err) => {
      setResult(null);
      toast.error(err instanceof Error ? err.message : "Check failed");
    },
  });

  const slugCount = splitList(slugsRaw).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check a manifest</CardTitle>
        <CardDescription>
          Dry-run an extension's requested capabilities against the live
          registry. Nothing is installed or changed. A single denial fails the
          whole manifest — a partially-granted extension would behave
          incorrectly rather than fail loudly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <VocabSelect
            id="check-tier"
            label="Requesting tier"
            value={tier}
            options={tiers}
            onChange={(next) => {
              setTier(next);
              setResult(null);
            }}
          />
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="check-slugs">Requested capability slugs</Label>
            <Textarea
              id="check-slugs"
              rows={3}
              value={slugsRaw}
              onChange={(e) => {
                setSlugsRaw(e.target.value);
                setResult(null);
              }}
              placeholder={"trust.risk_score\ncatalog.products\nsection.hero"}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Comma- or newline-separated. {slugCount} slug
              {slugCount === 1 ? "" : "s"} to check.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || slugCount === 0}
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Check
          </Button>
        </div>

        {result && (
          <div className="space-y-3 pt-2 border-t">
            <div
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                result.ok ? "text-emerald-600" : "text-red-600",
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {result.ok
                ? `Manifest would be granted at tier ${result.tier}`
                : `Manifest would be REJECTED at tier ${result.tier}`}
            </div>

            {result.granted.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Granted ({result.granted.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.granted.map((slug) => (
                    <Badge
                      key={slug}
                      className="border bg-emerald-100 text-emerald-700 border-emerald-200 font-mono text-[11px] dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900"
                    >
                      {slug}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.denied.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Denied ({result.denied.length})
                </p>
                <div className="space-y-2">
                  {result.denied.map((d) => (
                    <div
                      key={d.capability_slug}
                      className="flex items-start gap-2 p-2.5 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900"
                    >
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-medium">
                          {d.capability_slug}
                        </p>
                        <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">
                          {d.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
