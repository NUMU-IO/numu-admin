/**
 * Every WhatsApp session the GOWA server is holding, and how healthy each is.
 *
 * A session dying is the normal failure mode of this transport — WhatsApp can
 * log a linked device out at any time, and a ban presents identically. So the
 * fleet's health needs to be visible in one place rather than discovered when a
 * merchant reports that messages stopped.
 *
 * Sessions are shown even when nothing here has claimed them: a number linked
 * directly against GOWA during setup is invisible to the rest of the product
 * until it is adopted, and that gap is exactly where a "why isn't this working"
 * hour goes.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type GowaDeviceListItem,
  adoptPlatformDevice,
  listGowaDevices,
} from "@/services/whatsappGowaApi";

function HealthBadge({ state }: { state?: string | null }) {
  if (state === "logged_in") {
    return <Badge className="bg-green-600 hover:bg-green-700">Healthy</Badge>;
  }
  if (state === "logged_out") {
    // The one that matters operationally: a ban looks exactly like this.
    return <Badge variant="destructive">Logged out</Badge>;
  }
  return <Badge variant="secondary">{state || "Unknown"}</Badge>;
}

function OwnerBadge({ device }: { device: GowaDeviceListItem }) {
  if (device.is_platform) {
    return <Badge className="bg-blue-600 hover:bg-blue-700">Platform</Badge>;
  }
  if (device.claimed_by_store_id) {
    return <Badge variant="outline">Merchant</Badge>;
  }
  return (
    <Badge variant="secondary" title="Linked on the server but not claimed here">
      Unclaimed
    </Badge>
  );
}

export function DeviceHealthTable() {
  const queryClient = useQueryClient();
  const devicesQuery = useQuery({
    queryKey: ["gowa-devices"],
    queryFn: listGowaDevices,
    refetchInterval: 30000,
    retry: false,
  });

  const adopt = useMutation({
    mutationFn: adoptPlatformDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gowa-devices"] });
      queryClient.invalidateQueries({ queryKey: ["gowa-platform-status"] });
      toast.success("Adopted as the platform device");
    },
    onError: (e: Error) => toast.error("Could not adopt", { description: e.message }),
  });

  const devices = devicesQuery.data ?? [];
  const healthy = devices.filter((d) => d.state === "logged_in").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">
          Device health{" "}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {healthy}/{devices.length} healthy
          </span>
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh devices"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["gowa-devices"] })
          }
        >
          <RefreshCw
            className={`h-4 w-4 ${devicesQuery.isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </CardHeader>

      <CardContent>
        {devicesQuery.isError && (
          <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">
            Could not reach the GOWA server:{" "}
            {(devicesQuery.error as Error)?.message ?? "request failed"}
          </p>
        )}

        {!devicesQuery.isError && devices.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {devicesQuery.isLoading
              ? "Loading…"
              : "No sessions on the GOWA server yet."}
          </p>
        )}

        <div className="space-y-2">
          {devices.map((d) => (
            <div
              key={d.device_id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {d.phone ?? "Not logged in"}
                    <OwnerBadge device={d} />
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {d.device_id}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HealthBadge state={d.state} />
                {!d.is_platform &&
                  !d.claimed_by_store_id &&
                  d.state === "logged_in" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adopt.mutate(d.device_id)}
                      disabled={adopt.isPending}
                    >
                      <Link2 className="mr-1.5 h-3.5 w-3.5" />
                      Use as platform
                    </Button>
                  )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default DeviceHealthTable;
