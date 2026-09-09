Transient confirmation that something happened. Never use it for a condition an operator must act on — that is a `Banner`.

```jsx
<ToastStack>
  <Toast tone="success" title="Store suspended" description="store_4812 · logged to audit" action={<Button size="sm" variant="ghost">Undo</Button>} onDismiss={d} />
</ToastStack>
```

Include the entity ID in `description` — after a bulk action the operator needs to know exactly what changed.
