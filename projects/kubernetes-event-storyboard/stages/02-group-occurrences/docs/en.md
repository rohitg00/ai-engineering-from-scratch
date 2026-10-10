# Group repetitions without losing timestamps

> Deduplicate event snapshots before summing distinct series.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Repeated exports of the same event UID are snapshots of one series. Keep their maximum count and union time range. Then group distinct event UIDs by object UID, reason and type, summing those counts. Sort by occurrence time and identity. The representative object reference comes from the first event UID in lexical order, while eventUIDs retains all contributing identities.

## Worked example

Two snapshots of event-fail with counts 2 and 4 contribute 4, not 6. A distinct event UID with the same reason and count 1 makes the grouped count 5. A reused pod name with a new UID forms a different row.

```figure
pj-kubernetes-event-storyboard-2
```

## Implement the contract

`Group(Bundle)([]Row,error)`. Rows preserve object, reason, type, count, firstOccurrence, lastOccurrence, observedAt and sorted eventUIDs. Reject an event UID reused for another object, reason or type.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --init /tmp/kubernetes-event-storyboard-work
python3 scripts/project_test.py kubernetes-event-storyboard --stage 2 --path /tmp/kubernetes-event-storyboard-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

What evidence is lost when two event messages have the same reason? Explain why this compact report does not replace the original event export.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
