/**
 * Notifications & campaigns — what the platform sent on merchants' behalf.
 *
 * Read-only. Merchants compose and schedule their own campaigns in the hub;
 * staff are here to see delivery and failure. Sending from the admin would
 * put NUMU's name on a message the merchant never wrote, so there is no
 * compose button and that is deliberate rather than unfinished.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  MetricCard,
  Pagination,
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  listCampaigns,
  type CampaignChannelFilter,
  type CampaignItem,
} from "@/services/campaignsApi";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const PAGE_SIZE = 25;

const VIEWS: { id: CampaignChannelFilter; label: string }[] = [
  { id: "all", label: "All channels" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "other", label: "Other" },
];

const STATUS_BADGE: Record<string, "active" | "pending" | "delivered" | "failed" | "draft"> = {
  running: "active",
  sending: "active",
  scheduled: "pending",
  queued: "pending",
  completed: "delivered",
  sent: "delivered",
  failed: "failed",
  canceled: "failed",
  cancelled: "failed",
  draft: "draft",
};

export default function Campaigns() {
  const [channel, setChannel] = useState<CampaignChannelFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = {
    channel,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", params],
    queryFn: () => listCampaigns(params),
  });

  const stats = data?.stats;

  const columns: DataTableColumn<CampaignItem>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (c) => (
        <div>
          <div className="ntb__primary">{c.name}</div>
          <div className="ntb__sub">{c.store_name ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (c) => (
        <Badge tone={c.channel === "whatsapp" ? "success" : "info"} square>
          {c.channel}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <StatusBadge status={STATUS_BADGE[c.status] ?? "draft"} label={c.status} />
      ),
    },
    {
      key: "total_recipients",
      header: "Audience",
      align: "end",
      mono: true,
      render: (c) => formatNumber(c.total_recipients),
    },
    {
      key: "delivered_count",
      header: "Delivered",
      align: "end",
      mono: true,
      render: (c) => formatNumber(c.delivered_count),
    },
    {
      key: "failed_count",
      header: "Failed",
      align: "end",
      mono: true,
      render: (c) => formatNumber(c.failed_count),
    },
    {
      key: "delivery_rate",
      header: "Delivery",
      align: "end",
      mono: true,
      render: (c) => (c.delivery_rate == null ? "—" : `${c.delivery_rate}%`),
    },
    {
      key: "started_at",
      header: "Sent",
      mono: true,
      render: (c) => formatDateTime(c.started_at ?? c.scheduled_at ?? c.created_at),
    },
  ];

  const items = data?.items ?? [];

  return (
    <DashboardLayout
      title="Notifications & campaigns"
      subtitle="Outbound sends across every channel. Read-only — merchants compose their own."
    >
      <div className="ak-metrics">
        <MetricCard
          label="Campaigns · 30d"
          value={formatNumber(stats?.campaigns_30d)}
          icon="megaphone"
        />
        <MetricCard
          label="Recipients · 30d"
          value={formatNumber(stats?.recipients_30d)}
          icon="users"
          flat
        />
        <MetricCard
          label="Delivered · 30d"
          value={formatNumber(stats?.delivered_30d)}
          icon="check"
          flat
        />
        <MetricCard
          label="Failed · 30d"
          value={formatNumber(stats?.failed_30d)}
          icon="alertTriangle"
          alert={Boolean(stats?.failed_30d)}
          flat
        />
        <MetricCard
          label="Hub notifications"
          value={formatNumber(stats?.notifications_30d)}
          note={`${formatNumber(stats?.notifications_unread)} still unread`}
          icon="bell"
          flat
        />
      </div>

      <Card flush>
        <FilterBar
          savedViews={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
          activeView={channel}
          onViewChange={(id) => {
            setChannel(id as CampaignChannelFilter);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Campaign or merchant"
          actions={<span className="numu-label">read only</span>}
        />
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(c) => `${c.source}:${c.id}`}
          dense
          loading={isLoading}
          caption="Outbound campaigns"
          isFlagged={(c) => c.failed_count > 0 && c.failed_count >= c.delivered_count}
          empty={
            <EmptyState
              kind={search || channel !== "all" ? "noResults" : "empty"}
              icon="megaphone"
              title={
                search || channel !== "all" ? "Nothing matches" : "No campaigns sent yet"
              }
              body="Campaigns appear here once a merchant schedules or sends one from their hub."
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
