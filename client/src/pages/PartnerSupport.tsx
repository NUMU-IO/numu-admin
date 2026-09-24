/**
 * Partner support — tickets partners open to NUMU from the partner portal.
 *
 * A staff reply marks the ticket answered and emails the partner; a partner
 * reply puts it back to open. Oldest activity last, so the list reads as an
 * inbox.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  FormField,
  KeyValue,
  Pagination,
  StatusBadge,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import {
  closePartnerTicket,
  getPartnerTicket,
  listPartnerTickets,
  replyPartnerTicket,
  type PartnerTicket,
  type TicketStatus,
} from "@/services/appFeedbackApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const VIEWS: { id: TicketStatus | "all"; label: string }[] = [
  { id: "open", label: "Waiting on NUMU" },
  { id: "answered", label: "Answered" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

const STATUS: Record<TicketStatus, { status: "open" | "resolved" | "closed"; label: string }> = {
  open: { status: "open", label: "Open" },
  answered: { status: "resolved", label: "Answered" },
  closed: { status: "closed", label: "Closed" },
};

const AUTHOR = { merchant: "Merchant", partner: "Partner", staff: "NUMU" } as const;

export default function PartnerSupport() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<TicketStatus | "all">("open");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const params = {
    status: view === "all" ? undefined : view,
    page,
    page_size: PAGE_SIZE,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["partner-support", params],
    queryFn: () => listPartnerTickets(params),
    refetchInterval: 60_000,
  });
  const { data: thread } = useQuery({
    queryKey: ["partner-support", "thread", openId],
    queryFn: () => getPartnerTicket(openId!),
    enabled: Boolean(openId),
  });

  const settle = (next: Awaited<ReturnType<typeof getPartnerTicket>>) => {
    queryClient.setQueryData(["partner-support", "thread", next.ticket.id], next);
    queryClient.invalidateQueries({ queryKey: ["partner-support"] });
  };
  const send = useMutation({
    mutationFn: () => replyPartnerTicket(openId!, reply.trim()),
    onSuccess: (next) => {
      toast.success("Reply sent");
      setReply("");
      settle(next);
    },
    onError: (e) => toast.error((e as Error).message || "The reply was not sent"),
  });
  const close = useMutation({
    mutationFn: () => closePartnerTicket(openId!),
    onSuccess: (next) => {
      toast.success("Ticket closed");
      settle(next);
    },
    onError: (e) => toast.error((e as Error).message || "The ticket was not closed"),
  });

  const columns: DataTableColumn<PartnerTicket>[] = [
    {
      key: "subject",
      header: "Ticket",
      render: (t) => <div className="ntb__primary">{t.subject}</div>,
    },
    { key: "partner_name", header: "Partner", render: (t) => t.partner_name ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusBadge status={STATUS[t.status].status} label={STATUS[t.status].label} />,
    },
    {
      key: "last_message_at",
      header: "Last message",
      mono: true,
      render: (t) => formatRelative(t.last_message_at ?? t.created_at),
    },
  ];

  const ticket = thread?.ticket;

  return (
    <DashboardLayout
      title="Partner support"
      subtitle="Questions partners send NUMU from the partner portal."
      meta={<span>{formatNumber(data?.total)} tickets</span>}
    >
      <Card flush>
        <FilterBar
          savedViews={VIEWS}
          activeView={view}
          onViewChange={(id) => {
            setView(id as TicketStatus | "all");
            setPage(1);
          }}
          actions={<span className="numu-label">{formatNumber(data?.total)} tickets</span>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(t) => t.id}
          dense
          loading={isLoading}
          caption="Partner support tickets"
          onRowClick={(t) => {
            setOpenId(t.id);
            setReply("");
          }}
          empty={
            <EmptyState
              kind="empty"
              icon="inbox"
              title={view === "open" ? "Nothing waiting" : "Nothing here"}
              body={view === "open" ? "No partner is waiting on an answer." : "Switch to another view."}
            />
          }
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
      </Card>

      <Drawer
        open={Boolean(openId)}
        title={ticket?.subject ?? "Ticket"}
        onClose={() => setOpenId(null)}
        footer={
          ticket ? (
            <>
              <Button variant="ghost" onClick={() => setOpenId(null)}>
                Close panel
              </Button>
              {ticket.status !== "closed" ? (
                <Button variant="subtle" loading={close.isPending} onClick={() => close.mutate()}>
                  Close ticket
                </Button>
              ) : null}
              <Button
                icon="check"
                loading={send.isPending}
                disabled={!reply.trim()}
                onClick={() => send.mutate()}
              >
                Send reply
              </Button>
            </>
          ) : null
        }
      >
        {thread && ticket ? (
          <div className="ak-stack">
            <KeyValue
              items={[
                { label: "Partner", value: ticket.partner_name ?? "—" },
                { label: "Status", value: STATUS[ticket.status].label },
                { label: "Opened", value: formatDateTime(ticket.created_at), mono: true },
              ]}
            />
            {thread.messages.map((m) => (
              <div key={m.id} className="ak-note">
                <p className="numu-label">
                  {AUTHOR[m.author_role]} · {formatDateTime(m.created_at)}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
                {m.attachments.map((a) => (
                  <p key={a.url}>
                    <a href={a.url} target="_blank" rel="noreferrer noopener">
                      {a.name}
                    </a>
                  </p>
                ))}
              </div>
            ))}
            <FormField label="Reply" htmlFor="partner-reply" hint="Emailed to the partner's support address.">
              <Textarea
                id="partner-reply"
                rows={4}
                maxLength={5000}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </FormField>
          </div>
        ) : null}
      </Drawer>
    </DashboardLayout>
  );
}
