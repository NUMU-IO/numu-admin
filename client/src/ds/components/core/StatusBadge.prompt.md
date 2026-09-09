Renders a platform lifecycle state with the tone and glyph fixed by the shared status map — use it instead of a hand-toned `Badge` so "past_due" looks identical in billing, orders and merchant detail.

```jsx
<StatusBadge status="past_due" />
<StatusBadge status="active" label="نشِط" />
```

Extend by adding to `NUMU_STATUS`, never by passing a one-off tone.
