/**
 * MerchantDetail — full profile for one merchant (or demo), reached by
 * clicking any row on the Merchants list.
 *
 * One backend call (GET /admin/stores/{id}/detail) renders: store
 * identity + status, tenant lifecycle/billing, the DEMO LEAD box
 * (name / email / WhatsApp captured on the landing form) for demo
 * tenants, owner account, payg wallet summary, commerce metric tiles,
 * and the five most recent orders.
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  getMerchantDetail,
  type MerchantDetail as MerchantDetailData,
} from "@/services/merchantService";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  ShieldAlert,
  ShoppingCart,
  User,
  Users,
  Package,
  Wallet,
} from "lucide-react";

const fmtEGP = (cents: number | null | undefined) =>
  cents == null
    ? "—"
    : `${(cents / 100).toLocaleString("en-EG", { maximumFractionDigits: 2 })} EGP`;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : "—";

const PLAN_BADGE: Record<string, string> = {
  payg: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  demo: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  starter: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  pro: "bg-primary/15 text-primary",
  enterprise: "bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300",
  free: "bg-muted text-muted-foreground",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium truncate">{value ?? "—"}</div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums leading-tight truncate">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MerchantDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, params] = useRoute("/merchants/:merchantId");
  const [, navigate] = useLocation();
  const storeId = params?.merchantId ?? "";

  const detailQuery = useQuery<MerchantDetailData>({
    queryKey: ["merchant-detail", storeId],
    queryFn: () => getMerchantDetail(storeId),
    enabled: !!storeId,
  });

  if (authLoading) return <DashboardLayoutSkeleton />;
  if (!user) {
    const target = getLoginUrl();
    if (target) window.location.href = target;
    return null;
  }

  const d = detailQuery.data;

  return (
    <DashboardLayout title="Merchant detail">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/merchants")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to merchants
        </Button>

        {detailQuery.isLoading && (
          <div className="space-y-4">
            <Card className="h-28 animate-pulse bg-muted/30" />
            <Card className="h-64 animate-pulse bg-muted/30" />
          </div>
        )}

        {detailQuery.isError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Could not load merchant"}
              </p>
            </CardContent>
          </Card>
        )}

        {d && (
          <>
            {/* Header */}
            <Card>
              <CardContent className="pt-6 flex flex-wrap items-center gap-4">
                {d.store.logo_url ? (
                  <img
                    src={d.store.logo_url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover border"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold truncate">{d.store.name}</h1>
                    {d.tenant && (
                      <Badge
                        className={`border-transparent ${PLAN_BADGE[d.tenant.plan] ?? "bg-muted"}`}
                      >
                        {d.tenant.plan}
                      </Badge>
                    )}
                    <Badge variant="outline">{d.store.status}</Badge>
                    {d.tenant?.is_demo && (
                      <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        DEMO
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {d.store.subdomain
                      ? `${d.store.subdomain}.numueg.app`
                      : d.store.slug}
                    {" · "}created {fmtDate(d.store.created_at)}
                  </p>
                </div>
                {d.store.storefront_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={d.store.storefront_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open storefront <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Demo lead — the reason this page exists for demos */}
            {d.tenant?.is_demo && (
              <Card className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Demo lead</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Field
                    label="Name"
                    value={
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        {d.tenant.demo_name ?? "—"}
                      </span>
                    }
                  />
                  <Field
                    label="Email"
                    value={
                      d.tenant.demo_email ? (
                        <a
                          href={`mailto:${d.tenant.demo_email}`}
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          {d.tenant.demo_email}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="WhatsApp"
                    value={
                      d.tenant.demo_whatsapp ? (
                        <a
                          href={`https://wa.me/${d.tenant.demo_whatsapp.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          {d.tenant.demo_whatsapp}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="Demo started"
                    value={fmtDate(d.tenant.demo_started_at)}
                  />
                </CardContent>
              </Card>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricTile
                icon={ShoppingCart}
                label="Orders"
                value={d.metrics.orders_count}
              />
              <MetricTile
                icon={Wallet}
                label="Paid revenue"
                value={fmtEGP(d.metrics.paid_revenue_cents)}
              />
              <MetricTile
                icon={Package}
                label="Products"
                value={d.metrics.products_count}
              />
              <MetricTile
                icon={Users}
                label="Customers"
                value={d.metrics.customers_count}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Tenant / plan */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Plan &amp; lifecycle</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <Field label="Plan" value={d.tenant?.plan} />
                  <Field label="Lifecycle" value={d.tenant?.lifecycle_state} />
                  <Field label="Expires" value={fmtDate(d.tenant?.expires_at)} />
                  <Field
                    label="Next renewal"
                    value={fmtDate(d.tenant?.next_renewal_at)}
                  />
                  <Field
                    label="Billing cycle"
                    value={d.tenant?.billing_cycle ?? "—"}
                  />
                  <Field
                    label="Card"
                    value={
                      d.tenant?.payment_method_last4
                        ? `•••• ${d.tenant.payment_method_last4}`
                        : "—"
                    }
                  />
                  <Field
                    label="Go-live exempt"
                    value={d.tenant?.feature_flags?.golive_exempt ? "Yes" : "No"}
                  />
                  <Field
                    label="Trial started"
                    value={fmtDate(d.tenant?.trial_started_at)}
                  />
                </CardContent>
              </Card>

              {/* Owner */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Owner account</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <Field label="Name" value={d.owner?.name} />
                  <Field
                    label="Email"
                    value={
                      d.owner?.email ? (
                        <a
                          href={`mailto:${d.owner.email}`}
                          className="hover:underline"
                        >
                          {d.owner.email}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="Phone"
                    value={
                      d.owner?.phone ? (
                        <a
                          href={`tel:${d.owner.phone}`}
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          {d.owner.phone}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label="Status" value={d.owner?.status} />
                  <Field
                    label="Landing plan intent"
                    value={d.owner?.plan_intent ?? "—"}
                  />
                  <Field
                    label="User trial ends"
                    value={fmtDate(d.owner?.trial_ends_at)}
                  />
                  <Field
                    label="Last login"
                    value={fmtDate(d.owner?.last_login_at)}
                  />
                  <Field label="Registered" value={fmtDate(d.owner?.created_at)} />
                </CardContent>
              </Card>
            </div>

            {/* Wallet (payg) */}
            {d.wallet && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" /> Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Field
                    label="Balance"
                    value={
                      <span
                        className={
                          d.wallet.balance_cents < 0 ? "text-red-600" : undefined
                        }
                      >
                        {fmtEGP(d.wallet.balance_cents)}
                      </span>
                    }
                  />
                  <Field
                    label="On hold"
                    value={
                      d.wallet.pending_balance_cents > 0 ? (
                        <span className="text-amber-600">
                          {fmtEGP(d.wallet.pending_balance_cents)}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label="Status" value={d.wallet.status} />
                  <Field
                    label="Rate override"
                    value={
                      d.wallet.commission_bps_override != null
                        ? `${d.wallet.commission_bps_override / 100}%`
                        : "default"
                    }
                  />
                </CardContent>
              </Card>
            )}

            {/* Recent orders */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent orders</CardTitle>
              </CardHeader>
              <CardContent>
                {d.recent_orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No orders yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.recent_orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">
                            {o.order_number}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{o.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{o.payment_status}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtEGP(o.total_cents)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {fmtDate(o.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
