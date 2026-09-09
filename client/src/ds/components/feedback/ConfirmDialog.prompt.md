Every destructive or high-consequence staff action goes through this — suspend, delete, refund, force-cancel, impersonate.

```jsx
<ConfirmDialog
  open={open} onClose={close} onConfirm={suspend}
  title="Suspend Rahab Boutique?"
  entity={[{ label: "Store", value: "Rahab Boutique" }, { label: "Store ID", value: "store_4812", mono: true }, { label: "Org", value: "Rahab Group" }]}
  consequences={["The storefront returns 503 to shoppers immediately.", "42 open orders stay visible but cannot be fulfilled.", "The merchant is emailed and sees a suspension notice in the Hub."]}
  confirmPhrase="store_4812"
  confirmLabel="Suspend store"
/>
```

- Use `confirmPhrase` only for irreversible or shopper-visible actions; adding it everywhere trains operators to type without reading.
- `consequences` must be concrete and numeric where possible — "42 open orders", not "existing orders".
