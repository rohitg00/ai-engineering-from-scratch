# Create jobs with stable identity

> A report request arrives twice because the producer lost its acknowledgement. Two deliveries should refer to one job.

**Type:** Build
**Languages:** Go
**Prerequisites:** Go structs, pointers, errors, JSON files and a shell; complete earlier stages in order.
**Stage:** 1 of 4
**Time:** ~2 hours

## What you build

Give retries one identity. Implement `stage1.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

A job is the durable record of an intention. Your function creates that record without executing the intention. Keep `ID`, `State`, `Version`, `LeaseUntil` and `Attempts` visible instead of compressing them into a boolean. A boolean cannot tell you whether another worker currently owns the work.

For `report-1`, return queued, version 0, attempts 0 and lease 0. Reject `../report`, an empty string, uppercase initials, spaces and identifiers longer than 64 characters. The accepted form is a lowercase letter followed by lowercase letters, digits or hyphens. Do not trim an invalid identifier into a different valid identity.

The supplied CLI later stores `{id,text}` separately from the job state. Enqueueing the same identifier and identical text is a no-op; changing the text under an existing identifier is a conflict. This is how a producer can retry without accidentally replacing work that already ran.

```figure
pj-durable-agent-jobs-1
```

## Your contract

```go
func NewJob(id string) (Job, error)
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Check the whole identifier before constructing a Job. A zero-value Job has an empty state, so return the explicit queued state only on success.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py durable-agent-jobs --stage 1 --path /tmp/durable-agent-jobs-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Create `a`, then try `a ` and `a/`. Explain why trimming or path cleaning would make a retry ambiguous. Extend the payload with a report format only after deciding whether format changes require a new identifier.

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
