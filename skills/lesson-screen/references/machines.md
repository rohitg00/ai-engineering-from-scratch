# Machines

A machine is a JSON spec that describes the system of one lesson as physical parts. `CLI machine spec.json` checks the spec and writes a full-page screen. The page draws the parts in a 3D view and a 2D blueprint view, and walks the learner through numbered steps.

## Design the machine before the JSON

1. Name the system in one sentence: "Tokens move through attention and the MLP, and each pass mixes more context into each token."
2. List the lesson's own concepts. Each concept becomes one part, or one flow between parts.
3. Give each part a shape that hints at its job. Use the table below.
4. Arrange the parts so that data moves in one direction: bottom to top, or left to right.
5. Leave space between stations, so that the flows between them stay visible.
6. Write four to eight steps. Each step shows one change.
7. Run the lesson code. Copy its real numbers into the readouts and the step text.

| Job in the lesson | Shape that reads well |
|---|---|
| A layer, a stage, a block of weights | `slab` or `box` |
| A store, a cache, a queue, a database | `cylinder` |
| A token, a message, a request | `sphere` or a small `box` |
| A loop or a repeated pass | `torus` |
| A filter or a router | `cone` |
| A sensor, a port, a small connector | `disc` or `capsule` |

Use 8 to 30 parts. A machine with fewer parts looks empty. A machine with more parts hides its flows.

## Spec

```json
{
  "title": "One transformer block",
  "fig": "07.05",
  "lesson": "phases/07-transformers-deep-dive/05-full-transformer",
  "question": "How does one block turn token vectors into better token vectors? Press the steps in order.",
  "bigIdea": "Attention mixes information between tokens. The MLP changes each token alone. The residual path keeps the input.",
  "note": "Sizes are not to scale.",
  "parts": [],
  "flows": [],
  "readouts": [],
  "steps": []
}
```

| Key | Required | Rule |
|---|---|---|
| `title` | yes | 1 to 60 characters |
| `fig` | no | up to 16 characters, shown as FIG before the title |
| `lesson` | no | the lesson path, starting with `phases/` or `certifications/` |
| `question` | yes | 1 to 200 characters, shown above the model |
| `bigIdea` | yes | 1 to 320 characters, shown under the model |
| `note` | no | up to 200 characters, for scale and simulation notes |
| `parts` | yes | 1 to 48 parts |
| `flows` | no | up to 24 flows |
| `readouts` | no | up to 6 readouts |
| `steps` | yes | 1 to 10 steps |

The check rejects any key that this page does not list. A typo such as `colour` fails the check.

## Parts

```json
{
  "id": "attn",
  "label": "Multi-head attention",
  "explain": "Each token scores every earlier token and takes a weighted mix of their values.",
  "shape": "box",
  "size": [4, 0.8, 2],
  "at": [0, 2.4, 0],
  "rotate": [0, 0, 0],
  "material": "glass",
  "tone": "accent",
  "explode": [0, 1.2, 0],
  "group": "attention"
}
```

| Key | Required | Rule |
|---|---|---|
| `id` | yes | lowercase letters, digits, and hyphens, starting with a letter, up to 32 characters, unique |
| `label` | yes | 1 to 32 characters, the lesson's own name for the part |
| `explain` | yes | 1 to 240 characters, shown when the learner clicks the part |
| `shape` | yes | one of the shapes below |
| `size` | yes | numbers from 0.02 to 20, in the count that the shape needs |
| `at` | yes | `[x, y, z]`, the centre of the part, each from -30 to 30 |
| `rotate` | no | `[x, y, z]` in degrees, each from -360 to 360 |
| `material` | yes | one of the materials below |
| `tone` | no | one of the tones below. The default comes from the material |
| `explode` | no | `[x, y, z]`, the offset when the parts are fully apart, each from -30 to 30 |
| `group` | no | up to 24 characters, a station name for the parts list |

### Shapes and sizes

| Shape | `size` |
|---|---|
| `box` | `[width, height, depth]` with rounded edges |
| `slab` | `[width, height, depth]` for thin plates, with small rounded edges |
| `cylinder` | `[radius, height]` |
| `disc` | `[radius, height]` for short cylinders |
| `sphere` | `[radius]` |
| `capsule` | `[radius, length]` |
| `cone` | `[radius, height]` |
| `torus` | `[radius, tube]`, where `tube` is smaller than `radius` |

