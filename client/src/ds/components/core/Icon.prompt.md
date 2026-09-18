Renders one Lucide outline glyph at NUMU's 1.5px stroke in `currentColor`; use it anywhere an icon is needed instead of inlining SVG.

```jsx
<Icon name="shieldAlert" size={18} />
<Icon name="download" size={16} label="Export CSV" />
```

- `size`: 16 in dense tables, 18 UI default, 20 in nav, 24 for specimens.
- Colour comes from the parent's `color` — never pass a fill.
- Chevrons, arrows and `externalLink` auto-mirror under `dir="rtl"`; status and brand glyphs never mirror.
- Decorative by default (`aria-hidden`); pass `label` when the icon is the only content of a control.
