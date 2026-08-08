/**
 * Transport assignment for one merchant.
 *
 * Three real choices, which map onto two backend concepts:
 *
 *   Meta Cloud            → provider = meta_cloud
 *   GOWA · platform no.   → provider = gowa, no store-level device
 *   GOWA · their own no.  → provider = gowa + a device paired to this store
 *
 * The resolver tries the store's own device first and falls back to the shared
 * platform device, so "platform vs own" is simply whether a store-level device
 * exists — there is no third setting to keep in sync.
 *
 * `/status` reports only store-level devices, which is what makes the current
 * mode readable: `provider: gowa` with `paired: false` means this store is
 * riding the platform number.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type PairResult,
  getGowaStatus,
  pairGowaDevice,
  setWhatsAppProvider,
  unpairGowaDevice,
} from "@/services/whatsappGowaApi";

type Mode = "meta" | "gowa_platform" | "gowa_own";

const MODE_LABEL: Record<Mode, string> = {
  meta: "Meta Cloud",
  gowa_platform: "GOWA · platform number",
  gowa_own: "GOWA · their own number",
};

export function TransportAssignment({
  storeId,
  storeName,
}: {
  storeId: string;
  storeName?: string | null;
}) {
  const queryClient = useQueryClient();
  const [acknowledged, setAcknowledged] = useState(false);
  const [phone, setPhone] = useState("");
  const [pairing, setPairing] = useState<PairResult | null>(null);
  const [copied, setCopied] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["gowa-status", storeId],
    queryFn: () => getGowaStatus(storeId),
    // Poll fast while a code is outstanding, slowly otherwise — never `false`.
    // With no polling the card rendered once on mount and then only moved if an
    // invalidation landed, so a successful switch could sit there still showing
    // the old transport. Self-correcting beats relying on one cache event.
    refetchInterval: pairing ? 3000 : 15000,
    refetchOnWindowFocus: true,
    // Treat cached status as immediately stale: this drives a decision about
    // which number a merchant sends from, so showing a stale value is worse
    // than a refetch.
    staleTime: 0,
  });
  const status = statusQuery.data;

  const current: Mode = !status
    ? "meta"
    : status.provider !== "gowa"
      ? "meta"
      : status.paired
        ? "gowa_own"
        : "gowa_platform";

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["gowa-status", storeId] });

  const setMode = useMutation({
    mutationFn: async (mode: Mode) => {
      if (mode === "meta") {
        // Retire any store device first: leaving it active would silently make
        // the store "own number" again the moment someone flips back to GOWA.
        if (status?.paired) await unpairGowaDevice(storeId);
        await setWhatsAppProvider(storeId, "meta_cloud", true);
        return;
      }
      await setWhatsAppProvider(storeId, "gowa", acknowledged);
      // Moving to the platform number means giving up the store's own device;
      // the resolver then falls through to the shared one.
      if (mode === "gowa_platform" && status?.paired) {
        await unpairGowaDevice(storeId);
      }
    },
    onSuccess: async (_d, mode) => {
      setPairing(null);
      // Await the refetch: the toast should not claim success while the card is
      // still displaying the previous transport.
      await statusQuery.refetch();
      invalidate();
      toast.success(`${storeName ?? "Store"} → ${MODE_LABEL[mode]}`);
    },
    onError: (e: Error) => toast.error("Could not assign", { description: e.message }),
  });

  const pair = useMutation({
    mutationFn: () => pairGowaDevice(storeId, phone, "code", acknowledged),
    onSuccess: (r) => {
      setPairing(r);
      invalidate();
    },
    onError: (e: Error) => toast.error("Pairing failed", { description: e.message }),
  });

  const copyCode = async () => {
    if (!pairing?.pair_code) return;
    await navigator.clipboard.writeText(pairing.pair_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const needsAck = current === "meta";

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Transport</span>
        {(["meta", "gowa_platform", "gowa_own"] as Mode[]).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={current === m ? "default" : "outline"}
            disabled={
              setMode.isPending ||
              current === m ||
              // Both GOWA modes put a real account at risk of a ban.
              (m !== "meta" && needsAck && !acknowledged)
            }
            onClick={() =>
              m === "gowa_own" && !status?.paired
                ? setMode.mutate("gowa_own")
                : setMode.mutate(m)
            }
          >
            {MODE_LABEL[m]}
          </Button>
        ))}
        {status?.paired && (
          <Badge variant={status.is_logged_in ? "default" : "destructive"}>
            {status.is_logged_in ? "Connected" : (status.status ?? "Not connected")}
          </Badge>
        )}
      </div>

      {needsAck && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <div className="flex items-center gap-2">
            <Checkbox
              id={`ack-${storeId}`}
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor={`ack-${storeId}`} className="text-xs font-normal">
              GOWA is unofficial — WhatsApp can ban the sending number. The merchant
              accepts this.
            </Label>
          </div>
        </div>
      )}

      {/* Their own number needs a live pairing; the platform number does not. */}
      {current === "gowa_own" && !status?.is_logged_in && (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`phone-${storeId}`} className="text-xs">
                Merchant&rsquo;s WhatsApp number
              </Label>
              <Input
                id={`phone-${storeId}`}
                className="h-8"
                placeholder="+20 100 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => pair.mutate()}
              disabled={pair.isPending || !phone}
            >
              {pair.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Generate code
            </Button>
          </div>

          {pairing?.pair_code && (
            <div className="rounded border border-emerald-300/60 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <code className="rounded bg-background px-2 py-1 font-mono text-lg tracking-[0.2em]">
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
              <p className="mt-2 text-xs text-muted-foreground">
                WhatsApp → Linked devices → Link a device → &ldquo;Link with phone
                number instead&rdquo;. Expires in a couple of minutes.
              </p>
            </div>
          )}
        </div>
      )}

      {current === "gowa_own" && status?.paired && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Sending from {status.phone ?? "their number"}
            {status.last_error && (
              <span className="ml-2 text-destructive">{status.last_error}</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unpairGowaDevice(storeId).then(invalidate)}
          >
            <Unlink className="mr-1 h-3 w-3" />
            Unpair
          </Button>
        </div>
      )}

      {current === "gowa_platform" && (
        <p className="text-xs text-muted-foreground">
          Sending from the shared NUMU number. Nothing to pair.
        </p>
      )}
    </div>
  );
}

export default TransportAssignment;
