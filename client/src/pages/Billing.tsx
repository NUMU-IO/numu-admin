/**
 * Billing Page - NUMU Admin Dashboard
 *
 * Platform billing overview: revenue earned, merchant plan distribution,
 * and platform fee breakdown.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { StatsCard } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { getDashboardStats } from "@/services/dashboardService";
import { getMerchants } from "@/services/merchantService";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  DollarSign,
  Building2,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PCT = 2.5; // 2.5% platform fee

const PLAN_COLORS: Record<string, string> = {
  free: "#9ca3af",
  starter: "#3b82f6",
  growth: "#a855f7",
  pro: "#10b981",
  enterprise: "#f59e0b",
};

const PAYMENT_PROVIDERS = [
  { name: "Stripe", status: "operational", latency: "42ms" },
  { name: "Paymob", status: "operational", latency: "78ms" },
  { name: "Fawry", status: "operational", latency: "95ms" },
  { name: "Cash on Delivery", status: "operational", latency: "—" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: cents >= 1_000_000_00 ? "compact" : "standard",
  }).format(cents / 100);
}

function formatNum(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function PlanTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill }}>
        Merchants: {formatNum(payload[0].value)}
      </p>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Billing() {
  const { isAuthenticated } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    enabled: isAuthenticated,
  });

  // Fetch all merchants to compute plan distribution (up to 200)
  const { data: merchantData } = useQuery({
    queryKey: ["merchants", "all-for-billing"],
    queryFn: () => getMerchants({ limit: 200 }),
    enabled: isAuthenticated,
  });

  // Compute plan distribution
  const planCounts = (merchantData?.merchants ?? []).reduce<Record<string, number>>(
    (acc, m) => {
      const plan = m.plan || "free";
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    },
    {},
  );

  const planPieData = Object.entries(planCounts).map(([plan, count]) => ({
    name: capitalise(plan),
    value: count,
    fill: PLAN_COLORS[plan] ?? "#6b7280",
  }));

  // Revenue by plan (sum of totalRevenue for merchants on each plan, in cents)
  const revenueByPlan = (merchantData?.merchants ?? []).reduce<Record<string, number>>(
    (acc, m) => {
      const plan = m.plan || "free";
      acc[plan] = (acc[plan] || 0) + (m.totalRevenue ?? 0);
      return acc;
    },
    {},
  );

  const revenueBarData = Object.entries(revenueByPlan)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([plan, revenue]) => ({ plan: capitalise(plan), revenue }));

  const totalRevenue = stats?.totalRevenue ?? 0;
  const platformEarnings = Math.round(totalRevenue * (PLATFORM_FEE_PCT / 100));

  return (
    <DashboardLayout title="Billing" subtitle="Platform revenue, fees, and merchant plans">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Gross Revenue"
          value={formatCurrency(totalRevenue)}
          change={stats?.revenueChange}
          changeLabel="vs last month"
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Platform Earnings"
          value={formatCurrency(platformEarnings)}
          change={stats?.revenueChange}
          changeLabel="vs last month"
          icon={TrendingUp}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Active Merchants"
          value={formatNum(stats?.activeMerchants ?? 0)}
          change={stats?.merchantsChange}
          changeLabel="vs last month"
          icon={Building2}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatsCard
          title="Platform Fee"
          value={`${PLATFORM_FEE_PCT}%`}
          icon={CreditCard}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Plan Distribution + Revenue by Plan */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Plan pie */}
        <div className="dashboard-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Merchant Plan Distribution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatNum(merchantData?.total ?? 0)} total merchants
            </p>
          </div>
          {planPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={planPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {planPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>
                      {value}
                    </span>
                  )}
                />
                <Tooltip content={<PlanTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No plan data
            </div>
          )}
        </div>

        {/* Revenue by plan bar */}
        <div className="dashboard-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Revenue by Plan</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total merchant revenue per subscription tier
            </p>
          </div>
          {revenueBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueBarData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="plan"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  radius={[6, 6, 0, 0]}
                >
                  {revenueBarData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={PLAN_COLORS[entry.plan.toLowerCase()] ?? "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No revenue data
            </div>
          )}
        </div>
      </div>

      {/* Fee Breakdown + Payment Providers */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fee breakdown */}
        <div className="dashboard-card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Platform Fee Breakdown</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Gross Revenue (GMV)</span>
              <span className="text-sm font-semibold">{formatCurrency(totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">
                Platform Fee ({PLATFORM_FEE_PCT}%)
              </span>
              <span className="text-sm font-semibold text-emerald-600">
                {formatCurrency(platformEarnings)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Merchant Payout</span>
              <span className="text-sm font-semibold">
                {formatCurrency(totalRevenue - platformEarnings)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Avg. Revenue / Merchant</span>
              <span className="text-sm font-semibold">
                {stats?.activeMerchants
                  ? formatCurrency(Math.round(totalRevenue / stats.activeMerchants))
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Payment providers */}
        <div className="dashboard-card">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Payment Providers</h3>
          </div>
          <div className="space-y-3">
            {PAYMENT_PROVIDERS.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {provider.status === "operational" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  )}
                  <span className="text-sm font-medium">{provider.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{provider.latency}</span>
                  <Badge
                    className={
                      provider.status === "operational"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }
                  >
                    {provider.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Provider status is indicative. Check provider dashboards for real-time status.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
