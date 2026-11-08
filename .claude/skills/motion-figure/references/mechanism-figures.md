# Mechanism figures

A mechanism figure is a small interactive panel that shows how one system works. The reader drives it with one control, watches the named contents change, and reads a verdict that the figure computes. Use this tier for a standalone page, a README demo, a product page, or an essay. Inside a lesson, use the lesson figure tier first.

## Real names

Show the named parts of the real system. Do not draw abstract boxes.

| Topic | Weak figure | Strong figure |
|---|---|---|
| Context window | Grey bars that grow | A panel titled `CONTEXT WINDOW` with named rows such as `tool: test output 21k` and `goal: fix auth 2k`, a colour key, and token counts aligned right |
| Load balancer | Three boxes and two arrows | Named clients, a balancer, a pool of replicas, packets that move, and one replica the reader can stop |
| Rules file | A bullet list | The real file, with rules that appear one at a time and a comment on each rule that names the incident it came from |
| Agent fleet | A number | A grid of agent squares, with N running and the rest queued |

If the draft shows generic boxes, delete it. Draw the real parts with their real names.

## Rejected figures

Do not make these. Each one was made, reviewed, and removed.

1. Abstract byte bars or stacked grey rectangles with no names.
2. A static dot plot with no control.
3. A straight line on a log scale. Exponential decay is always a straight line on that scale, so the figure says nothing new.
4. A pyramid of plain boxes with no control.
5. Chat bubbles, when a view of the contents is clearer.

## One new mechanism per page

Every page gets a mechanism that no other page on the site uses. Keep a table of mechanisms with the page that uses each one. Before you build, read the table and pick a new shape. After you build, add a row.

Shapes to start from:

| Shape | What the reader does |
|---|---|
| Named-row panel | Picks an input and watches rows load, fold, or drop out |
| Topology with packets | Sends traffic and stops one part to see where packets go |
| Lifecycle stepper | Steps one object through its states, with only valid steps enabled |
| Accreting file | Watches a file grow one rule at a time, each rule with its reason |
| Fan-out grid | Sets a count and watches cells move from queued to running to done |
| Racing lanes | Runs two strategies side by side and compares the finish time |
| Crash-anywhere simulator | Picks the step where a process dies and reads what survives |
| Tape with checkpoints | Moves checkpoint marks on a long run and reads the redone work |
| Tile map of memory | Changes a size and watches named regions fill fixed tiles |

## Anatomy

Every mechanism figure has five parts, in this order.

1. Head: a label in mono caps on the left, two to four words. A Replay button on the right.
2. Note: one or two sentences that tell the reader what to do and what to watch.
3. Controls: buttons, a slider, or toggles. One control is enough.
4. Body: the named contents.
5. Verdict: one line of text that the figure computes from the current state.

The scaffold in `templates/mechanism.html` has all five parts.

## The verdict

- Write the verdict in text. Colour alone is not a verdict.
- Compute it from the same numbers that the body shows. Never write a fixed outcome.
- Make every number something the reader can derive from the figure, or cite where it comes from.
- Set it at 12.5 px or larger in the mono font.
- A border colour can repeat the result: green for a good result, red for a bad one. The text still says it.

## Motion budget

| Motion | Duration | Easing |
|---|---|---|
| Press on a button | 120 to 160 ms | `cubic-bezier(0.23, 1, 0.32, 1)` |
| Reveal of a row or a panel | 200 to 300 ms | `cubic-bezier(0.23, 1, 0.32, 1)` |
| Fold or drawer | 380 to 500 ms | `cubic-bezier(0.23, 1, 0.32, 1)` |
| Colour change | 150 to 200 ms | `ease` |

- Animate `transform` and `opacity` only. Animate `max-height` only to fold a panel open or closed.
- Never use `ease-in` for an entry.
- Give every button `:active { transform: scale(0.96) }`.
- Put hover effects inside `@media (hover: hover) and (pointer: fine)`.
- Stagger a list by 30 to 70 ms per item. Stagger only the first 8 items and show the rest at once.
- Keep every motion under 500 ms.

## When it plays

1. Render the first state at once, so the figure is readable before any motion.
2. Start the run once, when 35 percent of the figure is visible. Use `IntersectionObserver` with `threshold: 0.35` and disconnect it after the first run.
3. Add a Replay button that runs it again from the first state.
4. Never loop a mechanism figure.
5. Never start motion on an action the reader repeats fast, such as a key press while typing.
6. With `prefers-reduced-motion: reduce`, render the end state at once and skip every transition.

## Readable at every frame

Check these at the first frame, during the run, and at the end state.

- No label is cut or ends in an ellipsis. If a label does not fit its segment, move it outside with a leader line or a numbered key.
- No text sits on a hatched, striped, or dithered fill.
- No two text boxes overlap, mid run or at the end.
- Figure text is 11 px or larger. Values and the verdict are 12.5 px or larger.
- The figure reads in light and dark theme. Take every colour from a CSS variable.

## Small screens

- At 320 px, panels stack in one column. Use `grid-template-columns: 1fr` below 600 px.
- The page has no sideways scroll at 320 px and at 390 px.
- Every button and toggle has a touch target of 40 px or more.

## Check before you finish

- [ ] The body shows real names and real numbers. No label reads `item 1` or `block A`.
- [ ] The reader drives at least one control.
- [ ] The verdict is text, and a change in the control changes it.
- [ ] Each number in the verdict matches the arithmetic on the numbers in the body.
- [ ] The run starts once on view, Replay runs it again, and nothing loops.
- [ ] With reduced motion, the end state appears at once.
- [ ] No motion lasts longer than 500 ms, and only `transform` and `opacity` move.
- [ ] Screenshots at 1280 px and 390 px, in light and dark, show no cut labels and no overlap.
- [ ] Zero console errors while you click every control.
- [ ] The mechanism table has a new row for this figure.
