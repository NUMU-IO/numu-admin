The admin's primary navigation — Navy chrome, grouped by operational domain, with live queue counts.

```jsx
<SidebarNav env="prod" active={page} onNavigate={setPage} sections={[
  { items: [{ id: "overview", label: "Overview", icon: "layout" }] },
  { label: "Merchants", items: [
    { id: "orgs", label: "Organizations", icon: "building" },
    { id: "stores", label: "Stores", icon: "store", count: 12, alert: true }
  ]}
]} />
```

- Group by domain, never alphabetically; the section headings are the mental model.
- Only attach `count` to items that hold a work queue — a count the operator cannot clear is noise.
- The active item carries a Saffron inline-start edge, which flips under RTL.
