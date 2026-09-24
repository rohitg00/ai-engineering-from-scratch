# MCPA Readiness Checklist

A pre-exam checklist mapping each of the five MCPA domains to the concrete thing you must be able to do. Work through it against the capstone exchange in `code/main.py`: every row below is something that exchange actually demonstrates, not an abstract claim.

## MCP Fundamentals (16 percent)

- [ ] Name the four roles, host, client, server, tool, and say in one sentence what each owns.
- [ ] Explain the N times M integration problem and why one shared protocol reduces it to N plus M.
- [ ] State the protocol version this curriculum targets (`2026-07-28`) and where a handshake negotiates it.

## Architecture and Components (14 percent)

- [ ] Read a `tools/list` response and identify a tool's name, description, input schema, and annotations.
- [ ] Trace one request from a user's intent through the host, the client, the server, and back.
- [ ] Explain why the client, not the host directly, owns the single connection to a given server.

## Interactions and Execution (26 percent)

- [ ] Recognize the JSON-RPC envelope: `method`, `params`, an `id` on the request, and `result` or `error` on the response.
- [ ] Tell `-32600` (invalid request), `-32601` (method not found), and `-32602` (invalid params) apart on sight.
- [ ] Walk the tool invocation lifecycle: discover, validate, execute, return, without skipping the validation step.
- [ ] Explain why an implementation-defined error, such as a consent refusal, belongs outside `-32768` to `-32000`.

## Security and Governance (24 percent)

- [ ] Locate the trust boundary in a running exchange and say what crosses it and when.
- [ ] Explain how a tool annotation such as `destructiveHint` drives a host's consent decision.
- [ ] State why a consent refusal happens before a request is sent, and why that response has no request id.
- [ ] Explain what a hash-chained audit log detects that a plain list of log lines would not.

## Use Cases and Ecosystem (20 percent)

- [ ] Give one operational scenario where a read-only tool needs no consent prompt and one where a destructive tool does.
- [ ] Describe how the same host and client can be pointed at a different server without rewriting either.
- [ ] Explain what a team gains, in practice, by routing agent actions through an audited exchange instead of ad hoc scripts.

## Exam-day checklist

- [ ] You can run `python3 code/main.py` from this lesson and narrate every printed line before it prints.
- [ ] You can state, from memory, which domain owns each of the six stages in `mcpa-09-capstone-flow`.
- [ ] You can explain the difference between a protocol-level error and a host-policy refusal without looking it up.
- [ ] You have re-read the exam facts in `certifications/mcpa/research/source-verification-ledger.md`: 90 minutes, online proctored, aligned to MCP `2026-07-28`.
