# Routing gaps

A gap is a claim that the learner missed, a wrong answer that they matched,
or an unsupported number. Each gap goes to the material that teaches it.

## Targets

Take the targets from the item only. Use this order and stop at three.

| Order | Source | Show it as | Next action |
|-------|--------|------------|-------------|
| 1 | front matter `manuals`, `<manual-id>#s-<slug>` | `manuals/<manual-id>/sections/<file>.md` | read that section |
| 2 | front matter `lessons`, `phases/NN-x/MM-y` | the lesson path | `learn` on that lesson, in the host form |
| 3 | front matter `practice` | `practice/<id>` | do the practice task |
| 4 | front matter `cheatsheet` | `cheatsheets/<id>` | read the cheat sheet |
| 5 | the phase of a lesson target | the phase number | `check-understanding <phase>`, in the host form |

To find the file of a manual section, look in `manuals/<manual-id>/sections/`
for the file whose name ends with `-<slug>.md`. A slug that starts with
`ref-` names a reference section, such as `r-3-incident-index.md`.

Pick the target that is nearest to the missing claim. A gap on a measured
number goes to the manual section first, because the manual holds the
measurement. A gap on a concept goes to the lesson first.

If the item names no target that fits, give the `Taught in` sentence of the
item and say that no closer target exists. Do not name a lesson or a section
that the item does not name.

## Show a route

Use one line for each gap:

```text
Gap: <plain words>. Read <path>. Then <next action in the host form>.
```

Show the site page of the item after the learner has answered, never
before. The site shows the answer behind a fold, and a learner can open it
by mistake.

## Due dates

Space the reviews. Set the `Due` date from the number of times the gap has
been open.

| Times open | Due |
|------------|-----|
| first time | the next day |
| second time | three days later |
| third time and after | seven days later |

## Review mode

1. Read the current state, as [the state file](state-file.md) says.
2. List the open gaps that are due, oldest first. Ask the learner if they read
   the target. Do not mark a gap closed on that answer alone.
3. For each due gap, ask one item from the same card at the same level. Use a
   new item when one exists. Ask the same item again only when no other item
   fits, and say so.
4. A grade of working or strong closes the gap with a new Gaps row. A lower
   grade adds a new open row with the next due date.

Done when: each due gap has a new row, closed or open.

## Send a gap to a course skill

When a gap needs a full lesson, offer `learn` on the target lesson in the
host form. The course skill owns its own state file. Do not write lesson
progress into `INTERVIEW-LEARNING.md`, and do not write gaps into
`LEARNING.md`.
