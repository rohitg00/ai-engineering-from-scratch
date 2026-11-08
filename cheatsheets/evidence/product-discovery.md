# Evidence: cheatsheets/product-discovery.md

Abbreviations: L47 = phases/14-agent-engineering/47-outcomes-before-output, L48 = phases/14-agent-engineering/48-discover-the-real-workflow, L49 = phases/14-agent-engineering/49-map-assumptions-and-risk, L50 = phases/14-agent-engineering/50-choose-the-smallest-testable-slice, L51 = phases/14-agent-engineering/51-write-specifications-that-preserve-judgment, L52 = phases/14-agent-engineering/52-design-success-metrics, L53 = phases/14-agent-engineering/53-prototype-pilot-or-production. d = docs/en.md, c = code/main.py.

## From request to stage (flow, 7 steps)
1. outcome frame without naming a solution: L47/d:12, 105
2. workflow as ordered actions with evidence: L48/d:12, 19
3. score assumptions, highest open risk first: L49/d:13-14, 81
4. smallest slice covering required proof: L50/d:29, 102
5. invariants and decision modes: L51/d:12-13
6. thresholds before observing results: L52/d:13, 74
7. prototype, pilot or production: L53/d:12, 19-23

## Choose a stage (architecture, 6 nodes, 5 edges)
- Unknown, needs real users or data, no to Prototype: L53/d:66-67, L53/c:26-27
- Consequence bounded and operations ready, no to Pilot, yes to Production: L53/d:68-70
- consequence >= 4 or not reversible or not ready gives pilot: L53/c:28-29
- Prototype discardable, isolated: L53/d:31-32
- Pilot named audience, rollback: L53/d:45, 48
- Production owned continuously: L53/d:23, 25

## Outcome frame (concepts, 7)
- User: L47/d:31
- Situation: L47/d:32
- Current behavior: L47/d:33
- Desired outcome: L47/d:34
- Constraints: L47/d:35
- Non-goals: L47/d:36
- Solution leakage, product form, interface, model, framework, architecture: L47/d:49

## Formulas from the labs (concepts, 7)
- risk = impact * uncertainty + irreversibility: L49/c:26, L49/d:49
- slice score (outcome_value + uncertainty_reduced) / (effort + risk_penalty): L50/c:28
- risk_penalty consequence * 2 if not reversible else 0.5: L50/c:27
- eligible when required_proof <= set(item.proves): L50/c:32
- direct_evidence_ratio = direct / total: L48/c:40-45
- at-most value <= threshold: L52/c:52-53
- at-least value >= threshold: L52/c:54-55

## Assumptions and evidence (concepts, 7)
- Value: L49/d:33
- Usability: L49/d:34
- Feasibility: L49/d:35
- Viability: L49/d:36
- Safety: L49/d:37
- evidence ladder direct behavior, artifact, reported behavior, inference: L48/d:40-43
- only the first two prove current behavior: L48/d:45

## Three decision modes (comparison, 5 rows)
- agent may: not choose, choose inside limits, owns and explains: L51/d:34-36
- use for: L51/d:34-36
- next step: human checkpoint, proposes within limits, implements and proves: L51/d:44-46
- rationale required unless delegated: L51/c:41-42
- output keys human_checkpoint, bounded_decisions, agent_may_decide: L51/c:52-58

## Prototype, pilot, production (comparison, 4 rows)
- primary questions: L53/d:21-23
- use when: L53/d:29, 41, L53/c:26-30
- controls: L53/c:35-46, SLO: L53/c:62
- exit: mechanism earns another stage L53/d:37, expand, revise, or stop L53/d:50, retirement path L53/d:62

## Metric contract (annotated-code, 12 lines)
- MeasurementPlan goal, questions: L52/c:76-78
- median_identification_seconds at-most 120, ten incident replays, replay log, outcome: L52/c:80
- correct_service_rate at-least 0.9: L52/c:81
- production_writes at-most 0, entire pilot, audit log, guardrail: L52/c:82
- guardrail kind required: L52/c:41-42
- report(plan, values), missing status: L52/c:59, 68-69

## Lab functions (task-table, 8)
- python3 -m unittest discover code/tests -v: L47/d:85 and each lab, L53/d:85
- decision(frame): L47/c:38-41
- audit(steps): L48/c:29
- prioritize(items): L49/c:29
- next_experiment(items): L49/c:34-36
- choose(items, required_proof): L50/c:31
- compile_contract(specification): L51/c:46
- plan(decision) stage and required_controls: L53/c:53-55

## Lab constants (defaults, 6)
- risk dimensions range(1, 6): L49/c:24-25
- 0 <= item.confidence <= 1: L48/c:38-39
- order range(1, len(steps) + 1): L48/c:32-33
- VALID_MODES {"locked", "bounded", "delegated"}: L51/c:30, 39-40
- 1 <= decision.consequence <= 5: L53/c:24-25
- consequence >= 4 gives pilot: L53/c:28-29

## Validator messages (troubleshooting, 5)
- desired outcome names the proposed output: L47/c:33-34, L47/d:88
- non-goals are empty: L47/c:31-32, concrete non-goals: L47/d:72
- no slice proves the required assumptions: L50/c:33-34, risky part omitted: L50/d:15, 19
- constrained decision lacks rationale: L51/c:41-42
- guardrail metric is missing: L52/c:41-42, production_writes: L52/c:82

## Questions (qa, 5)
- cheap candidate stays ineligible: L50/d:85
- every result keep building is not an experiment: L50/d:74
- lower layer cannot prove higher claim: L51/d:57, 63
- offline and pilot do not substitute: L52/d:68
- production begins with ongoing responsibility: L53/d:25

## Tips (tips, 4)
- false minimums UI-only, infrastructure-only, happy-path, demo, platform: L50/d:58-62
- stop rule before implementation: L50/d:66
- pass, fail, ambiguous before results: L52/d:74
- mark the stage in configuration, access control, telemetry, documentation: L53/d:75
