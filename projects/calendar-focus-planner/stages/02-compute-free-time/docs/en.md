# Merge overlaps before finding gaps

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Calendar Focus Planner: find real free time in a calendar, place prioritized tasks, and explain which tasks do not fit.

Your public contract is `availableSlots(events, window, bufferMinutes=0)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Two overlapping meetings do not consume the sum of their durations. Expand each event by the chosen buffer, clip it to the work window, sort by start and merge overlapping or adjacent intervals. The complement of that union gives the actual free gaps.

A cursor starts at the work-window beginning. Before each busy interval, emit a gap only if the interval starts after the cursor. Move the cursor to the busy end. After the final event, emit the remaining tail. This method is explainable and handles nested meetings without double counting.

| Input with 10-minute buffer | Merged occupied interval |
|---|---|
| 09:20–10:25 and 09:50–11:10 | 09:20–11:10 |
| 12:50–14:40 | 12:50–14:40 |
| Work window | 09:00–17:00 |

## Predict before running

Calculate every free gap by hand. Verify busy duration plus free duration equals the window duration.

```figure
pj-calendar-focus-planner-2
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py calendar-focus-planner --init my-calendar-focus-planner
python3 scripts/project_test.py calendar-focus-planner --stage 2 --path my-calendar-focus-planner --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Clip before discarding intervals outside the window.
2. Compare each start with the last merged end.
3. Return new objects so caller events remain unchanged.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 2. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-calendar-focus-planner
node cli.ts sample.ics tasks.json 2026-10-14 output 10
```

The final artifact is an inspectable HTML plan, machine-readable schedule, and portable ICS proposals for manual import. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Vary the buffer and identify the exact point at which a 75-minute task no longer fits.

Scope: The parser supports explicit UTC events and all-day dates. Recurrence and named time zones must be expanded by a calendar exporter first and are rejected when encountered. The CLI plans a 09:00–17:00 UTC day. It creates local proposals and never changes an account calendar.

Primary reference: [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). The implementation and exercise data are original teaching examples.
