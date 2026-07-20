/**
 * Pricing Plans Editor — NUMU Admin Dashboard
 *
 * Admin can edit each plan's name, price, features, popularity flag,
 * CTA type, and the promo banner. Changes are saved to the backend
 * and immediately reflected on the landing page.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLoginUrl } from "@/const";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPricingPlans,
  getSignupSettings,
  updatePricingPlans,
  updateSignupSettings,
  type PlanConfig,
  type PricingPlansConfig,
  type PromoConfig,
  type SignupSettings,
} from "@/services/pricingPlansService";
import {
  CreditCard,
  Plus,
  Save,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function PricingPlans() {
  const { loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pricingPlans"],
    queryFn: getPricingPlans,
  });

  const mutation = useMutation({ mutationFn: updatePricingPlans });

  const [plans, setPlans] = useState<PlanConfig[] | null>(null);
  const [promo, setPromo] = useState<PromoConfig | null>(null);

  useEffect(() => {
    if (query.data && plans === null) {
      setPlans(query.data.plans);
      setPromo(query.data.promo ?? null);
    }
  }, [query.data, plans]);

  const hasChanges = useMemo(() => {
    if (!plans || !query.data) return false;
    return (
      JSON.stringify({ plans, promo }) !==
      JSON.stringify({ plans: query.data.plans, promo: query.data.promo })
    );
  }, [plans, promo, query.data]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) {
    const url = getLoginUrl();
    if (url) { window.location.href = url; return <DashboardLayoutSkeleton />; }
  }

  const handleSave = async () => {
    if (!plans) return;
    try {
      await mutation.mutateAsync({ plans, promo: promo ?? undefined });
      await queryClient.invalidateQueries({ queryKey: ["pricingPlans"] });
      toast.success("Pricing plans saved — changes are live on the landing page.");
    } catch {
      toast.error("Failed to save pricing plans.");
    }
  };

  const updatePlan = (idx: number, patch: Partial<PlanConfig>) => {
    setPlans((prev) => prev?.map((p, i) => (i === idx ? { ...p, ...patch } : p)) ?? null);
  };

  const addFeature = (idx: number) => {
    setPlans((prev) =>
      prev?.map((p, i) =>
        i === idx ? { ...p, features: [...p.features, { en: "", ar: "" }] } : p
      ) ?? null
    );
  };

  const removeFeature = (planIdx: number, featureIdx: number) => {
    setPlans((prev) =>
      prev?.map((p, i) =>
        i === planIdx
          ? { ...p, features: p.features.filter((_, fi) => fi !== featureIdx) }
          : p
      ) ?? null
    );
  };

  const updateFeature = (planIdx: number, featureIdx: number, field: "en" | "ar", value: string) => {
    setPlans((prev) =>
      prev?.map((p, i) =>
        i === planIdx
          ? {
              ...p,
              features: p.features.map((f, fi) =>
                fi === featureIdx ? { ...f, [field]: value } : f
              ),
            }
          : p
      ) ?? null
    );
  };

  return (
    <DashboardLayout
      title="Pricing Plans"
      subtitle="Edit plans shown on the landing page. Changes take effect immediately."
    >
      <div className="space-y-6">
        {/* Save bar */}
        {hasChanges && (
          <div className="sticky top-0 z-10 bg-background border-b py-3 px-4 flex items-center justify-between rounded-lg shadow-sm">
            <span className="text-sm text-muted-foreground">You have unsaved changes</span>
            <Button onClick={handleSave} disabled={mutation.isPending} size="sm">
              <Save className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Saving..." : "Save & Publish"}
            </Button>
          </div>
        )}

        {/* Signup & trial controls (separate config; saves independently) */}
        <SignupTrialCard />

        {/* Plan cards */}
        {(plans ?? []).map((plan, idx) => (
          <Card key={plan.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  {plan.name_en}
                  {plan.popular && (
                    <Badge className="ml-2 bg-primary text-white">
                      <Star className="w-3 h-3 mr-1" /> Popular
                    </Badge>
                  )}
                </div>
                <Badge variant="outline">{plan.key}</Badge>
              </CardTitle>
              <CardDescription>
                {plan.price_monthly === -1
                  ? "Custom pricing"
                  : plan.price_monthly === 0
                    ? "Free"
                    : `${plan.price_monthly} EGP/mo`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Name (English)</Label>
                  <Input value={plan.name_en} onChange={(e) => updatePlan(idx, { name_en: e.target.value })} />
                </div>
                <div>
                  <Label>Name (Arabic)</Label>
                  <Input value={plan.name_ar} onChange={(e) => updatePlan(idx, { name_ar: e.target.value })} dir="rtl" />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Monthly Price (EGP)</Label>
                  <Input
                    type="number"
                    value={plan.price_monthly}
                    onChange={(e) => updatePlan(idx, { price_monthly: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">-1 = custom, 0 = free</p>
                </div>
                <div>
                  <Label>Annual Price (EGP)</Label>
                  <Input
                    type="number"
                    value={plan.price_annual}
                    onChange={(e) => updatePlan(idx, { price_annual: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>CTA Button Type</Label>
                  <Select value={plan.cta} onValueChange={(v) => updatePlan(idx, { cta: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="try_demo">Try Demo</SelectItem>
                      <SelectItem value="subscribe">Subscribe (signup)</SelectItem>
                      <SelectItem value="signup_payg">Pay as you Grow signup</SelectItem>
                      <SelectItem value="contact">Contact Us</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Popular toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={plan.popular}
                  onCheckedChange={(v) => updatePlan(idx, { popular: v })}
                />
                <Label>Mark as "Most Popular"</Label>
              </div>

              {/* Features */}
              <Separator />
              <div>
                <Label className="mb-2 block">Features</Label>
                <div className="space-y-2">
                  {plan.features.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Input
                        placeholder="English"
                        value={f.en}
                        onChange={(e) => updateFeature(idx, fi, "en", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="عربي"
                        value={f.ar}
                        onChange={(e) => updateFeature(idx, fi, "ar", e.target.value)}
                        className="flex-1"
                        dir="rtl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeature(idx, fi)}
                        className="shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => addFeature(idx)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Feature
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Promo Banner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Promo Banner
            </CardTitle>
            <CardDescription>
              Promotional banner shown above the pricing cards on the landing page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promo ? (
              <>
                <div>
                  <Label>Discount Code</Label>
                  <Input
                    value={promo.code}
                    onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Text (English)</Label>
                    <Input
                      value={promo.text_en}
                      onChange={(e) => setPromo({ ...promo, text_en: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Text (Arabic)</Label>
                    <Input
                      value={promo.text_ar}
                      onChange={(e) => setPromo({ ...promo, text_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPromo(null)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" /> Remove Promo
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setPromo({ code: "", text_en: "", text_ar: "" })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Promo Banner
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

/**
 * Signup & trial controls — separate platform_config from the plan cards
 * (its own GET/PUT), so it saves independently of the pricing editor.
 *
 * - Free trial: on/off, length in days, and whether trial messaging shows
 *   on the landing (the trial card is dropped from the public payload
 *   when hidden). Registration reads the same config, so the length here
 *   IS the length new merchants actually get.
 * - Pay as you Grow: whether its card is injected into the landing
 *   pricing. The commission % itself lives in Merchant Wallets → Settings
 *   (rate-locked per merchant at activation).
 */
function SignupTrialCard() {
  const queryClient = useQueryClient();
  const signupQuery = useQuery({
    queryKey: ["signupSettings"],
    queryFn: getSignupSettings,
  });
  const [form, setForm] = useState<SignupSettings | null>(null);

  useEffect(() => {
    if (signupQuery.data && form === null) setForm(signupQuery.data);
  }, [signupQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: updateSignupSettings,
    onSuccess: (merged) => {
      setForm(merged);
      void queryClient.invalidateQueries({ queryKey: ["signupSettings"] });
      toast.success("Signup & trial settings saved — live immediately.");
    },
    onError: () => toast.error("Failed to save signup settings."),
  });

  if (!form) {
    return <Card className="h-40 animate-pulse bg-muted/30" />;
  }

  const set = <K extends keyof SignupSettings>(key: K, value: SignupSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="w-5 h-5" />
          Signup &amp; Free Trial
        </CardTitle>
        <CardDescription>
          Controls registration and what the landing page offers. The trial
          length here is what new merchants actually receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.trial_enabled}
              onCheckedChange={(v) => set("trial_enabled", v)}
            />
            <Label>Free trial enabled</Label>
          </div>
          <div>
            <Label>Trial length (days)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={form.trial_days}
              disabled={!form.trial_enabled}
              onChange={(e) => set("trial_days", parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.trial_visible_on_landing}
              disabled={!form.trial_enabled}
              onCheckedChange={(v) => set("trial_visible_on_landing", v)}
            />
            <Label>Show trial on landing</Label>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.payg_visible_on_landing}
              onCheckedChange={(v) => set("payg_visible_on_landing", v)}
            />
            <Label>Show "Pay as you Grow" card on landing</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Commission % comes live from Merchant Wallets → Settings
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => form && saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save signup settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