### Coordinates

- `y` points up. `x` points right, and `z` points toward the viewer.
- One unit is about one small block. Keep the whole machine inside 20 units on each side, so that it fits the view.
- The viewer moves the machine so that its lowest point sits on the desk. You do not need to start at `y` = 0.

### Materials and tones

| `material` | Look | Default `tone` |
|---|---|---|
| `metal` | polished metal | `steel` |
| `brushed` | brushed metal with a soft sheen | `steel` |
| `plastic` | moulded plastic with a light coat | `ink` |
| `glass` | clear glass that shows the parts behind it | `paper` |
| `ceramic` | glazed ceramic | `paper` |
| `rubber` | matte rubber | `ink` |
| `glow` | a part that emits light | `accent` |

The tones are `accent`, `ink`, `paper`, `steel`, `warn`, `copper`, and `gold`. Use `accent` for the subject of the lesson only. Use `warn` for one second state, such as a failure path or a dropped token.

## Flows

A flow is data that moves from one part to another. The 3D view moves bright beads along an arc between the two parts. The blueprint view draws a dashed arrow.

```json
{ "id": "x-to-attn", "from": "embed", "to": "attn", "label": "x [8 x 64]" }
```

| Key | Required | Rule |
|---|---|---|
| `id` | yes | the same form as a part id, unique among flows |
| `from` | yes | a part id |
| `to` | yes | a different part id |
| `label` | no | up to 40 characters, shown in the active step |

## Readouts

A readout is one real number that the learner watches. Each step can change its value.

```json
{ "id": "tokens", "label": "tokens", "value": "8" }
```

| Key | Required | Rule |
|---|---|---|
| `id` | yes | the same form as a part id, unique among readouts |
| `label` | yes | 1 to 24 characters |
| `value` | yes | a string of 1 to 24 characters, the value before the first step |

## Steps

```json
{
  "title": "Score pairs",
  "say": "Each of the 8 tokens scores the earlier tokens. The lesson run prints 36 scores for 8 tokens.",
  "focus": ["attn"],
  "flows": ["x-to-attn"],
  "explode": 0.5,
  "view": "iso",
  "readouts": { "scores": "36" }
}
```

| Key | Required | Rule |
|---|---|---|
| `title` | yes | 1 to 32 characters, a short verb phrase |
| `say` | yes | 1 to 280 characters, one or two sentences |
| `focus` | no | up to 12 part ids. Other parts fade. No list keeps every part in focus |
| `flows` | no | flow ids that run in this step |
| `explode` | no | 0 to 1, how far apart the parts sit. The default is 0 |
| `view` | no | `iso`, `front`, `side`, or `top`. The default is `iso` |
| `readouts` | no | readout ids with their new string values |

Values that a step does not set keep the value from the step before.

## What the learner sees

- A rail of numbered steps on the left, with the text of the active step.
- The model in the centre, with the question above it and the readouts under it.
- A view switch for 3D and Blueprint, a switch for Auto and Manual steps, an Apart slider, and a Save image button.
- A part panel that opens on a click, with the label, the explanation, and a button that asks the tutor about the part.
- The big idea, the note, and a line that says the tutor built the machine and the course authors did not review it.

Keys: Space or Enter for the next step, the arrow keys for the previous and next step, B for the blueprint view, A for Auto. A parts list under the model gives keyboard access to every part.

## Check errors

`CLI check` prints one line per error. Each line starts with the path of the value, as in `parts[2].size`. Fix the first error first, because one typo can cause several errors.

```json
{"type":"invalid","errors":["parts[2].id: \"attn\" is already used by parts[0]","flows[0].to: \"mlp2\" is not a part id"]}
```

## Two examples

`examples/transformer-block.json` draws one decoder block: embeddings, attention, the residual path, normalisation, and the MLP.

`examples/agent-loop.json` draws the agent loop: the model, the tool registry, the tool calls, the observations, and the stop check.

Both examples pass `CLI check`. Read their steps for the tone and length of `say`.
