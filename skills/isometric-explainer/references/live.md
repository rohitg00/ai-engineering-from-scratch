# The live script

The build script inlines the kit, the model, a data object `D` and the live script into one `<script>`. The live script turns model events into motion and keeps the page in step with the model.

## From events to beats

`beatsFor(sim)` turns each event into a short list of beats. A beat is a tween of pose fields:

```js
{ d: 0.4, to: { head: -5 }, hot: ["head", "carriage"], start: (pose) => {}, event: 7 }
```

- The pose is a plain object of numbers: carriage position, arm offsets, counters. Start each run from `freshPose(config)`.
- `to` lists the pose fields the beat moves. `start` sets discrete changes, such as showing a card.
- `hot` lists the item ids the accent marks during the beat.
- The first beat of each event carries `event`. When it begins, the readouts and the trace update from that event.
- Travel beats compute their own time. The reference uses `0.35 + distance / 150` seconds. The starter uses `0.3 + distance / 90`.
- Ease with a cubic in-out curve. Keep each beat between 0.1 and 1.3 seconds.

## The frame loop

```js
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  if (state.playing) advance(dt * speed * (still.matches ? 40 : 1));
  const moving = stepExplode(dt);
  draw();
  frame = visible && (state.playing || moving) ? requestAnimationFrame(tick) : 0;
}
```

- `advance(dt)` walks through beats and can finish several short beats in one frame.
- Step mode sets `stopAt` to the next event index. `advance` stops before the first beat of a later event.
- The loop stops when nothing plays and nothing springs. Any control calls a wake function that requests one frame.
- An `IntersectionObserver` with `rootMargin: "120px 0px"` sets `visible`. Off screen, no frames run.

## draw()

1. Compute one world offset `T[id]` per item: the explode offset of its assembly plus any pose offset.
2. Set `transform` to `K.translateAlong(P, T[id])`. Skip the write when the string did not change.
3. Compute `key + dot(T[id], V)` for every item, where `V` is the depth of a unit step along x, y and z.
4. Sort by that value. Join the ids into one string. Reorder the DOM only when the string changed.
5. Rebuild paths that change shape: rods, needles, crank handles. Cache rebuilt shapes by a rounded value. The reference rounds the drawer opening to 0.25 units.
6. Toggle `display` for parts that appear and disappear, such as cards.
7. Set `data-hot` on the beat's `hot` items. Remove it from all others.
8. Redraw the pill labels and the status lights from the pose. See `colour-and-ink.md`.

## One accent

CSS turns the accent on for any group with `data-hot`:

```css
[data-hot] .iso-edge { stroke: var(--anatomy-lit); }
[data-hot] .iso-top { fill: var(--anatomy-lit-top); }
[data-hot] .iso-shade { fill: var(--anatomy-lit-shade); }
[data-hot] .iso-face-text { fill: var(--anatomy-lit); }
```

Only the parts doing the current step are hot. A part switched off by the config is faded with lower opacity, not coloured.

## Controls

Each control changes the config or the view, then reloads the model run.

| Control | Action |
|---|---|
| Run | Play from the current beat. On a finished run, reload and play |
| Step | Play to the start of the next event |
| Break | Load the next failure config in a fixed order and play |
| Repair | Load `DEFAULTS` and play |
| Explode | Spring every assembly to its offset. Pause the run |
| Reset | Assemble, clear the selection, load `DEFAULTS` |
| Switches | `load(configFromForm())`. Keep playing if a run had started |

`load` calls `simulate`, rebuilds the beats, resets the pose, syncs the switches, writes the URL and redraws.

The reference page also has scenario buttons and a speed selector (0.5x, 1x, 2x, 4x). It adds a part inspector, a guided tour of six steps and a copy-link button.

## Keyboard and screen readers

- The stage has `tabindex="0"` and an `aria-label` that lists the keys.
- Space and Enter run or pause. Right arrow steps. E explodes. B breaks. R repairs.
- Ignore keys when the event target is not the stage, so form controls keep their keys.
- Tabs use arrow keys and `aria-selected`.
- An `aria-live="polite"` element announces the outcome at the end of a run.

## Reduced motion

- When `prefers-reduced-motion: reduce` matches, runs advance 40 times faster and the explode spring snaps to its goal.
- Do not autoplay with reduced motion or with `?still` in the URL.
- Otherwise autoplay once, 900 ms after the stage is 35% visible.

## Layout

- One screen at desktop width: a header line, a toolbar, the stage and the readouts. The reference grid is `250px minmax(0, 1fr) 350px` inside `height: 100svh` with `min-height: 700px`.
- The stage takes the free space. The SVG fills it with `width: 100%` and `height: 100%`.
- Below 1100 px the grid becomes one column and the height becomes `auto`.
- Below 640 px the readouts use two columns. The reference page widens the SVG to 150% inside a clipped plate, so the bench fills a phone screen.
- Buttons are at least 44 px tall.

## Debug handle

Expose the state and a few functions on `window`, for example `window.__machine = { state, load, play, pause, step, seek, finish }`. The verification script uses `seek(n)` to stop at any event.
