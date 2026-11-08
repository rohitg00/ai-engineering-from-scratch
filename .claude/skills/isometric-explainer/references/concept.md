# Invent the machine

Each part of the machine does one step of the process. After one run, a reader can explain the process without the captions.

## The one-sentence test

Write this sentence before anything else:

> X moves through Y, and that motion means Z.

Examples that pass the test:

- A request card rides a carriage round a loop past stations, and each lap means one model turn.
- A request card stops under a probe, and a probe that finds a stored copy means a cache hit.
- A slip goes through a schema gauge and past a permission bolt, and a slip that stops means a rejected tool call.

If the sentence needs the word "represents" twice, the machine is too abstract. Pick objects that do the job physically. A drawer holds documents, a press makes something new, a gauge measures and a bolt blocks.

## Pick objects that do the job

| Concept shape | Physical object | Motion that carries the meaning |
|---|---|---|
| Ordered steps | Track and carriage | The carriage stops at each station in order |
| Stored items | Drawer, bin, rack | Cards appear in it or leave it |
| Expensive work | Press, crank, calculator | A head comes down, a crank turns |
| A check | Gauge with a needle, plunger | The needle stays at zero on a match and swings on a mismatch |
| A block | Bolt, latch | The bolt slides across or stays shut |
| A limit or budget | Counter, quadrant, dial | The pointer advances and stops at the limit |
| A record | Printer and paper tape | One line prints per event |
| Fixed knowledge | Sealed housing with a drum inside | The drum shows only in the exploded view |

## Map concepts to stations

Make a table before geometry. One row per station:

| Field | Example from the agent bench |
|---|---|
| Part | Verifier gauge |
| Nameplate word | `VERIFIER` |
| Is | An external check of the answer, outside the model |
| Does | The plunger comes down on the answer slip and recomputes the numbers |
| Why | The model that wrote the answer is a poor judge of it |
| Without it | An unchecked answer goes straight to the exit |

The same table feeds the inspector panel, the labels and the tour. Keep it in one content module.

## Break it on purpose

List the failures the reader can cause. Each one is a config switch or a fault value in the model. The reference page has three switches (retrieval, tool access, verification) and four fault values (none, times out once, always times out, malformed call). That gives 2 x 2 x 2 x 4 = 32 runs, and a test runs all 32.

Write one scenario button per interesting failure. The reference page has eight, for example "Malformed tool call: the schema gauge rejects it."

## Size the job

Count parts from the parts list. Do not count them from the picture. A part is one solid, one moving group or one line set that a reviewer can point at.

| Tier | Parts | Time | Typical use |
|---|---|---|---|
| Figure | 40 to 80 | about 1 hour | One mechanism inside a lesson |
| Hero | 80 to 150 | 2 to 4 hours | A standalone page with five to ten stations |
| Larger | more than 150 | ask first | Get the user's approval before you start |

Tell the user the tier and the part count before you write geometry. If the count grows past the tier during the build, stop and ask.

## Honest labels

The page states what is simulated. The reference page says:

> This is a simulation. The model step is a fixed script that reads the cards on the carriage and picks the next move. No model runs in your browser. The invoices, the arithmetic and every check are real. Times are fixed costs set by the simulation, not measurements.

Copy this shape. Name the scripted part, say what is real, and say that times are fixed costs.
