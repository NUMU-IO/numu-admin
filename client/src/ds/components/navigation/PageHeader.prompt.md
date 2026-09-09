Top of every admin page. On entity pages it carries the breadcrumb chain, the entity's own status, and only the actions valid at that level.

```jsx
<PageHeader
  breadcrumbs={<Breadcrumbs items={crumbs} onNavigate={go} />}
  title="Rahab Boutique"
  badges={<><StatusBadge status="active" /><Badge tone="neutral" square>COD</Badge></>}
  meta={<><span>store_4812</span><span>rahab.numueg.app</span><span>Created 2024-03-11</span></>}
  actions={<><Button variant="subtle" size="sm" icon="eye">View as merchant</Button><Button variant="danger-outline" size="sm">Suspend</Button></>}
/>
```

The hard rule: `actions` are scoped to the entity in `title`. "Suspend organization" belongs on the org page, never in a store header.
