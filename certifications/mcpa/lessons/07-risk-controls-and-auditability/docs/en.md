# Auditability Means Tampering Leaves Evidence

> A log you cannot verify is a claim. A log with a hash chain you can verify is evidence, and evidence is what a security review actually asks for.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 06
**Time:** ~45 minutes

## Learning Objectives

- Explain why every tool call needs to be both observable and auditable, and name auditability as its own MCPA sub-competency
- Build an append-only log entry that records a tool call and a hash linking it to the entry before it
- Verify a hash-chained log by recomputing its hashes, and explain why an edited entry is detectable even if its own hash is recomputed to match
- Redact a flagged sensitive field before it is written to the log, so the audit trail cannot itself become a source of leaked secrets
- Apply rate limits, allowlists, and default-deny-unknown-tool as risk controls that bound what can happen, distinct from a log that only records what did happen

## The Problem

A support agent has a tool that can reset a user's password. Most days it runs exactly as expected: a user calls in, an agent verifies identity, the tool resets a password, the ticket closes. Then one day a password is reset for an account that never opened a ticket. Someone has to answer what happened, and answer it in a way a security reviewer, not just the on-call engineer, will accept.

If the only record of that reset is an application log line sitting in a file anyone with server access can edit, the honest answer is that nobody can fully trust it. A log that can be quietly edited after the fact is not evidence of what happened; it is a claim about what happened, no more reliable than whoever could have changed it. Worse, if that same log line captured the new password in plain text to make debugging easier, the log itself is now a second place the secret can leak from, independent of whatever went wrong with the reset in the first place.

MCP puts a server between a model and a real system, and the Security and Governance domain assumes that boundary will occasionally be crossed by something that should not have run. Auditability is the domain's answer to what happens next: not preventing every bad call up front, but making sure that after the fact, a reviewer can reconstruct exactly what ran, in what order, with what arguments, and can prove the record has not been altered since it was written. Risk controls are the domain's other answer, sitting earlier in the same request, deciding what is allowed to reach a tool at all.

## The Concept

Observability and auditability sound like the same idea, and the exam blueprint separates them on purpose. Observability is live: metrics, traces, and dashboards that show what a system is doing right now, so an operator can watch a request move through it. Auditability is retrospective: a durable record a reviewer can open days or months later and use to reconstruct exactly what happened, independent of whether anyone was watching a dashboard at the time. A system can have excellent observability and still fail an audit, if nothing it showed a viewer in real time was ever kept anywhere durable enough to check again.

The record this domain expects for a tool-calling system is an append-only log. Append-only means exactly what it says: a new call becomes a new entry at the end, and no entry already written is ever edited or deleted, not even to fix a mistake. If a correction is needed, a correcting entry is appended; the original stays. This single rule is what turns a log from a debugging convenience into an audit trail, because it is the property that makes the log a candidate for evidence in the first place. A log that can be edited after the fact proves nothing about the past; it only proves what someone wants a reader to believe about the past right now.

Append-only alone is a policy, not a guarantee. Nothing stops someone with file-system access from opening the log and editing a line anyway; the rule describes how the log is supposed to be used, not a hard barrier against misuse. A hash chain is what turns the policy into something checkable. Each entry stores a hash computed from two things: the hash of the entry immediately before it, and this entry's own content, meaning its tool name, its arguments, and its result. Because the hash is deterministic, anyone can recompute it from what is stored and compare. If a past entry's content changes after the fact, recomputing its hash produces a different value than the one recorded, and the mismatch is visible the moment someone verifies the chain. Recomputing that one entry's own hash to cover the edit does not fix the problem, because the next entry in the chain still stores the original hash as its own prev_hash; the break simply moves one entry later, and verification still finds it. This is tamper-evidence, not tamper-prevention. Nothing here stops the edit itself. What it guarantees is that the edit cannot be made invisible without rewriting the entire chain after it, in order, which is a far harder problem than editing one line.

A hash chain protects the log's integrity; it does nothing for the log's contents. If a tool call's arguments include a password, an API key, or another secret, writing that value into the log verbatim creates a second copy of the secret, sitting in a place backups and log aggregators will happily replicate further. Redaction closes that gap: certain argument fields are flagged, by name, as sensitive when a tool is registered, and before any entry is created, those fields are replaced with a fixed marker in the copy that gets written and hashed. The tool itself still receives the real value, because it needs it to do the work; only the durable record is redacted, and the redaction happens before the entry exists in any form, not as a mask applied afterward to something already stored in the clear.

