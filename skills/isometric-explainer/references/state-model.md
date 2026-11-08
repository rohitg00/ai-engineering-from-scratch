# The state model

The model is a plain ES module with no DOM, no timers and no randomness. The build script inlines it into the page, and the tests import it directly. Everything the page shows comes from its output.

## Contract

```js
export const DEFAULTS = { cache: true };
export function configOf(input) {}   // clamps any input to a valid config
export function simulate(input) {}   // returns { config, events, totals }
export function encode(config) {}    // config to a query string, "" for DEFAULTS
export function decode(search) {}    // query string to a config, bad values become defaults
```

Rules for the contract:

- `configOf` accepts anything and returns a valid config. Unknown values become the default.
- `simulate` never reads the clock. Simulated time is a sum of fixed costs from a `COST` table.
- `encode` writes only the values that differ from `DEFAULTS`, so the default URL has no query.

## Event shape

Each event is one step the machine shows. The reference page uses these fields:

```js
{
  index: 4,              // position in the list, starts at 0
  type: "schema",        // what happened, drives the motion beats
  station: "schema",     // which part does the work, drives the accent
  cost: 2,               // simulated ms for this step
  clock: 1132,           // running total of cost
  turn: 1,               // counters the readouts show
  calls: 1,
  context: ["req-01", "mem-01", "inv-2026-04", "inv-2026-05"],
  trace: "schema check passed",
  // event-specific fields: ok, errors, result, verdict, proposal
}
```

Store snapshots (`context.slice()`) in each event. The readouts can then show any event without a replay of the run.

Give every event a `trace` string. The trace panel, the printer tape and the screen reader text all use it.

## Limits

A loop in the model needs a hard limit. The reference page stops after 4 model turns and 3 tool attempts. Its backoff waits are 500 ms and 1000 ms, and its timeout is 2000 ms. A run that reaches a limit ends with a `failed` status and a trace line. It never loops forever.

## Outcome

End every run with an `exit` event and an outcome status. The reference page uses four: `verified`, `declined`, `unchecked`, `failed`. Keep the status separate from correctness. An unchecked answer can be right, and the page says "Nothing checked this answer. It happens to be right this time."

## Tests

Write these tests before geometry. The reference page has 14.

1. The healthy run produces the exact event type sequence, joined as one string.
2. The arithmetic gives the exact numbers the page prints, for example `{ diff: 3100, pct: 25 }`.
3. Each failure config produces its own sequence and outcome.
4. A sweep over every config combination. Each run ends with `exit` and stays inside the limits. Every event has a `trace`, and the clock never goes back.
5. `simulate(config)` deep-equals a second `simulate(config)`.
6. `decode("?" + encode(config))` deep-equals `config`, and a nonsense value decodes to `DEFAULTS`.
7. The published page equals a fresh build output.
8. The page HTML contains every control hook and the simulation sentence.

Run them with `node --test`. The starter has four of these in `templates/model.test.mjs`.

## URL state

On every load, the page reads `decode(location.search)`. On every config change, it calls `history.replaceState` with `encode(config)`. A "copy link" button copies `location.href`. A shared link opens with the same switches set.
