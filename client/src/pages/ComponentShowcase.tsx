/**
 * Design-system reference — every NUMU component this admin uses, on one page.
 *
 * This replaces a 1,400-line showcase of the previous component kit that was
 * never routed and documented a design that no longer exists. It is routed
 * now, at /design-system, because during a migration the useful question is
 * "what does the real thing look like", and answering it from the live app
 * beats answering it from a static specimen.
 *
 * Everything below is inert: no data is fetched and no action is wired.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  AuditTimeline,
  Badge,
  Banner,
  BarChart,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  Input,
  KeyValue,
  MetricCard,
  NUMU_STATUS,
  RiskScore,
  Select,
  Skeleton,
  Sparkline,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
  type DataTableColumn,
} from "@/ds";
import { useState } from "react";

interface DemoRow {
  id: string;
  store: string;
  amount: string;
  status: keyof typeof NUMU_STATUS;
  risk: number;
}

const ROWS: DemoRow[] = [
  { id: "EG-2291-4471", store: "Rahab Boutique", amount: "EGP 1,240.00", status: "pending", risk: 82 },
  { id: "EG-2291-4468", store: "قنديل", amount: "EGP 480.00", status: "shipped", risk: 24 },
  { id: "EG-2291-4455", store: "Cairo Book", amount: "EGP 2,110.00", status: "delivered", risk: 11 },
  { id: "EG-2291-4402", store: "Ektny", amount: "EGP 96.00", status: "failed", risk: 64 },
];

const TONES = ["success", "warning", "danger", "info", "neutral", "solid"] as const;

const VARIANTS = [
  "primary",
  "accent",
  "outline",
  "subtle",
  "ghost",
  "danger",
  "danger-outline",
] as const;

export default function ComponentShowcase() {
  const [tab, setTab] = useState("core");
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState("cod");

  const columns: DataTableColumn<DemoRow>[] = [
    { key: "id", header: "Order", mono: true },
    { key: "store", header: "Store" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "risk", header: "Risk", render: (r) => <RiskScore score={r.risk} inline /> },
    { key: "amount", header: "Value", align: "end", mono: true },
  ];

  return (
    <DashboardLayout
      title="Design system"
      subtitle="Every NUMU component the admin uses. Nothing here is wired to data."
      badges={<Badge tone="info" square>reference</Badge>}
      tabs={
        <Tabs
          tabs={[
            { id: "core", label: "Core", icon: "layout" },
            { id: "data", label: "Data", icon: "barChart" },
            { id: "forms", label: "Forms", icon: "clipboard" },
            { id: "feedback", label: "Feedback", icon: "bell" },
          ]}
          active={tab}
          onChange={setTab}
        />
      }
    >
      {tab === "core" ? (
        <>
          <Card title="Buttons" subtitle="Action hierarchy">
            <div className="ak-specimen">
              {VARIANTS.map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
              <Button loading>loading</Button>
              <Button disabled>disabled</Button>
              <Button requiresPermission="stores.suspend" hasPermission={false}>
                gated
              </Button>
              <Button size="sm" icon="download">
                small
              </Button>
              <Button size="lg" iconEnd="arrowRight">
                large
              </Button>
              <IconButton icon="settings" label="Settings" />
              <IconButton icon="trash" label="Delete" tone="bordered" />
            </div>
          </Card>

          <Card title="Status and risk" subtitle="Never colour alone">
            <div className="ak-stack">
              <div className="ak-specimen">
                {TONES.map((tone) => (
                  <Badge key={tone} tone={tone} dot>
                    {tone}
                  </Badge>
                ))}
              </div>
              <div className="ak-specimen">
                {(Object.keys(NUMU_STATUS) as (keyof typeof NUMU_STATUS)[])
                  .slice(0, 14)
                  .map((s) => (
                    <StatusBadge key={s} status={s} />
                  ))}
              </div>
              <div className="ak-specimen">
                <Chip selected={chip === "cod"} onClick={() => setChip("cod")}>
                  COD
                </Chip>
                <Chip selected={chip === "card"} onClick={() => setChip("card")}>
                  Card
                </Chip>
                <Chip count={12} onRemove={() => undefined}>
                  High risk
                </Chip>
              </div>
              <div className="ak-2col">
                <RiskScore
                  score={82}
                  reasons={[
                    "4 orders to this phone in 24 hours",
                    "Address does not resolve",
                    "First order on this store",
                  ]}
                />
                <RiskScore score={18} reasons={["No signals raised"]} />
              </div>
            </div>
          </Card>

          <div className="ak-metrics">
            <MetricCard label="Orders" value="41,820" delta="+12.4%" note="vs last month" icon="cart" />
            <MetricCard label="Revenue" value="148,233" unit="EGP" delta="-2.6%" icon="banknote" />
            <MetricCard
              label="Failed payments"
              value="41"
              alert
              deltaDirection="up"
              delta="+8"
              icon="alertTriangle"
            />
            <MetricCard
              label="Throughput"
              value="1,204"
              icon="activity"
              sparkline={<Sparkline data={[4, 9, 6, 12, 8, 15, 11, 18]} label="Rising" />}
            />
            <MetricCard label="Loading" value="—" loading />
          </div>

          <Card title="Icons" subtitle="Lucide, 1.5px, currentColor">
            <div className="ak-specimen">
              {(
                [
                  "store",
                  "package",
                  "cart",
                  "truck",
                  "users",
                  "shieldAlert",
                  "creditCard",
                  "messageCircle",
                  "activity",
                  "history",
                  "settings",
                  "lock",
                ] as const
              ).map((name) => (
                <span key={name} className="ak-specimen__icon">
                  <Icon name={name} size={20} />
                  <span className="numu-label">{name}</span>
                </span>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {tab === "data" ? (
        <>
          <Card title="Data table" subtitle="Dense, flagged, clickable" flush>
            <DataTable
              columns={columns}
              rows={ROWS}
              rowKey={(r) => r.id}
              dense
              caption="Specimen rows"
              isFlagged={(r) => r.risk >= 60}
            />
          </Card>

          <Card title="Empty states" subtitle="The six non-happy paths">
            <div className="ak-2col">
              <EmptyState kind="empty" title="Nothing yet" body="No rows have been created." />
              <EmptyState kind="noResults" title="Nothing matches" body="Widen the filters." />
              <EmptyState kind="error" title="Failed to load" body="The request did not complete." />
              <EmptyState
                kind="denied"
                title="You cannot see this"
                body="Requires the trust-reviewer role."
              />
            </div>
          </Card>

          <div className="ak-2col">
            <Card title="Bar chart" subtitle="Monitoring">
              <BarChart
                data={[
                  { label: "Mon", value: 120 },
                  { label: "Tue", value: 180 },
                  { label: "Wed", value: 90 },
                  { label: "Thu", value: 240 },
                  { label: "Fri", value: 310 },
                  { label: "Sat", value: 150 },
                  { label: "Sun", value: 70 },
                ]}
                height={190}
                isHighlighted={(d) => d.value > 300}
                label="Orders per day"
              />
            </Card>

            <Card title="Audit timeline" subtitle="Actor, action, time">
              <AuditTimeline
                entries={[
                  {
                    action: "Suspended store",
                    actor: "m.tarek@numueg.app",
                    actorType: "staff",
                    timestamp: "2026-09-08 14:02",
                    entity: "store_4812",
                    tone: "danger",
                  },
                  {
                    action: "Approved theme version",
                    actor: "ops@numueg.app",
                    actorType: "staff",
                    timestamp: "2026-09-08 11:40",
                    entity: "empire-v3 1.4.0",
                    tone: "success",
                  },
                  {
                    action: "Renewal charged",
                    actor: "billing",
                    actorType: "system",
                    timestamp: "2026-09-08 03:00",
                    entity: "tenant_119",
                  },
                ]}
              />
            </Card>
          </div>

          <Card title="Skeletons" subtitle="Sized to the real content">
            <div className="ak-stack">
              <Skeleton width={220} height={26} />
              <Skeleton lines={3} />
              <Skeleton height={80} variant="block" />
            </div>
          </Card>

          <Card title="Key values" subtitle="Entity attributes">
            <KeyValue
              items={[
                { label: "Store", value: "Rahab Boutique" },
                { label: "Store ID", value: "store_4812", mono: true },
                { label: "Domain", value: "rahab.numueg.app", mono: true },
                { label: "Owner", value: "owner@example.com", mono: true },
              ]}
            />
          </Card>
        </>
      ) : null}

      {tab === "forms" ? (
        <Card title="Form controls" subtitle="Every input ships inside a FormField">
          <div className="ak-2col">
            <FormField label="Store name" hint="Shown to shoppers at checkout." required>
              <Input placeholder="Rahab Boutique" />
            </FormField>
            <FormField label="Subdomain" hint="rahab.numueg.app">
              <Input mono placeholder="rahab" affix=".numueg.app" />
            </FormField>
            <FormField label="Plan">
              <Select
                options={[
                  { value: "payg", label: "Pay as you go" },
                  { value: "starter", label: "Starter" },
                  { value: "pro", label: "Pro" },
                ]}
              />
            </FormField>
            <FormField label="Phone" error="Must be 11 digits">
              <Input error mono placeholder="+20 10 …" />
            </FormField>
            <FormField label="Internal note">
              <Textarea rows={3} placeholder="What did you check, and what did you find?" />
            </FormField>
            <FormField label="Options">
              <div className="ak-stack">
                <Checkbox
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  label="Exclude from platform aggregates"
                />
                <Switch checked={on} onChange={setOn} label="Storefront reachable" />
              </div>
            </FormField>
          </div>
        </Card>
      ) : null}

      {tab === "feedback" ? (
        <>
          <div className="ak-stack">
            <Banner tone="info" title="Shipping metrics are 14 minutes behind">
              Order counts are current.
            </Banner>
            <Banner tone="warning" title="Two payment webhooks are retrying" />
            <Banner tone="danger" title="Storefront rendering is degraded in eu-west-1" />
            <Banner
              tone="impersonation"
              bar
              title="Viewing as merchant — Rahab Boutique (store_4812)"
            >
              Every action is recorded against your account.
            </Banner>
          </div>

          <Card title="Overlays" subtitle="Dialog, confirm, drawer, tooltip">
            <div className="ak-specimen">
              <Button variant="subtle" onClick={() => setDialog(true)}>
                Open dialog
              </Button>
              <Button variant="danger-outline" onClick={() => setConfirm(true)}>
                Open destructive confirm
              </Button>
              <Button variant="subtle" onClick={() => setDrawer(true)}>
                Open drawer
              </Button>
              <Tooltip label="Recorded in the audit log">
                <Button variant="ghost" icon="info">
                  Hover me
                </Button>
              </Tooltip>
            </div>
          </Card>

          <Dialog
            open={dialog}
            title="Change order status"
            description="EG-2291-4471 · EGP 1,240.00 · currently pending."
            onClose={() => setDialog(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialog(false)}>Update status</Button>
              </>
            }
          >
            <FormField label="New status">
              <Select options={["pending", "processing", "shipped", "delivered"]} />
            </FormField>
          </Dialog>

          <ConfirmDialog
            open={confirm}
            tone="danger"
            title="Suspend Rahab Boutique?"
            entity={[
              { label: "Store", value: "Rahab Boutique" },
              { label: "Store ID", value: "store_4812", mono: true },
            ]}
            consequences={[
              "The storefront stops serving shoppers immediately.",
              "42 open orders stay visible but cannot be fulfilled.",
              "Reinstating the store restores it exactly as it was.",
            ]}
            confirmPhrase="store_4812"
            confirmLabel="Suspend store"
            onClose={() => setConfirm(false)}
            onConfirm={() => setConfirm(false)}
          />

          <Drawer
            open={drawer}
            title="Review order"
            onClose={() => setDrawer(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDrawer(false)}>
                  Close
                </Button>
                <Button onClick={() => setDrawer(false)}>Save decision</Button>
              </>
            }
          >
            <KeyValue
              items={[
                { label: "Order", value: "EG-2291-4471", mono: true },
                { label: "Value", value: "EGP 1,240.00", mono: true },
                { label: "Risk", value: "82 — high" },
              ]}
            />
          </Drawer>
        </>
      ) : null}
    </DashboardLayout>
  );
}
