# Connect evidence to workload revisions

> Follow owner UIDs without guessing from names.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Map object UIDs to workload snapshots and walk ownerReferences until revision annotations are found. Cycles terminate through a visited set. Exactly one distinct revision can be attached; missing or conflicting revisions remain unknown. Investigations are suggestions based on reason, never causal conclusions.

## Worked example

pod-old owns an edge to rs-7 with revision 7. pod-new links to rs-8 with revision 8. A missing owner snapshot leaves revision blank; do not substitute a workload with the same name.

```figure
pj-kubernetes-event-storyboard-3
```

## Implement the contract

`Connect(rows []Row,workloads []Workload) []Row` returns copied rows with optional revision and investigation text. It does not mutate the input. Revision annotation key is deployment.kubernetes.io/revision.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --init /tmp/kubernetes-event-storyboard-work
python3 scripts/project_test.py kubernetes-event-storyboard --stage 3 --path /tmp/kubernetes-event-storyboard-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Add Deployment objects with conflicting revision annotations and observe the conservative unknown result.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
