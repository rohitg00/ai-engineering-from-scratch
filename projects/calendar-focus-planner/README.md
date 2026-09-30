# Calendar Focus Planner

Find real free time in a calendar, place prioritized tasks, and explain which tasks do not fit.

You finish with an inspectable HTML plan, machine-readable schedule, and portable ICS proposals for manual import.

## Run the finished tool

From the repository root:

```bash
cd projects/calendar-focus-planner/solution
node cli.ts sample.ics tasks.json 2026-10-14 output 10
```

The sample is authored for this project. Substitute your own input through the same CLI. No model key is needed for the baseline. See the command help before enabling an optional external adapter.

## Build it yourself

Start with [development setup](../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md) and [data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md). You should be able to read a JSON object, call a function, run a terminal command and interpret a failing test before starting.

```bash
python3 scripts/project_test.py calendar-focus-planner --init my-calendar-focus-planner
python3 scripts/project_test.py calendar-focus-planner --stage 1 --path my-calendar-focus-planner --strict
python3 scripts/project_test.py calendar-focus-planner --all --path my-calendar-focus-planner --strict --report completion.json
```

The fresh workspace intentionally fails until you implement the functions. The CLI, input files and public types are supplied so completion does not require copying a reference entry point. Work through the stages in order:

1. [Read explicit calendar intervals](stages/01-read-calendar/docs/en.md)
2. [Merge overlaps before finding gaps](stages/02-compute-free-time/docs/en.md)
3. [Schedule priorities without pretending everything fits](stages/03-place-tasks/docs/en.md)
4. [Export a reviewable calendar proposal](stages/04-export-proposals/docs/en.md)

## Reuse the artifact

The CLI and importable functions consume ordinary local files and return structured output. Keep input identity and explicit failure metadata when integrating with another program. The HTML output has no third-party scripts and can be shared after inspecting the included source data.

## Verification and scope

```bash
python3 scripts/project_test.py calendar-focus-planner --all --solution --strict
```

The parser requires explicit `DTSTART` and `DTEND` for both UTC events and all-day dates. For an all-day event, `DTEND;VALUE=DATE` is exclusive: an event on October 14 uses start `20261014` and end `20261015`. Implicit one-day ends and `DURATION` in place of `DTEND` are outside this teaching subset. Recurrence and named time zones must be expanded by a calendar exporter first and are rejected when encountered. The CLI plans a 09:00–17:00 UTC day. It creates local proposals and never changes an account calendar.

Grading validates the supplied deterministic contracts. A learner certificate is a self-attested completion record; it does not claim live-provider verification or professional certification. Read the JSON receipt and test at least one new input before treating the tool as integrated.

Primary reference: [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).
