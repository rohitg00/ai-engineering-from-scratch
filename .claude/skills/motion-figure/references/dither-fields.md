# Dither fields

A dither field is a band of moving pixels drawn with ordered dithering. It uses only three colours from the page: the paper, the accent, and the ink. Use one as a page masthead or above a section. It adds slow motion to a page at a low cost and uses only the course colours. `templates/dither.js` is a complete script.

## How it draws

1. A WebGL fragment shader computes one value from 0 to 1 for each pixel. The value comes from one of four motions.
2. The shader compares the value with a threshold from an 8 by 8 Bayer matrix at that pixel.
3. Below 0.7, the pixel is the accent where the value is above the threshold, and the paper elsewhere. Above 0.7, the pixel is the ink where the scaled value is above the threshold, and the accent elsewhere.
4. The canvas draws at half or one third of the element size, with `image-rendering: pixelated`. Each dot then shows as a crisp 2 px or 3 px square.

## The four motions

| Mode | Name | What moves |
|---|---|---|
| 0 | noise field | Fractal noise that drifts slowly to the right |
| 1 | ripple | Rings that spread from a point near the right of the band |
| 2 | wave | A diagonal sine wave mixed with drifting noise |
| 3 | sweep | A bright edge that moves from right to left over noise |

The script hashes the `data-seed` attribute with FNV-1a. The hash picks the mode (hash modulo 4) and shifts the noise, so one seed always draws the same band. Set `data-mode` to force a mode.

## Markup

```html
<div class="dither" data-seed="skills" data-label="skills · 15 files" aria-hidden="true"></div>
<script src="dither.js" defer></script>
```

- `data-seed`: any string. Use the page path or slug.
- `data-label`: optional. A small mono chip in the lower left corner.
- `data-mode`: optional. 0, 1, 2, or 3.
- `data-px`: optional. The size of one dot in CSS pixels. The default is 2, and 3 below 600 px.
- Add the class `slim` for a band of 60 px instead of 108 px.

## Rules

1. Read the three colours from CSS variables: `--bg` for paper, `--blueprint` for the accent, and `--ink` for ink. Give each one a default: `#fafaf5`, `#3553ff`, and `#1a1a1a`.
2. Redraw with new colours when the `data-theme` attribute on the root element changes. Use a `MutationObserver`.
3. Draw at 30 frames per second at most. Skip a frame if less than 33 ms have passed.
4. Draw only while the band is visible and the tab is not hidden. Use `IntersectionObserver` and the `visibilitychange` event.
5. Move a soft bright spot to the pointer on devices that hover. Start a ripple on click that fades by 4 percent each frame.
6. With `prefers-reduced-motion: reduce`, draw one static frame. Draw again only on pointer, click, theme change, or resize.
7. If WebGL is not available, show a static diagonal hatch in the accent and paper colours.
8. If the shader does not compile, hide the band. The page must not show an error.
9. Mark the band `aria-hidden="true"`. It is decoration and holds no information.
10. Never put text on the dithered area, except the small label chip, which has a solid background.

## Dithered bars

The same idea works on bars inside a figure. A bar fill in the accent colour gets a dithered leading edge and a stepped entry.

- The edge is 16 to 24 px of paper-coloured dots over the end of the fill, at three densities: 22, 50, and 80 percent. The fill then breaks up into dots at its end.
- The entry is a dot veil over the fill that goes from opaque to clear in 4 steps over about 520 ms, with `steps(4, end)`.
- A grey track behind a fill can show a sparse ink dot field at 28 percent.
- To skip a colour lookup, put a pseudo-element at the end of the fill and give it the track colour. Cut it with a CSS `mask` of an 8 by 8 Bayer tile.
- Never put a label or a value on a dithered part of a bar.
- With reduced motion, show the end state with no veil.

## Check before you finish

- [ ] The band draws the same picture for the same seed after a reload.
- [ ] The colours change at once when you change the theme.
- [ ] The band stops drawing when you scroll it out of view. Check the frame counter in `data-frames`.
- [ ] With reduced motion, the band is static and complete.
- [ ] The page has no console errors with WebGL off.
- [ ] No text other than the label chip sits on dots.
