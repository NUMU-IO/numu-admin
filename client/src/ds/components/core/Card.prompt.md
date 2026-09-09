The system's panel surface; wrap any grouped content in it rather than styling a bare div.

```jsx
<Card title="Recent orders" subtitle="Last 24h" actions={<Button variant="subtle" size="sm">View all</Button>} flush>
  <DataTable … />
</Card>
```

- `variant="app"` (shadow, 10px) inside the admin; `flat`/`outlined` (hairline, no shadow) on brand and editorial surfaces — the editorial register flattens `app` automatically.
- `flush` whenever the body is a table or a chart that should touch the edges.
