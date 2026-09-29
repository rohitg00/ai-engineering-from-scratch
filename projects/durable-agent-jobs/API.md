# Durable queue integration

Build `go build -o jobs .` inside the completed workspace. The CLI has no dependencies or network connection. JSON goes to stdout, errors to stderr; ordinary failures exit 1. Crash injection exits 86 by design.

| Command | Input | Result |
|---|---|---|
| `enqueue --store DIR --input FILE` | JSON array of id/text objects | Count of requested records, including identical redelivery |
| `worker --store DIR` | Existing persisted inputs | Schema1 events with id, claimed version, state and reused_effect |
| `status --store DIR` | Existing or empty directory | Schema1 jobs, available effects and scope |
| `demo --input FILE` | Same input format | Child-process crash/recovery transcript in a temporary store |

Identifiers match `[a-z][a-z0-9-]{0,63}`. Text is limited to 1,000,000 UTF-8 bytes per record, request arrays to 10,000 records and each JSON document to 4 MiB. Unknown input fields and trailing JSON documents fail. An identifier permanently binds its original text; use a new identifier for a changed report.

Worker options are `--lease-ms` (default 30000), `--max-attempts` (3), `--max-jobs` (1), `--delay-ms` (0..60000), `--crash-after claim|effect` and `--now-ms` (default -1 means current wall time). Explicit nonnegative now-ms supplies a fixed logical clock for demonstrations. Avoid mixing logical and real clocks in one store.

The store contains `ledger.lock`, `jobs.json`, immutable `inputs/<id>.json` and immutable `effects/<id>.json`. Job fields preserve the stage API's Go names: ID, State, Version, LeaseUntil and Attempts. Leases use integer milliseconds. Effect fields are id, input_sha256, bytes and words.

`Enqueue`, `ClaimNext`, `CompleteClaim`, `Work` and `Status` compose the stage functions. All ledger read-modify-write operations acquire the same advisory lock. ClaimNext reclaims expired running records, preserves attempts, saves the new claim, then releases the lock before execution. Completion reloads and checks the current version under that lock.

Receipt publication uses a synced temporary file and an atomic hard link that refuses replacement. Existing receipt data must exactly match the expected input digest and counts. This tolerates two executions racing to publish the same local effect. It is an example of a receiver-owned idempotency contract, not an external exactly-once guarantee.

A status call locks the job snapshot but then reads effect files separately. It can show a receipt whose completion is still pending. That is a real intermediate state, not a transactional combined snapshot. Do not interpret status as a cryptographic audit or edit storage files while workers run.

To plug in a remote effect, retain the input identity and lease fence, then design the receiver's durable idempotency key and reconciliation protocol first. Copying only the `Finish` call cannot protect a receiver from duplicate requests.
