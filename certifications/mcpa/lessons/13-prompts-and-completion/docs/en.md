# Prompt Templates and Argument Completion

> A prompt is a template the server writes and the user chooses to run. Nothing about it should surprise the person who picked it.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 12
**Time:** ~45 minutes

## Learning Objectives

- Explain why prompts are user-controlled, and how that differs from the model-controlled tools primitive and the application-driven resources primitive
- Read `prompts/list` and `prompts/get` requests and results, including arguments, pagination cursors, and cache hints
- Build `PromptMessage` content from text and resource links, and substitute caller-supplied arguments into a template
- Return `-32602` for an unknown prompt name, a missing required argument, and an unrecognized pagination cursor
- Use `completion/complete` with `ref/prompt` and `ref/resource` references, `context.arguments`, and the 100-value cap with `hasMore`

## The Problem

A host that lets a user type a slash command needs somewhere to keep the text those commands expand into. It could hardcode a handful of templates into the client, but then every new template needs a client release, and no two hosts agree on the same set. It could let the model invent the wording each time, but then a careful, reviewed prompt, the kind a team writes once and wants everyone to reuse the same way, drifts a little differently every time it runs.

MCP gives that text a home on the server, behind a primitive built for exactly this: content the user picks on purpose, with named arguments the host can turn into a form. The server that owns the domain (a code review policy, an incident runbook, a release announcement) owns the wording too, and every client that speaks MCP can list what is available, show it to the user, collect the arguments, and render the same template the same way. Typing usually happens through a menu or a slash command, but the protocol does not mandate a particular interface. What it fixes is the contract: the user decides when a prompt runs, and its content is data the server serves, not something a client bundles ahead of time.

A second, smaller problem sits next to the first: once a template has more than one argument, filling them in by hand is slow and error-prone. `completion/complete` solves that by letting the server suggest values as the user types, and by letting later suggestions take earlier answers into account.

## The Concept

Control model first, because it decides everything else about this primitive. Tools are model-controlled: the model decides when to call one. Resources are application-driven: the host decides which resource content enters context. Prompts are user-controlled: the user explicitly selects one, commonly through a menu the host renders as slash commands. The server still authors the prompt's wording, its arguments, and the messages it renders. Control means who decides when it runs, not who writes what it says.

A server that supports this primitive declares `prompts: {"listChanged": true}` in the `capabilities` object of its `server/discover` result and must then answer `prompts/list`. That result carries `resultType: "complete"`, a `prompts` array, and, because `prompts/list` is one of the six cacheable operations, an integer `ttlMs` and a `cacheScope` of `"public"` or `"private"`. Listing supports pagination: an opaque `cursor` in the request and an opaque `nextCursor` in the result when more pages remain. A cursor the server never issued is not a soft failure, it is `-32602` Invalid params, the same code that covers an invalid or missing prompt name.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Each entry in `prompts` names the prompt and lists its `arguments`, each with a `name`, a `description`, and a `required` flag. A client can build a form straight from that list before the user has typed anything. To resolve the template, the client sends `prompts/get` with `name` and an `arguments` map of strings. Two failure shapes exist, and the exam leans on the difference from the tools primitive: there is no `isError` channel here, because a prompt does not execute anything, it only renders text. An unknown prompt name and a missing required argument are both ordinary JSON-RPC errors, `-32602`, not a partial result the model is meant to patch up. The 2026-07-28 revision also lets `prompts/get` answer with an `InputRequiredResult` instead of a final result, the same multi round-trip shape that keeps a tools/call stateless while a server still needs one more answer before it can finish rendering; that mechanism gets its own lesson later in this track.

A successful `prompts/get` result carries `messages`, each one a `role` of `"user"` or `"assistant"` and one content block. A `text` block is the common case, with the argument values already substituted into the wording. A message can instead carry a `resource_link`, a `uri`, `name`, and `mimeType` that points at a resource without inlining its bytes, useful for a style guide or a runbook the review should cite but not duplicate. A message can also carry an embedded `resource` block, the resource's `uri`, `mimeType`, and either `text` or a base64 `blob`, directly in the message when the content is small enough to send inline. All three content types accept the same `audience` and `priority` annotations that resources use.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resultType": "complete",
    "description": "Code review request template",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Review this python snippet for style and correctness. Follow flask community conventions where they apply."
        }
      },
      {
        "role": "user",
        "content": {
          "type": "resource_link",
          "uri": "file:///styleguides/python.md",
          "name": "python-style-guide.md",
          "mimeType": "text/markdown"
        }
      }
    ]
  }
}
```

Filling in several arguments by hand is tedious, so a server that declares the `completions: {}` capability answers `completion/complete`. The request names what is being completed through a `ref`: `{"type": "ref/prompt", "name": "code_review"}` for a prompt argument, or `{"type": "ref/resource", "uri": "file:///src/{path}"}` for a resource template's variable. It carries the `argument` currently being typed, `{"name": ..., "value": ...}`, and an optional `context.arguments` map of names to values the user has already answered earlier in the same form. A completion result never lists more than 100 `values`; when the true match count is larger, it reports the full `total` and sets `hasMore` to true so the client knows the list was cut, not exhausted. Neither `prompts/get` nor `completion/complete` is one of the six cacheable operations, so their results carry no `ttlMs` or `cacheScope`, an easy exam trap: caching is a property of stable lists, not of a per-argument answer.

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "resultType": "complete",
    "completion": {
      "values": ["falcon", "fastapi"],
      "total": 2,
      "hasMore": false
    }
  }
}
```

