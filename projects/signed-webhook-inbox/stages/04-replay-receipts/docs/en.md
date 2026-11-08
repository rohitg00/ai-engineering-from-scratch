# Replay accepted deliveries with processing receipts

> Make a new processing run explicit while keeping transport deduplication intact.

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Replay reads only accepted inbox entries. The authored local processor extracts eventId and data from JSON and writes a processing receipt keyed by delivery ID plus explicit run ID. Repeating the same run returns its existing receipt; a different run is a deliberate replay.

## Worked example

Delivery delivery-1 carries business-42. Replay run review-1 creates one receipt; repeating review-1 creates none. A new delivery-2 may carry business-42 and is a distinct transport identity. Business-level deduplication is a downstream policy.

```figure
pj-signed-webhook-inbox-4
```

## Implement the contract

`Replay(dir,id,run,now)(Processing,created,error)`; fields schemaVersion, deliveryId, runId, businessEventId, bodySHA256, processedAt and payload. CLI modes demo, serve, sign, inspect and replay compose the contracts. The processor writes a local artifact and does not call an external side-effecting service.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py signed-webhook-inbox --init /tmp/signed-webhook-inbox-work
python3 scripts/project_test.py signed-webhook-inbox --stage 4 --path /tmp/signed-webhook-inbox-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Feed receipt.payload to a downstream queue with an idempotency key. External exactly-once effects require a separate transactional design; a local processing receipt cannot establish that guarantee.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
