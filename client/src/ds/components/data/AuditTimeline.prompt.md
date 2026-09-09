Renders audit history, entity lifecycle and support-case history — the same shape for all three, because operators read them the same way.

```jsx
<AuditTimeline entries={[
  { action: "Viewed as merchant", actor: "m.tarek@numu.eg", actorType: "staff", timestamp: "2026-09-08 11:04:22 EET", entity: "store_4812 · Rahab Boutique", meta: "ip 41.33.†† · session 14m", tone: "warning", note: "Reproducing the checkout failure in case #2291." },
  { action: "Payment captured", actor: "paymob-webhook", actorType: "system", timestamp: "2026-09-08 10:51:07 EET", meta: "evt_9Kd2 · 2 retries", tone: "success" }
]} />
```

Every entry answers all four audit questions — actor, action, time, affected entity. Never ship an entry missing the actor; `actorType="system"` is how automation identifies itself.
