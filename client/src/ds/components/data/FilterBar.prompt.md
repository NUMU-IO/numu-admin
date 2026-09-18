Sits directly above a `DataTable` and owns saved views, scoped search, facet filters, column config and CSV export.

```jsx
<FilterBar
  savedViews={[{id:"all",label:"All"},{id:"risk",label:"High-risk COD"}]}
  activeView={view} onViewChange={setView}
  search={q} onSearchChange={setQ} searchPlaceholder="Filter orders…"
  selectedCount={sel.length}
  bulkActions={<><Button size="sm" variant="ghost" icon="flag">Flag for review</Button><Button size="sm" variant="ghost" icon="download">Export</Button></>}
  onClearSelection={() => setSel([])}
>
  <Select placeholder="All statuses" options={["Paid","Pending","Failed"]} style={{height:32,width:150}} />
  <Chip count={128} onRemove={clearCod}>COD</Chip>
</FilterBar>
```

When `selectedCount > 0` the bar becomes the Navy bulk toolbar — filters are intentionally hidden so an operator cannot change the selection scope mid-action.
