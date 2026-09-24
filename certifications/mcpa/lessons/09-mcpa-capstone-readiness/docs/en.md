# The Anatomy of a Complete MCP Exchange

> Every domain on the MCPA blueprint names one property of a single exchange: a call that only completes if it is well-formed, permitted, and remembered afterward.

**Type:** Capstone
**Languages:** Python
**Prerequisites:** Lessons 00 to 08
**Time:** ~45 minutes

## Learning Objectives

- Assemble one MCP exchange end to end, naming which domain, MCP Fundamentals, Architecture and Components, or Interactions and Execution, governs each stage from handshake to result
- Classify the JSON-RPC error a conformant server returns for a schema-invalid call versus an unknown tool, and explain why the two codes differ
- Gate a side-effecting tool call behind a host-side consent decision driven by the tool's advertised annotations, and locate the trust boundary that gate defends
- Record protocol activity in an append-only, hash-chained audit log, and verify its integrity after a run
- Use the finished exchange as a checklist against the operational use cases and ecosystem roles the Use Cases and Ecosystem domain covers, as final preparation for the exam

## The Problem

Studying the five MCPA domains one lesson at a time is necessary, but it is not sufficient, because nothing in a real system ever tests a domain in isolation. A single incident report, the kind an on-call engineer actually reads, might say: a scheduled agent job shows a tool call that never produced a result, and the audit trail has a gap where the execution should be. Diagnosing that one line requires MCP Fundamentals to know which of the four roles could have dropped the ball, Interactions and Execution to read the JSON-RPC error code if one was returned, Security and Governance to check whether the call was ever sent in the first place or stopped at a consent gate, and Architecture and Components to confirm the schema the server advertised actually matches what the client sent. None of those domains, studied alone, explains the gap. Only the exchange, read end to end, does.

The exam reflects this. A question can describe a symptom, a refused call, a rejected argument, a missing log entry, and expect you to place it correctly on the timeline of one request, not to recite a domain's definition from memory. That is a different skill from knowing what a consent gate is. It is knowing where a consent gate sits relative to a schema check, and what each one looks like when it is the reason something did not happen.

This lesson does not introduce new protocol surface. It recomposes what lessons 00 through 08 covered separately into the one artifact a working system actually produces: a single tool call, correct or refused, with a reason attached and a record kept. Read it as a rehearsal for the exam's hardest question type, the one that gives you a symptom and asks which stage produced it, and as a rehearsal for the job the exam is actually certifying: operating a system where a tool call is not trusted by default.

## The Concept

A full MCP exchange is not one message. It is a short sequence of decisions, and each decision belongs to a different domain of this exam, even though a user experiences it as a single tool call.

The sequence opens with the handshake earlier lessons introduced: the client and server trade the protocol version they speak, `2026-07-28` for this curriculum, and the capabilities they support. Nothing past this point is safe to assume until both sides have agreed on it explicitly. A host that skips this step, or ignores a version mismatch, has no basis for trusting anything the server claims to expose next.

Discovery follows. The client asks for the tool list, and the server answers with each tool's name, description, and input schema, the same `tools/list` response the Architecture and Components domain teaches you to read as structured data rather than prose. This lesson adds one detail that domain only gestures at: a tool can also carry annotations, small hints such as `readOnlyHint` or `destructiveHint`, that describe the shape of a tool's effect without describing its implementation. A host reads those hints the moment discovery returns, well before any call is built.

Those hints matter at the very next stage, before a request is ever constructed. If the tool a user wants to invoke is marked destructive and the user has not already approved it, the host refuses locally: no request object is built, nothing crosses the wire, and the refusal carries no request id, because a request id only exists for a message that was actually transmitted. This is the consent gate the Security and Governance domain centers on, and it belongs to the host, not the server, because only the host embeds the party the protocol calls the user. A server cannot enforce a decision it has no way to observe.

If consent is not in question, either because the tool is read-only or because it was already granted, the request is built and sent, and the server takes over. A conformant server validates the arguments against the schema it advertised before it runs anything. A missing required field returns `-32602`, invalid params, immediately, with no side effect performed. An unrecognized tool name returns `-32601`, method not found. Both are ordinary JSON-RPC errors keyed to the request id, not crashes and not silent substitutions of a default value; the Interactions and Execution domain is the one that expects you to tell these codes apart on sight, and to know that a well-formed envelope with a bad payload, `-32602`, is a different failure than an envelope that is not JSON-RPC 2.0 at all, `-32600`.

Only a call that clears both the consent gate and the schema check reaches a handler. When it does, the host writes an entry to an audit log before returning the result to the caller: what was called, whether it succeeded, and a hash that chains to the entry recorded before it. That chain is what makes the log append-only in practice, not only in policy. Editing or deleting an old entry breaks every hash computed after it, and a verification pass that recomputes the chain from the start will catch the break immediately. This is the Security and Governance domain's auditability objective, made concrete instead of abstract.

The result that finally comes back is the moment the trust boundary this track's first lesson introduced stops being an abstraction. The server is a separate program, frequently one your organization did not write. Whatever it returns, even on a fully successful call, is content the host did not generate, entering a context the model is about to read. Every gate this lesson has walked through exists because that crossing is unavoidable, and a working system has to make it survivable rather than pretend it does not happen.

