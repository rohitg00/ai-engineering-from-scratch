# Geometry

All geometry is built once in Node by the build script. The browser only moves groups, toggles their visibility and rebuilds a few paths.

## World units and axes

- x runs left to right along the bench, y runs from back to the viewer, z runs up.
- One world unit is one unit of the design, not one pixel. The reference bench plate is 398 by 292 units. The starter bench is 144 by 68.
- Keep the bench top at z = 0. Stations stand on it. The plate and its feet go below zero.

## Camera

```js
const P = k.fitProjection(points, W, H, { pad: 26, azimuth: 60 });
```

- Elevation is 30 degrees, the kit default. Do not change it per part.
- The azimuth sets which faces show. At 60 degrees, faces toward +y carry 0.87 of the view and faces toward +x carry 0.5. Put working faces on +y faces.
- `points` must include the plate corners and the highest points of the exploded pose. If you leave out the exploded pose, exploded parts leave the stage.
- The reference page uses a 960 by 640 viewBox. The starter uses 720 by 440.

## Parts list

Write the list before any code. One row per part:

| id | assembly | plan (x, y, w, d) | z0 to z1 | tone | moves |
|---|---|---|---|---|---|
| `cache` | cache | -26, -30, 20, 18 | 0 to 10 | mid | no |
| `probe` | cache | -19, -3, 6, 6 | 18 to 25 | hi | z, -2.5 on lookup |
| `bin0` | cache | -21, -27, 10, 0.8 | 10 to 17 | hi | shown when stored |

The assembly decides the explode vector and the pill label that lights with the part.

## Kit functions you will use

From `kit/iso-kit.mjs`:

| Function | Makes |
|---|---|
| `fitProjection(points, W, H, opts)` | The projection `P` |
| `iso(p, P)`, `depthOf(p, P)` | Screen point and depth of a world point |
| `slabOf(plan, z, h, P, steps, bevel)` | A rounded box. `plan` is `{ x, y, w, d, r }` |
| `cylinder(cx, cy, r, z, h, P, steps)` | An upright cylinder |
| `extrude(ring, z, h, P, opts)` | Any plan polygon pushed up |
| `solidSvg(paths, { tone, crease, lit, inner })` | Fill, four shade bands, top, crease and outline |
| `lineSvg(d, { tone, free, dotted, dashed })` | A line with a tone |
| `lineOnTop(a, b, z, P)`, `segment(a, b, P)`, `ring(cx, cy, r, z, P)` | Line paths on a top face or in space |
| `radialTicks`, `topTicks`, `knurl`, `sideSeam`, `dotGrid` | Dial ticks, ruler ticks, grip texture, seams, perforation |
| `topMatrix(at, z, P)`, `sideMatrix(at, z, P, face)`, `faceTextSvg(m, text, opts)` | Text engraved on a face |
| `haloOf(plan, z, h, P)` | A soft shadow under a station |
| `translateAlong(P, [dx, dy, dz])` | The SVG `translate` for a world offset |
| `figureSvg`, `plateHtml`, `ISO_CSS` | The SVG root, the corner plate frame and the base styles |

From `kit/lathe.mjs`: `frameAlong`, `disc`, `ribsOf`, `dotsOf`, `circleOf`, `spokesOf` and `viewOf` build drums, rollers, rods and ports on any axis. From `kit/tube.mjs`: `tubePieces` and `tubeSvg` build bent pipes that split into depth-sorted pieces.

## Shading and tones

- `inkSolid` (from `kit/ink.mjs`) paints each solid in three flat tones of its material, a lit top and an ink outline. See `colour-and-ink.md` for the materials and the tone rules.
- An extruded side face gets band `floor(4 * (n . l + 1) / 2)`. Here `n` is the face normal in plan and `l` is `(-sin A, cos A)`. The ink CSS maps the four bands to three tones.
- Lathe bodies use a raised light and band limits of 0, 0.2, 0.42 and 0.62.
- Outline weights: about 2.6 px for a body silhouette, 1.1 px for edges, 0.7 px for seams. Use `silhouetteSvg` for the heavy line.
- Tokens come from CSS variables, so both themes work. `INK_CSS` holds the paper, ink, material and shadow tokens for light and dark.
- The accent is `--anatomy-lit`. The hot part gets the accent on its top face and its edges, and its pill turns the accent colour. Nothing else on the stage uses the accent.
- Cast shadows replace the blurred halo: `castShadowSvg` for each body, drawn in one low item.

## Items and depth keys

Each part becomes one item: `{ id, asm, key, svg }`. The key is the depth of a reference point plus a bias.

```js
const depth = (p) => k.depthOf(p, P);   // (x cosA + y sinA) cosE + z sinE
put("probe", "cache", [-16, 0, 20], svg, 6);
```

- Pick the reference point at the visible centre of the part.
- Larger keys paint later, so they appear in front.
- Give the base plate a bias of about -1000 and the track about -500, so they always paint first.
- A part that rests on top of another part needs a positive bias. In the starter, a card on the cache top had a smaller key than the cache body. It stayed hidden until it got a bias of 3.
- A head that hangs over a carriage gets a bias of 6 to 20, so it paints over the cards below it.

## Labels

Every station gets a pill label with a leader line to its working part. The pills replace engraved nameplates.

```js
const roof = at([XS[asm], backY, roofZ])[1] - [62, 38, 14][i % 3];
LABELS.push({ asm, at: anchor, dx: 0, dy: Math.round(roof - at(anchor)[1]) });
```

- Anchor the leader on the part that does the work: the decode bed, the IR stack, the type pins.
- Put pills in empty space above the machine, in two or three rows that alternate, so that neighbours do not touch. The verify loop checks the overlap in every frame.
- Pills move with their assembly in the exploded view, because the live script adds the explode offset to the anchor.
- `colour-and-ink.md` has the label rules, the Labels switch and `?labels=0`.

## Lines

- Every line ends on a solid, on another line or on a hub.
- A pointer that starts on a hub and ends in free space carries `data-free="end"`. A pointer drawn from its tip uses `data-free="start"`.
- Rods between a fixed arm and a moving head are lines that the live script rebuilds each frame. Both ends sit on solids at every pose.

## Explode

Give each assembly one offset vector in world units. The reference vectors run from `[0, 6, 44]` for the controller to `[-50, -14, 16]` for the memory drum. Base, track and core stay at zero. Parts hidden inside a housing, such as a drum, fade in as the housing lifts.
