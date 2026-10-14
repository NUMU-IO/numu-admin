/**
 * Audit log — who did what, to which merchant, and when.
 *
 * Every audited action on the platform, newest first: staff actions from this
 * panel, merchants' own changes and automated ones. Read only.
 */

import { useDeferredValue, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import DashboardLayout from "@/components/DashboardLayout";
import {
  AuditTimeline,
  Button,
  Card,
  EmptyState,
  FilterBar,
  Input,
  Select,
  Skeleton,
  type AuditEntry,
} from "@/ds";
import { formatDateTime, humanizeAction } from "@/lib/format";
import {
  listAuditActors,
  listAuditLog,
  type AuditLogFilters,
  type AuditLogRow,
} from "@/services/auditApi";

function toEntry(row: AuditLogRow, staff: Set<string>): AuditEntry {
  const merchant = row.tenant_name ?? row.tenant_subdomain;
  const resource = row.resource_type ? `${row.resource_type} ${row.resource_id ?? ""}` : "";
  return {
    id: row.id,
    action: humanizeAction(row.event_type),
    actor: row.actor_email ?? "system",
    actorType: !row.user_id ? "system" : staff.has(row.user_id) ? "staff" : "merchant",
    timestamp: formatDateTime(row.created_at),
    entity: [merchant, row.store_name].filter(Boolean).join(" · ") || undefined,
    meta: [row.event_type, resource.trim()].filter(Boolean).join(" · "),
    note: Object.keys(row.details ?? {}).length ? (
      <code dir="ltr" style={{ wordBreak: "break-all" }}>
        {JSON.stringify(row.details)}
      </code>
    ) : undefined,
    tone:
      row.severity === "warning"
        ? "warning"
        : row.severity === "error" || row.severity === "critical"
          ? "danger"
          : undefined,
  };
}

export default function AuditLog() {
  const [userId, setUserId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState<AuditLogFilters["actor"]>("");
  const [since, setSince] = useState("");

  const filters: AuditLogFilters = {
    user_id: userId,
    merchant: useDeferredValue(merchant.trim()),
    event_type: useDeferredValue(eventType.trim()),
    actor,
    since: since ? `${since}T00:00:00Z` : "",
  };

  const actors = useQuery({ queryKey: ["audit-actors"], queryFn: listAuditActors });
  const log = useInfiniteQuery({
    queryKey: ["audit-log", filters],
    queryFn: ({ pageParam }) => listAuditLog(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });

  const staff = new Set((actors.data ?? []).map((a) => a.id));
  const rows = log.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = Boolean(userId || merchant || eventType || actor || since);

  return (
    <DashboardLayout
      title="Audit log"
      subtitle="Every audited action on the platform, newest first: staff, merchants and automation."
      actions={
        <Button
          variant="subtle"
          icon="refresh"
          loading={log.isFetching && !log.isFetchingNextPage}
          onClick={() => void log.refetch()}
        >
          Refresh
        </Button>
      }
    >
      <Card flush>
        <FilterBar
          search={merchant}
          onSearchChange={setMerchant}
          searchPlaceholder="Merchant name or subdomain"
          actions={<span className="numu-label">Read only</span>}
        >
          <Select
            aria-label="Staff member"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={[
              { value: "", label: "Anyone" },
              ...(actors.data ?? []).map((a) => ({ value: a.id, label: a.email })),
            ]}
          />
          <Select
            aria-label="Actor type"
            value={actor}
            onChange={(e) => setActor(e.target.value as AuditLogFilters["actor"])}
            options={[
              { value: "", label: "All actors" },
              { value: "staff", label: "Staff" },
              { value: "system", label: "System" },
            ]}
          />
          <Input
            aria-label="Event type"
            mono
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="Event type, e.g. admin."
          />
          <Input
            aria-label="Since"
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </FilterBar>
        <div style={{ padding: 16 }}>
          {log.isLoading ? (
            <Skeleton lines={8} />
          ) : log.isError ? (
            <EmptyState kind="error" title="Audit log failed to load" body={log.error.message} />
          ) : rows.length ? (
            <AuditTimeline entries={rows.map((r) => toEntry(r, staff))} />
          ) : (
            <EmptyState
              kind={filtered ? "noResults" : "empty"}
              icon="history"
              title={filtered ? "Nothing matches" : "No audited actions yet"}
              body={
                filtered
                  ? "Event types match by prefix, e.g. admin. or api_key."
                  : "Audited actions appear here as they happen."
              }
            />
          )}
          {log.hasNextPage ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <Button
                variant="subtle"
                loading={log.isFetchingNextPage}
                onClick={() => void log.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </DashboardLayout>
  );
}
