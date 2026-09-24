# Consent and Least Privilege

> A tool call that changes something in the world should not run just because a model decided to call it. It should run because a human said yes to that specific call, and the client should hold no more access than that call actually needs.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 24
**Time:** ~45 minutes

## Learning Objectives

- Explain why MCP has no server-to-client push for approvals, and how a multi round-trip request (MRTR) elicitation carries a consent question instead
- Distinguish per-tool consent scoping from a blanket "trust this server" grant, and explain why a tool's annotations inform that decision without being allowed to enforce it
- Read an HTTP 403 insufficient_scope challenge and compute the scope a client should request next, as the union of what it already held and what the challenge demands
- Apply a retry cap to a step-up authorization loop so a client with no path to the needed scope fails loudly instead of retrying forever
- Explain why a result like tools/list can vary by the caller's granted scopes without ever varying for the same caller on the same request twice

## The Problem

An agent with tool access can do things a person cannot easily undo: delete a file, send a payment, message a customer, revoke an account. The tool that does any of that runs on a server the client did not write, driven by a model choosing when to call it. Two designs both fail. Treat every call as pre-approved the moment a server connects, and a single careless or compromised server can act with the user's full authority, with no point where a human looks at what is about to happen. Treat every call, including the ones that only read data, as needing a fresh prompt, and the prompt becomes noise the user clicks through without reading, which is not consent, it is fatigue wearing the costume of consent.

Getting this right in MCP is harder than picking a policy, because the protocol gives you no shortcut to lean on. There is no session and no server-initiated push in the 2026-07-28 revision: a server cannot simply interrupt the client mid-call and ask a question the way an older, connection-oriented protocol might. And there is a second, easily confused gate sitting underneath the human one: even before anyone is asked to approve anything, the client's own access token has to carry enough OAuth scope for the operation at all. Consent answers "should this specific action happen." Scope answers "is this client even allowed to attempt actions like it." A lesson that only covers one of the two leaves half the Security and Governance domain untouched.

## The Concept

### Asking without a session: elicitation over MRTR

