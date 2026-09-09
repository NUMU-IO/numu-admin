Operational monitoring chart — failed jobs per hour, orders per day, webhook latency buckets.

```jsx
<BarChart height={150} data={hours} isHighlighted={(d) => d.value > 40} formatValue={(v) => v + ""} label="Failed webhook deliveries per hour, last 24h" />
```

Chart rules for the admin: horizontal gridlines only, tabular mono labels, one `--viz-*` colour per series, `isHighlighted` for breaches. No gradients, no rounded 3D bars, no decorative marketing charts.
