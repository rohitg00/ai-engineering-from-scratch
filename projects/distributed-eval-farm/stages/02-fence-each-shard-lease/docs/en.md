# Fence each shard lease

> A lease must survive the process that acquired it. The next process must advance the same version.

**Type:** Build
**Languages:** Go
**Prerequisites:** Complete stage 1; understand its exported types and failure contracts.
**Stage:** 2 of 4
**Time:** ~2 hours

## What you build

Let another process take over safely. Implement `stage2.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

The first worker claims shard-0 at 100 ms with a 10 ms lease. Its stored record has owner old, version 1 and until 110. A second worker at 109 cannot acquire it. At 110 it can become owner new with version 2. Completed shards stay closed regardless of time.

`Acquire` changes one Lease in memory. `ClaimShard` composes it with a whole-run snapshot under `ledger.lock`. It reloads while holding the lock, chooses an eligible shard, calls Acquire, saves, and only then returns cases to the worker. Starting an evaluation before the claim is durable would leave no recoverable owner after a crash.

Run `farm worker --crash-after-claim` after initialization. This starts a real process and exits 86 after the rename, leaving its lease on disk. A replacement process at the expiry boundary can recover the shard. No network, model service or synthetic callback is needed to observe that failure.

All participants must use the locking wrapper on a local Linux or macOS filesystem. A raw call to Acquire does not coordinate processes. A network filesystem or remote database requires its own transaction and clock contract.

```figure
pj-distributed-eval-farm-2
```

## Your contract

```go
func Acquire(l *Lease, worker string, now, ttl int64) error
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Check Done and a currently owned unexpired lease before mutation. Validate clock arithmetic. Keep owner, version and expiry changes together.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py distributed-eval-farm --stage 2 --path /tmp/distributed-eval-farm-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Pause a worker after it claims, then run another at the same logical time. Confirm that pending work is reported instead of stolen. Resume at 110 and inspect the persisted version.

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