The second argument being narrowed by the first is the whole point of `context.arguments`. Without it, a server can only guess from the prefix typed so far, and every candidate that matches the letters is fair game regardless of which language the user already picked. With `context.arguments` carrying `{"language": "python"}`, a server offering framework suggestions can drop the JavaScript and Java entries and return only the ones that actually apply. Completion candidates, like tool annotations, are suggestions, not access control. A client still validates whatever the user ultimately submits against the prompt's own rules.

Before 2026-07-28, list results such as `prompts/list` had no required caching fields at all; a dual-era client that receives a `prompts/list` result with neither `ttlMs` nor `cacheScope` should treat it as an uncached, single-use answer rather than assume a default freshness window.

```figure
mcpa-13-prompt-template
```

## Interactive Lab

The figure's left column follows one `prompts/get` call end to end: the template's `{language}` and `{framework}` placeholders, the arguments supplied for that call, and the rendered text that comes back. The right column runs `completion/complete` for the `framework` argument twice with the same typed prefix, once with no `context.arguments` and once after the client has told the server which language the user already picked. The candidate list shrinks between the two calls because the server can now rule out frameworks that do not belong to that language. Neither column shows a cache hint, because neither `prompts/get` nor `completion/complete` carries one.

## Practice Lab

Open `code/main.py`. It is a standard-library prompt server with two prompts, `code_review` and `bug_triage`, listed one per page so `prompts/list` demonstrates real pagination with a cursor and a `nextCursor`. A synthetic catalog of 144 source file paths backs a `ref/resource` completion so the 100-value cap and `hasMore` are not simulated, they come from an actual count that exceeds the limit.

```bash
python3 code/main.py
```

Read the printed exchanges against the concept section. Find the two `prompts/list` calls and notice how the second one, using the `nextCursor` from the first, returns the remaining prompt with no `nextCursor` of its own, meaning the list is exhausted. Find the third `prompts/list` call, which sends a cursor the server never issued and gets `-32602` back. Find the `prompts/get` call for `code_review`: its result has two messages, a `text` block with `python` and `flask` already substituted, and a `resource_link` pointing at a style guide the review should cite. Then find the two failure calls, a `prompts/get` with no arguments at all and one naming a prompt that does not exist, both `-32602`. Finally, compare the two `framework` completions: the first, with no `context`, returns three matches including one that belongs to JavaScript; the second, with `context.arguments` set to `{"language": "python"}`, returns only the two that belong to Python. The last two calls complete a `ref/resource` path argument, first with an empty prefix (100 of 144 possible paths, `hasMore` true) and then with the prefix `auth/` (18 of 18, `hasMore` false). Change the prefix or add a third prompt and rerun to see the pagination and completion respond.

## Shipped Artifact

`outputs/prompt-and-completion-reference.md` is a one-page reference for the prompts and completion surface: the request and result shapes, the content types a `PromptMessage` can carry, the error table, and the completion reference types with their caps. Keep it next to a server you are reviewing to check its `prompts/get` errors and its `completion/complete` cap and `hasMore` behavior at a glance.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that `prompts/list` paginates and carries cache hints, that an unrecognized cursor is rejected, that `prompts/get` substitutes arguments into a text block and attaches a resource link, that a missing required argument and an unknown prompt name both come back as `-32602`, that a completion result caps at 100 values and sets `hasMore` when more exist, that a narrower prefix drops back under the cap, that `context.arguments` measurably shrinks the candidate set, and that every request in the scenario carries its protocol metadata. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/13-prompts-and-completion
```

## Capstone Connection

The capstone's end-to-end exchange discovers a server, calls a tool, and walks through consent, but a realistic host also lets the user reach for a reviewed template instead of typing free text, and offers completions while they fill it in. When the capstone asks you to justify why a particular interaction used a prompt instead of a tool, answer from control: the user chose it on purpose, the server authored its wording, and nothing about rendering it changes state the way a tool call does.

## Key Terms

| Term | Meaning |
|------|---------|
| Prompt | A user-controlled, server-authored message template with named arguments |
| `prompts/list` | Cacheable, paginated request that returns the prompts currently visible to the caller |
| `prompts/get` | Request that renders one prompt's messages with arguments substituted in |
| `PromptMessage` | A `role` plus one content block: text, image, audio, resource link, or embedded resource |
| `resource_link` | A content block that points at a resource by URI instead of inlining its bytes |
| `completion/complete` | Request that returns ranked suggestions for one prompt or resource template argument |
| `ref/prompt` | A completion reference naming the prompt whose argument is being completed |
| `ref/resource` | A completion reference naming the resource URI or template being completed |
| `context.arguments` | Previously resolved argument values a client sends to narrow later completions |
| `hasMore` | Completion flag that is true whenever `total` exceeds the 100-value cap |

## Further Reading

- [MCP specification 2026-07-28: Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP specification 2026-07-28: Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10
- `phases/13-tools-and-protocols/10-mcp-resources-and-prompts`, for the resources and prompts primitives built out in depth