```figure
mcpa-09-capstone-flow
```

## Interactive Lab

The figure above is the six-stage map this lesson teaches: handshake, discovery, a schema check, a consent gate, audited execution, and a result that crosses back. `code/main.py` runs exactly that sequence against a small in-memory `ops` server with two tools, a read-only `check_status` and a destructive `restart_service`.

Run it and read the six printed lines against the figure in order. The `initialize` line echoes the negotiated protocol version. The `tools/list` line shows both tools with their schemas and annotations, the data a host would use to decide about consent before ever building a call. The next line calls `restart_service` with no arguments and shows the schema check failing with `-32602`. The line after that calls it correctly but before consent has been granted, and shows the host refusing locally with a custom `-32001` code and no request id attached, because nothing was sent. Only after `grant_consent` runs does the same call succeed. The final two lines call an unregistered tool to show `-32601`, then print the audit log's size and the result of `verify()`.

```bash
python3 code/main.py
```

Change one thing and predict the effect before you rerun it: call `check_status`, the read-only tool, without ever granting consent for it. It should succeed immediately, because the annotation that gates `restart_service` was never attached to it. If your prediction and the output disagree, the gap is exactly the kind of thing an exam question will ask you to explain.

## Practice Lab

Open a Python shell in `code/` and import `main`. Build a `Host` the way `demo()` does, discover its tools, grant consent for `restart_service`, and call it once so the audit log has one real entry. Then reach into `host.audit_log.entries[0]` and change its `detail` field directly, as if an operator had edited the log after the fact. Call `host.audit_log.verify()` again.

It should now return `False`. Before you run it, write down which hash you expect to no longer match and why: the edited entry's own recomputed hash no longer equals the hash stored when it was created, because the hash covers the entry's fields, not just a label pointing at them. This is the difference between a log that is append-only because a policy says so and a log that is append-only because tampering with it is detectable. `test_tampering_with_an_entry_breaks_verify` in this lesson's test suite exercises the same idea; read it after you have tried the exercise yourself, not before.

## Shipped Artifact

`outputs/mcpa-readiness-checklist.md` is a pre-exam checklist that maps each of the five domains to concrete, checkable competence, phrased as things you can do rather than facts you can recite: read a `tools/list` response, tell three JSON-RPC error codes apart, explain why a consent refusal has no request id, state what a hash chain detects that a plain log does not. Run through it once after finishing this lesson and once again the night before you sit the exam.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the properties this lesson claims: that the handshake echoes the negotiated protocol version, that discovery returns each tool with its schema and annotations, that a schema-invalid call is rejected with `-32602`, that an unknown tool is rejected with `-32601`, that a side-effecting call without consent is refused locally with no request id, that a read-only call needs no consent, that a consented valid call succeeds and is recorded, that `verify()` passes after a normal run, and that editing a recorded entry makes `verify()` fail. If any of these disagree with the lesson's prose, the code is the source of truth for the message shapes; report the mismatch.

## Capstone Connection

This lesson does not feed forward into another capstone. It is the capstone: the point where lessons 00 through 08 stop being five separate subjects and become five properties of one request you can trace from the first byte to the last. MCP Fundamentals gave you the four roles this exchange plays out across. Architecture and Components gave you the schemas and the message flow. Interactions and Execution gave you the request, response, and error vocabulary the exchange speaks. Security and Governance gave you the trust boundary, the consent gate, and the audit log that make the exchange safe to operate. Use Cases and Ecosystem is why any of this matters outside a textbook: real teams put real tools behind real MCP servers, and this exchange, handshake to audited result, is what every one of those deployments actually runs, whatever the tool happens to do.

What comes after this lesson is not another lesson. It is the exam itself, and after that, building or operating a system where this exchange is not a diagram but a dependency.

## Key Terms

| Term | Meaning |
|------|---------|
| Consent gate | The host-side check, run before a request is sent, that requires explicit user approval for a side-effecting tool call |
| Tool annotation | A hint such as `readOnlyHint` or `destructiveHint` attached to a discovered tool, describing its effect without describing its implementation |
| Implementation-defined error | A JSON-RPC error code in the `-32000` to `-32099` range, reserved for application-specific conditions like a consent refusal, distinct from the protocol's own reserved codes |
| Hash-chained audit log | An append-only record where each entry's hash covers the entry before it, so an edited, inserted, or deleted entry is detectable by recomputing the chain |
| Trust boundary | The line a tool result crosses when it leaves a separate server and enters the host's context as content the host did not generate |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, at modelcontextprotocol.io/specification/2026-07-28, for the normative shapes every stage of this exchange relies on.
- `phases/13-tools-and-protocols/23-capstone-tool-ecosystem` in this repository, for a deeper build of a full tool ecosystem beyond this lesson's single mock exchange.
- The MCPA certification page, at training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa, for the exam's official format, timing, and domain weights.
- `certifications/mcpa/research/source-verification-ledger.md` in this repository, for the sourced exam facts this curriculum relies on and their retrieval dates.
