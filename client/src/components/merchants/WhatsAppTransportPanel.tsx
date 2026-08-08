/**
 * WhatsApp transport panel for a single merchant.
 *
 * Two jobs: choose whether this store sends through Meta Cloud or GOWA, and —
 * for GOWA — link the WhatsApp account it sends as.
 *
 * ## Why the flow looks like this
 *
 * WhatsApp issues a pairing code for a SPECIFIC number and expires it within
 * minutes, so it cannot be generated ahead of time or emailed. The panel is
 * therefore built for one situation: the operator has the merchant on a call,
 * types their number, hits generate, and reads the code out. Status polls on
 * its own so nobody has to refresh to find out whether it worked.
 *
 * The risk checkbox is not decoration. GOWA links a real WhatsApp account and
 * sends automated traffic from it, which is what WhatsApp bans numbers for —
 * and for a BYO merchant that is the number their customers know. The backend
 * refuses both the switch and the pairing without it, and records who accepted.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Smartphone,
  Unlink,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  type GowaDeviceStatus,
  type PairResult,
  type WhatsAppProvider,
  getGowaStatus,
  pairGowaDevice,
  setWhatsAppProvider,
  unpairGowaDevice,
} from "@/services/whatsappGowaApi";

interface Props {
  storeId: string;
  storeName?: string;
}

/** Poll fast while a code is outstanding — the operator is watching it live. */
const POLL_WHILE_PAIRING_MS = 3000;
const POLL_IDLE_MS = 30000;

function StatusBadge({ status }: { status: GowaDeviceStatus }) {
  if (!status.paired) {
    return <Badge variant="outline">Not paired</Badge>;
  }
  if (status.is_logged_in) {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Connected</Badge>;
  }
  if (status.status === "logged_out") {
    return <Badge variant="destructive">Logged out</Badge>;
  }
  if (status.status === "pending") {
    return <Badge variant="secondary">Waiting for scan…</Badge>;
  }
  return <Badge variant="secondary">{status.status ?? "Unknown"}</Badge>;
}

