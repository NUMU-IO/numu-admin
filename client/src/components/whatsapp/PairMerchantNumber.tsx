/**
 * Pair a merchant's own WhatsApp number from the WhatsApp page.
 *
 * The same thing can be done from each approved merchant's card below, but
 * that only helps when the merchant already has an access request in the list.
 * This panel is for the ordinary support case: someone is on the phone, and the
 * operator wants to pair them without hunting for their row first.
 *
 * The flow is dictated by WhatsApp, not by us: a pairing code is issued for one
 * specific number and expires within minutes, so it cannot be prepared in
 * advance or emailed. Type the number, generate, read it out.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type PairResult,
  pairGowaDevice,
  setWhatsAppProvider,
} from "@/services/whatsappGowaApi";

export function PairMerchantNumber({
  stores,
}: {
  /** Approved stores, so the operator picks rather than pastes a UUID. */
  stores: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [phone, setPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pairing, setPairing] = useState<PairResult | null>(null);
  const [copied, setCopied] = useState(false);

  const pair = useMutation({
    mutationFn: async () => {
      // A store still on Meta would pair a device it never uses, so switch the
      // transport first — pairing is only meaningful once GOWA is selected.
      await setWhatsAppProvider(storeId, "gowa", acknowledged);
      return pairGowaDevice(storeId, phone, "code", acknowledged);
    },
    onSuccess: (r) => {
      setPairing(r);
      queryClient.invalidateQueries({ queryKey: ["gowa-devices"] });
      queryClient.invalidateQueries({ queryKey: ["gowa-status", storeId] });
    },
    onError: (e: Error) =>
      toast.error("Pairing failed", { description: e.message }),
  });

  const copyCode = async () => {
    if (!pairing?.pair_code) return;
    await navigator.clipboard.writeText(pairing.pair_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ready = storeId && phone && acknowledged;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Pair a merchant&rsquo;s own number
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pair-store" className="text-sm">
              Merchant
            </Label>
            <select
              id="pair-store"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">Select a store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pair-phone" className="text-sm">
              Their WhatsApp number
            </Label>
            <Input
              id="pair-phone"
              className="h-9"
              placeholder="+20 100 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex items-center gap-2">
            <Checkbox
              id="pair-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor="pair-ack" className="text-xs font-normal">
              This switches the merchant to GOWA. WhatsApp can ban the number
              they give us — the one their customers already have. They accept
              this.
            </Label>
          </div>
        </div>

        <Button onClick={() => pair.mutate()} disabled={!ready || pair.isPending}>
          {pair.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Generate pairing code
        </Button>

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
            <p className="mt-2 text-xs text-muted-foreground">
              Expires in a couple of minutes. Watch Device health above for it to
              turn Healthy.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PairMerchantNumber;
