Direction-of-travel beside a number. No axes, no grid, no legend, no tooltip.

```jsx
<MetricCard label="Orders today" value="4,182" delta="+6.1%" sparkline={<Sparkline data={hourly} area label="Orders per hour, last 24h" />} />
```

If a reader needs to read values off it, it is the wrong component — use `BarChart`.
