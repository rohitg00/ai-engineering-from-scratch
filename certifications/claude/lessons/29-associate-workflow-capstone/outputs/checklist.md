# Associate Workflow Capstone Checklist

Use this checklist as the release record for your capstone. Replace bracketed prompts with evidence. Do not mark an item complete because a draft looks convincing.

## Monday: Purpose and Surface

- [ ] Decision, deadline, audience, and accountable owner are explicit.
- [ ] Allowed and prohibited actions are documented.
- [ ] Data and consequence are classified under organizational policy.
- [ ] The selected Claude surface is approved for the purpose and data class.
- [ ] Current terms, retention behavior, controls, and limitations were checked.
- [ ] Verification date and official or contractual sources are recorded.

Evidence:

```text
[Surface-selection record and policy approval]
```

## Tuesday: Sources and Context

- [ ] Every source has an ID, owner, authority, effective date, review date, and sensitivity.
- [ ] Superseded or duplicate material is outside active retrieval.
- [ ] The authority order is explicit.
- [ ] Required regions or business units are present or marked missing.
- [ ] The weekly source snapshot and cutoff are fixed.
- [ ] Conflicts, stale sources, and permission gaps have owners.

Evidence:

```text
[Registry version, snapshot ID, source exceptions]
```

## Wednesday: Prompt and Task Design

- [ ] Outcome, context, task, evidence, constraints, format, and acceptance checks are present.
- [ ] Extraction, reconciliation, analysis, and drafting are separate stages.
- [ ] Each stage has a testable input, output, and gate.
- [ ] Missing evidence produces abstention or escalation, not guessing.
- [ ] Source content is treated as data, not tool authorization.
- [ ] Prompt and workflow versions are recorded.

Evidence:

```text
[Prompt versions and stage contracts]
```

## Thursday: Validation and Governance

- [ ] The Python validator passes for the release candidate.
- [ ] At least three deliberate failure packets are blocked or marked for revision.
- [ ] Exact totals and schemas use deterministic checks.
- [ ] Every consequential claim maps to authoritative supporting evidence.
- [ ] Independent review reports findings separately from revision.
- [ ] Privacy, bias, scope, and action-authority checks pass.
- [ ] Every blocker is resolved before handoff.

Commands and results:

```text
python3 code/main.py
python3 -m unittest discover -s code/tests -v

[Paste concise status and test count]
```

## Friday: Handoff and Recovery

- [ ] The handoff states the exact decision, deadline, and decision owner.
- [ ] Source snapshot, draft version, and workflow version are included.
- [ ] Passed checks, failed checks, conflicts, and uncertainty are visible.
- [ ] Approve, revise, reject, and escalate paths are available.
- [ ] Manual fallback is current and has been rehearsed.
- [ ] External actions are separated from drafting and protected against duplicate execution.
- [ ] A post-approval source change triggers delta review.

Decision record:

```text
Decision:
Decision owner:
Evidence snapshot:
Conditions:
Fallback:
```

## Evaluation Coverage

- [ ] Four representative normal cases pass.
- [ ] Three edge cases cover missing, conflicting, or stale evidence.
- [ ] Three governance or adversarial cases cover unauthorized purpose, sensitive data, or prompt injection.
- [ ] High-risk performance is reported separately from aggregate performance.
- [ ] A held-out case remains unused during prompt tuning.

## Retrospective

```text
Most expensive stage:
Most important caught defect:
Failure added to evaluation set:
Source or control to improve:
Human responsibility that remains:
Next release boundary:
```

## Release Recommendation

- [ ] Remain manual.
- [ ] Continue in shadow mode.
- [ ] Release as human-reviewed assistance.
- [ ] Permit bounded automation for low-consequence steps.
- [ ] Stop and escalate because purpose, data, authority, or evidence is unresolved.

Rationale:

```text
[State what was tested, what passed, what remains uncertain, and who owns the decision.]
```
