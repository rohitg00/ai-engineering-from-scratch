# Read explicit calendar intervals

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Calendar Focus Planner: find real free time in a calendar, place prioritized tasks, and explain which tasks do not fit.

Your public contract is `parseCalendar(text)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Calendar text is a protocol, not a loose list of dates. Unfold continuation lines before reading properties. Keep each event identity, summary, start and end together. Reject missing or reversed endpoints and duplicate identities. Cancelled or transparent events should not occupy focus time.

This bounded parser accepts UTC timestamps and date-only events with explicit `DTSTART` and `DTEND`. An all-day `20261014` event needs exclusive `DTEND;VALUE=DATE:20261015`; do not infer an omitted end or substitute `DURATION`. It refuses recurrence and timezone rules because silently treating them as one UTC event would create false free time. An event uses a half-open interval: its end is the first instant no longer occupied.

| Event | Start | End |
|---|---|---|
| Team sync | 09:30 | 10:15 |
| Office hours | 10:00 | 11:00 |
| Workshop | 13:00 | 14:30 |

## Predict before running

Predict whether a task beginning exactly at 11:00 conflicts with an event ending at 11:00 when no buffer is requested.

```figure
pj-calendar-focus-planner-1
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py calendar-focus-planner --init my-calendar-focus-planner
python3 scripts/project_test.py calendar-focus-planner --stage 1 --path my-calendar-focus-planner --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Unfold before splitting properties.
2. Validate timestamps by converting and checking the round trip.
3. Reject unsupported timing semantics rather than guessing.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 1. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-calendar-focus-planner
node cli.ts sample.ics tasks.json 2026-10-14 output 10
```

The final artifact is an inspectable HTML plan, machine-readable schedule, and portable ICS proposals for manual import. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Import an all-day event and explain why no daytime gap remains.

Scope: The parser supports explicit UTC events and all-day dates. Recurrence and named time zones must be expanded by a calendar exporter first and are rejected when encountered. The CLI plans a 09:00–17:00 UTC day. It creates local proposals and never changes an account calendar.

Primary reference: [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). The implementation and exercise data are original teaching examples.
