# Durable Agent Jobs

Build a local report queue you can interrupt between claim, output and completion. Restart another worker against the same directory and inspect exactly which work repeats. The finished artifact accepts your text records and writes one content-bound receipt per job.

Go is a good fit for a small standalone worker binary and explicit filesystem operations. The core and CLI use only its standard library. Four stages take about 8 hours. You need Go 1.22+, Python 3.10+ for the grader, Linux or macOS, and basic structs, pointers, errors and JSON. Start with [A Tour of Go](https://go.dev/tour/) if those concepts are new. Learn the [os filesystem APIs](https://pkg.go.dev/os) alongside stage 4.

## Build and run your version

From the repository root:

```bash
python3 scripts/project_test.py durable-agent-jobs --init /tmp/durable-agent-jobs-work
python3 scripts/project_test.py durable-agent-jobs --stage 1 --path /tmp/durable-agent-jobs-work --strict
```

The first command supplies typed contracts, a CLI and sample input. The first test intentionally fails until you implement `stage1.go`. Continue through the four stages, then grade and run your completed workspace:

```bash
python3 scripts/project_test.py durable-agent-jobs --all --path /tmp/durable-agent-jobs-work --strict --report /tmp/durable-learner.json
cd /tmp/durable-agent-jobs-work
go build -o /tmp/durable-learner .
/tmp/durable-learner demo --input samples/jobs.json
```

The demo calls your binary in separate processes. Only a complete learner report establishes local completion; reference tests do not award a certificate.

## Run the reference with your own data

```bash
cd projects/durable-agent-jobs/solution
go build -o /tmp/durable-jobs .
STORE=$(mktemp -d /tmp/durable-jobs.XXXXXX)
/tmp/durable-jobs enqueue --store "$STORE" --input samples/jobs.json
/tmp/durable-jobs worker --store "$STORE" --max-jobs 100
/tmp/durable-jobs status --store "$STORE"
```

Input is a JSON array of `{ "id": "report-one", "text": "your report text" }`. Edit a copy of the supplied sample or pass your own path. Identical repeated enqueue is safe. A changed payload under an existing ID conflicts. Output receipts include SHA256, UTF-8 byte length and whitespace-delimited word count; this worker does not generate or send a report through a model.

For a repeatable crash, use a new store:

```bash
CRASH_STORE=$(mktemp -d /tmp/durable-crash.XXXXXX)
/tmp/durable-jobs enqueue --store "$CRASH_STORE" --input samples/jobs.json
/tmp/durable-jobs worker --store "$CRASH_STORE" --now-ms 100 --lease-ms 10 --crash-after effect
/tmp/durable-jobs status --store "$CRASH_STORE"
/tmp/durable-jobs worker --store "$CRASH_STORE" --now-ms 111 --lease-ms 10 --max-jobs 100
/tmp/durable-jobs status --store "$CRASH_STORE"
```

The crash command intentionally exits 86. Before recovery, `incident-summary` is running v1 and its receipt already exists: 95 bytes, 11 words. After recovery it is completed v4, attempts 2, and the worker reports `reused_effect: true`. The second sample completes v2 with a 79-byte, 12-word receipt. Change `--crash-after effect` to `claim` to observe recovery before an output exists. `go run . demo` automates the effect-crash sequence and cleans up only its own temporary directory.

`--now-ms` is an injected test clock. Omit it for real wall-clock execution. `--delay-ms 500` lets another process recover an expired claim before the old one finishes. Stale completions fail; two ordinary worker processes can claim different jobs safely.

## Learn each boundary

1. [Create stable job identities](stages/01-create-jobs-with-stable-identity/docs/en.md).
2. [Claim with a version and lease](stages/02-claim-with-a-lease-and-version/docs/en.md).
3. [Reclaim and fence old workers](stages/03-finish-or-reclaim-expired-work/docs/en.md).
4. [Persist snapshots and recover effects](stages/04-write-and-recover-atomic-snapshots/docs/en.md).

[API.md](API.md) defines the integration contract. Call the binary from any language and parse its JSON. The grader builds the chosen workspace and tests actual crashes, concurrent workers, stale completion, changed input and corrupt-state preservation:

```bash
python3 scripts/project_test.py durable-agent-jobs --all --solution --strict
```

## Honest limits

The store coordinates cooperating processes on one local POSIX filesystem with advisory locks. Do not put it on NFS, bypass the wrapper, share it with untrusted writers, or treat it as an authenticated service. Windows needs a different locking implementation.

Execution is at least once. The local immutable receipt makes this particular effect idempotent; it does not make arbitrary payments, email or remote writes exactly once. A crash may leave temporary files or an unreferenced input. Snapshot rename and file sync protect process recovery but do not promise power-loss durability without directory sync. At the attempt cap, jobs remain visible for manual reconciliation. The artifact is a learning-sized queue with a 4 MiB snapshot limit and no scheduling, heartbeat renewal or remote transport.
