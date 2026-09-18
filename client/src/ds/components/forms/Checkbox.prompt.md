Multi-select and boolean settings.

```jsx
<Checkbox label="Auto-publish new products" defaultChecked />
<Checkbox compact indeterminate checked={some} aria-label="Select all rows" />
```

Use `compact` only inside a table cell; standalone checkboxes keep the 44px row so they stay tappable on tablet.
