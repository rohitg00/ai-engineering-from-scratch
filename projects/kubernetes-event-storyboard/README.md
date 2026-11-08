# Kubernetes Event Storyboard

Help an on-call engineer inspect exported Kubernetes events and workload snapshots. Group repeated events, distinguish observation time from occurrence time, and link each suggested investigation to object identity and rollout revision. Export an HTML timeline and a redacted JSON context pack for an assistant.

Standard libraries only. Four stages, approximately eight hours. Go, TypeScript implementations are exercised by the grader.

## Build it

1. [Parse event and workload snapshots](stages/01-parse-snapshots/docs/en.md)
2. [Group repetitions without losing timestamps](stages/02-group-occurrences/docs/en.md)
3. [Connect evidence to workload revisions](stages/03-connect-revisions/docs/en.md)
4. [Export a redacted assistant context pack](stages/04-export-storyboard/docs/en.md)

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --init /tmp/kubernetes-event-storyboard-work
python3 scripts/project_test.py kubernetes-event-storyboard --stage 1 --path /tmp/kubernetes-event-storyboard-work --strict
python3 scripts/project_test.py kubernetes-event-storyboard --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run your own snapshot bundle

```bash
cd projects/kubernetes-event-storyboard/solution
go run . --input fixtures/rollout.json --out /tmp/context-pack.json
node --experimental-strip-types cli.ts /tmp/context-pack.json /tmp/timeline.html
python3 demo.py
```

Input wraps exported core/v1 Kubernetes lists: `{observedAt:"RFC3339",events:{items:[...]},workloads:{items:[...]}}`. Workloads may contain Pods, ReplicaSets and Deployments. Include the owner snapshots needed to resolve a revision; missing or conflicting revision evidence remains unknown. This is an offline snapshot adapter, with no cluster credentials or live cluster access.

Occurrence ranges belong to the event series. observedAt is your capture time. Counts from repeated snapshots of one event UID are deduplicated by maximum; counts of distinct event UIDs are summed. The pack does not recover lost events or prove ordering between clocks.

The Go CLI writes schema-version-1 JSON. TypeScript consumes that artifact and renders a responsive, escaped timeline with a Warning filter and context download. Open /tmp/timeline.html directly or serve its containing directory with a local HTTP server. Event messages and workload payloads are omitted; object names, UIDs, reasons and revision numbers remain visible. Review those identifiers before sharing the context externally.

[Core Event API](https://kubernetes.io/docs/reference/kubernetes-api/core/event-v1/) and [Kubernetes object names and UIDs](https://kubernetes.io/docs/concepts/overview/working-with-objects/names/) describe the underlying object model.

## Completion evidence

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --all --path /tmp/kubernetes-event-storyboard-work --strict --report /tmp/kubernetes-event-storyboard-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
