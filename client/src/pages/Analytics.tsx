/**
 * Analytics Page - NUMU Admin Dashboard
 *
 * Platform-wide analytics: revenue KPIs, order distribution,
 * merchant breakdown, and growth metrics.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { StatsCard } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { getDashboardStats } from "@/services/dashboardService";
import { getOrderStats } from "@/services/orderService";
import { getMerchantStats } from "@/services/merchantService";
import { getCustomerStats } from "@/services/customerService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  BarChart3,
  Building2,
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// Back-calculate previous period value from current + MoM % change
function prevValue(current: number, changePct: number): number {
  if (changePct === 0) return current;
  return Math.round(current / (1 + changePct / 100));
}

const CHART_COLORS = {
  primary: "hsl(250 80% 60%)",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  gray: "#9ca3af",
};

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: any) {
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

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatNum(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { isAuthenticated } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    enabled: isAuthenticated,
  });

  const { data: orderStats } = useQuery({
    queryKey: ["orders", "stats"],
    queryFn: getOrderStats,
    enabled: isAuthenticated,
  });

  const { data: merchantStats } = useQuery({
    queryKey: ["merchants", "stats"],
    queryFn: getMerchantStats,
    enabled: isAuthenticated,
  });

  const { data: customerStats } = useQuery({
    queryKey: ["customers", "stats"],
    queryFn: getCustomerStats,
    enabled: isAuthenticated,
  });

  // Revenue MoM comparison
  const revChange = stats?.revenueChange ?? 0;
  const revCurrent = stats?.totalRevenue ?? 0;
  const revPrev = prevValue(revCurrent, revChange);

  const revenueData = [
    { period: "Last Month", Revenue: revPrev },
    { period: "This Month", Revenue: revCurrent },
  ];

  // Order status pie data
  const orderPieData = [
    { name: "Pending", value: orderStats?.pending ?? 0, color: CHART_COLORS.amber },
    { name: "Processing", value: orderStats?.processing ?? 0, color: CHART_COLORS.blue },
    { name: "Shipped", value: orderStats?.shipped ?? 0, color: CHART_COLORS.purple },
    { name: "Delivered", value: orderStats?.delivered ?? 0, color: CHART_COLORS.emerald },
    { name: "Cancelled", value: orderStats?.cancelled ?? 0, color: CHART_COLORS.red },
  ].filter((d) => d.value > 0);

  // Merchant status bar data
  const merchantBarData = [
    { status: "Active", count: merchantStats?.active ?? 0 },
    { status: "Pending", count: merchantStats?.pending_approval ?? 0 },
    { status: "Suspended", count: merchantStats?.suspended ?? 0 },
    { status: "Inactive", count: merchantStats?.inactive ?? 0 },
  ];

  const merchantBarColors = [
    CHART_COLORS.emerald,
    CHART_COLORS.amber,
    CHART_COLORS.red,
    CHART_COLORS.gray,
  ];

  // Growth rate helper
  const growthLabel = (change: number) =>
    change >= 0 ? `+${change.toFixed(1)}% MoM` : `${change.toFixed(1)}% MoM`;

  return (
    <DashboardLayout title="Analytics" subtitle="Platform performance and growth metrics">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          change={stats?.revenueChange}
          changeLabel="vs last month"
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Active Merchants"
          value={formatNum(stats?.activeMerchants ?? 0)}
          change={stats?.merchantsChange}
          changeLabel="vs last month"
          icon={Building2}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Total Orders"
          value={formatNum(stats?.totalOrders ?? 0)}
          change={stats?.ordersChange}
          changeLabel="vs last month"
          icon={ShoppingCart}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatsCard
          title="Total Customers"
          value={formatNum(stats?.totalCustomers ?? 0)}
          change={stats?.customersChange}
          changeLabel="vs last month"
          icon={Users}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Revenue Chart + Order Distribution */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue MoM */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Revenue — Month over Month</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current vs previous month
              </p>
            </div>
            <Badge
              className={
                revChange >= 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }
            >
              {growthLabel(revChange)}
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
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
              <Tooltip content={<CurrencyTooltip />} />
              <Bar dataKey="Revenue" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Distribution */}
        <div className="dashboard-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Order Status Distribution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatNum(orderStats?.total ?? 0)} total orders
            </p>
          </div>
          {orderPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={orderPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {orderPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>
                      {value}
                    </span>
                  )}
                />
                <Tooltip
                  formatter={(value: number) => [formatNum(value), "Orders"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              No order data
            </div>
          )}
        </div>
      </div>

      {/* Merchant Breakdown + Growth Summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Merchant Status Breakdown */}
        <div className="dashboard-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Merchant Status Breakdown</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatNum(merchantStats?.total ?? 0)} total merchants
            </p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={merchantBarData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="status"
                type="category"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {merchantBarData.map((_, i) => (
                  <Cell key={i} fill={merchantBarColors[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Growth Summary Table */}
        <div className="dashboard-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Month-over-Month Growth</h3>
          </div>
          <div className="space-y-3">
            {[
              {
                metric: "Revenue",
                change: stats?.revenueChange ?? 0,
                icon: DollarSign,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
              {
                metric: "Orders",
                change: stats?.ordersChange ?? 0,
                icon: ShoppingCart,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                metric: "Merchants",
                change: stats?.merchantsChange ?? 0,
                icon: Building2,
                color: "text-purple-600",
                bg: "bg-purple-50",
              },
              {
                metric: "Customers",
                change: stats?.customersChange ?? 0,
                icon: Users,
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
            ].map((row) => (
              <div
                key={row.metric}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${row.bg} flex items-center justify-center`}>
                    <row.icon className={`w-4 h-4 ${row.color}`} />
                  </div>
                  <span className="text-sm font-medium">{row.metric}</span>
                </div>
                <Badge
                  className={
                    row.change >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }
                >
                  {row.change >= 0 ? "+" : ""}
                  {row.change.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>

          {/* Customer activity */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">
              Customer Activity
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatNum(customerStats?.total ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Active</span>
              <span className="font-semibold text-emerald-600">
                {formatNum(customerStats?.active ?? 0)}
              </span>
            </div>
            {customerStats && customerStats.total > 0 && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${Math.round((customerStats.active / customerStats.total) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
