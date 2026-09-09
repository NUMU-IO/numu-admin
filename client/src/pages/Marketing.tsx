/**
 * Marketing — reaching leads, the copy, and the referral programme.
 *
 * Three tabs because they are three jobs, not three views of one thing:
 * picking who to message, writing what they receive, and paying the merchants
 * who bring us other merchants.
 *
 * ─── THE ONE THING TO KNOW ───────────────────────────────────────────────────
 * WhatsApp is NOT sent by the platform. Send produces a `wa.me` link per lead
 * with the message already typed, and the operator sends it from their own
 * WhatsApp. Links open ONE AT A TIME from the results panel rather than
 * automatically: every browser blocks a burst of popups, so auto-opening
 * forty would silently deliver one and swallow the rest.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  MetricCard,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { listLeads, type Lead, type LeadStatusFilter } from "@/services/leadsApi";
import {
  createTemplate,
  decideReward,
  deleteTemplate,
  getMarketingSettings,
  getReferralSummary,
  listMilestones,
  listOutreach,
  listRewards,
  listTemplates,
  previewMessage,
  recalculateReferrals,
  sendMessage,
  updateMilestone,
  updateTemplate,
  type MarketingChannel,
  type MarketingLanguage,
  type MarketingTemplate,
  type MilestoneSetting,
  type SendResult,
} from "@/services/marketingApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const LEAD_PAGE_SIZE = 50;

const LEAD_VIEWS: { id: LeadStatusFilter; label: string }[] = [
  { id: "all", label: "All leads" },
  { id: "new", label: "New" },
  { id: "demo_started", label: "Demo started" },
  { id: "registered", label: "Registered" },
  { id: "store_created", label: "Store created" },
  { id: "activated", label: "Activated" },
];

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Each lead's own language" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية (Egyptian)" },
];

export default function Marketing() {
  const [tab, setTab] = useState<"send" | "templates" | "referrals">("send");

  const { data: settings } = useQuery({
    queryKey: ["marketing", "settings"],
    queryFn: getMarketingSettings,
  });

  return (
    <DashboardLayout
      title="Marketing"
      subtitle="Reach a lead, keep the copy, pay for a referral."
      meta={settings ? <span>Email from {settings.email_from}</span> : undefined}
      tabs={
        <Tabs
          tabs={[
            { id: "send", label: "Reach out", icon: "megaphone" },
            { id: "templates", label: "Templates", icon: "fileText" },
            { id: "referrals", label: "Referrals", icon: "userPlus" },
          ]}
          active={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      }
    >
      {tab === "send" ? <ReachOut emailEnabled={settings?.email_enabled ?? true} /> : null}
      {tab === "templates" ? <Templates /> : null}
      {tab === "referrals" ? <Referrals /> : null}
    </DashboardLayout>
  );
}

// ── Reach out ────────────────────────────────────────────────────────────────

function ReachOut({ emailEnabled }: { emailEnabled: boolean }) {
  const [view, setView] = useState<LeadStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [channel, setChannel] = useState<MarketingChannel>("whatsapp");
  const [language, setLanguage] = useState<"auto" | MarketingLanguage>("auto");
  const [templateKey, setTemplateKey] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "leads", view, search],
    queryFn: () =>
      listLeads({
        page: 1,
        pageSize: LEAD_PAGE_SIZE,
        status: view,
        q: search || undefined,
      }),
  });

  const { data: templates } = useQuery({
    queryKey: ["marketing", "templates", channel],
    queryFn: () => listTemplates(channel),
  });

  const leads = data?.items ?? [];

  // Distinct keys, not rows: a template exists once per language and the
  // operator picks the copy, not the translation.
  const templateKeys = useMemo(() => {
    const seen: { value: string; label: string }[] = [];
    for (const t of templates ?? []) {
      if (!seen.some((s) => s.value === t.key)) seen.push({ value: t.key, label: t.name });
    }
    return seen;
  }, [templates]);

  // A lead with no address for the chosen channel cannot be reached, and
  // saying so before the send beats reporting it after.
  const reachable = (lead: Lead) =>
    channel === "email" ? !!lead.email : !!(lead.whatsapp_phone || lead.phone);

  const selectedLeads = leads.filter((l) => selected.includes(l.id));
  const unreachable = selectedLeads.filter((l) => !reachable(l)).length;

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "email",
      header: "Lead",
      render: (l) => (
        <div>
          <div className="ntb__primary">{l.name || "—"}</div>
          <div className="ntb__sub numu-email">{l.email}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Stage",
      render: (l) => <Badge tone="neutral" square>{l.status}</Badge>,
    },
    {
      key: "language",
      header: "Language",
      render: (l) => (l.language?.toLowerCase().startsWith("ar") ? "العربية" : "English"),
    },
    {
      key: "reach",
      header: "Reachable",
      render: (l) =>
        reachable(l) ? (
          <StatusBadge
            status="verified"
            label={channel === "email" ? "Email" : "WhatsApp"}
            icon={channel === "email" ? "mail" : "messageCircle"}
          />
        ) : (
          <Badge tone="warning" square>
            no {channel === "email" ? "email" : "number"}
          </Badge>
        ),
    },
    {
      key: "last_seen_at",
      header: "Last seen",
      mono: true,
      render: (l) => (l.last_seen_at ? formatRelative(l.last_seen_at) : "—"),
    },
  ];

  return (
    <>
      {channel === "email" && !emailEnabled ? (
        <Banner tone="warning" title="Email is not configured on this environment">
          Sends will fail. WhatsApp still works — it produces a link you send
          yourself.
        </Banner>
      ) : null}

      <FilterBar
        savedViews={LEAD_VIEWS.map((v) => ({ id: v.id, label: v.label }))}
        activeView={view}
        onViewChange={(id) => {
          setView(id as LeadStatusFilter);
          // Selection is per list. Keeping ids from a filter the operator can
          // no longer see is how forty people get a message nobody reviewed.
          setSelected([]);
        }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email or phone"
      />

      <Card
        title={`${leads.length} leads`}
        subtitle={
          selected.length
            ? `${selected.length} selected${unreachable ? ` · ${unreachable} unreachable on ${channel}` : ""}`
            : "Select the leads to reach"
        }
        actions={
          <>
            <Select
              aria-label="Channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as MarketingChannel)}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Email" },
              ]}
            />
            <Button
              variant="primary"
              icon="megaphone"
              disabled={!selected.length}
              onClick={() => {
                setResult(null);
                setComposeOpen(true);
              }}
            >
              Compose
            </Button>
          </>
        }
        flush
      >
        <DataTable
          columns={columns}
          rows={leads}
          loading={isLoading}
          dense
          selectable
          selected={selected}
          rowKey={(l) => l.id}
          onSelect={(id) =>
            setSelected((prev) =>
              prev.includes(String(id))
                ? prev.filter((x) => x !== String(id))
                : [...prev, String(id)],
            )
          }
          onSelectAll={(checked) =>
            setSelected(checked ? leads.filter(reachable).map((l) => l.id) : [])
          }
          empty={<EmptyState kind="empty" title="No leads match this filter" />}
        />
      </Card>

      {result ? (
        <SendResults
          result={result}
          channel={channel}
          onDismiss={() => setResult(null)}
        />
      ) : null}

      {composeOpen ? (
        <Compose
          leadIds={selected}
          channel={channel}
          language={language}
          onLanguageChange={setLanguage}
          templateKey={templateKey}
          onTemplateChange={setTemplateKey}
          templateKeys={templateKeys}
          onClose={() => setComposeOpen(false)}
          onSent={(r) => {
            setResult(r);
            setComposeOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function Compose({
  leadIds,
  channel,
  language,
  onLanguageChange,
  templateKey,
  onTemplateChange,
  templateKeys,
  onClose,
  onSent,
}: {
  leadIds: string[];
  channel: MarketingChannel;
  language: "auto" | MarketingLanguage;
  onLanguageChange: (v: "auto" | MarketingLanguage) => void;
  templateKey: string;
  onTemplateChange: (v: string) => void;
  templateKeys: { value: string; label: string }[];
  onClose: () => void;
  onSent: (result: SendResult) => void;
}) {
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const useTemplate = templateKey !== "__custom__";

  const request = {
    lead_ids: leadIds,
    channel,
    language: language === "auto" ? null : language,
    template_key: useTemplate ? templateKey || null : null,
    subject: useTemplate ? null : customSubject || null,
    body: useTemplate ? null : customBody || null,
  };

  // Preview against the FIRST selected lead, with real substitutions in it.
  // Placeholders are where marketing copy goes wrong and they are invisible
  // in the editor.
  const { data: preview, error: previewError } = useQuery({
    queryKey: ["marketing", "preview", request],
    queryFn: () => previewMessage(request),
    enabled: useTemplate ? !!templateKey : !!customBody,
    retry: false,
  });

  const send = useMutation({
    mutationFn: () => sendMessage(request),
    onSuccess: (result) => {
      onSent(result);
      if (channel === "whatsapp") {
        toast.success(`${result.sent} messages ready to send`, {
          description: "Open each link to send it from your WhatsApp.",
        });
      } else {
        toast.success(`${result.sent} emails sent`, {
          description: result.failed ? `${result.failed} failed` : undefined,
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = useTemplate ? !!templateKey : !!customBody;

  return (
    <Dialog
      open
      title={`Message ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`}
      description={
        channel === "whatsapp"
          ? "WhatsApp is not sent from here. You get a link per lead with the message already typed, and send it from your own WhatsApp."
          : "Sent from hello@numueg.app. Replies come back to that mailbox."
      }
      width={720}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={channel === "whatsapp" ? "messageCircle" : "mail"}
            loading={send.isPending}
            disabled={!ready}
            onClick={() => send.mutate()}
          >
            {channel === "whatsapp" ? "Prepare links" : "Send emails"}
          </Button>
        </>
      }
    >
      <div className="ak-stack">
        <div className="ak-2col">
          <FormField label="Template">
            <Select
              value={templateKey}
              onChange={(e) => onTemplateChange(e.target.value)}
              placeholder="Choose a template"
              options={[
                ...templateKeys,
                { value: "__custom__", label: "Write a one-off…" },
              ]}
            />
          </FormField>
          <FormField
            label="Language"
            hint="A merchant who used the Arabic dashboard should not get English."
          >
            <Select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as typeof language)}
              options={LANGUAGE_OPTIONS}
            />
          </FormField>
        </div>

        {!useTemplate ? (
          <>
            {channel === "email" ? (
              <FormField label="Subject">
                <Input
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Still thinking about your store, {{name}}?"
                />
              </FormField>
            ) : null}
            <FormField
              label="Message"
              hint="{{name}} · {{email}} · {{referral_code}} · {{referral_link}}"
            >
              <Textarea
                rows={6}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
              />
            </FormField>
          </>
        ) : null}

        {previewError ? (
          <Banner tone="danger" title={(previewError as Error).message} />
        ) : null}

        {preview ? (
          <Card
            title="Preview"
            subtitle={`As ${preview.recipient} will receive it`}
            variant="flat"
          >
            {preview.subject ? (
              <div className="ak-row-line">
                <span className="ak-feed__meta">Subject</span>
                <strong>{preview.subject}</strong>
              </div>
            ) : null}
            <div
              className="ak-preview"
              dir="auto"
              // The body IS the message. Rendering an email preview as text
              // would show the operator markup instead of what the merchant
              // sees, and the source is our own templates — no third-party
              // HTML reaches this.
              dangerouslySetInnerHTML={{
                __html:
                  channel === "email"
                    ? preview.body
                    : escapeHtml(preview.body).replace(/\n/g, "<br />"),
              }}
            />
          </Card>
        ) : null}
      </div>
    </Dialog>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function SendResults({
  result,
  channel,
  onDismiss,
}: {
  result: SendResult;
  channel: MarketingChannel;
  onDismiss: () => void;
}) {
  const [opened, setOpened] = useState<string[]>([]);

  return (
    <Card
      title={
        channel === "whatsapp"
          ? `${result.sent} messages ready`
          : `${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`
      }
      subtitle={
        channel === "whatsapp"
          ? "Open each one to send it from your WhatsApp. They open one at a time on purpose — a browser blocks a burst of tabs."
          : undefined
      }
      actions={
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      }
      flush
    >
      <DataTable
        dense
        rowKey={(d) => d.lead_id}
        rows={result.details}
        columns={[
          {
            key: "lead",
            header: "Lead",
            render: (d) => (
              <div>
                <div className="ntb__primary">{d.name || d.email || d.lead_id}</div>
                {d.phone ? <div className="ntb__sub numu-mono">{d.phone}</div> : null}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (d) =>
              d.status === "sent" ? (
                <StatusBadge status="verified" label="Ready" />
              ) : (
                <Badge tone={d.status === "failed" ? "danger" : "warning"} square>
                  {d.reason || d.status}
                </Badge>
              ),
          },
          {
            key: "action",
            header: "",
            align: "end",
            render: (d) =>
              d.whatsapp_url ? (
                <Button
                  size="sm"
                  variant={opened.includes(d.lead_id) ? "ghost" : "outline"}
                  icon="externalLink"
                  as="a"
                  href={d.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpened((prev) => [...prev, d.lead_id])}
                >
                  {opened.includes(d.lead_id) ? "Opened" : "Open WhatsApp"}
                </Button>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}

// ── Templates ────────────────────────────────────────────────────────────────

function Templates() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MarketingTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["marketing", "templates", "all"],
    queryFn: () => listTemplates(),
  });

  const remove = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["marketing", "templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: DataTableColumn<MarketingTemplate>[] = [
    {
      key: "name",
      header: "Template",
      render: (t) => (
        <div>
          <div className="ntb__primary">{t.name}</div>
          <div className="ntb__sub numu-mono">{t.key}</div>
        </div>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (t) => (
        <StatusBadge
          status="verified"
          label={t.channel === "email" ? "Email" : "WhatsApp"}
          icon={t.channel === "email" ? "mail" : "messageCircle"}
        />
      ),
    },
    {
      key: "language",
      header: "Language",
      render: (t) => (t.language === "ar" ? "العربية" : "English"),
    },
    {
      key: "subject",
      header: "Subject / opening",
      render: (t) => (
        <span dir="auto" className="ak-truncate">
          {t.subject || t.body.replace(/<[^>]+>/g, "").slice(0, 70)}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Live",
      render: (t) =>
        t.is_active ? (
          <StatusBadge status="active" label="Live" />
        ) : (
          <Badge tone="neutral" square>
            off
          </Badge>
        ),
    },
    {
      key: "updated_at",
      header: "Updated",
      mono: true,
      render: (t) => formatRelative(t.updated_at),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (t) => (
        <span className="ak-rowactions">
          <Button size="sm" variant="ghost" icon="fileText" onClick={() => setEditing(t)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="trash"
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${t.name}" (${t.channel}, ${t.language})? Messages already sent are unaffected.`,
                )
              ) {
                remove.mutate(t.id);
              }
            }}
          >
            Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Templates"
        subtitle="Every one exists in English and Egyptian Arabic. A send picks the version matching the lead's own language."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            New template
          </Button>
        }
        flush
      >
        <DataTable
          columns={columns}
          rows={templates ?? []}
          rowKey={(t) => t.id}
          loading={isLoading}
          dense
          empty={<EmptyState kind="empty" title="No templates yet" />}
        />
      </Card>

      {editing ? (
        <TemplateEditor template={editing} onClose={() => setEditing(null)} />
      ) : null}
      {creating ? <TemplateEditor onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function TemplateEditor({
  template,
  onClose,
}: {
  template?: MarketingTemplate;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState(template?.key ?? "");
  const [channel, setChannel] = useState<MarketingChannel>(template?.channel ?? "email");
  const [language, setLanguage] = useState(template?.language ?? "en");
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  const save = useMutation({
    mutationFn: () =>
      template
        ? updateTemplate(template.id, {
            name,
            subject: channel === "email" ? subject : null,
            body,
            is_active: isActive,
          })
        : createTemplate({
            key,
            channel,
            language,
            name,
            subject: channel === "email" ? subject : null,
            body,
            is_active: isActive,
          }),
    onSuccess: () => {
      toast.success(template ? "Template saved" : "Template created");
      queryClient.invalidateQueries({ queryKey: ["marketing", "templates"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isArabic = language === "ar";

  return (
    <Dialog
      open
      title={template ? `Edit ${template.name}` : "New template"}
      description={
        template
          ? "The key, channel and language are fixed — messages already sent keep the copy they went out with."
          : "A key groups the same message across channels and languages."
      }
      width={760}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!name || !body || (channel === "email" && !subject)}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="ak-stack">
        {!template ? (
          <div className="ak-3col">
            <FormField label="Key" hint="lowercase_with_underscores">
              <Input
                mono
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="follow_up"
              />
            </FormField>
            <FormField label="Channel">
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as MarketingChannel)}
                options={[
                  { value: "email", label: "Email" },
                  { value: "whatsapp", label: "WhatsApp" },
                ]}
              />
            </FormField>
            <FormField label="Language">
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={[
                  { value: "en", label: "English" },
                  { value: "ar", label: "العربية (Egyptian)" },
                ]}
              />
            </FormField>
          </div>
        ) : null}

        <FormField label="Name" hint="What an operator picks it by">
          <Input value={name} onChange={(e) => setName(e.target.value)} arabic={isArabic} />
        </FormField>

        {channel === "email" ? (
          <FormField label="Subject">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              arabic={isArabic}
            />
          </FormField>
        ) : null}

        <FormField
          label={channel === "email" ? "Body (HTML)" : "Message"}
          hint="{{name}} · {{full_name}} · {{email}} · {{referral_code}} · {{referral_link}}"
        >
          <Textarea
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            arabic={isArabic}
          />
        </FormField>

        <Switch
          checked={isActive}
          onChange={setIsActive}
          label="Live"
          description="A template that is off cannot be sent, but stays here to edit."
        />
      </div>
    </Dialog>
  );
}

// ── Referrals ────────────────────────────────────────────────────────────────

function Referrals() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "paid" | "all"
  >("pending");

  const { data: summary } = useQuery({
    queryKey: ["marketing", "referrals", "summary"],
    queryFn: getReferralSummary,
  });
  const { data: milestones } = useQuery({
    queryKey: ["marketing", "referrals", "milestones"],
    queryFn: listMilestones,
  });
  const { data: rewards, isLoading } = useQuery({
    queryKey: ["marketing", "referrals", statusFilter],
    queryFn: () => listRewards(statusFilter),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["marketing", "referrals"] });

  const decide = useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: "approve" | "pay" | "void";
      note?: string;
    }) => decideReward(id, { action, note }),
    onSuccess: () => {
      toast.success("Reward updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recalculate = useMutation({
    mutationFn: recalculateReferrals,
    onSuccess: (r) => {
      toast.success(
        r.rewards_created
          ? `${r.rewards_created} new rewards across ${r.leads_scanned} referred leads`
          : `${r.leads_scanned} referred leads scanned — nothing new`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="ak-metrics ak-metrics--4">
        <MetricCard
          label="Awaiting approval"
          value={formatMoney(summary?.pending_cents ?? 0)}
          note={`${formatNumber(summary?.pending_count)} rewards`}
          icon="clock"
          alert={Boolean(summary?.pending_count)}
        />
        <MetricCard
          label="Approved, unpaid"
          value={formatMoney(summary?.approved_cents ?? 0)}
          note={`${formatNumber(summary?.approved_count)} rewards`}
          icon="banknote"
          flat
        />
        <MetricCard
          label="Paid out"
          value={formatMoney(summary?.paid_cents ?? 0)}
          note={`${formatNumber(summary?.paid_count)} rewards`}
          icon="check"
          flat
        />
        <MetricCard
          label="Referred merchants"
          value={formatNumber(summary?.referred_leads)}
          note={`${formatNumber(summary?.activated_referrals)} took a first order`}
          icon="userPlus"
          flat
        />
      </div>

      <Card
        title="What a referral pays"
        subtitle="A referrer earns as the merchant they brought grows, not when they sign up. Changing an amount applies to milestones reached from now on — rewards already earned keep what was promised."
        flush
      >
        <DataTable
          rows={milestones ?? []}
          rowKey={(m) => m.milestone}
          dense
          columns={[
            {
              key: "label",
              header: "Milestone",
              render: (m) => (
                <div>
                  <div className="ntb__primary">{m.label}</div>
                  <div className="ntb__sub">{m.description}</div>
                </div>
              ),
            },
            {
              key: "amount",
              header: "Pays",
              align: "end",
              render: (m) => <MilestoneAmount milestone={m} onSaved={invalidate} />,
            },
          ]}
        />
      </Card>

      <Card
        title="Reward ledger"
        subtitle="Oldest first — a payout someone earned three weeks ago is the overdue one."
        actions={
          <>
            <Select
              aria-label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              options={[
                { value: "pending", label: "Awaiting approval" },
                { value: "approved", label: "Approved" },
                { value: "paid", label: "Paid" },
                { value: "all", label: "Everything" },
              ]}
            />
            <Button
              variant="outline"
              icon="refresh"
              loading={recalculate.isPending}
              onClick={() => recalculate.mutate()}
            >
              Recalculate
            </Button>
          </>
        }
        flush
      >
        <DataTable
          rows={rewards ?? []}
          rowKey={(r) => r.id}
          loading={isLoading}
          dense
          columns={[
            {
              key: "referrer",
              header: "Referrer",
              render: (r) => <span className="numu-email">{r.referrer_email ?? "—"}</span>,
            },
            {
              key: "referred",
              header: "Brought",
              render: (r) => <span className="numu-email">{r.referred_email ?? "—"}</span>,
            },
            { key: "milestone", header: "For", render: (r) => r.milestone_label },
            {
              key: "amount",
              header: "Amount",
              align: "end",
              mono: true,
              render: (r) => formatMoney(r.amount_cents, r.currency),
            },
            {
              key: "earned_at",
              header: "Earned",
              mono: true,
              render: (r) => formatDateTime(r.earned_at),
            },
            {
              key: "status",
              header: "Status",
              render: (r) =>
                r.status === "paid" ? (
                  <StatusBadge status="active" label="Paid" />
                ) : (
                  <Badge tone={r.status === "pending" ? "warning" : "info"} square>
                    {r.status}
                  </Badge>
                ),
            },
            {
              key: "actions",
              header: "",
              align: "end",
              render: (r) => (
                <span className="ak-rowactions">
                  {r.status === "pending" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="check"
                      onClick={() => decide.mutate({ id: r.id, action: "approve" })}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {r.status === "pending" || r.status === "approved" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="banknote"
                        onClick={() => {
                          // "Paid" records that money left NUMU; it does not
                          // move any. Payouts happen outside the platform, so
                          // the operator is confirming a fact, not triggering
                          // a transfer.
                          if (
                            window.confirm(
                              `Mark ${formatMoney(r.amount_cents, r.currency)} to ${r.referrer_email} as paid? This records the payout — it does not send money.`,
                            )
                          ) {
                            decide.mutate({ id: r.id, action: "pay" });
                          }
                        }}
                      >
                        Mark paid
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="x"
                        onClick={() => {
                          const note = window.prompt(
                            "Why is this reward being voided? The merchant earned it, so the reason is kept on the record.",
                          );
                          if (note?.trim()) {
                            decide.mutate({ id: r.id, action: "void", note });
                          }
                        }}
                      >
                        Void
                      </Button>
                    </>
                  ) : null}
                </span>
              ),
            },
          ]}
          empty={
            <EmptyState
              kind="empty"
              title="No rewards here"
              body="Rewards appear as referred merchants hit milestones. Recalculate re-scans every referred lead."
            />
          }
        />
      </Card>

      <RecentOutreach />
    </>
  );
}

function MilestoneAmount({
  milestone,
  onSaved,
}: {
  milestone: MilestoneSetting;
  onSaved: () => void;
}) {
  // Major units in the field, minor units on the wire. An operator types 100,
  // not 10000, and the one time that is confused it is confused by a factor
  // of a hundred.
  const [amount, setAmount] = useState(String(milestone.amount_cents / 100));
  const [active, setActive] = useState(milestone.is_active);

  const save = useMutation({
    mutationFn: (next: { amount: number; active: boolean }) =>
      updateMilestone(milestone.milestone, {
        amount_cents: Math.round(next.amount * 100),
        is_active: next.active,
      }),
    onSuccess: () => {
      toast.success("Reward updated");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <span className="ak-milestone">
      <Input
        numeric
        affix="EGP"
        value={amount}
        // Wide enough for the EGP affix and a five-figure amount without the
        // two colliding — measured at 120px, where "EGP" sat on top of "100".
        style={{ width: 150 }}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          const next = Number(amount);
          if (!Number.isFinite(next) || next < 0) {
            setAmount(String(milestone.amount_cents / 100));
            return;
          }
          if (Math.round(next * 100) !== milestone.amount_cents) {
            save.mutate({ amount: next, active });
          }
        }}
      />
      <Switch
        checked={active}
        onChange={(next) => {
          setActive(next);
          save.mutate({ amount: Number(amount) || 0, active: next });
        }}
      />
    </span>
  );
}

function RecentOutreach() {
  const { data: outreach } = useQuery({
    queryKey: ["marketing", "outreach"],
    queryFn: () => listOutreach({ limit: 25 }),
  });

  if (!outreach?.length) return null;

  return (
    <Card
      title="Recent outreach"
      subtitle="What we sent, and to whom. The message is the version that went out, not the template as it reads today."
      flush
    >
      <DataTable
        rows={outreach}
        rowKey={(o) => o.id}
        dense
        columns={[
          {
            key: "recipient",
            header: "To",
            render: (o) => (
              <div>
                <div className="ntb__primary numu-email">
                  {o.lead_email ?? o.recipient}
                </div>
                <div className="ntb__sub numu-mono">{o.recipient}</div>
              </div>
            ),
          },
          {
            key: "channel",
            header: "Channel",
            render: (o) => (
              <Badge tone="neutral" square>
                {o.channel}
              </Badge>
            ),
          },
          { key: "template_key", header: "Template", render: (o) => o.template_key ?? "one-off" },
          {
            key: "body",
            header: "Message",
            render: (o) => (
              <span dir="auto" className="ak-truncate">
                {o.subject || o.body.replace(/<[^>]+>/g, "").slice(0, 80)}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (o) =>
              o.status === "sent" ? (
                <StatusBadge status="verified" label="Sent" />
              ) : (
                <Badge tone={o.status === "failed" ? "danger" : "warning"} square>
                  {o.error ?? o.status}
                </Badge>
              ),
          },
          {
            key: "created_at",
            header: "When",
            mono: true,
            render: (o) => formatRelative(o.created_at),
          },
        ]}
      />
    </Card>
  );
}
