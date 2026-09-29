# Run a bounded local worker pool

> Concurrency becomes useful when every dispatched worker uses the same durable claim and receipt path.

**Type:** Build
**Languages:** Go
**Prerequisites:** Complete stages 1 through 3; understand their exported types and failure contracts.
**Stage:** 4 of 4
**Time:** ~2 hours

## What you build

Run the whole farm across processes. Implement `stage4.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

Implement a bounded goroutine pool around an injected callback. A channel carries unique work IDs; at most the configured worker count calls the callback simultaneously. Collect successful Items and sort by ID. If one callback fails, return its error alongside the successes you actually collected. Cancellation stops new useful work and is passed into every callback.

The final `run` command uses this pool to launch operating-system worker processes. Each callback executes this same compiled binary with the worker command. Each process acquires one persisted shard, evaluates its recorded predictions and submits through the current lease. Work runs in bounded waves until all shards finish or every remaining shard has an unexpired owner.

For the four-case sample and workers 2, two waves create four short-lived processes. The bound 2 describes simultaneous processes, not total process count. The resulting report shows 3 correct out of 4, complete coverage, the dataset hash, shard owners and actual process IDs. PIDs vary between runs; the scores come from the supplied responses.

The final-stage tests run a delayed old worker alongside a replacement. After the replacement commits, the old process exits with a fencing error and the persisted snapshot remains unchanged. The tests also crash a worker, restart from disk, reject changed datasets and preserve corrupt input for diagnosis. This is same-host coordination, not a multi-machine transport.

```figure
pj-distributed-eval-farm-4
```

## Your contract

```go
func Parallel(ctx context.Context, ids []string, workers int, run func(context.Context, string) (string, error)) ([]Item, error)
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Only the dispatch goroutine closes the jobs channel. Close results after all workers exit. Give result collection enough capacity or keep draining it after an error to avoid stranding senders.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py distributed-eval-farm --stage 4 --path /tmp/distributed-eval-farm-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Run the sample with workers 1 and 2 and compare coverage and receipts, not wall-clock speed. Try workers 0 and a canceled context. Explain why a callback that ignores context can still delay pool shutdown.

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
