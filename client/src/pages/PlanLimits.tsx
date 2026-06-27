/**
 * Plan Limits Editor — NUMU Admin Dashboard
 *
 * Controls the actual backend plan features, limits, and pricing.
 * Changes take effect immediately (hot-patched) and persist across restarts.
 */

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { getLoginUrl } from "@/const";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPlanLimits,
  updatePlanLimits,
  type PlanLimitsItem,
} from "@/services/planLimitsService";
import { Save, Shield, Sliders } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const planColors: Record<string, string> = {
  demo: "bg-gray-100 text-gray-700",
  trial: "bg-amber-100 text-amber-700",
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  enterprise: "bg-indigo-100 text-indigo-700",
};

function formatEGP(piasters: number): string {
  if (piasters === -1) return "Custom";
  if (piasters === 0) return "Free";
  return `EGP ${(piasters / 100).toLocaleString()}`;
}

function formatLimit(val: number): string {
  return val === -1 ? "Unlimited" : val.toLocaleString();
}

export default function PlanLimits() {
  const { loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["planLimits"],
    queryFn: getPlanLimits,
    enabled: isAuthenticated,
  });

  const mutation = useMutation({ mutationFn: updatePlanLimits });

  const [plans, setPlans] = useState<PlanLimitsItem[] | null>(null);

  useEffect(() => {
    if (query.data && plans === null) {
      setPlans(query.data.plans);
    }
  }, [query.data, plans]);

  const hasChanges = useMemo(() => {
    if (!plans || !query.data) return false;
    return JSON.stringify(plans) !== JSON.stringify(query.data.plans);
  }, [plans, query.data]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) {
    const url = getLoginUrl();
    if (url) {
      window.location.href = url;
      return <DashboardLayoutSkeleton />;
    }
  }

  const handleSave = async () => {
    if (!plans) return;
    try {
      const result = await mutation.mutateAsync(plans);
      setPlans(result.plans);
      await queryClient.invalidateQueries({ queryKey: ["planLimits"] });
      toast.success("Plan limits saved — changes are live immediately.");
    } catch {
      toast.error("Failed to save plan limits.");
    }
  };

  const updatePlan = (idx: number, patch: Partial<PlanLimitsItem>) => {
    setPlans(
      (prev) =>
        prev?.map((p, i) => (i === idx ? { ...p, ...patch } : p)) ?? null,
    );
  };

  return (
    <DashboardLayout
      title="Plan Limits & Pricing"
      subtitle="Control features, limits, and pricing for each subscription plan. Changes are live immediately."
    >
      <div className="space-y-6">
        {/* Save bar */}
        {hasChanges && (
          <div className="sticky top-0 z-10 bg-background border border-border py-3 px-4 flex items-center justify-between rounded-lg shadow-sm">
            <span className="text-sm text-muted-foreground">
              You have unsaved changes
            </span>
            <Button
              onClick={handleSave}
              disabled={mutation.isPending}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        )}

        {/* Plan cards */}
        {(plans ?? []).map((plan, idx) => (
          <Card key={plan.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {plan.display_name}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={planColors[plan.key] ?? "bg-gray-100"}>
                    {plan.key}
                  </Badge>
                  <Badge variant="outline">
                    {formatEGP(plan.monthly_price_piasters)}/mo
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Monthly: {formatEGP(plan.monthly_price_piasters)} | Annual:{" "}
                {formatEGP(plan.annual_price_piasters)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pricing */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4" /> Pricing (in piasters — 100
                  piasters = 1 EGP)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Monthly (piasters)</Label>
                    <Input
                      type="number"
                      value={plan.monthly_price_piasters}
                      onChange={(e) =>
                        updatePlan(idx, {
                          monthly_price_piasters:
                            parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      = {formatEGP(plan.monthly_price_piasters)}
                    </p>
                  </div>
                  <div>
                    <Label>Annual (piasters)</Label>
                    <Input
                      type="number"
                      value={plan.annual_price_piasters}
                      onChange={(e) =>
                        updatePlan(idx, {
                          annual_price_piasters:
                            parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      = {formatEGP(plan.annual_price_piasters)}
                    </p>
                  </div>
                  <div>
                    <Label>Display Name</Label>
                    <Input
                      value={plan.display_name}
                      onChange={(e) =>
                        updatePlan(idx, { display_name: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Resource Limits */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Resource Limits (-1 = unlimited)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {(
                    [
                      ["max_products", "Products"],
                      ["max_orders_per_month", "Orders/mo"],
                      ["max_stores", "Stores"],
                      ["max_staff_members", "Staff"],
                      ["max_customers", "Customers"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        value={plan[field]}
                        onChange={(e) =>
                          updatePlan(idx, {
                            [field]: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatLimit(plan[field])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Feature Flags */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Feature Flags</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {(
                    [
                      ["webhooks_enabled", "Webhooks"],
                      ["custom_domain_enabled", "Custom Domain"],
                      ["api_access_enabled", "API Access"],
                      ["analytics_enabled", "Analytics"],
                      ["discount_codes_enabled", "Discount Codes"],
                    ] as const
                  ).map(([field, label]) => (
                    <div
                      key={field}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <Label className="text-xs">{label}</Label>
                      <Switch
                        checked={plan[field]}
                        onCheckedChange={(v) =>
                          updatePlan(idx, { [field]: v })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
