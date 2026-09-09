Wraps every form control so labels, hints and validation live in one predictable place.

```jsx
<FormField label="Subdomain" hint="rahab.numueg.app" htmlFor="sub">
  <Input id="sub" mono defaultValue="rahab" />
</FormField>
<FormField label="Tax ID" required error="Must be 9 digits">
  <Input error defaultValue="12345" />
</FormField>
```

- `error` replaces `hint` — never stack both.
- Error text is always specific about the rule ("Must be 9 digits"), never "Invalid".
