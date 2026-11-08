---
id: product-discovery
title: Outcomes, Workflows, Risks and Specs
code: OW
subtitle: Frame the outcome, ground the workflow, rank assumptions, pick a slice, write the spec, set metrics, choose a stage.
hue: 330
sources: phases/14-agent-engineering/47-outcomes-before-output, phases/14-agent-engineering/48-discover-the-real-workflow, phases/14-agent-engineering/49-map-assumptions-and-risk, phases/14-agent-engineering/50-choose-the-smallest-testable-slice, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment, phases/14-agent-engineering/52-design-success-metrics, phases/14-agent-engineering/53-prototype-pilot-or-production
source_hash: 9fddd57a6902430a
---

## From request to stage
type: flow
from: phases/14-agent-engineering/47-outcomes-before-output/docs/en.md, phases/14-agent-engineering/48-discover-the-real-workflow/docs/en.md, phases/14-agent-engineering/49-map-assumptions-and-risk/docs/en.md, phases/14-agent-engineering/50-choose-the-smallest-testable-slice/docs/en.md, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/docs/en.md, phases/14-agent-engineering/52-design-success-metrics/docs/en.md, phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md

1. **Outcome**: frame the result without naming a solution.
2. **Workflow**: record the steps people perform, with evidence.
3. **Assumptions**: score the bets. Test the riskiest open one first.
4. **Slice**: pick the smallest slice that covers the required proof.
5. **Specification**: fix invariants. Mark each decision mode.
6. **Metrics**: set thresholds before results exist.
7. **Stage**: choose prototype, pilot or production.

## Choose a stage
type: architecture
from: phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md, phases/14-agent-engineering/53-prototype-pilot-or-production/code/main.py

```arch
node | unk | 1,1 | Unknown | the learning question | client
node | real | 2,1 | Needs real users or data? | choose_stage |
node | proto | 3,1 | Prototype | discardable, isolated | process
node | ready | 2,2 | Consequence bounded, ops ready? | consequence below 4 |
node | pilot | 3,2 | Pilot | named audience, rollback | process
node | prod | 4,2 | Production | owned continuously | process
edge | unk | real |
edge | real | proto | no
edge | real | ready | yes
edge | ready | pilot | no
edge | ready | prod | yes
```

## Outcome frame
type: concepts
from: phases/14-agent-engineering/47-outcomes-before-output/docs/en.md, phases/14-agent-engineering/47-outcomes-before-output/code/main.py

- **User**: who experiences the problem directly?
- **Situation**: when and where does it occur?
- **Current behavior**: what happens today, with workarounds?
- **Desired outcome**: what observable state improves?
- **Constraints**: fixed safety, policy, cost or compatibility limits.
- **Non-goals**: tempting adjacent work that is excluded.
- **Solution leakage**: a product form, model or framework in the outcome.

## Formulas from the labs
type: concepts
from: phases/14-agent-engineering/48-discover-the-real-workflow/code/main.py, phases/14-agent-engineering/49-map-assumptions-and-risk/code/main.py, phases/14-agent-engineering/50-choose-the-smallest-testable-slice/code/main.py, phases/14-agent-engineering/52-design-success-metrics/code/main.py

- **Risk**: $\mathrm{impact} \times \mathrm{uncertainty} + \mathrm{irreversibility}$
- **Slice score**: $\frac{\mathrm{value} + \mathrm{uncertainty\ reduced}}{\mathrm{effort} + \mathrm{risk\ penalty}}$
- **Risk penalty**: consequence times 2 if not reversible, else times 0.5.
- **Eligible slice**: the required proof is a subset of `proves`.
- **Direct evidence ratio**: direct items over all evidence items.
- **`at-most`**: passes when value is at or below the threshold.
- **`at-least`**: passes when value is at or above the threshold.

## Assumptions and evidence
type: concepts
from: phases/14-agent-engineering/49-map-assumptions-and-risk/docs/en.md, phases/14-agent-engineering/48-discover-the-real-workflow/docs/en.md

- **Value**: will the outcome matter enough?
- **Usability**: can the user understand and act on it?
- **Feasibility**: can the system produce it with the data and constraints?
- **Viability**: can the organization sustain cost, ownership and operation?
- **Safety**: can it fail without unacceptable consequence?
- **Evidence ladder**: direct behavior, artifact, reported behavior, inference.
- **Proof of current behavior**: only the first two rungs.

## Three decision modes
type: comparison
from: phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/docs/en.md, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/code/main.py

| Factor | Locked | Bounded | Delegated |
|---|---|---|---|
| Agent may | Not choose | Choose inside limits | Own the choice, explain it |
| Use for | Safety, authority, public compatibility | Search budgets, retry counts | Names, reversible refactors |
| Next step | Human checkpoint | Agent proposes within limits | Agent implements and proves |
| Rationale | Required | Required | Optional |
| Output key | `human_checkpoint` | `bounded_decisions` | `agent_may_decide` |

## Prototype, pilot, production
type: comparison
span: 2
from: phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md, phases/14-agent-engineering/53-prototype-pilot-or-production/code/main.py

