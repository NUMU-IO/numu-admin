The admin's global search and its fastest navigation path — a support agent pastes a phone number here before anything else.

```jsx
<CommandPalette open={open} query={q} onQueryChange={setQ} cursor={i} onClose={close} onSelect={go}
  groups={[
    { label: "Stores", items: [{ id: "s1", label: "Rahab Boutique", icon: "store", meta: "rahab.numueg.app", kind: "store" }] },
    { label: "Orders", items: [{ id: "o1", label: "EG-2291-4471 · COD", icon: "cart", meta: "+20 10 †† ††", kind: "order" }] },
    { label: "Actions", items: [{ id: "a1", label: "Go to failed webhooks", icon: "gitBranch", kind: "action" }] }
  ]} />
```

- Show `meta` — the matched identifier is why the row is in the list.
- Group by entity type and put the likeliest group first; a phone-number query should surface Customers above Actions.
