# Preserve raw bytes and delivery identity

> Read the exact authenticated body before decoding business data.

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Read POST requests with X-Delivery-ID, X-Timestamp and X-Signature. Preserve raw bytes exactly. JSON whitespace is part of the signed content; decoding then reserializing would alter the authenticated message.

## Worked example

The fixture body ends with a newline on disk. Signing that file includes its newline. Removing the final byte changes the signature even though the JSON object represents the same data. The transport delivery ID is distinct from business eventId inside the body.

```figure
pj-signed-webhook-inbox-1
```

## Implement the contract

`ReadDelivery(*http.Request)(Delivery,error)` returns ID, Timestamp, Signature, Body. Require POST, canonical int64 decimal timestamp, ID matching [A-Za-z0-9][A-Za-z0-9._-]{0,127}, and 1..65536 raw bytes. JSON validity is a processing-stage concern.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py signed-webhook-inbox --init /tmp/signed-webhook-inbox-work
python3 scripts/project_test.py signed-webhook-inbox --stage 1 --path /tmp/signed-webhook-inbox-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Send the same JSON with different whitespace and compare its raw SHA-256 digest. Do not use semantic JSON equality at the signature boundary.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
