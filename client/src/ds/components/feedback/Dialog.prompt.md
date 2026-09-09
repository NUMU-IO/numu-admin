Modal for one focused decision or a short form. For destructive confirmations use `ConfirmDialog`, which adds the typed-confirmation gate.

```jsx
<Dialog open={open} title="Assign support case" onClose={close}
  footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary">Assign</Button></>}>
  <FormField label="Assignee"><Select options={team} /></FormField>
</Dialog>
```

Never put a multi-step flow in a dialog — that is a `Drawer` or a page.
