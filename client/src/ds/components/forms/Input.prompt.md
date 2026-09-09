Single-line text control; 40px tall so it clears the interactive minimum.

```jsx
<Input icon="search" placeholder="Search merchants, stores, orders, phone…" />
<Input mono affix=".numueg.app" defaultValue="rahab" />
<Input arabic defaultValue="بوتيك رحاب" />
```

Set `arabic` on fields that hold Arabic content even in an English admin — the value stays RTL/Tajawal while the label stays in the UI language.
