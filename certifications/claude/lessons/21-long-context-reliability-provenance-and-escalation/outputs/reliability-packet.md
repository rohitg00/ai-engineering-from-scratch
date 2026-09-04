# Reliability Packet: Repository Security Review

## Scope and Coverage

The manifest requires 24 files. The first pass reviewed 18 of 24; six omitted
files remain named under `services/payments/**`. Two valid findings are retained.

## Provenance Envelope

Evidence `policy-auth-017` carries repository URI, source version `3a91c7e`,
effective date, authority, Markdown content type, heading and line location,
extractor version, and observed time.

## Partial Result

State is partial, not complete. A retryable dependency timeout names the six
unreviewed files, trace `8801`, two finding IDs, and full artifact reference.

## Conflict

Two approved policies disagree about token rotation. Both versions and exact
spans remain visible; no precedence rule is invented.

## Escalation

Security architecture is the owner. The safe next action is to stop rollout,
resolve precedence, then review only the named coverage gap.

## Human Review

Review every severe finding, partial result, and policy conflict, plus a random sample
of ordinary passes. Record disposition and correction reason.
