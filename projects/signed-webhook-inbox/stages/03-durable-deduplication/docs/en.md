# Deduplicate retries with a durable inbox

> Persist accepted identity and body before acknowledging delivery.

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Write a mode-0600 temporary file, sync its content, and publish it through an atomic no-overwrite hard link. Sync the directory before acknowledging success. Delivery filenames are SHA-256 digests of IDs, preventing path traversal. Existing IDs with identical raw bytes are transport retries; changed bytes are conflicts.

## Worked example

The first signed delivery returns HTTP 202. The same ID and bytes return 200 without replacing the original acceptedAt. The same ID with a newly valid signature but a different body returns 409. A changed body under the old signature returns 401 before storage.

```figure
pj-signed-webhook-inbox-3
```

## Implement the contract

`Accept(dir,id,body,now)(Entry,created,error)`; `LoadEntry(dir,id)(Entry,error)`. Entry stores schemaVersion, deliveryId, base64 body, sha256 and acceptedAt. `ErrConflict` identifies reused delivery IDs. Corrupt stored records fail closed.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py signed-webhook-inbox --init /tmp/signed-webhook-inbox-work
python3 scripts/project_test.py signed-webhook-inbox --stage 3 --path /tmp/signed-webhook-inbox-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Kill a process between writing and linking. Unlinked .pending files can remain but are never accepted deliveries. This local-filesystem design requires hard-link and fsync support; do not claim equivalent behavior on arbitrary network filesystems.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
