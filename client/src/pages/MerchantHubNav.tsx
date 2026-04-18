/**
 * Merchant Hub Nav — platform admin page.
 *
 * Lets super-admins hide/show, mark "coming soon", or reorder each tab in
 * the merchant hub sidebar. Writes go to platform_config.merchant_hub_nav
 * and are read on first paint by the merchant hub.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import {
  getMerchantHubNav,
  updateMerchantHubNav,
  TAB_LABELS,
  DEFAULT_TABS,
  type MerchantHubNavTab,
} from "@/services/merchantHubNavApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function MerchantHubNav() {
  const { user, loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tabs, setTabs] = useState<MerchantHubNavTab[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-merchant-hub-nav"],
    queryFn: getMerchantHubNav,
    enabled: isAuthenticated,
    retry: 0,
  });

  // Seed the table from whichever source we have:
  //   - Live data once the fetch succeeds.
  //   - The hardcoded DEFAULT_TABS once the fetch has failed (so the page is
  //     usable before the backend endpoint is deployed).
  useEffect(() => {
    if (data?.tabs && data.tabs.length > 0) {
      setTabs([...data.tabs].sort((a, b) => a.order - b.order));
      setDirty(false);
    } else if (error) {
      setTabs([...DEFAULT_TABS]);
      setDirty(false);
    }
  }, [data, error]);

  const save = useMutation({
    mutationFn: () => updateMerchantHubNav({ tabs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-merchant-hub-nav"] });
      toast.success("Merchant hub nav updated");
      setDirty(false);
    },
    onError: (err) => toast.error((err as Error).message || "Failed to save"),
  });

  if (loading || isLoading) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
    }
    return <DashboardLayoutSkeleton />;
  }

  const move = (idx: number, delta: -1 | 1) => {
    const next = idx + delta;
    if (next < 0 || next >= tabs.length) return;
    const copy = [...tabs];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    // Rewrite .order so it persists across reloads.
    copy.forEach((t, i) => (t.order = i));
    setTabs(copy);
    setDirty(true);
  };

  const toggle = (idx: number, field: "visible" | "coming_soon") => {
    const copy = [...tabs];
    copy[idx] = { ...copy[idx], [field]: !copy[idx][field] };
    setTabs(copy);
    setDirty(true);
  };

  return (
    <DashboardLayout
      title="Merchant Hub Nav"
      subtitle="Control which tabs show up in the merchant hub sidebar, mark upcoming ones as 'Coming Soon', or reorder them."
    >
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-medium">{user?.email}</span>.
            </p>
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>

        {error ? (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-amber-900 text-base">
                Backend endpoint missing
              </CardTitle>
              <CardDescription className="text-amber-900/80">
                GET /admin/merchant-hub-nav failed ({(error as Error).message}).
                Showing defaults from the client-side registry so you can still
                edit. Save will retry the PUT — deploy the NUMU-api branch that
                adds the endpoint and refresh.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Retry fetch
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Tabs</CardTitle>
            <CardDescription>
              Changes take effect the next time a merchant loads the hub.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Tab</TableHead>
                  <TableHead className="w-28">Visible</TableHead>
                  <TableHead className="w-32">Coming soon</TableHead>
                  <TableHead className="w-24 text-right">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabs.map((t, idx) => {
                  const label = TAB_LABELS[t.key];
                  return (
                    <TableRow key={t.key}>
                      <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{label?.en ?? t.key}</div>
                        <div className="text-[11px] text-muted-foreground">
                          key: <code className="font-mono">{t.key}</code>
                          {label?.ar ? <span className="ms-2">· {label.ar}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={t.visible}
                          onCheckedChange={() => toggle(idx, "visible")}
                          aria-label={`Toggle visibility for ${t.key}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={t.coming_soon}
                            onCheckedChange={() => toggle(idx, "coming_soon")}
                            aria-label={`Toggle coming-soon for ${t.key}`}
                          />
                          {t.coming_soon && (
                            <Badge variant="secondary" className="text-[10px]">
                              Coming soon
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => move(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => move(idx, 1)}
                            disabled={idx === tabs.length - 1}
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
