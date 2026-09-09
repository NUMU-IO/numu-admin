Icon-only control for row actions, toolbars and nav chrome; `label` is mandatory because there is no visible text.

```jsx
<IconButton icon="moreVertical" label="Row actions" size="sm" />
<IconButton icon="bell" label="Notifications" tone="onNav" />
```

Use `tone="bordered"` when it sits alone on a card surface and needs an edge; `tone="onNav"` on Navy chrome.
