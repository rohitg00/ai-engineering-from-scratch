# Export a reviewable calendar proposal

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Calendar Focus Planner: find real free time in a calendar, place prioritized tasks, and explain which tasks do not fit.

Your public contract is `exportCalendar(plan, createdAt); renderPlan(plan)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

An exported focus block is a proposal. Give it a stable identity derived from task identity and scheduled start, explicit UTC endpoints, and a creation timestamp supplied by the caller. Escape text properties and fold long lines without splitting a UTF-8 character.

The HTML explains the same schedule in human terms, including unscheduled work. The JSON lets another program inspect the decision. Manual ICS import keeps the final calendar edit under the learner’s control and avoids account credentials in this project.

| Output | Purpose |
|---|---|
| focus.ics | Portable proposed events |
| plan.json | Inspectable scheduling result |
| plan.html | Human review and rejected tasks |

## Predict before running

Use a task title containing a comma and a newline. Export, parse again, and verify the title and interval survive.

```figure
pj-calendar-focus-planner-4
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py calendar-focus-planner --init my-calendar-focus-planner
python3 scripts/project_test.py calendar-focus-planner --stage 4 --path my-calendar-focus-planner --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Escape values before line folding.
2. Count UTF-8 bytes rather than JavaScript string length for folding.
3. Use a fixed creation timestamp in tests.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 4. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-calendar-focus-planner
node cli.ts sample.ics tasks.json 2026-10-14 output 10
```

The final artifact is an inspectable HTML plan, machine-readable schedule, and portable ICS proposals for manual import. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Build a separate adapter that converts an external planner’s proposals into validated Task records, keeping this scheduler as the deterministic boundary.

Scope: The parser supports explicit UTC events and all-day dates. Recurrence and named time zones must be expanded by a calendar exporter first and are rejected when encountered. The CLI plans a 09:00–17:00 UTC day. It creates local proposals and never changes an account calendar.

Primary reference: [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). The implementation and exercise data are original teaching examples.
