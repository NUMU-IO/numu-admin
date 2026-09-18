Application header. The search control is a button that opens the `CommandPalette`, so there is exactly one search surface in the product.

```jsx
<Topbar onSearchOpen={() => setPalette(true)}
  actions={<><IconButton icon="refresh" label="Refresh data" /><IconButton icon="bell" label="Notifications" /></>}
  user={{ name: "M. Tarek", initials: "MT", role: "Trust reviewer" }} />
```

Always render the role — an operator about to take a destructive action needs to see which hat they are wearing.