export function WhatsAppTransportPanel({ storeId, storeName }: Props) {
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pairing, setPairing] = useState<PairResult | null>(null);
  const [copied, setCopied] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["gowa-status", storeId],
    queryFn: () => getGowaStatus(storeId),
    // Poll quickly while a code is outstanding so "Connected" appears by
    // itself — the operator is on the phone and shouldn't have to refresh.
    refetchInterval: pairing ? POLL_WHILE_PAIRING_MS : POLL_IDLE_MS,
  });

  const status = statusQuery.data;
  const isGowa = status?.provider === "gowa";

  // Once the session is live the code is spent; clearing it returns the panel
  // to its resting state rather than leaving a dead code on screen.
  useEffect(() => {
    if (pairing && status?.is_logged_in) {
      setPairing(null);
      toast.success("Device connected", {
        description: `${storeName ?? "This store"} is now linked and can send.`,
      });
    }
  }, [pairing, status?.is_logged_in, storeName]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["gowa-status", storeId] });

  const providerMutation = useMutation({
    mutationFn: (provider: WhatsAppProvider) =>
      setWhatsAppProvider(storeId, provider, acknowledged),
    onSuccess: (_d, provider) => {
      invalidate();
      toast.success("Transport updated", {
        description:
          provider === "gowa"
            ? "Now sending via GOWA. Pair a number below before any messages go out."
            : "Back on Meta Cloud.",
      });
    },
    onError: (e: Error) =>
      toast.error("Could not switch", { description: e.message }),
  });

  const pairMutation = useMutation({
    mutationFn: () => pairGowaDevice(storeId, phone, "code", acknowledged),
    onSuccess: (result) => {
      setPairing(result);
      invalidate();
    },
    onError: (e: Error) =>
      toast.error("Pairing failed", { description: e.message }),
  });

  const unpairMutation = useMutation({
    mutationFn: () => unpairGowaDevice(storeId),
    onSuccess: () => {
      setPairing(null);
      invalidate();
      toast.success("Unpaired", { description: "The number is no longer linked." });
    },
    onError: (e: Error) =>
      toast.error("Could not unpair", { description: e.message }),
  });

  const copyCode = async () => {
    if (!pairing?.pair_code) return;
    await navigator.clipboard.writeText(pairing.pair_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">WhatsApp transport</CardTitle>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
            aria-label="Refresh status"
          >
            <RefreshCw
              className={`h-4 w-4 ${statusQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── transport choice ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Button
            variant={!isGowa ? "default" : "outline"}
            size="sm"
            onClick={() => providerMutation.mutate("meta_cloud")}
            disabled={providerMutation.isPending || !isGowa}
          >
            Meta Cloud
          </Button>
          <Button
            variant={isGowa ? "default" : "outline"}
            size="sm"
            onClick={() => providerMutation.mutate("gowa")}
            disabled={providerMutation.isPending || isGowa || !acknowledged}
          >
            GOWA
          </Button>
          <span className="text-xs text-muted-foreground">
            {isGowa
              ? "Sending from a linked WhatsApp account."
              : "Sending through the official Business API."}
          </span>
        </div>

        {/* ── risk acknowledgement ─────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">
              GOWA is <strong>unofficial</strong>. It links this merchant&rsquo;s own
              WhatsApp account as a device and sends automated messages from it.
              WhatsApp can ban that number — the same number their customers already
              have. Only switch a merchant who has agreed to that.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gowa-risk"
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v === true)}
              />
              <Label htmlFor="gowa-risk" className="text-sm font-normal">
                The merchant understands and accepts the ban risk
              </Label>
            </div>
          </div>
        </div>

        {/* ── paired device ────────────────────────────────────────────── */}
        {status?.paired && (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {status.phone ?? "Number not reported yet"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => unpairMutation.mutate()}
                disabled={unpairMutation.isPending}
              >
                <Unlink className="mr-1.5 h-3.5 w-3.5" />
                Unpair
              </Button>
            </div>
            {status.last_seen_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last seen {new Date(status.last_seen_at).toLocaleString()}
              </p>
            )}
            {/* A ban and an ordinary disconnect both land as logged_out — this
                text is the only thing that tells them apart, so it is shown
                verbatim rather than summarised. */}
            {status.last_error && (
              <p className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                {status.last_error}
              </p>
            )}
          </div>
        )}

        {/* ── pairing ──────────────────────────────────────────────────── */}
        {isGowa && !status?.is_logged_in && (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="gowa-phone" className="text-sm">
                  Merchant&rsquo;s WhatsApp number
                </Label>
                <Input
                  id="gowa-phone"
                  placeholder="+20 100 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button
                onClick={() => pairMutation.mutate()}
                disabled={pairMutation.isPending || !phone || !acknowledged}
              >
                {pairMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Generate code
              </Button>
            </div>

            {pairing?.pair_code && (
              <div className="rounded-md border border-emerald-300/60 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30">
                <p className="text-sm font-medium">Read this to the merchant now</p>
                <div className="mt-2 flex items-center gap-3">
                  <code className="rounded bg-background px-3 py-2 font-mono text-2xl tracking-[0.2em]">
                    {pairing.pair_code}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <ol className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  <li>1. WhatsApp → Settings → Linked devices</li>
                  <li>2. Link a device → &ldquo;Link with phone number instead&rdquo;</li>
                  <li>3. Enter the code above</li>
                </ol>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Waiting for the merchant to link… this expires in a couple of
                  minutes.
                </p>
              </div>
            )}
          </div>
        )}

        {isGowa && !status?.paired && !pairing && (
          <p className="text-xs text-muted-foreground">
            This store is set to GOWA but has no linked number, so nothing can be
            sent. Pair a number above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default WhatsAppTransportPanel;
