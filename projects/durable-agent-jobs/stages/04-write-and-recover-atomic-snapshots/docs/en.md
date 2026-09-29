# Write and recover atomic snapshots

> A crash can happen after an output exists but before the queue records completion. Make that gap reproducible.

**Type:** Build
**Languages:** Go
**Prerequisites:** Complete stages 1 through 3; understand their exported types and failure contracts.
**Stage:** 4 of 4
**Time:** ~2 hours

## What you build

Recover the effect and the ledger. Implement `stage4.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

Validate every job and reject duplicate identifiers before opening a temporary snapshot. Write in the destination directory, sync the file, close it, then rename it over `jobs.json`. The loader bounds the file at 4 MiB and rejects truncated JSON, unknown fields and trailing documents. A failed validation must preserve the previous snapshot.

The composed worker persists its claim, reads its immutable input, creates `effects/<id>.json`, then persists completion. The receipt contains the input SHA256, byte count and word count. A temporary receipt is synced, then linked into its final name without replacement. If that final receipt already contains the expected values, recovery reuses it.

Run `go run . demo` from your completed workspace. The demo starts a real worker that exits 86 after writing the first effect. Status shows running v1 with one receipt. The next worker uses logical time 111, reclaims and claims v3, observes the existing receipt and completes v4 with `reused_effect: true`. The second sample job completes normally.

Atomic rename protects readers from partial JSON. It does not turn the input, receipt and ledger into one transaction. A producer crash can leave an unreferenced input file; an identical enqueue safely adopts it. File sync without directory sync is not a proof of power-loss durability. These exercises establish process-crash recovery on a local filesystem.

```figure
pj-durable-agent-jobs-4
```

## Your contract

```go
func ValidateJobs(jobs []Job) error
func Save(file string, jobs []Job) error
func Load(file string) ([]Job, error)
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Keep the old snapshot until every operation on the temporary file succeeds. Do not defer away a Close error. Follow `runner.go` to see how your functions compose under one lock.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py durable-agent-jobs --stage 4 --path /tmp/durable-agent-jobs-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Run the crash-after-claim experiment from the README, then crash-after-effect. Count receipt files before and after each recovery. Replace the receipt with an HTTP payment call on paper: what idempotency key and durable receiver contract would you need?

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
