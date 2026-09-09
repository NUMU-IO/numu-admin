Persistent, page-level message — use it when the condition outlives a toast (degraded upstream, partial data, active impersonation).

```jsx
<Banner tone="impersonation" bar title="Viewing as merchant — Rahab Boutique"
  actions={<Button size="sm" variant="ghost" icon="logOut">Exit</Button>}>
  Every action you take is recorded against your account in the store's audit log.
</Banner>
<Banner tone="warning" title="Partial data">Shipping metrics are 14 minutes behind. Order counts are current.</Banner>
```

`tone="impersonation"` is deliberately loud Saffron and cannot be dismissed — it must stay visible for the whole session.
