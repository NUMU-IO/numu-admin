The admin's workhorse list view — every merchant, order, payment, job and case list is this table.

```jsx
<DataTable
  dense selectable
  columns={[
    { key: "id", header: "Order", mono: true, width: 120 },
    { key: "store", header: "Store", render: (r) => <span className="ntb__primary">{r.store}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "total", header: "Total", align: "end", sortable: true }
  ]}
  rows={orders}
  sort={sort} onSort={setSort}
  selected={sel} onSelect={toggle} onSelectAll={all}
  isFlagged={(r) => r.risk >= 70}
  empty={<EmptyState kind="empty" title="No orders match these filters" />}
/>
```

- Declare `align:"end"` and `mono` on the column, not in the cell renderer — that is what keeps numerals tabular and IDs LTR-isolated under RTL.
- `loading` renders skeleton rows in the real column widths, so the layout does not jump.
- Pair with `FilterBar` above and `Pagination` below inside a `<Card flush>`.