| Factor | Prototype | Pilot | Production |
|---|---|---|---|
| Question | Can the mechanism produce the evidence at all? | Does it work safely with a bounded real audience? | Can we own it at the promised reliability? |
| Use when | No real users or data needed | Real behavior needed, consequence not ready | Consequence bounded, operations ready |
| Controls | Synthetic or recorded inputs, discardable | Limited audience, rollback, human owner, audit trail | SLO, on-call owner, security review, monitoring |
| Exit | Mechanism earns another stage | Expand, revise or stop | Retirement path |

## Metric contract
type: annotated-code
lang: python
from: phases/14-agent-engineering/52-design-success-metrics/code/main.py, phases/14-agent-engineering/52-design-success-metrics/docs/en.md

```python
plan = MeasurementPlan(
    goal="Reduce time to identify the affected service without increasing unsafe actions",
    questions=["How quickly is the correct service identified?"],
    metrics=[
        Metric("median_identification_seconds", "at-most", 120,
               "ten incident replays", "replay log", "outcome"),
        Metric("correct_service_rate", "at-least", 0.9,
               "ten incident replays", "incident record", "outcome"),
        Metric("production_writes", "at-most", 0,
               "entire pilot", "audit log", "guardrail"),  # required kind
    ])
report(plan, values)          # missing value gives status missing
```

## Lab functions
type: task-table
col: 4
from: phases/14-agent-engineering/47-outcomes-before-output/code/main.py, phases/14-agent-engineering/48-discover-the-real-workflow/code/main.py, phases/14-agent-engineering/49-map-assumptions-and-risk/code/main.py, phases/14-agent-engineering/50-choose-the-smallest-testable-slice/code/main.py, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/code/main.py, phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md, phases/14-agent-engineering/53-prototype-pilot-or-production/code/main.py

| Task | Code |
|---|---|
| Run a lab and its tests | `python3 -m unittest discover code/tests -v` |
| Frame status | `decision(frame)` |
| Audit workflow evidence | `audit(steps)` |
| Rank assumptions | `prioritize(items)` |
| Highest open risk | `next_experiment(items)` |
| Pick an eligible slice | `choose(items, required_proof)` |
| Spec to contract | `compile_contract(specification)` |
| Stage and its controls | `plan(decision)` |

## Lab constants
type: defaults
from: phases/14-agent-engineering/48-discover-the-real-workflow/code/main.py, phases/14-agent-engineering/49-map-assumptions-and-risk/code/main.py, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/code/main.py, phases/14-agent-engineering/53-prototype-pilot-or-production/code/main.py

| Setting | Default | Note |
|---|---|---|
| Risk dimensions | range(1, 6) | Impact, uncertainty, irreversibility |
| Evidence `confidence` | 0 <= item.confidence <= 1 | Else an issue |
| Workflow `order` | range(1, len(steps) + 1) | Contiguous from one |
| `VALID_MODES` | {"locked", "bounded", "delegated"} | Other modes are invalid |
| Stage `consequence` | 1 <= decision.consequence <= 5 | Else an error |
| Pilot at consequence | 4 | Or not reversible, or not ready |

## Validator messages
type: troubleshooting
span: 2
from: phases/14-agent-engineering/47-outcomes-before-output/code/main.py, phases/14-agent-engineering/50-choose-the-smallest-testable-slice/code/main.py, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/code/main.py, phases/14-agent-engineering/52-design-success-metrics/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| `desired outcome names the proposed output` | Solution leaked into the outcome | State the observable result instead |
| `non-goals are empty` | No boundary on the slice | Add concrete non-goals that reject work |
| `no slice proves the required assumptions` | Candidates skip the risky part | Design a slice that covers the proof set |
| `constrained decision lacks rationale` | Locked or bounded without a reason | Write the reason for the limit |
| `guardrail metric is missing` | Only outcome metrics | Add a `production_writes` guardrail |

## Questions
type: qa
from: phases/14-agent-engineering/50-choose-the-smallest-testable-slice/docs/en.md, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/docs/en.md, phases/14-agent-engineering/52-design-success-metrics/docs/en.md, phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md, phases/14-agent-engineering/48-discover-the-real-workflow/docs/en.md

- **A cheap slice scores high but misses proof?** It stays ineligible.
- **Every result says keep building?** The slice is not an experiment.
- **Can a lower layer prove a higher claim?** No. A unit test proves a local contract only.
- **Offline replay or pilot?** Neither substitutes for the other.
- **When does production begin?** When the organization accepts ongoing responsibility.

## Tips
type: tips
from: phases/14-agent-engineering/50-choose-the-smallest-testable-slice/docs/en.md, phases/14-agent-engineering/52-design-success-metrics/docs/en.md, phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md, phases/14-agent-engineering/49-map-assumptions-and-risk/docs/en.md

- Avoid false minimums: UI-only, infrastructure-only, happy-path, demo, platform.
- Write a stop rule before implementation.
- Write pass, fail and ambiguous paths before you see results.
- Mark the stage in configuration, access control, telemetry and docs.
