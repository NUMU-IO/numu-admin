/**
 * Customers — shoppers, across every merchant.
 *
 * The identifier an operator holds is almost always a phone number, so the
 * phone column is mono and LTR-isolated: an Egyptian number inside an Arabic
 * name would otherwise be reordered by the bidi algorithm and stop matching
 * what the operator pasted in.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  Input,
  KeyValue,
  MetricCard,
  Pagination,
  type DataTableColumn,
} from "@/ds";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  sentenceCase,
} from "@/lib/format";
import {
  getCustomerStats,
  getCustomers,
  lookupPhone,
  type Customer,
  type PhoneLookup,
} from "@/services/customerService";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";

const PAGE_SIZE = 20;

export default function Customers() {
  const [, navigate] = useLocation();
  const [phone, setPhone] = useState("");
  const lookup = useMutation({ mutationFn: lookupPhone });
  const searchString = useSearch();
  const [search, setSearch] = useState(() => new URLSearchParams(searchString).get("q") ?? "");
  const [page, setPage] = useState(1);

  const queryParams = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    search: search || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["customers", "list", queryParams],
    queryFn: () => getCustomers(queryParams),
  });
  const { data: stats } = useQuery({
    queryKey: ["customers", "stats"],
    queryFn: getCustomerStats,
  });

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <div>
          <div className="ntb__primary">{c.name || "—"}</div>
          <div className="ntb__sub numu-email">{c.email}</div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      mono: true,
      render: (c) => (c.phone ? <span className="numu-phone">{c.phone}</span> : "—"),
    },
    {
      key: "merchantId",
      header: "Merchant",
      // The store's NAME. This column carried a raw tenant UUID, which is not
      // an answer to "which merchant" — it is the same 36 characters for
      // every row of a store and unreadable across a table. The id stays
      // available on hover for the times it is the thing being matched.
      render: (c) => <span title={c.merchantId}>{c.merchantName ?? c.merchantId}</span>,
    },
    {
      key: "totalOrders",
      header: "Orders",
      align: "end",
      mono: true,
      render: (c) => formatNumber(c.totalOrders),
    },
    {
      key: "totalSpent",
      header: "Spent",
      align: "end",
      mono: true,
      render: (c) => formatMoneyShort(c.totalSpent),
    },
    {
      key: "createdAt",
      header: "First seen",
      mono: true,
      render: (c) => formatDate(c.createdAt),
    },
  ];

  const customers = data?.customers ?? [];
  const repeat = customers.filter((c) => (c.totalOrders ?? 0) > 1).length;

  return (
    <DashboardLayout title="Customers" subtitle="Shoppers across every merchant storefront.">
      <div className="ak-metrics ak-metrics--4">
        <MetricCard label="Total customers" value={formatNumber(stats?.total)} icon="users" flat />
        <MetricCard label="On this page" value={formatNumber(customers.length)} icon="user" flat />
        <MetricCard
          label="Repeat buyers here"
          value={formatNumber(repeat)}
          note="more than one order"
          icon="refresh"
          flat
        />
        <MetricCard
          label="Page"
          value={`${page} / ${Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))}`}
          icon="fileText"
          flat
        />
      </div>

      <Card title="Look up a phone">
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.trim()) lookup.mutate(phone.trim());
          }}
        >
          <Input
            icon="phone"
            mono
            dir="ltr"
            value={phone}
            placeholder="01001234567 or +201001234567"
            aria-label="Phone number"
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" loading={lookup.isPending} disabled={!phone.trim()}>
            Look up
          </Button>
        </form>
        {lookup.error ? (
          <EmptyState kind="error" title="Lookup failed" body={(lookup.error as Error).message} />
        ) : lookup.data ? (
          <PhoneResult
            r={lookup.data}
            onOpenOrder={(n) => navigate(`/orders?q=${encodeURIComponent(n)}`)}
          />
        ) : null}
      </Card>

      <Card flush>
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Name, email or phone"
          actions={<span className="numu-label">Read only</span>}
        />
        <DataTable
          columns={columns}
          rows={customers}
          rowKey={(c) => c.customerId}
          loading={isLoading}
          caption="Customers across all merchants"
          empty={
            <EmptyState
              kind={search ? "noResults" : "empty"}
              title={search ? "Nothing matches" : "No customers yet"}
              body={
                search
                  ? "Phone numbers match in E.164 form, e.g. +2010…"
                  : "A customer appears here after their first checkout on any storefront."
              }
              action={
                search ? (
                  <Button size="sm" variant="subtle" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </Card>
    </DashboardLayout>
  );
}

function PhoneResult({ r, onOpenOrder }: { r: PhoneLookup; onOpenOrder: (n: string) => void }) {
  const s = r.stats;
  const n = r.network;
  return (
    <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
      <KeyValue
        items={[
          { label: "Phone", value: r.phone, mono: true },
          {
            label: "Orders",
            value: `${formatNumber(s.orders)} at ${formatNumber(s.stores)} stores`,
          },
          {
            label: "Delivered / returned / cancelled",
            value: `${s.delivered} / ${s.returned} / ${s.cancelled}`,
            mono: true,
          },
          {
            label: "Return rate",
            value: s.return_rate == null ? "—" : `${Math.round(s.return_rate * 100)}%`,
            mono: true,
          },
          { label: "Paid in total", value: formatMoney(s.paid_total_cents), mono: true },
          ...(n
            ? [
                {
                  label: "Trust network",
                  value: `${n.total_network_orders} orders · ${n.total_network_rtos} returns · ${n.contributing_store_count} stores · score ${n.network_risk_score ?? "—"} (${n.confidence_level})`,
                },
              ]
            : []),
        ]}
      />
      <DataTable
        dense
        columns={[
          { key: "n", header: "Order", mono: true, render: (o) => o.order_number },
          { key: "s", header: "Store", render: (o) => o.store_name },
          { key: "st", header: "Status", render: (o) => sentenceCase(o.status) },
          {
            key: "p",
            header: "Payment",
            render: (o) =>
              `${sentenceCase(o.payment_status)}${o.payment_method ? ` · ${sentenceCase(o.payment_method)}` : ""}`,
          },
          {
            key: "t",
            header: "Total",
            align: "end",
            mono: true,
            render: (o) => formatMoney(o.total, o.currency),
          },
          {
            key: "d",
            header: "Placed",
            mono: true,
            render: (o) => formatDateTime(o.created_at),
          },
        ]}
        rows={r.orders}
        rowKey={(o) => o.id}
        caption="Orders from this phone at every store, newest first"
        onRowClick={(o) => onOpenOrder(o.order_number)}
        empty={<EmptyState kind="noResults" title="No orders from this phone" />}
      />
    </div>
  );
}
