Filter facet and applied-filter token for table toolbars.

```jsx
<Chip selected>All orders</Chip>
<Chip count={128} onRemove={() => clear("cod")}>COD</Chip>
```

Chips are pressable, so they carry `aria-pressed`; the × is a nested affordance that stops propagation.
