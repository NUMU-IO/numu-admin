Entity attribute list for detail-page sidebars and drawers.

```jsx
<KeyValue items={[
  { label: "Org ID", value: "org_7fJ2p", mono: true },
  { label: "Domain", value: "rahab.numueg.app", mono: true },
  { label: "Owner", value: "رحاب مصطفى" }
]} />
```

Always set `mono` on IDs, domains, phone numbers, emails and timestamps — it isolates the run so an Arabic label beside it does not reorder the characters.
