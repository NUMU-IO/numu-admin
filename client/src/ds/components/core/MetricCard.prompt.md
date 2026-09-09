One operational number for the admin overview strip — value, direction of change, and a one-line reason to care.

```jsx
<MetricCard label="Failed payments · 24h" value="38" delta="+9" deltaDirection="up" alert note="Above the 25 threshold" icon="creditCard" />
```

- Set `deltaDirection` explicitly whenever a rise is bad; the default assumes up = good.
- `alert` marks a metric that requires action — use it sparingly or the strip stops meaning anything.
- Every value is tabular; pass pre-formatted strings (`"٣٫٢٥٠"`, `"EGP 1.24M"`) rather than raw numbers.
