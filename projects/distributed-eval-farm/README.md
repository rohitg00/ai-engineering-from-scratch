# Distributed Eval Farm Coordinator

Turn a file of recorded model predictions into a resumable evaluation run. Separate worker processes acquire persisted shards, compare answers and publish fenced receipts. Kill a worker after its claim, restart the run and prove an old worker cannot overwrite the replacement's result.

Go fits the coordinator because the same dependency-free binary can launch child workers, bound concurrency and coordinate filesystem state. This implementation distributes work across processes on one Linux or macOS host. It does not provide a multi-machine transport or perform model inference.

Four stages take about 8 hours. You need Go 1.22+, Python 3.10+ for the grader, structs, errors, JSON, goroutines, channels and cancellation. Start with [A Tour of Go](https://go.dev/tour/) and [Go pipelines](https://go.dev/blog/pipelines) if channels are unfamiliar. Completing [Durable Agent Jobs](../durable-agent-jobs/README.md) makes the persistence stage easier.

## Build and run your version

From the repository root:

```bash
python3 scripts/project_test.py distributed-eval-farm --init /tmp/distributed-eval-farm-work
python3 scripts/project_test.py distributed-eval-farm --stage 1 --path /tmp/distributed-eval-farm-work --strict
```

Initialization supplies types, process glue and sample predictions. The first test intentionally fails until you implement `stage1.go`. Finish all four stages, then run your composed artifact:

```bash
python3 scripts/project_test.py distributed-eval-farm --all --path /tmp/distributed-eval-farm-work --strict --report /tmp/farm-learner.json
cd /tmp/distributed-eval-farm-work
go build -o /tmp/farm-learner .
/tmp/farm-learner demo --input samples/cases.json --workers 2 --shards 4
```

The demo crashes a real worker after its durable claim, prints the incomplete snapshot, then starts replacement workers at the expiry boundary. The supplied coordinator calls your stage implementations. A reference pass is instructor evidence, not learner completion.

## Run the reference on a prediction file

```bash
cd projects/distributed-eval-farm/solution
go build -o /tmp/eval-farm .
STORE=$(mktemp -d /tmp/eval-farm.XXXXXX)
/tmp/eval-farm init --store "$STORE" --input samples/cases.json --shards 4
/tmp/eval-farm run --store "$STORE" --input samples/cases.json --shards 4 --workers 2
/tmp/eval-farm status --store "$STORE"
```

Each input record has id, prompt, expected and response. Pass your own JSON array or edit a copy of the sample. Scoring lowercases and collapses whitespace before comparing expected with response. The four authored records score 3/4. Before run, completed_shards and evaluated are 0. Afterwards, complete is true, completed_shards is 4, evaluated is 4 and correct is 3.

The report retains the SHA256 of the ordered dataset and per-shard case results, owners, versions and actual worker PIDs. With the sample and workers 2, two bounded waves launch four short-lived processes. PIDs vary; the concurrency cap remains 2. A finished rerun emits no new worker events and preserves receipts. Recorded sample answers demonstrate coordination, not a model benchmark.

## Recover a crashed worker

Use a separate store and one shard so the recovery is easy to follow:

```bash
CRASH_STORE=$(mktemp -d /tmp/eval-crash.XXXXXX)
/tmp/eval-farm init --store "$CRASH_STORE" --input samples/cases.json --shards 1
/tmp/eval-farm worker --store "$CRASH_STORE" --worker-id old --now-ms 100 --lease-ms 10 --crash-after-claim
/tmp/eval-farm status --store "$CRASH_STORE"
/tmp/eval-farm run --store "$CRASH_STORE" --input samples/cases.json --shards 1 --workers 2 --now-ms 110 --lease-ms 10
```

The crash intentionally exits 86. Status shows owner old, version 1, expiry 110 and Done false. Recovery at 110 finishes version 2 with all four case results. Recovery at 109 instead reports a pending run and exits 1; it does not steal a live lease. Omit now-ms for wall-clock operation. `--delay-ms` pauses after a claim to expose a stale-worker race without changing the scoring function.

## Learn and integrate

1. [Partition stable case identities](stages/01-partition-stable-case-identities/docs/en.md).
2. [Persist and fence shard leases](stages/02-fence-each-shard-lease/docs/en.md).
3. [Accept idempotent receipts](stages/03-accept-idempotent-completion-receipts/docs/en.md).
4. [Compose a bounded process coordinator](stages/04-run-a-bounded-local-worker-pool/docs/en.md).

[API.md](API.md) documents the JSON and process boundary. Any language can write a prediction file and parse the report. Final-stage tests build the selected learner binary, use actual worker processes, test crash recovery, delayed stale writers, dataset changes and corrupt-state preservation:

```bash
python3 scripts/project_test.py distributed-eval-farm --all --solution --strict
```

## Honest limits

The coordinator uses a 4 MiB whole-run snapshot and a local POSIX advisory lock. All writers must cooperate. Network filesystems, untrusted store writers and multi-host clocks are outside the contract. File sync and atomic rename demonstrate process-crash recovery; directory sync and power-loss guarantees are not implemented.

Predictions are already recorded. Exact-match scoring does not judge semantic quality, citations or fairness, and no model API is called. There is no network worker protocol, lease heartbeat, dynamic resharding, retry backoff or scheduling daemon. `run` makes bounded waves and reports pending leases instead of waiting indefinitely; invoke it again after expiry. Context cancellation bounds cooperative callbacks; the CLI additionally gives the run a two-minute deadline. These are visible starting points for an advanced extension, not hidden production guarantees.
