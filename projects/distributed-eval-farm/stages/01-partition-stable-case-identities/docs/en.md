# Partition stable case identities

> A restarted evaluation should know which cases belong to each shard before any worker starts.

**Type:** Build
**Languages:** Go
**Prerequisites:** Go structs, pointers, errors, JSON files and a shell; complete earlier stages in order.
**Stage:** 1 of 4
**Time:** ~2 hours

## What you build

Make dataset placement reproducible. Implement `stage1.go` in your initialized workspace. The supplied CLI calls your implementation; it does not import the reference solution.

## Work through the mechanism

Partitioning assigns identifiers to buckets. Start the FNV-1a32 hash at 2166136261, XOR each UTF-8 byte and multiply by 16777619 with 32-bit wraparound. Take hash modulo shard count. Go's `hash/fnv` implements this primitive; the learning work is defining and testing the identity contract around it.

With four shards, the sample identifiers land as case-d in 0, case-c in 1, case-b in 2 and case-a in 3. Reordering the input changes each bucket's local order but never an identifier's bucket. Do not assert that every bucket has equal size: deterministic assignment is not a load-balancing guarantee.

Reject empty identifiers, duplicates and shard counts outside 1..1024. The supplied persistent store also fingerprints the ordered input records, including prompts, expected answers and recorded responses. A changed prediction or shard count needs a different store. Otherwise a resumed run could combine results from two experiments while keeping one apparent dataset name.

Empty partitions need no lease and are omitted from the stored active shard list. Coverage still counts every actual case. A sample with one record and four buckets has one active shard, not four artificial completed tasks.

```figure
pj-distributed-eval-farm-1
```

## Your contract

```go
func Partition(ids []string, shards int) ([][]string, error)
```

Keep the public signature and errors in `types.go`. Rejected calls must preserve the caller's prior state. Read [the project API](../../../API.md) for the final artifact's file and process boundaries.

## Implementation hint

Allocate all requested buckets first, track seen identifiers, hash bytes and append to exactly one bucket. Keep IDs intact; normalization can merge distinct cases.

## Verify your work

From the repository root:

```bash
python3 scripts/project_test.py distributed-eval-farm --stage 1 --path /tmp/distributed-eval-farm-work --strict
```

The grader exercises your selected workspace, including the earlier stages. Its reference mode is a separate instructor check and does not earn learner completion.

## Investigate a failure

Partition the sample into 4 and 3 buckets. Which case IDs move? Explain why changing only a prompt also changes the run fingerprint even though its shard assignment remains stable.

## Sources and limits

Study the standard-library [os package](https://pkg.go.dev/os), [context](https://pkg.go.dev/context) and [Go pipelines guide](https://go.dev/blog/pipelines) as needed. These exercises and samples are original. Process recovery is demonstrated on one host; the README names the filesystem and evaluation limits you must preserve when adapting the artifact.