Tools are model-controlled: the model decides when to call one. The specification does not mandate a particular interaction model, but it is explicit that there should always be a human in the loop with the ability to deny a call, and that an application should show which tools are exposed, mark when one runs, and confirm sensitive operations before they happen. Because there is no server push, that confirmation travels through the same mechanism every server-needs-more-information case uses: a Multi Round-Trip Request. The server answers `tools/call` not with a result, but with `resultType: "input_required"`, an `inputRequests` map whose entries are `elicitation/create` requests, and (when the answer needs to come back to the same call) a `requestState` string. The client gathers the answer, and retries the exact same operation with a brand new JSON-RPC id, the answer under `inputResponses` keyed the same way the server named it, and `requestState` echoed back byte for byte.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "confirm": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Allow delete_file to run with arguments {\"path\": \"notes.txt\"}?",
          "requestedSchema": {
            "type": "object",
            "properties": {"approved": {"type": "boolean", "title": "Approve this call"}},
            "required": ["approved"]
          }
        }
      }
    },
    "requestState": "eyJ0b29sIjogImRlbGV0ZV9maWxlIn0.9f2c..."
  }
}
```

The user's answer comes back as one of three actions, never a bare yes or no: `accept` (with `content` matching the requested schema, for form mode), `decline` (the user explicitly said no), or `cancel` (the user walked away without deciding). All three block the call from running, but only `accept` is consent; a client that treats `cancel` as `decline`, or either as something to retry silently, is guessing at what the user meant. None of this is a protocol error. A server that refuses to run a tool because consent was withheld reports that the way it reports any business refusal: a normal `tools/call` result with `isError: true` and text the model can read, not a JSON-RPC error and never an invented code. Nothing in the 2026-07-28 error table has a slot for "consent required," and nothing should.

`requestState` deserves the same suspicion you would give any value that crosses the trust boundary and comes back later: it is attacker-controlled input the moment it leaves the server. If it is allowed to influence what runs, sign it (HMAC or AEAD is enough for most servers), bind it to the specific call it was issued for, and consume it once. A retry that presents a `requestState` from one call while asking to run a different set of arguments is not a legitimate retry, it is a request that changed after the human looked at it, and the server's own signature check, not the wire format, is what has to catch that.

### Scoping consent to one tool, not one server

Consent that a user grants has to be scoped to exactly the tool it was granted for. Approving `delete_file` does not approve `send_payment`, even on the same server, even in the same conversation, even moments later. A "trust this server" grant collapses the entire point of naming tools individually: it turns one specific, informed decision into a blanket one the user never actually made. This is where a tool's `annotations` earn their keep and immediately show their limit. `readOnlyHint`, `destructiveHint`, and `openWorldHint` are exactly the signal a client needs to decide when a prompt belongs: a call that only reads data can often proceed without one, and a call that writes, deletes, sends, or reaches into the open world usually should not. But annotations are hints a server sets about itself, and the specification is direct that a client must treat them as untrusted unless the server itself is trusted. A tool that lies about being read-only does not become safe because its `annotations` say so. Whatever policy a client builds on top of annotations, the actual enforcement, the record of which named tool a human actually approved, has to live in the client, not in whatever the server claims about its own tools. Note too what the defaults imply: `destructiveHint` and `openWorldHint` both default to true, `readOnlyHint` defaults to false. A tool that ships no annotations at all is treated as destructive and open-world by default, not as safe. The protocol is deliberately conservative when a server says nothing.

### Step-up authorization: a different gate, one level down

Before consent is even reached, a call can fail for a completely different reason: the token backing it does not carry enough scope. This is transport-level, governed by OAuth, and it answers a different question than consent does. When a request arrives with insufficient scope, the server responds `403 Forbidden` with a `WWW-Authenticate` header naming every scope the operation needs in one challenge, not one at a time across several round trips:

```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
                         scope="payments:write",
                         resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"
