# Accessibility and reduced motion

These defaults apply to every page, card, and figure in the course. Each one is a value or a markup rule that you can check in the output.

## Theme start-up

Set the theme on the root element before the first paint. Read the stored choice first, then the system setting, then use light.

```javascript
(function () {
  var root = document.documentElement;
  var stored = '';
  try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) root.setAttribute('data-theme', 'dark');
  else root.setAttribute('data-theme', 'light');
})();
```

- The storage key is `theme`. The values are `light` and `dark`.
- Wrap every storage read and write in `try`, so private windows still render.
- The theme toggle writes the new value to the root and to storage.

## Focus

- Every link, button, input, and toggle shows a visible focus ring on `:focus-visible`.
- The ring is `outline: 2px solid var(--blueprint)` with `outline-offset: 2px`.
- The skip link is the first element in `body`. It is hidden until focus, then it shows with `padding: 12px 18px` and a `2px solid var(--ink)` outline.
- Never remove an outline without a replacement ring of the same size.

## Targets

- Menu rows, figure controls, and mobile buttons have `min-height: 44px`.
- Modal close and toggle buttons have `min-height: 36px` and a minimum width of 78px or more.
- Below 480px, body text is `16px`. Do not set reading text smaller than that.

## Colour and contrast

- Body text uses `--ink` or `--ink-soft`. Both pass 4.5:1 in both themes.
- `--ink-mute` measures 4.11:1 in light and 4.41:1 in dark. Use it only for large text or marks that are not text.
- Never use colour alone to carry a state. Add a word, a border style, or a glyph. A planned card uses a dashed border as well as muted text.
- Check the page in both themes before you finish.

## Figure markup

Static SVG figures:

- The root has `role="img"` and `aria-labelledby="<id>-title <id>-desc"`.
- The root has a `<title>` and a `<desc>` as direct children. The `<desc>` has at least 40 characters and says what the figure shows.
- A course figure without `<title>` and `<desc>` has an `aria-label` that starts with its FIG_ label.
- Every `id` in a figure starts with the figure id.
- No scripts, event handlers, links, or `style` attributes inside a manual figure.

Interactive widgets:

- Each control has a `<label>` with a `for` attribute that points to the control id.
- Each slider shows its current value as text next to the label.
- A slider uses the native `<input type="range">` with `accent-color: var(--blueprint)`.

## Reduced motion

The site respects `prefers-reduced-motion: reduce` in CSS, in lesson figures, and in SMIL animations.

CSS block for pages:

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal,
  .ascii-rule,
  .toc-row {
    transition: none !important;
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    clip-path: none !important;
  }
}
```

Rules:

- Under reduced motion, show the final state at once. Do not hide content until a transition ends.
- Keep colour and opacity changes of 180ms or less. Remove movement, scale, and clip changes.
- Smooth scrolling is off under reduced motion.
- Pressed buttons do not scale under reduced motion.

Animated lesson figures:

- An animated figure has a toggle button with `aria-pressed`. Its text is `Pause animation` or `Play animation`.
- Its `aria-label` is `Pause explanatory animation` or `Play explanatory animation`.
- Under reduced motion the toggle reads `Motion reduced`, is disabled, and has the label `Animation disabled because reduced motion is enabled`.
- Under reduced motion the figure shows one static frame. The frame time comes from `data-static-time` on the host, 1.5 s by default.
- Choose that moment so the static frame is a complete, readable picture.
- The toggle is hidden in print.

Interactive explainers do not start to play by themselves under reduced motion. Draw one complete frame, and let the reader start playback with a control.
