# Schedule priorities without pretending everything fits

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Calendar Focus Planner: find real free time in a calendar, place prioritized tasks, and explain which tasks do not fit.

Your public contract is `schedule(tasks, events, window, bufferMinutes=0)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Sort tasks by descending priority with a stable ID tie-breaker. Place each task into the earliest gap that is long enough, then move that gap start forward. Keep tasks contiguous; splitting a task would be a different policy requiring an explicit contract.

The policy is a deterministic heuristic, not an optimal scheduler. A large low-priority task may remain unscheduled even when several small fragments sum to its duration. Report that outcome with a reason instead of inventing free time or shortening the task.

| Task | Minutes | Outcome in the sample |
|---|---|---|
| Lesson example | 75 | 11:10–12:25 |
| Review submissions | 45 | 14:40–15:25 |
| Record walkthrough | 90 | 15:25–16:55 |
| Evaluation design | 120 | No contiguous gap |

## Predict before running

Raise the 120-minute task to priority five and predict which other work becomes unscheduled.

```figure
pj-calendar-focus-planner-3
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py calendar-focus-planner --init my-calendar-focus-planner
python3 scripts/project_test.py calendar-focus-planner --stage 3 --path my-calendar-focus-planner --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Copy tasks before sorting.
2. Require one gap to fit the full duration.
3. Retain every rejected task with its original requested duration.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 3. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-calendar-focus-planner
node cli.ts sample.ics tasks.json 2026-10-14 output 10
```

The final artifact is an inspectable HTML plan, machine-readable schedule, and portable ICS proposals for manual import. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Compare earliest-fit with shortest-task-first on an original task set and explain the tradeoff.

Scope: The parser supports explicit UTC events and all-day dates. Recurrence and named time zones must be expanded by a calendar exporter first and are rejected when encountered. The CLI plans a 09:00–17:00 UTC day. It creates local proposals and never changes an account calendar.

Primary reference: [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). The implementation and exercise data are original teaching examples.
