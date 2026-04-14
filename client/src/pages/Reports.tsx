/**
 * Reports Page - NUMU Admin Dashboard
 *
 * Generate and download CSV reports for orders, customers,
 * merchants, and revenue summary.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { getOrders } from "@/services/orderService";
import { getCustomers } from "@/services/customerService";
import { getMerchants } from "@/services/merchantService";
import { getDashboardStats } from "@/services/dashboardService";
import {
  Download,
  FileText,
  Users,
  Building2,
  ShoppingCart,
  DollarSign,
  Loader2,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

/** Convert array of objects to CSV string */
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

/** Trigger browser download of a CSV string */
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Report definitions ────────────────────────────────────────────────────────

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  columns: string;
  usesDateRange: boolean;
}

const REPORTS: ReportDef[] = [
  {
    id: "orders",
    title: "Orders Report",
    description: "All platform orders with status, customer info, and totals",
    icon: ShoppingCart,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    columns: "Order ID, Merchant, Customer, Status, Payment Status, Total, Date",
    usesDateRange: false,
  },
  {
    id: "customers",
    title: "Customers Report",
    description: "All registered customers across all merchants",
    icon: Users,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    columns: "Customer ID, Merchant, Name, Email, Phone, Total Orders, Total Spent, Joined",
    usesDateRange: false,
  },
  {
    id: "merchants",
    title: "Merchants Report",
    description: "All merchant stores with plan, status, and revenue",
    icon: Building2,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    columns: "Merchant ID, Name, Email, Domain, Plan, Status, Total Revenue, Total Orders, Created",
    usesDateRange: false,
  },
  {
    id: "revenue",
    title: "Revenue Summary",
    description: "Platform-wide revenue KPIs and month-over-month changes",
    icon: DollarSign,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    columns: "Metric, Current Value, MoM Change",
    usesDateRange: false,
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const [loading, setLoading] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo());
  const [dateTo, setDateTo] = useState(today());

  async function handleGenerate(reportId: string) {
    setLoading(reportId);
    try {
      const filename = `numu_${reportId}_${dateFrom}_${dateTo}.csv`;

      if (reportId === "orders") {
        // Fetch up to 500 orders (multiple pages if needed)
        const [p1, p2, p3, p4, p5] = await Promise.all([
          getOrders({ limit: 100, offset: 0 }),
          getOrders({ limit: 100, offset: 100 }),
          getOrders({ limit: 100, offset: 200 }),
          getOrders({ limit: 100, offset: 300 }),
          getOrders({ limit: 100, offset: 400 }),
        ]);
        const all = [
          ...p1.orders,
          ...p2.orders,
          ...p3.orders,
          ...p4.orders,
          ...p5.orders,
        ];
        const rows = all.map((o) => ({
          "Order ID": o.orderId,
          Merchant: o.merchantId,
          Customer: o.customerName || o.customerEmail || o.customerId || "",
          Status: o.status,
          "Payment Status": o.paymentStatus,
          "Total (USD)": formatCurrency(o.total),
          Date: o.createdAt.toISOString().split("T")[0],
        }));
        downloadCSV(toCSV(rows), filename);
      } else if (reportId === "customers") {
        const [p1, p2, p3] = await Promise.all([
          getCustomers({ limit: 100, offset: 0 }),
          getCustomers({ limit: 100, offset: 100 }),
          getCustomers({ limit: 100, offset: 200 }),
        ]);
        const all = [...p1.customers, ...p2.customers, ...p3.customers];
        const rows = all.map((c) => ({
          "Customer ID": c.customerId,
          Merchant: c.merchantId,
          Name: c.name || "",
          Email: c.email,
          Phone: c.phone || "",
          "Total Orders": c.totalOrders ?? 0,
          "Total Spent (USD)": formatCurrency(c.totalSpent ?? 0),
          Joined: c.createdAt.toISOString().split("T")[0],
        }));
        downloadCSV(toCSV(rows), filename);
      } else if (reportId === "merchants") {
        const { merchants } = await getMerchants({ limit: 200 });
        const rows = merchants.map((m) => ({
          "Merchant ID": m.merchantId,
          Name: m.name,
          Email: m.email,
          Domain: m.domain || "",
          Plan: m.plan,
          Status: m.status,
          "Total Revenue (USD)": formatCurrency(m.totalRevenue ?? 0),
          "Total Orders": m.totalOrders ?? 0,
          Created: m.createdAt.toISOString().split("T")[0],
        }));
        downloadCSV(toCSV(rows), filename);
      } else if (reportId === "revenue") {
        const stats = await getDashboardStats();
        const rows = [
          {
            Metric: "Total Revenue",
            "Current Value": formatCurrency(stats.totalRevenue),
            "MoM Change": `${stats.revenueChange >= 0 ? "+" : ""}${stats.revenueChange.toFixed(1)}%`,
          },
          {
            Metric: "Active Merchants",
            "Current Value": stats.activeMerchants,
            "MoM Change": `${stats.merchantsChange >= 0 ? "+" : ""}${stats.merchantsChange.toFixed(1)}%`,
          },
          {
            Metric: "Total Orders",
            "Current Value": stats.totalOrders,
            "MoM Change": `${stats.ordersChange >= 0 ? "+" : ""}${stats.ordersChange.toFixed(1)}%`,
          },
          {
            Metric: "Total Customers",
            "Current Value": stats.totalCustomers,
            "MoM Change": `${stats.customersChange >= 0 ? "+" : ""}${stats.customersChange.toFixed(1)}%`,
          },
          {
            Metric: "Platform Earnings (2.5%)",
            "Current Value": formatCurrency(Math.round(stats.totalRevenue * 0.025)),
            "MoM Change": `${stats.revenueChange >= 0 ? "+" : ""}${stats.revenueChange.toFixed(1)}%`,
          },
        ];
        downloadCSV(toCSV(rows), filename);
      }

      toast.success(`${reportId.charAt(0).toUpperCase() + reportId.slice(1)} report downloaded`);
    } catch {
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <DashboardLayout title="Reports" subtitle="Generate and download platform data exports">
      {/* Date range */}
      <div className="dashboard-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Report Period</h3>
          <Badge className="bg-muted text-muted-foreground text-xs">
            Note: date range is included in the filename only; data reflects all-time records
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-sm w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-sm w-40"
            />
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.id} className="dashboard-card flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl ${report.iconBg} flex items-center justify-center flex-shrink-0`}
              >
                <report.icon className={`w-5 h-5 ${report.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                <p className="text-xs text-muted-foreground/70 mt-2 font-mono leading-relaxed">
                  {report.columns}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <Badge className="bg-muted text-muted-foreground text-xs">CSV</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerate(report.id)}
                disabled={loading !== null}
                className="gap-2 h-8"
              >
                {loading === report.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-6 dashboard-card">
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              About Reports
            </p>
            <p className="text-xs text-muted-foreground">
              Reports export all available data from the platform. For large datasets, export may
              take a few seconds. Files are generated client-side and downloaded directly to your
              device — no data is sent to external services.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
