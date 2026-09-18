Loading placeholder. Match the real element's box so the layout does not jump when data lands.

```jsx
<Skeleton width={180} height={30} />
<Skeleton lines={3} />
```

Skeletons are for first paint. For a refresh of already-visible data, keep the old values and show a spinner on the refresh button instead — operators must never wonder whether a number is stale or loading. Honours `prefers-reduced-motion`.
