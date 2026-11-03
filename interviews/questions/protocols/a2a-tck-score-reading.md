---
id: a2a-tck-score-reading
title: How conformant is a server that scores 66.7 percent
card: protocols
kind: estimate
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, ai-developer-relations-engineer]
rounds: [ml-depth, design-review]
tags: [a2a, conformance, tck, testing, evidence]
minutes: 12
lessons: []
manuals: [a2a-101#s-conformance-testing, a2a-101#s-ref-errors]
practice: []
cheatsheet: [a2a]
related: [protocols/a2a-version-header-missing]
updated: 2026-11-03
---

You run the official A2A conformance kit against your server twice. The first run scores 32.3 percent. After a two-line change to the kit's own JSON-RPC client, the second run scores 66.7 percent: 62 PASS, 31 FAIL, 11 SKIPPED and 25 NOT TESTED of 129 requirements. Your manager asks how conformant the server is. Estimate the real figure and defend every adjustment you make.

## Short answer

Neither percentage measures the server alone. The first run lost 63 of 85 JSON-RPC records because the kit posted to the card URL with a trailing slash, which is the kit's defect. In the second run, 21 of the failures are skips inside a test body that the tagged kit records as FAIL, so under the main-branch rule the run reads 62 PASS, 10 FAIL and 32 SKIPPED, or 86.1 percent, and of those ten failures three belonged to the server: the missing REST push routes and, at SHOULD level, the missing `Cache-Control` and `ETag` on the card.

## Full answer

### How the kit scores

The kit is a pytest project. It reads the card, builds one client per `supportedInterfaces` entry, and runs each test on each declared binding. A MUST test is a hard failure, a SHOULD test is an expected failure, and a MAY test is skipped when the card lacks the capability. The percentages count only PASS and FAIL. All 72 gRPC records were skipped because the server has no gRPC interface, and that is correct, not a loss.

### Run one: a kit defect

The specification places the interface at `url`. The kit appended a slash, the server answered 404, and 63 records failed for one reason. Fixing the kit's client, not the server, moved the score.

### Run two: separate the failures

| Group | Count | Whose |
|---|---|---|
| skips inside a test body, recorded as FAIL at the tag | 21 | the kit; `main` records them as SKIPPED |
| push requirements that pass on HTTP+JSON and fail on JSON-RPC | most of the rest | the kit sends snake_case `task_id`, where the specification requires camelCase |
| REST push routes missing although the card declared `pushNotifications` | 1 | the server; every declared binding must offer the same operations |
| missing `Cache-Control` and `ETag` on the card | 2 | the server, at SHOULD level |

After the server fix, the six HTTP+JSON push records pass, and each requirement still reads FAIL because of its JSON-RPC side.

### Where the kit departs from the specification

The kit expects HTTP `409` for `TaskNotCancelableError`, `415` for `ContentTypeNotSupportedError`, `502` for `InvalidAgentResponseError`, and gRPC `UNIMPLEMENTED` for three errors. The canonical table says `400`, `400`, `500` and `FAILED_PRECONDITION`. A server that follows the specification fails those checks. It also demands `application/json` on REST where the specification says `application/a2a+json` should be used, and it hard-asserts SHOULD and MAY caching tests.

### What the kit never tests

Five behaviors that split the SDKs never run: the REST subscribe verb, pagination beyond one call, an `append` to an unknown artifact, another caller's task, and a resent `messageId`. The NOT TESTED set also covers in-task authorization, TLS, card signatures and the client's version header. Those are yours to test.

### The estimate

Say this: one MUST defect, found and fixed; two SHOULD gaps on card caching; a per-requirement reading of 86.1 percent under the main-branch rule, with the remaining failures attributable to the kit's own client, and an explicit list of untested behaviors with your own tests beside them. Hand over `compatibility.json`, not the percentage.

## Follow-ups

- **Level 3:** Why do the percentages leave out the SKIPPED and NOT TESTED rows? Expected: those rows carry no verdict, so a percentage over them would reward a card that declares few capabilities.
- **Level 4:** The push requirements pass on one binding and fail on the other. How do you classify that? Expected: a kit defect, because the JSON field names must be camelCase and the kit sends `task_id`; keep the requirement as passing in your own ledger with the evidence.
- **Level 4:** What did the one real failure teach about cards? Expected: a capability flag is a promise for every declared binding, so the REST side needed the four push routes the card advertised.
- **Level 4:** Which checks do you add that the kit lacks? Expected: owner scoping of tasks, a resent `messageId`, `append` to an unknown artifact, the REST subscribe verb, and pagination with the returned token.

## Wrong answers

- "Report the second percentage as the conformance figure." It counts kit skips as failures and the kit's snake_case parameters as your bugs.
- "Report full conformance after fixing the missing routes." The two SHOULD gaps remain, and a quarter of the requirements were never tested.
- "The kit is the specification." It departs from the canonical error table in six places; the specification wins, and the kit's README itself calls SHOULD an expected failure.

## Taught in

The [conformance testing section](../../../manuals/a2a-101/sections/7-3-conformance-testing.md) records both runs, and the [errors reference](../../../manuals/a2a-101/sections/r-4-errors.md) sets the kit's status table beside the canonical one.
