/**
 * App reviews — the moderation queue for merchant reviews of apps.
 *
 * A merchant or the app's partner reports a review; it lands here. Hide
 * takes it out of the listing and the rating (its author still sees it),
 * dismiss keeps it and clears the report.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  type DataTableColumn,
} from "@/ds";
import { formatNumber, formatRelative } from "@/lib/format";
import {
  listAppReviews,
  moderateAppReview,
  type AppReview,
  type ReviewQueue,
} from "@/services/appFeedbackApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const VIEWS: { id: ReviewQueue; label: string }[] = [
  { id: "reported", label: "Reported" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All" },
];

export default function AppReviews() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<ReviewQueue>("reported");
  const [page, setPage] = useState(1);
  const params = { queue, page, page_size: PAGE_SIZE };
  const { data, isLoading } = useQuery({
    queryKey: ["app-reviews", params],
    queryFn: () => listAppReviews(params),
  });
  const moderate = useMutation({
    mutationFn: (v: { id: string; action: "hide" | "unhide" | "dismiss" }) =>
      moderateAppReview(v.id, v.action),
    onSuccess: (_, v) => {
      toast.success(v.action === "dismiss" ? "Report dismissed" : v.action === "hide" ? "Review hidden" : "Review shown");
      queryClient.invalidateQueries({ queryKey: ["app-reviews"] });
    },
    onError: (e) => toast.error((e as Error).message || "The review was not updated"),
  });

  const columns: DataTableColumn<AppReview>[] = [
    {
      key: "rating",
      header: "Rating",
      render: (r) => (
        <Badge tone={r.rating <= 2 ? "warning" : "neutral"} square>
          {r.rating}/5
        </Badge>
      ),
    },
    {
      key: "body",
      header: "Review",
      render: (r) => (
        <div>
          <div className="ntb__primary">{r.body ?? "—"}</div>
          <div className="ntb__sub">
            {r.app_name ?? "—"} · {r.store_name ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "report_reason",
      header: "Report",
      render: (r) => (r.reported ? r.report_reason : r.is_hidden ? "Hidden" : "—"),
    },
    { key: "created_at", header: "Written", mono: true, render: (r) => formatRelative(r.created_at) },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => (
        <div className="ak-cell-line">
          {r.is_hidden ? (
            <Button size="sm" variant="subtle" onClick={() => moderate.mutate({ id: r.id, action: "unhide" })}>
              Show
            </Button>
          ) : (
            <Button size="sm" variant="subtle" onClick={() => moderate.mutate({ id: r.id, action: "hide" })}>
              Hide
            </Button>
          )}
          {r.reported ? (
            <Button size="sm" variant="ghost" onClick={() => moderate.mutate({ id: r.id, action: "dismiss" })}>
              Dismiss
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      title="App reviews"
      subtitle="Reported merchant reviews of apps. Hide abuse, dismiss the rest."
      meta={<span>{formatNumber(data?.total)} reviews</span>}
    >
      <Card flush>
        <FilterBar
          savedViews={VIEWS}
          activeView={queue}
          onViewChange={(id) => {
            setQueue(id as ReviewQueue);
            setPage(1);
          }}
          actions={<span className="numu-label">{formatNumber(data?.total)} reviews</span>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          dense
          loading={isLoading}
          caption="App reviews"
          empty={
            <EmptyState
              kind="empty"
              icon="star"
              title={queue === "reported" ? "No reports" : "Nothing here"}
              body={queue === "reported" ? "No review is waiting for a decision." : "Switch to another view."}
            />
          }
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
      </Card>
    </DashboardLayout>
  );
}