```

The client's response is to compute the union of the scopes it already held and the scopes in this challenge, never to replace one set with the other. A server that challenges per operation should never cost the client a scope it earned earlier. The client then re-authorizes for that unioned set and retries. This is not the same flow as choosing an initial scope: when a client is authorizing for the very first time and the initial `401` carried no `scope` parameter at all, it falls back to `scopes_supported` from the server's Protected Resource Metadata as the minimal starting set, rather than requesting everything the server has ever defined. Both rules exist for the same reason: request only what is needed, when it is needed, and step up in one clean jump instead of trickling out extra permission over many round trips. A step-up loop also needs a limit. A client should retry re-authorization only a small, bounded number of times; past that cap, it should treat the operation as a permanent authorization failure rather than looping against a scope it is never going to receive.

### Least privilege in what a server admits it has

Statelessness means `tools/list` must never change as a side effect of some other request, and it must return the same tools for the same caller under the same authorization every time. But it is explicitly allowed to differ between two different callers, because the scopes on the request are part of the input, not connection state. A server that only ever shows every tool to everyone, then rejects the ones a caller cannot use once they try to call one, is leaking the existence and shape of capabilities a caller was never meant to see, and training the model to attempt calls that will only fail. The least-privilege move is to filter `tools/list` by the scopes actually presented, and to mark that result `cacheScope: "private"` rather than `"public"`, since a cached public copy would leak one user's tool surface to another.

```figure
mcpa-25-consent-gates
```

## Interactive Lab

The figure follows one `tools/call` through both gates it can meet before it does anything. It first crosses the authorization boundary: if the token's scope is insufficient, the server bounces it with `403` and the required scope, the client unions that scope with what it already had, and tries again. Only once authorization clears does the call reach the consent gate: if the tool needs a human decision and none is on record for that exact tool, the server answers `input_required` instead of running anything, and the client resolves it through an `elicitation/create` round trip before retrying. Notice the two gates are independent and ordered: a fully authorized client can still be asked for consent, and a client with no consent problem at all can still be short on scope. A tool can sit behind either gate, both, or neither.

## Practice Lab

Open `code/main.py`. It builds one server with four tools: `list_files` (read-only, closed-world, runs immediately), `search_web` (read-only but open-world, and still gated on consent because openWorldHint is true), `delete_file` (destructive, gated on consent, backed by a small in-memory filesystem so you can see a decline leave a file untouched), and `send_payment` (destructive and gated on the `payments:write` scope, so it exercises both gates at once).

```bash
python3 code/main.py
```

Read the transcript against the walkthrough above. Find the `input_required` result for `delete_file`, the `decline` that leaves `notes.txt` in place, the fresh elicitation that follows (consent for a decline is not remembered), and the accepted retry that finally deletes it. Then find the deliberately wrong entry: a retry that echoes a valid `requestState` but asks to delete a different file than the one the user was shown. It is marked `violation` in the transcript because the server's signature check catches the mismatch instead of trusting the retry. Separately, watch `send_payment` get bounced with a scope challenge, watch the client compute the union of `payments:read` and the challenged `payments:write`, and only then reach its own, independent consent prompt. Finally, compare what `tools/list` returns with only `payments:read` against what it returns once `payments:write` is granted too.

## Shipped Artifact

`outputs/consent-design-checklist.md` is a one-page reference for reviewing a consent and authorization design: when to prompt, how to scope a grant, how to shape a step-up challenge, and the failure patterns worth rejecting on sight.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a read-only tool runs without any prompt, a destructive tool triggers an elicitation, a decline (and a cancel) leaves no side effect, consent for one tool never covers a different one, a tampered retry is rejected without burning the legitimate `requestState`, a consumed `requestState` cannot be replayed, step-up authorization computes the union of scopes and enforces a retry cap, and `tools/list` is filtered by the scopes actually granted. The repository's wire checker also validates this lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/25-consent-and-least-privilege
```

## Capstone Connection

Every side-effecting tool in the capstone system needs a consent decision scoped to its own name, never inherited from a sibling tool and never assumed from an annotation the server itself supplied. Every scope-gated tool needs a step-up path that unions rather than replaces, and a limit on how long it keeps trying. When the capstone asks you to defend what a caller can see and do, answer from both gates in this lesson: what a human explicitly approved, and what the token in hand actually authorizes, and be ready to say which one a given failure belongs to.

## Key Terms

| Term | Meaning |
|------|---------|
| Elicitation | An MRTR request from a server for user input, delivered as an `elicitation/create` entry inside `inputRequests` |
| requestState | An opaque, server-issued string that a retry must echo exactly; treated as untrusted input and, when it matters, signed and single-use |
| Per-tool consent scoping | An approval recorded against one named tool, never against a server, a category, or a naming pattern |
| Annotation hint | A server-declared property such as `destructiveHint` that informs a client's prompting policy but is never trusted as an enforcement guarantee |
| Step-up authorization | Re-authorizing for the union of previously held and newly challenged OAuth scopes after a `403 insufficient_scope` response |
| Scope union | The combination of a client's prior scopes and a challenge's required scopes, so re-authorization never drops an earlier grant |
| Least privilege in list results | A `tools/list` (or similar) result filtered to what the caller's current authorization permits, cached with `cacheScope: "private"` |

## Further Reading

- [Model Context Protocol specification 2026-07-28, Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), for the User Interaction Model and the two tool error channels
- [Model Context Protocol specification 2026-07-28, Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation), for form mode, URL mode, and the three response actions
- [Model Context Protocol specification 2026-07-28, Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), for the Scope Selection Strategy and the Step-Up Authorization Flow
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 7, 11, and 12
- `phases/13-tools-and-protocols/12-mcp-roots-and-elicitation`, for elicitation built up from first principles
