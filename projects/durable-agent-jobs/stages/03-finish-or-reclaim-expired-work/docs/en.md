# Finish or reclaim expired work

> A slow worker can wake after another worker has already completed its job. Its old receipt must not rewrite the ledger.

**Type:** Build
**Languages:** Go
**Prerequisites:** Complete stages 1 through 2; understand their exported types and failure contracts.
**Stage:** 3 of 4
**Time:** ~2 hours

## What you build

Separate completion from permission. Implement `stage3.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

Worker A owns version 1 until 110. At 110, finishing version 1 fails. Reclaim changes running v1 to queued v2 and clears the lease, while keeping attempts 1. Worker B claims queued v2 and receives running v3 with attempts 2. A late completion from A still carries 1, so it fails even if its clock says 105. The version check protects against a stale view of time.

Worker B completes before its expiry, producing completed v4. Completion is a new state transition; its version is not the claim version. Duplicate calls to `Finish` fail because the job is no longer running. This differs deliberately from an idempotent output receipt: ledger transitions and business effects have separate contracts.

Use the CLI's `--now-ms` only for repeatable experiments. Normal workers call the current wall clock at claim and finish. An injected fixed clock proves version fencing but does not model a real clock moving during computation. Multiple machines with independent clocks need a coordinator-owned time authority.

```figure
pj-durable-agent-jobs-3
```

## Your contract

```go
func Finish(j *Job, expected int, now int64) error
func Reclaim(j *Job, now int64) bool
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Reclaim must test both running state and expiry. A queued or completed record should remain byte-for-byte unchanged. Finish must check the current version as well as the lease.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py durable-agent-jobs --stage 3 --path /tmp/durable-agent-jobs-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Test 109 and 110 against lease 110. Then allow A to finish after B has claimed v3. Describe why extending A's timeout cannot restore A's authority.

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
