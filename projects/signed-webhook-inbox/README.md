# Signed Webhook Inbox

Help developers feed external events into an agent workflow without losing retries or accepting altered payloads. Verify an authored signature scheme over the raw body, enforce timestamp bounds, and store stable delivery identities before dispatch. Export an HTTP receiver and a replay CLI that distinguishes a transport retry from a new business event.

Standard libraries only. Four stages, approximately eight hours. Go implementations are exercised by the grader.

## Build it

1. [Preserve raw bytes and delivery identity](stages/01-preserve-delivery/docs/en.md)
2. [Verify signatures and timestamp bounds](stages/02-verify-authenticity/docs/en.md)
3. [Deduplicate retries with a durable inbox](stages/03-durable-deduplication/docs/en.md)
4. [Replay accepted deliveries with processing receipts](stages/04-replay-receipts/docs/en.md)

```bash
python3 scripts/project_test.py signed-webhook-inbox --init /tmp/signed-webhook-inbox-work
python3 scripts/project_test.py signed-webhook-inbox --stage 1 --path /tmp/signed-webhook-inbox-work --strict
python3 scripts/project_test.py signed-webhook-inbox --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run and inspect the actual receiver

```bash
cd projects/signed-webhook-inbox/solution
go run . --mode demo
```

The terminating demo sends real HTTP deliveries to a loopback receiver: original, transport retry and one altered raw byte. It expects statuses 202,200,401, reopens the persisted delivery, and explicitly replays the accepted body twice under the same run ID. The second replay reuses the processing receipt.

For your own persistent inbox, provide a shared secret of at least 16 bytes through WEBHOOK_SECRET using your environment manager. Do not put real keys in command history or source files.

```bash
go build -o /tmp/webhook-inbox .
/tmp/webhook-inbox --mode serve --dir /tmp/my-webhook-inbox --listen 127.0.0.1:8141 --seconds 120
/tmp/webhook-inbox --mode sign --id delivery-1 --timestamp 1770000000 --body fixtures/event.json
/tmp/webhook-inbox --mode inspect --dir /tmp/my-webhook-inbox --id delivery-1
/tmp/webhook-inbox --mode replay --dir /tmp/my-webhook-inbox --id delivery-1 --run review-1
```

Use the current Unix timestamp when signing a live delivery; the fixed timestamp above illustrates the header shape. Send the exact file bytes with the returned X-Delivery-ID, X-Timestamp and X-Signature headers. The receiver prints its listening URL and stops after the finite lifetime. A successful 202 means authenticated bytes were durably accepted, not that a business action has executed.

The original v1 scheme authenticates timestamp, delivery identity and raw body with HMAC-SHA256. It is not a provider-compatible signature format. Disk entries retain raw payloads as base64; these files are private evidence and are not redacted assistant context. New files use owner-only permissions.

Local persistence uses fsync and atomic hard links without overwriting existing identity records. It fails if the filesystem lacks those capabilities. Pending temporary files may remain after a crash, but they are not accepted entries. Processing receipts are local JSON artifacts, not proof of external exactly-once side effects. Business event IDs and transport delivery IDs remain separate.

[Go HMAC](https://pkg.go.dev/crypto/hmac), [Go file operations](https://pkg.go.dev/os) and [Go HTTP](https://pkg.go.dev/net/http) document the primitives used here.

## Completion evidence

```bash
python3 scripts/project_test.py signed-webhook-inbox --all --path /tmp/signed-webhook-inbox-work --strict --report /tmp/signed-webhook-inbox-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
