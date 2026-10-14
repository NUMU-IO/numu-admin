/**
 * Public-API access for one merchant.
 *
 * The plan matrix decides by default — Pro and Enterprise include the API —
 * but it is too blunt on its own: a partner on a pilot, an agency integrating
 * one Starter merchant, or a negotiated deal should not need a plan change.
 * And the reverse: a merchant abusing the API should lose it without losing
 * their plan. This is that lever, in three positions: follow the plan, always
 * on, or blocked.
 *
 * Switching it off is not cosmetic. Access is checked on every API request,
 * so it stops a live integration on its next call — which is why it asks
 * first and says what will break. Webhook deliveries are a separate
 * entitlement and keep running.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  FormField,
  Input,
  KeyValue,
  Skeleton,
  type KeyValueItem,
} from "@/ds";
import {
  getTenantApiAccess,
  setTenantApiAccess,
  type ApiAccessMode,
  type ApiAccessState,
} from "@/services/apiAccessApi";

interface Props {
  tenantId: string | null | undefined;
  storeName?: string;
}

const MODES: { id: ApiAccessMode; label: string }[] = [
  { id: "plan", label: "Follow plan" },
  { id: "on", label: "Always on" },
  { id: "off", label: "Blocked" },
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function effective(s: ApiAccessState): { on: boolean; text: string } {
  if (s.mode === "off") return { on: false, text: "API blocked by NUMU" };
  if (!s.active) return { on: false, text: "API off — merchant suspended" };
  if (s.mode === "on") return { on: true, text: "API on — granted by NUMU" };
  if (s.in_plan) return { on: true, text: `API on — included in ${capitalize(s.plan)} plan` };
  return { on: false, text: "API off — not in plan" };
}

export function ApiAccessPanel({ tenantId, storeName }: Props) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [confirmOff, setConfirmOff] = useState<ApiAccessMode | null>(null);
  const queryKey = ["api-access", tenantId];

  const access = useQuery({
    queryKey,
    queryFn: () => getTenantApiAccess(tenantId!),
    enabled: Boolean(tenantId),
  });

  const save = useMutation({
    mutationFn: (mode: ApiAccessMode) =>
      setTenantApiAccess(tenantId!, mode, note.trim() || undefined),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKey, state);
      setNote("");
      toast.success(`${effective(state).text} for ${storeName ?? "this merchant"}`, {
        description: state.allowed
          ? "They can mint tokens and call the API from their next request."
          : "Existing tokens are refused from their next request. Webhook deliveries are not affected.",
      });
      void queryClient.invalidateQueries({ queryKey: ["merchant-detail"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const state = access.data;
  const now = state ? effective(state) : null;

  const onPick = (mode: ApiAccessMode) => {
    if (!state || mode === state.mode) return;
    // Ask first only when the change takes a working API away.
    const turnsOff = state.allowed && (mode === "off" || (mode === "plan" && !state.in_plan));
    if (turnsOff) {
      setConfirmOff(mode);
      return;
    }
    save.mutate(mode);
  };

  const facts: KeyValueItem[] = state
    ? [
        { label: "Plan", value: state.plan },
        { label: "Included in plan", value: state.in_plan ? "Yes" : "No" },
        {
          label: "NUMU override",
          value: state.mode === "on" ? "Granted" : state.mode === "off" ? "Blocked" : "None",
        },
        { label: "Merchant active", value: state.active ? "Yes" : "No — suspended" },
      ]
    : [];

  return (
    <>
      <Card
        title="Public API"
        subtitle="Whether this merchant can mint and use API tokens"
        actions={
          now ? (
            now.on ? (
              <Badge tone="success" icon="check" square>
                On
              </Badge>
            ) : (
              <Badge tone="neutral" icon="lock" square>
                Off
              </Badge>
            )
          ) : null
        }
        footer={
          <div className="ak-stack">
            <div className="ak-cell-line" role="group" aria-label="API access">
              {MODES.map((m) => (
                <Chip
                  key={m.id}
                  selected={state?.mode === m.id}
                  disabled={!state || save.isPending}
                  onClick={() => onPick(m.id)}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
            <FormField label="Note" hint="Optional. Saved with the change in the audit log.">
              <Input
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why the change"
              />
            </FormField>
          </div>
        }
      >
        {access.isLoading ? (
          <Skeleton lines={3} />
        ) : access.isError ? (
          <p className="ak-text-muted">
            {access.error instanceof Error ? access.error.message : "API access failed to load."}
          </p>
        ) : now ? (
          <div className="ak-stack">
            <p className="ak-feed__title">{now.text}</p>
            <KeyValue items={facts} />
          </div>
        ) : (
          <p className="ak-text-muted">This store has no tenant.</p>
        )}
      </Card>

      {confirmOff ? (
        <Dialog
          open
          tone="danger"
          icon="alertTriangle"
          title={confirmOff === "off" ? "Block API access?" : "Return to the plan and turn the API off?"}
          description={`Every token ${storeName ?? "this merchant"} holds is refused from its next request, and any integration they have built stops working. Webhook deliveries are a separate entitlement and keep running.`}
          onClose={() => setConfirmOff(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOff(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={save.isPending}
                onClick={() => {
                  save.mutate(confirmOff);
                  setConfirmOff(null);
                }}
              >
                {confirmOff === "off" ? "Block access" : "Follow plan"}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
