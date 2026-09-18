Grades a fraud/trust judgement. Three redundant encodings — number, word, filled segments — so it never relies on colour.

```jsx
<RiskScore score={82} reasons={["New device, 4 orders in 20 min", "Phone unverified", "COD to a governorate with 38% RTO"]} />
<RiskScore score={44} inline showValue />
```

- Always pass `reasons` on a review queue or detail page; a reviewer needs the signals, not the score.
- Risk is deliberately not a `StatusBadge`: status is a lifecycle fact, risk is a graded judgement that a human can override.
