/**
 * The shared NUMU number — health, and which GOWA session backs it.
 *
 * Sits at the top of the WhatsApp page because it is the sending identity for
 * every merchant assigned to "GOWA · platform number". If this session is
 * logged out, all of them stop sending at once, so its state belongs above the
 * queue rather than buried on a separate screen.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adoptPlatformDevice,
  getPlatformStatus,
  listGowaDevices,
} from "@/services/whatsappGowaApi";

export function PlatformDeviceCard() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["gowa-platform-status"],
    queryFn: getPlatformStatus,
    refetchInterval: 30000,
    retry: false,
  });
  const devicesQuery = useQuery({
    queryKey: ["gowa-devices"],
    queryFn: listGowaDevices,
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["gowa-platform-status"] });
    queryClient.invalidateQueries({ queryKey: ["gowa-devices"] });
  };

  const adopt = useMutation({
    mutationFn: adoptPlatformDevice,
    onSuccess: () => {
      refresh();
      toast.success("Adopted as the platform device");
    },
    onError: (e: Error) => toast.error("Could not adopt", { description: e.message }),
  });

  const status = statusQuery.data;
  // Sessions live on the GOWA server that nothing here has claimed yet — the
  // usual case right after a number is linked directly during setup.
  const unclaimed = (devicesQuery.data ?? []).filter(
    (d) => !d.is_platform && !d.claimed_by_store_id && d.state === "logged_in",
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">
          Platform number (shared)
        </CardTitle>
        <div className="flex items-center gap-2">
          {status?.paired ? (
            status.is_logged_in ? (
              <Badge className="bg-green-600 hover:bg-green-700">Connected</Badge>
            ) : (
              <Badge variant="destructive">
                {status.status ?? "Not connected"}
              </Badge>
            )
          ) : (
            <Badge variant="outline">Not set</Badge>
          )}
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh">
            <RefreshCw
              className={`h-4 w-4 ${statusQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {status?.paired ? (
          <>
            <div className="font-medium">
              {status.phone ?? "Number not reported yet"}
            </div>
            {status.last_seen_at && (
              <p className="text-xs text-muted-foreground">
                Last seen {new Date(status.last_seen_at).toLocaleString()}
              </p>
            )}
            {/* A ban and an ordinary disconnect both surface as logged_out —
                this text is the only thing that separates them. */}
            {status.last_error && (
              <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                {status.last_error}
              </p>
            )}
          </>
        ) : statusQuery.isError ? (
          /* A failed lookup used to render exactly like "no device set", so a
             broken request was indistinguishable from a genuine empty state —
             which is precisely the case where the operator needs to know. */
          <p className="rounded bg-destructive/10 p-2 text-destructive">
            Could not load the platform device:{" "}
            {(statusQuery.error as Error)?.message ?? "request failed"}
          </p>
        ) : statusQuery.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <p className="text-muted-foreground">
            No platform device set — merchants assigned to the platform number
            cannot send.
          </p>
        )}

        {devicesQuery.isError && (
          <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
            Could not list GOWA sessions:{" "}
            {(devicesQuery.error as Error)?.message ?? "request failed"}
          </p>
        )}

        {unclaimed.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium">Linked sessions not yet claimed</p>
            {unclaimed.map((d) => (
              <div key={d.device_id} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{d.phone}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {d.device_id}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => adopt.mutate(d.device_id)}
                  disabled={adopt.isPending}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Use as platform
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            A ban on this number stops WhatsApp for <strong>every</strong> merchant
            on the shared path — not just one. Keep marketing off it.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlatformDeviceCard;
