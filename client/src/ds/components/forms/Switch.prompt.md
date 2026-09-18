Toggle for settings that apply immediately (feature flags, COD on/off, integration enable).

```jsx
<Switch label="Cash on delivery" description="Store-level. Overrides the org default." checked={cod} onChange={setCod} />
```

If the change needs a Save button, use `Checkbox` instead — a switch promises the change already happened.
