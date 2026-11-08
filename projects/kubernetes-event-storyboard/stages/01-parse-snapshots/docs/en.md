# Parse event and workload snapshots

> Separate occurrence time from the time you captured the export.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Parse a bundle containing observedAt plus events.items and workloads.items from exported Kubernetes JSON lists. Preserve a core/v1 Event subset. Use firstTimestamp and lastTimestamp, falling back to eventTime or metadata.creationTimestamp; series supplies the latest count and lastObservedTime.

## Worked example

The authored warning occurred from 12:00 to 12:03, while the bundle was observed at 12:05. It targets pod-old, not merely the reusable name gallery-7-a. Workload objects retain only identity, owner UIDs and deployment revision annotation.

```figure
pj-kubernetes-event-storyboard-1
```

## Implement the contract

`Parse([]byte)(Bundle,error)`. Reject files over one MiB, trailing JSON, absent item arrays, invalid timestamps, count below one, duplicate workload UIDs and missing event/object UIDs. A missing count defaults to one. Unknown Kubernetes fields are intentionally ignored.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --init /tmp/kubernetes-event-storyboard-work
python3 scripts/project_test.py kubernetes-event-storyboard --stage 1 --path /tmp/kubernetes-event-storyboard-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Export a fresh cluster snapshot with kubectl get events -A -o json and the relevant workloads. Do not infer observation time from an event timestamp.

[Kubernetes core Event API](https://kubernetes.io/docs/reference/kubernetes-api/core/event-v1/).
