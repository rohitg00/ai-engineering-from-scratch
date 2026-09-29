# Claim with a lease and version

> The claim is the moment a worker acquires permission to act. Persist it before starting the work.

**Type:** Build
**Languages:** Go
**Prerequisites:** Complete stage 1; understand its exported types and failure contracts.
**Stage:** 2 of 4
**Time:** ~2 hours

## What you build

Reserve an execution window. Implement `stage2.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

Start with queued version 0, attempts 0. A claim at 100 ms for 10 ms with expected version 0 becomes running version 1, attempts 1, lease 110. The lease interval is [100,110): its right endpoint is excluded.

Two workers may read version 0. Only the first successful claim may proceed. Checking the expected version after changing the record would lose the evidence needed to reject the second worker. Validate state, expected version, attempt cap, clock and overflow before assigning any field.

`ClaimJob` is a pure in-memory transition. The supplied `ClaimNext` wrapper holds an operating-system file lock across load, transition and Save. Separate processes open the same `ledger.lock`; a crash releases the kernel lock. `jobs.json` is replaced while that stable lock file stays in place. Locking the renamed snapshot itself would let processes lock different file objects.

The attempt counter survives recovery. A job that crashes three times should remain visible as queued with attempts 3 when the cap is 3; silently clearing the counter would create an unlimited retry loop.

```figure
pj-durable-agent-jobs-2
```

## Your contract

```go
func ClaimJob(j *Job, expected int, now, ttl int64, maxAttempts int) error
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Write every rejection as an early return. Check `now > MaxInt64-ttl` before addition. Only then assign lease, version, attempt count and state.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py durable-agent-jobs --stage 2 --path /tmp/durable-agent-jobs-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Predict the snapshot after two callers both supply expected 0. Then set maxAttempts 1 and reclaim the first attempt. Why does the next claim fail even though the state is queued?

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
