Covers all six non-happy paths — empty, no-results, error, permission-denied, offline, partial data.

```jsx
<EmptyState kind="noResults" title="No orders match these filters" body="Try widening the date range or clearing the COD filter." action={<Button variant="subtle" size="sm">Reset filters</Button>} />
<EmptyState kind="denied" title="Trust & risk access required" body="Ask a super admin for the trust.review role. Your request is logged." />
```

- Distinguish `empty` from `noResults` — "nothing exists" and "your filters hid it" need different actions.
- `denied` explains what role is missing and that the attempt is audited; it never just says "Forbidden".
