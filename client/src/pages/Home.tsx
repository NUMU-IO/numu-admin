/**
 * Home Page - NUMU Admin Dashboard
 * 
 * Design: Soft Minimalist Dashboard
 * Layout: Grid-based with multiple card sections
 * 
 * This page implements the admin backoffice dashboard for NUMU,
 * featuring all the components from the Figma design.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { getLoginUrl } from "@/const";
import {
  AnalyticsReport,
  BusinessIndicators,
  CompaniesTable,
  FXTrades,
  RequestsByMonth,
  RequestsCreated,
  RevenueShare,
  SalesStats,
  SLAStats,
  StatsCard,
  TeamPerformance,
  TicketsByPriority,
  TicketsByStatus,
  TimeStats,
  TopProductSales,
  TotalProductSales,
  TotalTicketStats,
  WorldMap,
} from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  
  // Fetch dashboard stats from API
  const { data: dashboardStats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Show loading skeleton while checking auth
  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return <DashboardLayoutSkeleton />;
  }

  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <DashboardLayout
      title="Dashboard Overview"
      subtitle={`Welcome back, ${user?.name || "Admin"}! Here's what's happening with your platform today.`}
    >
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Revenue"
          value={statsLoading ? "Loading..." : formatCurrency(dashboardStats?.totalRevenue ?? 8943200)}
          change={dashboardStats?.revenueChange ?? 12.5}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatsCard
          title="Active Merchants"
          value={statsLoading ? "Loading..." : formatNumber(dashboardStats?.activeMerchants ?? 5612)}
          change={dashboardStats?.merchantsChange ?? 8.2}
          changeLabel="vs last month"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatsCard
          title="Total Orders"
          value={statsLoading ? "Loading..." : formatNumber(dashboardStats?.totalOrders ?? 5161)}
          change={dashboardStats?.ordersChange ?? -2.4}
          changeLabel="vs last month"
          icon={ShoppingCart}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          title="Total Customers"
          value={statsLoading ? "Loading..." : formatNumber(dashboardStats?.totalCustomers ?? 391152)}
          change={dashboardStats?.customersChange ?? 5.7}
          changeLabel="vs last month"
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Row 1: SLA Stats, Tickets By Priority, Total Ticket Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-4">
          <SLAStats />
        </div>
        <div className="lg:col-span-3">
          <TicketsByPriority />
        </div>
        <div className="lg:col-span-5">
          <TotalTicketStats />
        </div>
      </div>

      {/* Row 2: Requests Created + Companies Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-5">
          <RequestsCreated />
        </div>
        <div className="lg:col-span-7">
          <CompaniesTable />
        </div>
      </div>

      {/* Row 3: Tickets By Status, Top Product Sales, Revenue Share */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-3">
          <TicketsByStatus />
        </div>
        <div className="lg:col-span-3">
          <TopProductSales />
        </div>
        <div className="lg:col-span-6">
          <RevenueShare />
        </div>
      </div>

      {/* Row 4: Team Performance, Analytics Report, Sales Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-3">
          <TeamPerformance />
        </div>
        <div className="lg:col-span-5">
          <AnalyticsReport />
        </div>
        <div className="lg:col-span-4">
          <SalesStats />
        </div>
      </div>

      {/* Row 5: World Map, Business Indicators, Requests By Month */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-4">
          <WorldMap />
        </div>
        <div className="lg:col-span-4">
          <BusinessIndicators />
        </div>
        <div className="lg:col-span-4">
          <RequestsByMonth />
        </div>
      </div>

      {/* Row 6: FX Trades + Time Stats + Total Product Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <FXTrades />
        </div>
        <div className="lg:col-span-3">
          <TimeStats />
        </div>
        <div className="lg:col-span-3">
          <TotalProductSales />
        </div>
      </div>
    </DashboardLayout>
  );
}
