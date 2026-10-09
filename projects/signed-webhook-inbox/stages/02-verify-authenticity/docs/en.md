# Verify signatures and timestamp bounds

> Authenticate identity, timestamp and raw bytes under an explicit teaching scheme.

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

The authored signature is v1= followed by lowercase HMAC-SHA256 hex over decimalTimestamp + dot + deliveryID + dot + rawBody. The shared secret comes from an environment variable and is never written to the inbox. Verify with hmac.Equal and bound accepted timestamps.

## Worked example

At now=1770000000 and a 300-second window, now-300 and now+300 are accepted. now-301 is stale. Altering a single body byte or delivery ID fails authentication even inside the time window.

```figure
pj-signed-webhook-inbox-2
```

## Implement the contract

`Sign(key []byte,id string,timestamp int64,body []byte)string`; `Verify(Delivery,key,now,skew)error`. Keys require at least 16 bytes; skew must be 0..1 hour. Receiver uses five minutes. This format is original and not compatible with a named webhook provider.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py signed-webhook-inbox --init /tmp/signed-webhook-inbox-work
python3 scripts/project_test.py signed-webhook-inbox --stage 2 --path /tmp/signed-webhook-inbox-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Add a provider adapter only after implementing and testing its published raw-byte signing rules. Do not assume a different service uses this concatenation order.

[Go HMAC](https://pkg.go.dev/crypto/hmac) and [Go SHA-256](https://pkg.go.dev/crypto/sha256).
