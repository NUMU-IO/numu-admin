/**
 * Home Page - NUMU Admin Dashboard
 *
 * Shows real platform data: stats, order breakdown,
 * merchant breakdown, recent orders, and top merchants.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { StatsCard } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/services/dashboardService";
import { getOrders, getOrderStats } from "@/services/orderService";
import { getMerchants, getMerchantStats } from "@/services/merchantService";
import { getCustomerStats } from "@/services/customerService";
import {
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  Repeat,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  XCircle,
} from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    enabled: isAuthenticated,
  });

  // Fetch order stats
  const { data: orderStats } = useQuery({
    queryKey: ["orders", "stats"],
    queryFn: getOrderStats,
    enabled: isAuthenticated,
  });

  // Fetch merchant stats
  const { data: merchantStats } = useQuery({
    queryKey: ["merchants", "stats"],
    queryFn: getMerchantStats,
    enabled: isAuthenticated,
  });

  // Fetch recent orders
  const { data: recentOrdersData } = useQuery({
    queryKey: ["orders", "list", { limit: 8, offset: 0 }],
    queryFn: () => getOrders({ limit: 8, offset: 0 }),
    enabled: isAuthenticated,
  });

  // Fetch top merchants
  const { data: topMerchantsData } = useQuery({
    queryKey: ["merchants", "list", { limit: 6, offset: 0, status: "active" }],
    queryFn: () => getMerchants({ limit: 6, offset: 0, status: "active" }),
    enabled: isAuthenticated,
  });

  // Fetch customer stats
  const { data: customerStats } = useQuery({
    queryKey: ["customers", "stats"],
    queryFn: getCustomerStats,
    enabled: isAuthenticated,
  });

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
      return <DashboardLayoutSkeleton />;
    }
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);

  const formatEGP = (piasters: number) =>
    new Intl.NumberFormat("en-EG", {
      style: "currency",
      currency: "EGP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(piasters / 100);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("en-US").format(num);

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    confirmed: "bg-blue-50 text-blue-700",
    processing: "bg-indigo-50 text-indigo-700",
    shipped: "bg-purple-50 text-purple-700",
    delivered: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-rose-50 text-rose-700",
    refunded: "bg-gray-50 text-gray-700",
  };

  const recentOrders = recentOrdersData?.orders ?? [];
  const merchants = topMerchantsData?.merchants ?? [];

  return (
    <DashboardLayout
      title="Dashboard Overview"
      subtitle={`Welcome back, ${user?.name || "Admin"}! Here's what's happening with your platform today.`}
    >
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatsCard
          title="MRR"
          value={statsLoading ? "..." : formatEGP(dashboardStats?.mrr.total ?? 0)}
          changeLabel={`${dashboardStats?.mrr.subscriberCount ?? 0} subscribers`}
          icon={Repeat}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatsCard
          title="Total Revenue"
          value={statsLoading ? "..." : formatCurrency(dashboardStats?.totalRevenue ?? 0)}
          change={dashboardStats?.revenueChange}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatsCard
          title="Active Merchants"
          value={statsLoading ? "..." : formatNumber(dashboardStats?.activeMerchants ?? 0)}
          change={dashboardStats?.merchantsChange}
          changeLabel="vs last month"
          icon={Store}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatsCard
          title="Total Orders"
          value={statsLoading ? "..." : formatNumber(dashboardStats?.totalOrders ?? 0)}
          change={dashboardStats?.ordersChange}
          changeLabel="vs last month"
          icon={ShoppingCart}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          title="Total Customers"
          value={statsLoading ? "..." : formatNumber(dashboardStats?.totalCustomers ?? 0)}
          change={dashboardStats?.customersChange}
          changeLabel="vs last month"
          icon={Users}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Row 2: Order Status Breakdown + Merchant & Customer Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Order Status Breakdown */}
        <div className="lg:col-span-7 dashboard-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Order Status Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Pending", value: orderStats?.pending ?? 0, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
              { label: "Processing", value: orderStats?.processing ?? 0, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Shipped", value: orderStats?.shipped ?? 0, icon: Truck, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Delivered", value: orderStats?.delivered ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Cancelled", value: orderStats?.cancelled ?? 0, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
              { label: "Total", value: orderStats?.total ?? 0, icon: ShoppingCart, color: "text-foreground", bg: "bg-secondary" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <div className={cn("p-2 rounded-lg", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{formatNumber(s.value)}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Merchant & Customer Stats */}
        <div className="lg:col-span-5 space-y-4">
          <div className="dashboard-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Merchant Overview
            </h3>
            <div className="space-y-2">
              {[
                { label: "Total Merchants", value: merchantStats?.total ?? 0, color: "bg-blue-500" },
                { label: "Active", value: merchantStats?.active ?? 0, color: "bg-emerald-500" },
                { label: "Pending", value: merchantStats?.pending_approval ?? 0, color: "bg-yellow-500" },
                { label: "Suspended", value: merchantStats?.suspended ?? 0, color: "bg-rose-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", s.color)} />
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatNumber(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dashboard-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Customer Overview
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-muted-foreground">Total Customers</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatNumber(customerStats?.total ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatNumber(customerStats?.active ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Orders */}
      <div className="dashboard-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
          <a href="/orders" className="text-xs text-primary hover:underline">
            View all
          </a>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No orders yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell className="font-medium text-xs">
                      #{order.orderId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.customerName || order.customerEmail || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          statusColor[order.status] ?? "bg-gray-50 text-gray-700"
                        )}
                      >
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Row 4: Top Merchants */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Active Merchants</h3>
          <a href="/merchants" className="text-xs text-primary hover:underline">
            View all
          </a>
        </div>
        {merchants.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No merchants yet
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {merchants.map((m) => (
              <div
                key={m.merchantId}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
              >
                <div className="p-2 rounded-lg bg-blue-50">
                  <Store className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.domain || m.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {m.plan}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
