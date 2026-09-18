The system's action control; every clickable action in admin and marketing uses it so the hierarchy stays legible.

```jsx
<Button variant="primary" icon="plus">Add merchant</Button>
<Button variant="subtle" size="sm" icon="download">Export CSV</Button>
<Button variant="danger-outline" requiresPermission="stores.suspend" hasPermission={false}>Suspend store</Button>
```

- One `primary` per view. Everything else is `outline`, `subtle` or `ghost`.
- `danger` must open a `ConfirmDialog` — never fire straight from the click.
- `requiresPermission` + `hasPermission={false}` renders the lock affordance instead of hiding the action, so operators can see what they lack.
- `accent` is Terracotta only inside `[data-numu-register="editorial"]`; in the admin it resolves to Navy on purpose.