None of this replaces deciding what is allowed to run in the first place. Risk controls sit earlier in the same request: an allowlist denies any tool name the server did not register, by default, before the call reaches a handler or a log entry; required-argument validation refuses a call missing a field its schema demands; a rate limit caps how many times a single tool may run, bounding the damage a compromised or simply overeager caller can do even when every individual call looks legitimate on its own. A control and the log answer different questions. The control decides whether something is allowed to happen. The log proves what did happen, for everything the controls let through.

```figure
mcpa-07-audit-trail
```

## Interactive Lab

Open `code/main.py`. It registers two tools on an `AuditedServer`: `lookup_order`, which takes no sensitive arguments, and `reset_password`, which flags `new_password` as a field to redact. Running the demo calls `lookup_order`, then `reset_password`, then prints the most recent log entry so you can see `new_password` replaced by a fixed marker while `user_id` stays readable. It then calls a tool name the server never registered and shows the allowlist deny it with a JSON-RPC error rather than a log entry, before calling `lookup_order` past its configured rate limit to show the same deny-with-no-log pattern for a different control. The last two lines call `verify()` on the clean log, then deliberately overwrite the first entry's arguments in memory and call `verify()` again. Watch that second result next to the figure above: the return value flips from `True, None` to `False, 0`, naming the exact entry where the chain broke, which is the append-only guarantee made checkable rather than assumed.

```bash
python3 code/main.py
```

## Practice Lab

Add `"api_key"` to a new tool's `flagged_fields`, alongside `reset_password`'s existing `new_password`, and register a third tool, `charge_card`, that takes `account_id` and `api_key` as required arguments and simply returns a confirmation string. Call it through the client with a real-looking `api_key` value, then print `client.server.log.entries[-1].arguments` and confirm `api_key` reads as the redaction marker while `account_id` does not. Then reach into the log directly, the way the demo does for its own tampering example, and change the arguments on an earlier entry, such as the very first call the server logged. Call `log.verify()` and confirm it returns `False` along with the index of the entry you changed, not the index of whatever entry happens to be last. That index is the detail a reviewer actually needs: not just that something was altered, but exactly where the chain stops matching its own history.

## Shipped Artifact

`outputs/auditability-controls.md` is a one-page field brief you can keep: the six fields every audit entry carries, the hash-chain rule stated as a checkable procedure, the redaction rule and why it has to run before an entry is created rather than after, and the three risk controls with a one-sentence distinction between what a control does and what the log does. Keep it next to lesson 01's field brief when you assemble your own study notes for the Security and Governance domain.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the properties this lesson claims: that each call appends exactly one entry, that consecutive entries link through their hashes, that `verify()` passes on a clean chain and fails with the correct index the moment a past entry is altered, that a flagged field is replaced with the redaction marker while other fields are left alone, that entry order matches call order, and that the allowlist, argument validation, and rate limit each deny a call with a distinct JSON-RPC error code before anything reaches the log. If a test fails, the mock and the lesson have drifted, and the mock is the source of truth for the message shapes.

## Capstone Connection

The capstone asks you to defend a design, not just describe one. When you present a tool-calling system for capstone review, "how would you know if this had been misused" is one of the first questions a reviewer will ask, and "we have log files" is not an answer that survives a follow-up question about whether those files could have been edited without anyone knowing. The hash-chained log, the redaction rule, and the three risk controls this lesson builds are the concrete answer: a chain you can verify, a secret that was never written down in the clear, and a boundary that denies what it does not recognize before any of it needs to be explained after the fact. Carry the field brief into lesson 09 and be ready to point at entries, hashes, and denial codes, not just describe them in the abstract.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Audit log | "The log file" | An append-only record of every tool call kept for after-the-fact review, not just real-time monitoring |
| Hash chain | "A checksum" | Each entry's hash covers its own content plus the previous entry's hash, so altering any past entry breaks every link after it |
| Tamper-evident | "Tamper-proof" | A property that makes an unauthorized change detectable, not a guarantee that the change cannot be made at all |
| Redaction | "Masking" | Replacing a flagged sensitive field with a fixed marker before an entry is ever written or hashed, not after |
| Allowlist | "A whitelist" | A closed set of tools a server will run at all; anything not on it is denied by default, before a log entry is even possible |
| Rate limit | "Throttling" | A cap on how many times a tool may run in a server's lifetime, bounding damage independent of whether any one call looks legitimate |

## Further Reading

- [Model Context Protocol specification, version 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), for the normative shape of the tool calls this log records.
- [OpenTelemetry GenAI: Tracing Tool Calls End-to-End](../../../../../phases/13-tools-and-protocols/20-opentelemetry-genai/), for the real-time tracing that complements this lesson's after-the-fact audit log.
- [MCPA certification page](https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/), for the official scope of the Security and Governance domain.
