# AgentCard fields

> An `AgentCard` has 14 fields, eight of them REQUIRED, and together they say what an agent offers, where to reach it, and what it demands.

The planner is about to delegate its first test run to `test-runner`, an agent it knows only as `localhost:41241`. Its first request is a `GET` for one JSON document.

When you finish this section, you can read any agent card field by field and say which fields a valid card must carry.

## The card and its REQUIRED fields

**Agent card:** "A JSON metadata document published by an A2A Server, describing its identity, capabilities, skills, service endpoint, and authentication requirements." {{spec §2.2}} Every server publishes one: "A2A Servers MUST make an Agent Card available." {{spec §8.1}}

The proto message `AgentCard` has 14 fields, and eight of them are REQUIRED: `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, and `skills` {{proto AgentCard}}. A REQUIRED field "MUST be present and set in valid messages" {{spec §5.7}}.

Four of those fields are lists, and "Arrays marked as required MUST contain at least one element" {{spec §5.7}}. The signing example in §8.4.1 keeps an empty `skills` list all the same {{spec §8.4.1}} ([conflict D19](#s-ref-sources), open as [issue #2122](https://github.com/a2aproject/A2A/issues/2122)), and real cards follow §5.7.

[Figure](#fig-agent-card-fields) sorts the whole `test-runner` card into four groups: who it is, where to reach it, what it demands, and what it offers. Of the identity fields, `version` is the agent's own release, and [extended cards and signatures](#s-extended-cards-and-signatures) covers `signatures`.

```figure
id: fig-agent-card-fields
kind: structure
title: the test-runner agent card, field by field
claim: One `GET` returns what a client needs before its first message: who the agent is, where to reach it, what it demands, and what it offers.
caption: Each row is one field of the card, grouped by the question it answers. A dot marks a field the proto makes REQUIRED, and dashed rows are optional fields this card leaves out. From capture/out/01-agent-cards.http.
```

## What it offers: skills and modes

**Skill:** one entry in `skills`, a unit of work the agent says it can do. Each skill needs an `id`, a `name`, a `description`, and at least one entry in `tags` {{spec §5.7}}. The optional `examples` hold sample prompts, and a skill can carry its own modes and `securityRequirements` {{proto AgentSkill}}.

```listing
title: the one skill on the test-runner card
source: capture/out/01-agent-cards.http
lang: json
note: The skills array of the first card in the file, complete.
---
  "skills": [
    {
      "id": "run-tests",
      "name": "Run tests",
      "description": "Run the test suite of a repository at one commit and report each failure with its log.",
      "tags": [
        "ci",
        "tests"
      ],
      "examples": [
        "Run the unit tests for payments-api at commit 9f3c2e1"
      ]
    }
  ]
```

No field of `SendMessageRequest` or `Message` names a skill {{proto SendMessageRequest}}, and the proto calls the list "largely a descriptive concept" {{proto AgentCard}}.

**Mode:** a media type that names content an agent accepts or produces, such as `text/plain` {{proto AgentCard}}. The REQUIRED lists `defaultInputModes` and `defaultOutputModes` apply across all skills, and a skill overrides them with its own `inputModes` and `outputModes`. The `code-reviewer` card narrows the input of its `review-diff` skill to `text/x-diff` and `text/plain`.

## Where to reach it: supportedInterfaces

**Interface:** one entry in `supportedInterfaces`, a URL with the binding and the protocol version spoken there. Its fields `url`, `protocolBinding`, and `protocolVersion` are REQUIRED, and `tenant` is optional {{proto AgentInterface}}. The order matters: "Ordered list of supported interfaces. The first entry is preferred." {{proto AgentCard}}

```listing
title: the two interfaces of test-runner, JSON-RPC first
source: capture/out/01-agent-cards.http
lang: json
note: The supportedInterfaces array of the first card in the file, complete.
---
  "supportedInterfaces": [
    {
      "url": "http://localhost:41241/a2a/jsonrpc",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    },
    {
      "url": "http://localhost:41241/a2a/rest",
      "protocolBinding": "HTTP+JSON",
      "protocolVersion": "1.0"
    }
  ],
```

The proto names three standard bindings: `JSONRPC`, `GRPC`, and `HTTP+JSON` {{proto AgentInterface}}. The field `protocolVersion` is the A2A version spoken at that URL, as `Major.Minor` {{spec §3.6}}, and [the version and extension headers](#s-version-and-extension-headers) cover the matching `A2A-Version` header.

Each URL "Must be a valid absolute HTTPS URL in production" {{proto AgentInterface}}, and the kit uses `http://localhost` on one machine. The spec does not say which form a `GRPC` entry takes, and the reference SDK's sample writes a plain host and port {{sdk samples/hello_world_agent.py}} ([conflict D34](#s-ref-sources)).

## What it demands: capabilities and security

**Capability:** a flag in the REQUIRED `capabilities` object that switches on an optional part of the protocol: `streaming`, `pushNotifications`, or `extendedAgentCard` {{proto AgentCapabilities}}. An absent flag counts the same as `false` {{spec §3.3.4}}, and [discovery](#s-discovery-and-supported-interfaces) lists the operations that each flag allows. The same object lists `extensions` by `uri`, and [extensions](#s-extensions) covers that list.

The optional `securitySchemes` and `securityRequirements` say which credentials a call needs {{proto AgentCard}}. The `test-runner` card sets neither, and [security schemes](#s-security-schemes-and-in-task-authorization) reads the bearer scheme on the `deployer` card.

In 1.0, five top-level fields of the 0.3 card moved into `supportedInterfaces` and `capabilities` {{docs whats-new-v1}}, and [from 0.3 to 1.0](#s-from-0-3-to-1-0) maps each one. The migration steps in §A.2.1 still use a card field `protocolVersions` {{spec §A.2.1}}, which the 1.0 proto lacks ([conflict D8](#s-ref-sources)). [PR #2165](https://github.com/a2aproject/A2A/pull/2165) fixed that on main after v1.0.1, not yet released. The sample card in §8.5 still uses `security` where the proto has `securityRequirements` {{spec §8.5}} {{proto AgentCard}} ([conflict D6](#s-ref-sources)). [PR #2046](https://github.com/a2aproject/A2A/pull/2046) fixed that sample on main, not yet released.

```takeaways
- Take the preferred endpoint from the first entry of `supportedInterfaces`, never from a top-level `url`.
- Reject a card that lacks a REQUIRED field or leaves a REQUIRED list empty.
- Pick an agent by its skills and modes.
```

Sources: spec §2.2, §3.3.4, §3.6, §5.7, §8.1, §8.4.1, §8.5, §A.2.1 (research/sources/specification.md); proto AgentCard, AgentProvider, AgentSkill, AgentInterface, AgentCapabilities, SendMessageRequest (research/sources/a2a.proto); docs/whats-new-v1.md at v1.0.1; sdk samples/hello_world_agent.py; capture/out/01-agent-cards.http
