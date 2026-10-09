# How to read this manual

> Every claim in this manual traces to a ranked source, and every request, response, and stream frame comes from a capture kit you can run yourself.

This manual explains the Agent2Agent protocol, A2A, at release 1.0.1, through one system: a planner that gives work to three agents it cannot see inside.

## Who this manual is for

You have built an agent that calls tools or a model API, and you know HTTP and JSON. Now you want to give work to an agent that another team owns.

After the last part, you can:

- Read an agent card and say what the agent offers, how to reach it, and what it requires.
- Predict which state a task is in at any point of a run, and what a client can do next.
- Choose between a blocking call, polling, streaming, and push notifications for a given job.
- Read any A2A request, response, or stream frame line by line, in either JSON binding.
- Name the errors a client must handle and the rules a server can break without noticing.

[The A2A lesson](phases/13-tools-and-protocols/19-a2a-protocol) predates version 1.0, so where the two differ, follow this manual.

## How it was made

The manual pins tag `v1.0.1` of the A2A repository, commit `3303592`. In requests and cards, that release is protocol version `1.0`, because "Patch version numbers SHOULD NOT be used in requests, responses and Agent Cards" {{spec §3.6}}. The facts were also checked against the main branch at commit `679ab3a` of 2026-10-05, where v1.0.1 was still the latest release.

Facts come from five sources, ranked by authority. When two of them disagree, the higher one wins and the text says so.

| Rank | Source | What the manual takes from it | Cited as |
|---|---|---|---|
| 1 | `specification/a2a.proto` at v1.0.1 | every object, field, enum value, and method | `proto` and a message or enum name |
| 2 | `docs/specification.md` at v1.0.1 | every behavior rule, quoted word for word | `spec` and a section number |
| 3 | the project's documentation pages at v1.0.1 | the project's own framing, flagged where a page is out of date | `docs` and a page name |
| 4 | the reference SDK, a2a-python 1.2.2 | what a production implementation does where the specification is silent | `sdk` and a source file |
| 5 | the capture kit in `capture/` | every request, response, and stream frame the manual shows | the capture file name |

The proto, the specification, and the documentation pages are vendored unchanged under `research/sources/`.

The specification disagrees with itself or the proto on [the HTTP verb for `SubscribeToTask`](#s-json-rpc) ([conflict D1](#s-ref-sources)) and on [whether a send waits](#s-send-message) ([conflict D2](#s-ref-sources)). It also disagrees on [when a stream closes](#s-input-required-and-auth-required) ([conflict D3](#s-ref-sources)) and on [the name of the card's security field](#s-security-schemes-and-in-task-authorization) ([conflict D6](#s-ref-sources)). [The sources reference](#s-ref-sources) lists all forty conflicts with the section that discusses each.

## The capture kit

The capture kit runs three remote agents and a recording client on your machine, with the Python standard library only and no network or keys.

| Agent | Port | What it does | What its runs show |
|---|---|---|---|
| `test-runner` | 41241 | runs a test suite and streams the log | streaming, artifacts in chunks, polling, cancel, push notifications, both JSON bindings |
| `code-reviewer` | 41242 | reviews a diff against a base branch | direct message replies, `TASK_STATE_INPUT_REQUIRED`, rejected content types, no push support |
| `deployer` | 41243 | deploys a build to staging after an operator approves | bearer authentication, `TASK_STATE_AUTH_REQUIRED` with approval outside A2A, rejection, extended and signed cards |

[A client](#s-a-client) walks through the real planner, `capture/planner.py`.

Seeded ids and a fixed clock make two runs byte-identical. [The kit README](manuals/a2a-101/capture/README.md) lists where the kit differs from the reference SDK.

## Conventions

Citations name a place: {{spec §3.7}} a section of the specification, {{proto TaskState}} a message or enum in the proto, {{docs life-of-a-task}} a documentation page, and {{sdk src/a2a/server/tasks/task_manager.py}} a file in the SDK.

A listing copies lines from a capture file unchanged, and a `…` marks a cut that the note explains.

Field names and enum values are set in code type as they travel, such as `messageId`. Figures shorten task and context ids to 8 characters, so `728ba084-97eb-422b-b94b-b0fe9153ce2c` appears as `728ba084`.

Figures animate on the web, where a Replay button runs the steps again, and print and reduced motion show the final frame.

## A first run

The kit needs Python 3 and four free ports on `127.0.0.1`: 41241 to 41243 for the agents and 41250 for the webhook receiver. From the repository root, run it and check it:

```bash
cd manuals/a2a-101
python3 capture/run.py
python3 capture/run.py --check
```

Open `capture/out/02-message-reply.http` first: a question to `code-reviewer` and a direct answer, with no task. Then open `capture/out/05-streaming.http`, where a request to `test-runner` opens a stream of nine `data:` lines:

```listing
title: the start of a stream
source: capture/out/05-streaming.http
lang: http
note: The request body and the rest of the first frame are cut. Frames 2 to 9 follow it in the file.
---
POST /a2a/jsonrpc HTTP/1.1
Host: localhost:41241
Content-Type: application/json
A2A-Version: 1.0
Accept: text/event-stream
…
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc": "2.0", "id": 1, "result": {"task": {"id": "728ba084-97eb-422b-b94b-b0fe9153ce2c", … "state": "TASK_STATE_SUBMITTED", …
```

The first frame is the `task` itself, and [one task, request by request](#s-one-task-request-by-request) reads all nine.

## How the parts are ordered

Part 1 gives you the whole protocol. Parts 2 to 6 each take one layer, from the AgentCard to security and extensions, and Part 7 builds a client and a server:

```parts
```

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure](#fig-reading-a-sequence) teaches seven of the eight arrow styles. It leaves out solid plum, because A2A never carries a model call.

```figure
id: fig-reading-a-sequence
kind: sequence
title: reading a sequence figure in this manual
claim: Each of the seven arrow styles marks one kind of exchange, and the label on each arrow is a real name from a run of the kit.
caption: Read each numbered row from the tail of the arrow to its head. The note under a label gives the style and its meaning. The rows come from 03-blocking-task.http, 05-streaming.http, 15-push.http, 19-planner.log, and 11-errors.http, and the task store is the kit's own store inside test-runner.
```

Sources: spec §3.6, §3.7 (research/sources/specification.md); proto TaskState (research/sources/a2a.proto); docs life-of-a-task (research/sources/docs.md); sdk src/a2a/server/tasks/task_manager.py; manual.json; research/sources/README.md; research/brief-spec.md §12.2; research/brief-docs.md; research/sources/specification-main.md (main at 679ab3a); capture/README.md, capture/run.py, capture/agents.py, capture/a2a_ref.py, capture/planner.py; capture/out/02-message-reply.http, 03-blocking-task.http, 05-streaming.http, 11-errors.http, 15-push.http, 19-planner.log
