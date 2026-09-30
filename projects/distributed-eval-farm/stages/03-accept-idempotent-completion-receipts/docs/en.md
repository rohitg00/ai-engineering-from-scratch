# Accept idempotent completion receipts

> Correct results from the wrong lease are still stale results.

**Type:** Build
**Languages:** Go
**Prerequisites:** Complete stages 1 through 2; understand their exported types and failure contracts.
**Stage:** 3 of 4
**Time:** ~2 hours

## What you build

Accept one result for one lease. Implement `stage3.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

A result is tied to shard, owner and version. Suppose old/v1 computed the right answer but new/v2 already completed the shard. Submitting old/v1 must fail before comparing result text. The worker's intelligence does not give it current write authority.

Before completion, require now < Until and a nonempty result of at most 1 MiB. After completion, the same owner, version and exact result can be delivered again successfully, even after the lease time has passed. It acknowledges the existing receipt; it does not reopen evaluation. Changing any result byte conflicts.

The CLI evaluates the supplied recorded response against expected text after lowercasing and collapsing whitespace. `GET` and ` get ` match; `no` and `yes` do not. Each shard receipt stores ordered case IDs, correctness flags and the actual worker PID. The coordinator verifies the receipt's coverage and counts before writing it into the persisted Lease.Result.

This is a narrow exact-match evaluator. It cannot grade paraphrases, citation support or model reasoning. Replace the evaluator only after defining a stable scoring version and including that version in the run identity.

```figure
pj-distributed-eval-farm-3
```

## Your contract

```go
func Submit(l *Lease, worker string, version int, now int64, result string) error
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Check owner and version first. Then handle an already completed result. Apply the expiry condition only to a first completion; this ordering permits identical receipt redelivery.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py distributed-eval-farm --stage 3 --path /tmp/distributed-eval-farm-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Complete at 109, redeliver at 200 with identical data, then change one result byte. Predict all three outcomes. Try an old owner with identical data and explain why it still fails.

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
