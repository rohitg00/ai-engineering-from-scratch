# Part

> Every piece of content in A2A is a `Part` that holds exactly one of `text`, `raw`, `url`, or `data`, and its `mediaType` says how to read it.

Your planner asks `code-reviewer` to review a diff. The request carries an instruction and the diff as a file, and the answer carries findings that the planner's own code will parse. A2A carries all three in one container shape, the part, and labels each one with a media type.

When you finish this section, you can build all four kinds of part and predict whether an agent will accept them.

## One container, four contents

**Part:** "The smallest unit of content within a Message or Artifact" {{spec §2.2}}. In the proto, `Part` declares its content as a `oneof` with four members {{proto Part}}:

- `text` holds a string.
- `raw` holds the bytes of a file. "In JSON serialization, this is encoded as a base64 string." {{proto Part}}
- `url` holds "A `url` pointing to the file's content" {{proto Part}}.
- `data` holds "Arbitrary structured `data` as a JSON value (object, array, string, number, boolean, or null)" {{proto Part}}.

Beside the content sit three optional fields, `mediaType`, `filename`, and `metadata`, and `mediaType` "is available for all part types" {{proto Part}}. The kit's review request sends two kinds in one message:

```listing
title: one message, two kinds of part
source: capture/out/06-input-required.http
lang: json
note: The parts array of the planner's first message to code-reviewer. The base64 value of raw is cut after 36 of its 236 characters.
---
      "parts": [
        {
          "text": "Review this diff of payments-api."
        },
        {
          "raw": "LS0tIGEvcGF5bWVudHMvcmVmdW5kcy5weQor…",
          "filename": "refunds.diff",
          "mediaType": "text/x-diff"
        }
      ]
```

Base64 costs size: the 175-byte diff of `payments/refunds.py` becomes 236 characters in the JSON body. A `url` part keeps the message small and leaves the download, with its risk, to the receiver.

## No kind, no nesting

In version 0.3, a part named its type in a `kind` field and wrapped a file in a nested `file` object. Version 1.0 removed both, and "The `kind` field is no longer part of the protocol and should not be emitted" {{spec §A.2.1}}.

A file part is flat: `raw` or `url` sits next to `filename` and `mediaType`. The specification's own file-part sample has that shape but is not valid JSON {{spec §6.7}} ([conflict D24](#s-ref-sources)). Copy part shapes from the proto, never from the samples.

Read a part by testing which content member is present, and never send two of them. The reference SDK refuses a part with two members as invalid parameters, `-32602`, before any agent code runs {{sdk src/a2a/server/routes/jsonrpc_dispatcher.py}}. It ignores a stray `kind`, as the specification asks: "Implementations SHOULD ignore unrecognized fields in messages" {{spec §5.7}}.

```figure
id: fig-four-parts
kind: structure
title: four kinds of part from the kit
claim: The kit's captures use all four kinds of part, and only the `image/png` part fails, because `code-reviewer` does not accept that media type.
caption: The top row is the shape of every part. Each row below is one captured part, in the order the captures sent them. Its content member is on the left, its media type in green, and its sender underneath. The review.json artifact holds a text part for a person and a data part for code. From capture/out/06-input-required.http and capture/out/11-errors.http.
```

## Who declares media types

Media types are declared in four places, and a skill's modes override the card's defaults {{proto AgentSkill}}:

| Field | Lives in | Set by | `code-reviewer` in the kit |
|---|---|---|---|
| `defaultInputModes` | the agent card | the agent | `text/plain`, `text/x-diff` |
| `defaultOutputModes` | the agent card | the agent | `text/plain`, `application/json` |
| `inputModes`, `outputModes` | each skill on the card | the agent | `review-diff` takes `text/x-diff` and `text/plain` |
| `acceptedOutputModes` | `configuration` of a send | the client | not sent anywhere in the kit |
| `mediaType` | each part | whoever sends the part | `text/x-diff` on `refunds.diff` |

The client's one field is `acceptedOutputModes`, and the rule on the agent is a SHOULD: "Agents SHOULD use this to tailor their output" {{proto SendMessageConfiguration}}. The SDK's request handler never reads the field {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}, so check the `mediaType` of every part you receive.

## When the media type does not fit

**ContentTypeNotSupportedError:** "A Media Type provided in the request's message parts or implied for an artifact is not supported by the agent or the specific skill being invoked" {{spec §3.3.2}}. Its JSON-RPC code is `-32005` {{spec §5.4}}, and [errors](#s-errors) gives its other forms.

In the kit, the planner sends `code-reviewer` a screenshot as a `url` part labelled `image/png`, and the agent refuses before it creates a task:

```listing
title: a media type the agent does not accept
source: capture/out/11-errors.http
lang: json
note: Exchange 5, cut to the part that was sent and the error that came back inside an HTTP 200 response.
---
      "parts": [
        {
          "url": "https://example.com/screenshot.png",
          "mediaType": "image/png"
        }
      ]
…
  "error": {
    "code": -32005,
    "message": "Content type not supported",
    "data": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "CONTENT_TYPE_NOT_SUPPORTED",
        "domain": "a2a-protocol.org",
        "metadata": {
          "mediaType": "image/png"
        }
```

Servers check differently, because the specification gives an unlabelled part no default type. The SDK checks only when the server turns the check on, and then it skips every part with no `mediaType` {{sdk src/a2a/utils/input_mode_validator.py}}. The kit gives such a part a default type and checks it against the card's `defaultInputModes`, as [the kit README](manuals/a2a-101/capture/README.md) lists. The same unlabelled part can pass one server and fail the other.

The security rules ask agents to "reject unexpected media types" {{spec §13.4}}, and a `url` part must be checked against server-side request forgery {{spec §14.1.1}}, as [security requirements](#s-security-requirements) explains.

```takeaways
- Read a part by the content member it holds, and never send two members or a `kind` field.
- Set `mediaType` on every part, using only media types that the card or the skill lists.
- Put content that code will parse in a `data` part.
- Treat `-32005` as a statement about content: change the part or pick another agent.
```

Sources: spec §2.2, §3.3.2, §5.4, §5.7, §6.7, §13.4, §14.1.1, §A.2.1 (research/sources/specification.md); proto Part, AgentCard, AgentSkill, SendMessageConfiguration (research/sources/a2a.proto); sdk src/a2a/server/routes/jsonrpc_dispatcher.py, src/a2a/server/request_handlers/default_request_handler_v2.py, src/a2a/utils/input_mode_validator.py at a2a-python 1.2.2; capture/out/01-agent-cards.http, 06-input-required.http, 11-errors.http; capture/a2a_ref.py, capture/README.md
