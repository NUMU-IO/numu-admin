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
  MetricCard,
  Pagination,
  type DataTableColumn,
} from "@/ds";
import { formatDate, formatMoneyShort, formatNumber } from "@/lib/format";
import { getCustomerStats, getCustomers, type Customer } from "@/services/customerService";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearch } from "wouter";

const PAGE_SIZE = 20;

export default function Customers() {
  const searchString = useSearch();
  const [search, setSearch] = useState(
    () => new URLSearchParams(searchString).get("q") ?? "",
  );
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
    { key: "merchantId", header: "Merchant", mono: true },
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
    <DashboardLayout
      title="Customers"
      subtitle="Shoppers across every merchant storefront."
    >
      <div className="ak-metrics ak-metrics--4">
        <MetricCard
          label="Total customers"
          value={formatNumber(stats?.total)}
          icon="users"
          flat
        />
        <MetricCard
          label="On this page"
          value={formatNumber(customers.length)}
          icon="user"
          flat
        />
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
