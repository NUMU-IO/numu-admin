Native single-choice control — used for table filters, statuses and any list under ~15 items.

```jsx
<Select placeholder="All statuses" options={["Paid", "Pending", "Failed", "Refunded"]} />
```

Stay native: it inherits the OS keyboard and screen-reader behaviour, which matters more than a custom popover in an operations tool.
