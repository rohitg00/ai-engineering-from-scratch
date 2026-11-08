# Colour and ink

This is the look for every machine page. Colour shows what each part is made of. Ink shows its shape. The motion and the model stay the same. Only the paint changes. `kit/ink.mjs` holds the code. This file says how to use it.

## The look in one list

- Warm paper behind the stage: `#f2efe7` in light, `#1f1c18` in dark.
- Flat colour with three tones for each material: light, mid and dark. The tone of a face comes from the direction it faces. There are no gradients.
- One body colour for the stations, picked with the swatches. The carriage or other main mover uses a second colour so that it stands out.
- Dark navy ink. A heavy outline round each main body, about 2.6 px. Inner edges are 1.2 px, and seams and grooves are about 0.7 px in a soft ink.
- A flat, hard-edged warm grey cast shadow on the bench, short and joined to the part that casts it. Never blue or purple, and never blurred.
- Glass where a station shows something inside: a light tint and one or two white streaks.
- Status lights: green when a station finished and red when it failed or reported a gap.
- Pill labels with leader lines, and a "Hand-drawn wobble" slider.

## Materials

`inkSolid(paths, style)` replaces `solidSvg`. It adds the class `m-<material>` to the solid, and CSS gives each material its three tones.

| Material | Use it for | Set it with |
|---|---|---|
| `mid` | station bodies, the body colour | `tone: "mid"`, the default for boxes |
| `hi` | small light parts: heads, tiles, cards, paper | `tone: "hi"` |
| `lo` | metal: bases, rails, rods, lamp housings | `tone: "lo"` |
| `board` | the bench plate and anything off | `material: "board"` |
| `ride` | the main mover, in a second colour | `material: "ride"` |
| `glass` | covers and windows | `glassSvg(...)` |
| `lamp` | status lights | `material: "lamp"`, then `data-state="ok"` or `"bad"` on a parent |

The kit maps the four shade bands of a solid to three tones. The top face and band 3 get the light tone, bands 2 and 1 get the mid tone, and band 0 gets a mix of mid and dark. The dark tone alone reads as an ink line, so it is never used on a whole face.

A part that a setting switches off keeps its shape and takes the board colours: put `data-off` on its group. Do not use opacity for this. Faded parts show the parts behind them and look like glass.

## Ink

- Draw a silhouette for each main body with `silhouetteSvg(points3, P)`. Pass the eight corners of one convex box. A hull over a part with a step or a gap draws a false straight line across the gap, so draw one hull for the base and one for the body.
- Paint the silhouette as the last child of the body item, so that the body's own faces do not cover it.
- Thin parts such as rods and posts keep the 1.1 px edge. They must look thin.

## Cast shadows

- `castShadowSvg(points3, P, z0)` pushes the points along the light onto the plane `z0` and fills their hull. The light is fixed: shadows fall toward the viewer and a little to the left.
- Draw all shadows in one item with a large negative bias, so that they paint after the bench and before everything that stands on it.
- One shadow for each body. Do not cast shadows of high, thin parts such as arms: their shadow lands away from the base and reads as a second object.
- The bench itself can cast one shadow onto the paper below it.

## Glass

- `glassSvg(x0, y0, z0, x1, y1, z1, P)` draws a tinted box and two streaks on its front face.
- Give the glass a depth bias between the contents and anything that moves above them. The contents paint first, then the glass, then the mover.

## Status lights

- Put one lamp on each station, on the top face where no arm or head passes in front of it. Check the 4x close-up: a lamp that sits under a head disappears.
- The model decides the state. A beat sets `pose.lamps[station]` to `ok` or `bad`, and `draw()` copies it to `data-state`. A gap counts as bad: an unknown name, a refused lift, a jump into the middle of an instruction.

## Labels

- `pillSvg([x, y], dx, dy, text, on)` draws a cream pill with a leader line to a screen point. Project the 3D anchor with `K.iso`, and add the explode offset of the assembly, so that the leader stays on the part when the machine explodes.
- The anchor is the working part, not the middle of the body.
- Point the pills outward into empty space, above the machine. They must not cover a moving part or printed text. Long rows of stations need two or three rows of pills: compute each pill height from a fixed point on the station roof, and step the rows in turn.
- Aim for 3 to 6 labels. A pipeline with more stations than that can have one pill for each station when the pills sit in clear space. Check every event of a run in the sweep frames.
- The pill turns the accent colour while its station is hot.
- Draw the pills in a `<g data-pills>` group after the depth-sorted layer, and redraw them when their text, their projected anchor or their hot state changes. The anchor moves when the machine explodes.
- Give the page a Labels switch, and read `?labels=0`. The class `iso-nolabels` on the root hides them.

## Wobble and colour controls

- `wobbleFilter(id, scale)` returns a displacement filter. Put it on the depth-sorted layer only, not on the pills, so that the labels stay sharp.
- A range input sets the `scale` of the `[data-wobble]` element. At 0, remove the filter from the layer: the frame loop gets cheaper.
- Swatches set `--body-l`, `--body-m` and `--body-d` on the figure. In dark mode, blend the swatch toward the dark paper by about 0.38 with `blend()`, so that the colour does not glare.

## Dark theme

- Same look, darker paper and light ink. The `INK_CSS` dark block swaps the paper, ink, metal, ceramic, board, glass and shadow tokens.
- Check the contrast of the ink against the darkest body tone, and of the pill text against the pill.

## The big idea

Put one short line under the figure that starts "The big idea" and says the point of the machine in plain words. It is copy, not a caption on the stage.
