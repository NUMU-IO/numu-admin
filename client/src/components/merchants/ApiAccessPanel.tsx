/**
 * Public-API access for one merchant.
 *
 * The plan matrix decides by default — Pro and Enterprise include the API —
 * but it is too blunt on its own: a partner on a pilot, an agency integrating
 * one Starter merchant, or a negotiated deal should not need a plan change.
 * This is that lever, and it is the whole reason the grant exists.
 *
 * Revoking is not cosmetic. Access is checked on every API request and every
 * webhook delivery, so switching it off stops a live integration mid-sentence
 * — which is why it asks first and says what will break.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge, Button, Card, Dialog, KeyValue, Switch, type KeyValueItem } from "@/ds";
import { setTenantApiAccess } from "@/services/apiAccessApi";

interface Props {
  tenantId: string | null | undefined;
  plan: string | null | undefined;
  featureFlags: Record<string, boolean> | undefined;
  storeName?: string;
}

export function ApiAccessPanel({ tenantId, plan, featureFlags, storeName }: Props) {
  const queryClient = useQueryClient();
  const [granted, setGranted] = useState(Boolean(featureFlags?.api_access));
  const [inPlan, setInPlan] = useState<boolean | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // Until the first call answers, the plan name is the only signal we have.
  const planIncludes =
    inPlan ?? ["pro", "enterprise"].includes((plan ?? "").toLowerCase());
  const allowed = planIncludes || granted;

  const save = useMutation({
    mutationFn: (enabled: boolean) => setTenantApiAccess(tenantId!, enabled),
    onSuccess: (state) => {
      setGranted(state.granted);
      setInPlan(state.in_plan);
      toast.success(
        state.allowed
          ? `API access is on for ${storeName ?? "this merchant"}`
          : `API access is off for ${storeName ?? "this merchant"}`,
        {
          description: state.allowed
            ? "They can mint tokens and receive webhooks now."
            : "Existing tokens stop working and webhook deliveries stop.",
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["merchant-detail"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const facts: KeyValueItem[] = [
    { label: "Plan", value: plan ?? "—" },
    {
      label: "Included in plan",
      value: planIncludes ? "Yes" : "No",
    },
    { label: "Granted by NUMU", value: granted ? "Yes" : "No" },
  ];

  const onToggle = (next: boolean) => {
    if (!tenantId) return;
    // Turning it off only matters when the grant is what is holding it open.
    if (!next && !planIncludes) {
      setConfirmRevoke(true);
      return;
    }
    save.mutate(next);
  };

  return (
    <>
      <Card
        title="Public API"
        subtitle="Whether this merchant can mint API tokens and receive webhooks"
        actions={
          allowed ? (
            <Badge tone="success" icon="check" square>
              {planIncludes ? "In plan" : "Granted"}
            </Badge>
          ) : (
            <Badge tone="neutral" icon="lock" square>
              Off
            </Badge>
          )
        }
        footer={
          <div className="ak-cell-line">
            <Switch
              checked={granted}
              disabled={!tenantId || save.isPending}
              onChange={onToggle}
              label="Grant API access"
            />
            {planIncludes ? (
              <span className="ak-text-muted">
                Their plan already includes it — the grant changes nothing while
                they stay on {plan}.
              </span>
            ) : (
              <span className="ak-text-muted">
                Switches the API on for a merchant whose plan excludes it.
              </span>
            )}
          </div>
        }
      >
        <KeyValue items={facts} />
      </Card>

      {confirmRevoke ? (
        <Dialog
          open
          tone="danger"
          icon="alertTriangle"
          title="Revoke API access?"
          description={`Every token ${storeName ?? "this merchant"} holds stops working immediately, and webhook deliveries stop with them. Any integration they have built goes down without warning.`}
          onClose={() => setConfirmRevoke(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmRevoke(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={save.isPending}
                onClick={() => {
                  save.mutate(false);
                  setConfirmRevoke(false);
                }}
              >
                Revoke access
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
