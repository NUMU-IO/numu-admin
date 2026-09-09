Makes the Organization → Store → Order hierarchy visible on every detail page. This is the main defence against confusing an org-level action with a store-level one.

```jsx
<Breadcrumbs items={[{id:"orgs",label:"Organizations"},{id:"org_7f",label:"Rahab Group"},{id:"store_4812",label:"Rahab Boutique"},{label:"Order #EG-2291-4471"}]} onNavigate={go} />
```

Never skip a level to shorten it — the hierarchy is the point.
