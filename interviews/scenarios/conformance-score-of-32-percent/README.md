---
id: conformance-score-of-32-percent
title: A conformance score of 32.3 percent
card: scenarios
kind: incident
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [design-review, debugging]
tags: [a2a, conformance, tck, test-defects, binding-equivalence, release-gate]
minutes: 30
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: [a2a]
related: [scenarios/task-not-found-in-two-bindings]
updated: 2026-11-03
system:
  version: A2A 1.0.1 with the manual's capture kit (the test-runner, code-reviewer and deployer agents)
  model: no model; the agents are deterministic fixtures
  hardware: one machine, localhost, no network
source:
  - manuals/a2a-101/research/tck-run.md
  - manuals/a2a-101/research/tck-summary.txt
  - manuals/a2a-101/sections/7-3-conformance-testing.md
  - manuals/a2a-101/sections/5-5-errors.md
  - manuals/a2a-101/sections/4-6-push-notification-configs.md
---

## Situation

A team's A2A server is ready for its first release. The release gate runs the official conformance kit, `a2a-tck` at the tag `1.0.0.alpha2`, against the server and requires a passing score. The dashboard shows an overall compatibility of 32.3 percent, and the gate is red. The engineering lead opens a ticket with the title "fix the 63 failing JSON-RPC checks" and asks you for an estimate.

The server under test is the kit's `test-runner` agent. Its card declares a JSON-RPC and an HTTP+JSON interface, streaming and push notifications, and no gRPC. You have the record of two runs against it on the same day: the first with the TCK as published, and the second after a two-line change to the TCK's own JSON-RPC client, repeated against the server after one fix. Your job is to say which failures belong to the server, which belong to the test kit, and what the gate should read.

## Evidence

- [the numbers of the two runs, from compatibility.json and pytest](evidence/two-runs.txt)
- [why there is a second run: where the TCK posted its JSON-RPC requests](evidence/why-run-2.txt)
- [two accounting rules of the TCK that change how the numbers read](evidence/two-accounting-facts.txt)
- [the ten requirements that fail on a real assertion, by class](evidence/the-ten-real-failures.txt)
- [the push requirements after the fix, verdict per binding](evidence/push-rows.txt)
- [the one defect the run found in the server, and its fix](evidence/the-kit-defect.txt)
- [where the TCK departs from the specification, in order of effect](evidence/departures-in-order.txt)

## Questions

1. Which single cause explains most of the first run, and whose defect is it?
2. After the second run, why do most of the remaining failed requirements still say nothing about the server?
3. Of the requirements that fail on a real assertion, how many are the server's, and at which level?
4. The push requirements pass on one binding and fail on the other. What does the TCK record for each one, and why?
5. What was the one real defect, which rule does it break, and how was the fix verified?
6. Write the release rule: what does the gate read, and what does it do with a failure that the test kit owns?

## Walkthrough

