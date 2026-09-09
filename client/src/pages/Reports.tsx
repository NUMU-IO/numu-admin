/**
 * Reports — CSV exports of platform data.
 *
 * Everything is generated in the browser from the same endpoints the list
 * pages read, so nothing leaves the operator's machine.
 *
 * Money columns export as plain numbers in EGP major units, not as
 * formatted currency strings. An operator opens these in a spreadsheet and
 * sums them; "EGP 1,240.00" is text, and it was also labelled USD.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Banner, Button, Card, FormField, Input, KeyValue } from "@/ds";
import { getCustomers } from "@/services/customerService";
import { getDashboardStats } from "@/services/dashboardService";
import { getMerchants } from "@/services/merchantService";
import { getOrders } from "@/services/orderService";
import type { NumuIconName } from "@/ds";
import { useState } from "react";
import { toast } from "sonner";

/** Piasters → a bare number a spreadsheet can add up. */
const egp = (piasters: number | null | undefined) => ((piasters ?? 0) / 100).toFixed(2);

const isoDate = (d: Date) => d.toISOString().split("T")[0];

function today() {
  return isoDate(new Date());
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return isoDate(d);
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: NumuIconName;
  columns: string;
}

const REPORTS: ReportDef[] = [
  {
    id: "orders",
    title: "Orders",
    description: "Up to 500 of the most recent orders across every merchant.",
    icon: "cart",
    columns: "order_id, merchant, customer, status, payment_status, total_egp, date",
  },
  {
    id: "customers",
    title: "Customers",
    description: "Up to 300 of the most recent customers across every merchant.",
    icon: "users",
    columns: "customer_id, merchant, name, email, phone, orders, spent_egp, joined",
  },
  {
    id: "merchants",
    title: "Merchants",
    description: "Up to 200 stores with plan, status and lifetime revenue.",
    icon: "building",
    columns: "store_id, name, email, domain, plan, status, revenue_egp, orders, created",
  },
  {
    id: "revenue",
    title: "Revenue summary",
    description: "Platform KPIs with their month-over-month change.",
    icon: "banknote",
    columns: "metric, value, mom_change",
  },
];

export default function Reports() {
  const [busy, setBusy] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo());
  const [dateTo, setDateTo] = useState(today());

  async function generate(reportId: string) {
    setBusy(reportId);
    try {
      const filename = `numu_${reportId}_${dateFrom}_${dateTo}.csv`;

      if (reportId === "orders") {
        const pages = await Promise.all(
          [0, 100, 200, 300, 400].map((offset) => getOrders({ limit: 100, offset })),
        );
        const rows = pages
          .flatMap((p) => p.orders)
          .map((o) => ({
            order_id: o.orderId,
            merchant: o.merchantId,
            customer: o.customerName || o.customerEmail || o.customerId || "",
            status: o.status,
            payment_status: o.paymentStatus,
            currency: o.currency ?? "EGP",
            total: egp(o.total),
            date: isoDate(o.createdAt),
          }));
        downloadCSV(toCSV(rows), filename);
      } else if (reportId === "customers") {
        const pages = await Promise.all(
          [0, 100, 200].map((offset) => getCustomers({ limit: 100, offset })),
        );
        const rows = pages
          .flatMap((p) => p.customers)
          .map((c) => ({
            customer_id: c.customerId,
            merchant: c.merchantId,
            name: c.name || "",
            email: c.email,
            phone: c.phone || "",
            orders: c.totalOrders ?? 0,
            spent_egp: egp(c.totalSpent),
            joined: isoDate(c.createdAt),
          }));
        downloadCSV(toCSV(rows), filename);
      } else if (reportId === "merchants") {
        const { merchants } = await getMerchants({ limit: 200 });
        const rows = merchants.map((m) => ({
          store_id: m.merchantId,
          name: m.name,
          email: m.email,
          domain: m.domain || "",
          plan: m.plan,
          status: m.status,
          internal: m.isInternal ? "yes" : "no",
          revenue_egp: egp(m.totalRevenue),
          orders: m.totalOrders ?? 0,
          created: isoDate(m.createdAt),
        }));
        downloadCSV(toCSV(rows), filename);
      } else if (reportId === "revenue") {
        const stats = await getDashboardStats();
        const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
        const rows = [
          {
            metric: "gross_merchant_revenue_egp",
            value: egp(stats.totalRevenue),
            mom_change: pct(stats.revenueChange),
          },
          { metric: "mrr_egp", value: egp(stats.mrr.total), mom_change: "" },
          {
            metric: "mrr_subscribers",
            value: stats.mrr.subscriberCount,
            mom_change: "",
          },
          {
            metric: "active_merchants",
            value: stats.activeMerchants,
            mom_change: pct(stats.merchantsChange),
          },
          {
            metric: "total_orders",
            value: stats.totalOrders,
            mom_change: pct(stats.ordersChange),
          },
          {
            metric: "total_customers",
            value: stats.totalCustomers,
            mom_change: pct(stats.customersChange),
          },
        ];
        downloadCSV(toCSV(rows), filename);
      }

      toast.success("Report downloaded", { description: filename });
    } catch (e) {
      toast.error((e as Error).message || "The export did not complete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardLayout
      title="Reports"
      subtitle="CSV exports, generated in your browser."
    >
      <Banner tone="info" icon="info" title="The dates name the file, they do not filter it">
        Every export returns the most recent records the API will serve. Filter
        in the spreadsheet, or use the export button on a filtered list page.
      </Banner>

      <Card title="Report period" subtitle="Filename only">
        <div className="ak-cell-line">
          <FormField label="From" htmlFor="report-from">
            <Input
              id="report-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </FormField>
          <FormField label="To" htmlFor="report-to">
            <Input
              id="report-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </FormField>
        </div>
      </Card>

      <div className="ak-2col">
        {REPORTS.map((report) => (
          <Card
            key={report.id}
            title={report.title}
            subtitle="CSV"
            footer={
              <Button
                size="sm"
                variant="subtle"
                icon="download"
                loading={busy === report.id}
                disabled={busy !== null && busy !== report.id}
                onClick={() => generate(report.id)}
              >
                Download
              </Button>
            }
          >
            <div className="ak-stack">
              <p style={{ fontSize: "var(--fs-app-sm)" }}>{report.description}</p>
              <KeyValue items={[{ label: "Columns", value: report.columns, mono: true }]} />
            </div>
          </Card>
        ))}
      </div>

      <Card title="About these exports" subtitle="Handling">
        <p style={{ fontSize: "var(--fs-app-sm)", maxWidth: "var(--measure)" }}>
          Files are built in this browser tab from the admin API and saved
          straight to your device — nothing is sent to a third party. They
          contain merchant and customer personal data, so treat a downloaded
          file the way you would treat the database it came from.
        </p>
      </Card>
    </DashboardLayout>
  );
}
