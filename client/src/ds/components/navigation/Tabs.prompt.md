Splits an entity's related data on a detail page — Overview first, then the collections that belong to it.

```jsx
<Tabs active={tab} onChange={setTab} tabs={[
  { id: "overview", label: "Overview" },
  { id: "stores", label: "Stores", count: 3 },
  { id: "billing", label: "Subscription & billing" },
  { id: "audit", label: "Audit log" }
]} />
```

Tabs hold *related data*, never steps in a task. Overview is always first and always the default.