1. **Read the two runs.** Run 1 scored 32.3 percent: 30 requirements passed, 63 failed, 11 were skipped and 25 were not tested, of 129. On the JSON-RPC transport 12 records passed, 63 failed and 10 were skipped, of 85. Run 2 scored 66.7 percent: 62 passed, 31 failed, 11 skipped, 25 not tested, and the JSON-RPC transport read 66, 29 and 7 of 102 records. All 72 gRPC records were skipped in both runs, because the card declares no gRPC interface. The server did not change between the two scores, apart from the push fix, and that fix moved no verdict.
2. **Read why run 2 exists.** The TCK's JSON-RPC client posts to `/` on an HTTP client whose base is the interface URL. The library appends a slash to the base, so every request went to the card's URL plus a trailing slash. The server routes JSON-RPC at the exact URL and answers 404 with "No such path". 63 of the 85 JSON-RPC records in run 1 fail or skip for this one reason. The TCK's own reference server declares its interface at the host root, where the two URLs are the same, so the kit never meets its own defect. The specification requires an interface to declare its URL, and nothing requires a server to also answer at the URL with a slash. The two-line change replaces `/` with the base URL, and every one of those records passes.
3. **Read the accounting.** The tag records a skip raised inside a test body as a failure. The main branch of the TCK fixed that and wrote why: recording it as a failure would misrepresent it. In run 2, 21 of the 31 failed requirements are such skips, most of them from a prerequisite that expects an agent that parks a task in an input-required state, which `test-runner` never does. With the main rule the run reads 62 passed, 10 failed, 32 skipped, 25 not tested: 86.1 percent overall and 89.4 percent on MUST requirements. The second rule: the per-transport entry is the last record written, so a requirement can show a pass on a transport beside a failed verdict.
4. **Read the ten.** None fails on the server's account at MUST level. Seven are the TCK's: a required content-type error counted as a failure, two content-type substring checks that want `application/json` where the specification prefers `application/a2a+json`, a test that sends a non-JSON body and expects -32005 where the specification gives -32700, the snake_case `task_id` on push creation, and a MAY that the test asserts. Two come from the TCK's sample agent story, which expects fixed outputs that this agent does not produce. Two are SHOULD omissions the server documents: no `Cache-Control` and no `ETag` on the card.
5. **Read the push rows.** Six push requirements show `http_json=PASS`, `jsonrpc=FAIL`, and the verdict FAIL, because a requirement fails when any transport fails. The JSON-RPC side fails because the TCK sends `task_id` where the specification's camelCase rule gives `taskId`. The server reads `taskId`, finds no task, and answers -32001. The HTTP+JSON client sends camelCase and passes. `PUSH-GET-002` passed on JSON-RPC for the same wrong reason: the server answered not found for every config id, so the test never checked a real one.
6. **Read the defect.** Before the fix, the HTTP+JSON binding served no route under `tasks/{id}/pushNotificationConfigs`, while the card declared both bindings with push notifications on. Section 5.1 of the specification says that all supported protocols must provide the same set of operations. The run recorded it as `PUSH-CREATE-001` failing on HTTP+JSON with "404 Method not found" and five dependent skips. The fix added the four REST routes behind the same capability guard. The repeat of run 2 flipped six HTTP+JSON records to pass and raised the pytest count from 113 to 119, and eight hand checks covered create, get, list, a missing id, delete, get after delete, delete again, and an unknown task.
7. **Read the departures.** Eight, in order of effect: the trailing slash, the snake_case parameters, the content-type substring, the missing expected error on one requirement, the non-JSON body, hard asserts on SHOULD and MAY tests, the skip recorded as a failure, and latent status codes of 409, 415 and 502 where the specification says 400, 400 and 500. Two of the eight are fixed on the main branch of the TCK.

## Resolution

The 32.3 percent measured how the TCK built a URL, and the 66.7 percent measured how it counted a skip. By requirement, the server breaks no MUST. Its one real defect, found by the second run, was the missing push routes on HTTP+JSON, and the fix is verified by six records and eight hand checks. Two SHOULD omissions remain and are documented. The release rule reads `compatibility.json` per requirement, never the percentage. It classifies every non-pass as the server's, the TCK's, the sample agent's, unsupported by design, or untested. It blocks only on a MUST failure that is the server's own, tracks the SHOULD omissions, and files each TCK defect upstream with the wire check that proves it. It also keeps a list of what the TCK does not test at this tag, among them binding equivalence, card signatures and owner scoping, and the team tests those itself.

## Wrong turns

- "Fix the 63 failures." 63 records fail for one reason that lives in the test client, and no rule requires a server to answer at the URL plus a slash. A two-line change in the TCK removes all of them.
- "Rename the JSON-RPC parameters to snake_case so the push checks pass." The specification requires camelCase, and the TCK's own HTTP+JSON client sends camelCase and passes. The server would break the specification to satisfy the kit.
- "Send application/json so the content-type checks pass." The specification prefers `application/a2a+json`, and the implementations split. Accept both when you read, and keep sending what the specification prefers.
- "Ship when the percentage reaches a threshold." The percentage counts PASS and FAIL only. The skip rule alone moves it from 66.7 to 86.1 with no change to the server, so a threshold measures the TCK version.
- "The push checks pass on HTTP+JSON, so binding equivalence is covered." The four equivalence requirements are not tested at this tag. The defect was caught by accident through a push test, and the next gap will not be.

## Generalize

A conformance score is a measurement, and the instrument has its own defects. Before you act on the number, read per requirement, separate the instrument's failures from the subject's, run again after the instrument is fixed, and ask what the instrument does not measure at all. The one real defect here sat in the gap between two bindings, a place the kit did not test.

## Taught in

The [conformance testing page of A2A 101](../../../manuals/a2a-101/sections/7-3-conformance-testing.md) records these two runs and the table of departures, the [errors page](../../../manuals/a2a-101/sections/5-5-errors.md) and the [push notifications page](../../../manuals/a2a-101/sections/4-6-push-notification-configs.md) give the rules behind the content-type and push rows, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) warns that monitoring which tags only the headline misses the failures that matter.
