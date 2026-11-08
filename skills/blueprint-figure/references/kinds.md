# The nine figure kinds

Each figure has one kind. Pick the kind from the claim, then use the layout below. All coordinates are in viewBox units at width 640. Keep content between x 20 and x 620.

| Kind | Use it for |
|---|---|
| `sequence` | parties on lifelines, time running down, numbered exchanges |
| `structure` | the anatomy of one record, object, or schema |
| `flow` | stages that data passes through, with who writes and who reads |
| `comparison` | two answers to one question, side by side |
| `timeline` | tracks over a numbered axis such as commit sequence or time |
| `tree` | ownership, containment, or delegation |
| `state` | a state machine with its transitions |
| `decision` | where something fails and what each outcome means |
| `layers` | a stack of layers with the parts each one owns |

## sequence

- Party boxes at the top: y 8 to 10, height 30 to 40, centred on the lifeline x.
- Four lanes: lane centres near x 118, 262, 406, 556, box width 112. Seven lanes: centres at `52 + i × 89`, box width 86, title 11, padding 3.
- Lifelines from the box bottom to `H − 8`.
- Rows every 44 to 46 units, the first row at y 76 to 84.
- A step circle at x 16 to 24 on each row. Number rows in capture order.
- Each arrow is horizontal. The label sits 6 units above the line, the note 15 units below.
- Height: about `first row + rows × 44 + 30`. Eight rows fit in 430. Ten rows fit in 540.

## structure

- A header box in the record hue, height 28, with the record name aligned left.
- One row per field, height 28, fill paper, stroke panel-edge.
- Field name at x 32, size 12, ink-soft. Value at x 150, size 12, ink.
- Notes on the right at x 380, size 11 serif.
- A short rule from x 350 to x 372 in the record hue joins each note to its row.
- Two kickers: the record on the left at x 20, "what each field is for" at x 380.
- Six fields fit in a height of 226.

## flow

- Kickers across the top: who writes, the stages, who reads.
- Writers in a column on the left (x 20, width 130, height 38, 46 units apart).
- The stages inside one container rect in the durable hue, each stage box 72 wide with 10 units between boxes.
- Readers in a column on the right (x 530, width 90).
- Writers join the queue with `call` paths. Readers take frames with `event` paths. Effects below the queue return with an `effect` arrow.

## comparison

- Two columns: left at x 20, right at x 336, each 284 wide.
- A dashed vertical rule at x 320 between them.
- Kickers name the two answers: `A · <first answer>` and `B · <second answer>`.
- The same number of rows in each column, 70 units apart, boxes 44 high.
- Compare two behaviours of the subject. Never compare against an earlier build.

## timeline

- One kicker per track at x 20.
- Bars 12 units high. Solid bars in the hue ink for work, hatched bars for waiting, dashed outline bars for resumed or planned work.
- An axis rule from x 60 to x 620, with a tick 8 units tall every 40 units.
- A number at size 11 below each tick.
- A kicker under the axis names the unit, such as `Commit seq`.
- An event across all tracks is a dashed vertical rule with a bold label above it, width 1.4.

## tree

- The root box centred at the top (x 230, width 180).
- Children in one row 94 units below, boxes 180 wide and 44 high, at x 20, 230 and 440.
- Edges are orthogonal paths in ink-mute with no arrowhead: down from the parent, across, down into the child.
- One short serif label, such as `owns`, names the relation once.

## state

- Live states on the left, terminal states in a column on the right (x 470, width 150).
- A kicker `Terminal` over the terminal column.
- All transitions use the `state` style (dashed amber).
- Branches leave through one junction x, such as x 380 or x 430, then turn into each target.
- Terminal states have a double border. Interrupted states have a dashed border.
- Transition labels are 11 serif in ink-soft, next to the line, never on it.
- One serif line at the bottom explains the borders: `double border: terminal · dashed border: interrupted`.

## decision

- Phases in one row across the top, 110 wide, 120 units apart, starting at x 20.
- Outcomes in a row below, at about y 118.
- Safe outcomes in teal. Unknown or unsafe outcomes in rose.
- `call` arrows from each phase to its outcome, `fail` arrows where the phase fails.
- A last row says what to do next for each outcome, joined by `reply` arrows.

## layers

- One kicker per layer at x 20, then the layer box or container under it.
- Main stack 440 wide (x 20 to x 460). Options or plug-ins in a column on the right at x 480, width 140, joined by dashed rules.
- Components inside a layer: boxes 98 wide, 106 units apart.
- `call` arrows go down from the host. `write` arrows go down into storage. One label names the rule, such as `every change is a commit`.

## Figure 0.1

The first figure of a set teaches the grammar. Draw it as a `sequence` with the real parties of the subject. Give each row one arrow style and a note that names the style, such as `a failure · dashed rose`. Include every arrow style the set uses.
