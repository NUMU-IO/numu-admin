The one ornamental element in the system. Use it as a horizontal rule between landing-page sections, or as a matched pair framing a band.

```jsx
<SoukDivider />
<section>…</section>
<SoukDivider flip />
```

Hard limits: edges and dividers only, never a full-page or card background; never behind text; never more than two strips visible at once. `tone="navy"` only where the motif frames real product UI.

Note: the component references `assets/souk-tile.svg` with a path relative to `components/editorial/`. When composing a screen elsewhere, pass `style={{ backgroundImage: "url(<your path>/souk-tile.svg)" }}`.
