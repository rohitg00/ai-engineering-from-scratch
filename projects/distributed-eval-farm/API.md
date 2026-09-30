# Evaluation farm integration

Build `go build -o farm .` in the completed workspace. A caller supplies UTF-8 JSON prediction records and reads a JSON report; no SDK or inference service is required.

```json
[
  {"id":"case-one","prompt":"Safe HTTP read verb?","expected":"GET","response":" get "}
]
```

IDs must be unique and nonempty, at most 256 bytes. Expected answers must be nonempty. Prompt, expected and response each have a 100,000-byte limit. At most 10,000 records and 4 MiB of JSON are accepted. Unknown fields and trailing documents fail. The current scoring rule is lowercased whitespace-normalized equality.

| Command | Behavior |
|---|---|
| `init --store DIR --input FILE --shards N` | Bind dataset hash and shard count; identical replay preserves progress |
| `worker --store DIR --worker-id NAME` | Claim, evaluate and submit at most one eligible shard |
| `run --store DIR --input FILE --shards N --workers W` | Initialize or validate identity; launch bounded process waves; emit coverage and receipts |
| `status --store DIR` | Validate and report the persisted snapshot |
| `demo --input FILE` | Print actual worker-crash and recovery snapshots from a temporary store |

Shards are 1..1024; concurrent process slots are 1..64. Empty buckets are omitted from active leases. The ordered dataset, including recorded predictions, is hashed as Go's canonical JSON struct encoding. This is this artifact's identity format, not a cross-language JSON canonicalization standard. Retain the emitted hash when integrating reports.

Worker options: `--lease-ms` (default 30000), `--now-ms` (default -1 uses the wall clock), `--delay-ms` (0..60000) and `--crash-after-claim` (intentional exit 86). Explicit nonnegative now-ms is a fixed logical clock for tests. Completion rechecks the current persisted owner and version; it cannot trust a worker's old in-memory Lease.

`farm.json` stores schema_version 1, dataset_sha256, shard_count, cases and shards. Each shard stores case_ids and the stage Lease object with Shard, Worker, Version, Until, Result and Done. A completed Result is encoded JSON containing worker_pid, ordered case correctness flags, correct and total. Uppercase lease field names preserve the original Go teaching API.

`Partition` defines membership. `InitFarm` makes membership durable. `ClaimShard` locks, loads, acquires and persists before returning input. `WorkShard` performs the exact-match evaluation outside the lock. `CompleteShard` reloads and calls `Submit` while locked. `RunFarm` uses the learner's `Parallel` pool to launch the same binary's worker command, passing cancellation into `exec.CommandContext`.

Reports contain complete, active_shards, completed_shards, correct, evaluated, dataset_cases, worker_processes, receipts and the full shard ledger. `worker_processes` counts distinct accepted receipt PIDs; it is not a configured concurrency measurement. Run additionally emits worker_events. The per-invocation pool bounds simultaneous child processes; process IDs can differ on every run.

stdout contains JSON and stderr contains failures. Exit 0 means the command succeeded; run exits 1 after printing complete:false when remaining leases are still owned. Malformed input, stale completion, changed dataset or corrupt state also exits 1. Intentional crash injection exits 86 after the claim is persisted. Completed reruns do not recalculate results.

The filesystem is trusted local storage, not authenticated evidence. The snapshot validator checks dataset identity, partition membership, lease shape and receipt coverage/counts. It does not authenticate a human who edits a consistent snapshot. A network extension needs authenticated workers, bounded requests, a transaction-capable coordinator and a clock policy; preserving only the JSON field names is insufficient.
