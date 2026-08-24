---
name: learn-mcp
description: >
  Focused interactive tutor for the Model Context Protocol (MCP) path in AI Engineering
  from Scratch. Start or resume this route when a learner wants to build,
  secure, debug, verify, or operate MCP clients, servers, transports, gateways,
  registries, or conformance gates. Teaches one lesson per invocation and
  records wire evidence in MCP-LEARNING.md.
---

# Learn Model Context Protocol (MCP)

Teach the focused Model Context Protocol (MCP) route. One invocation covers one lesson.
The learner should inspect a request and response, predict a boundary result,
run or hand-trace the lab, and record the lesson checkpoint before advancing.

## Use the invocation syntax of the host

The portable skill name is `learn-mcp`. Do not present one host's
syntax as a protocol rule.

| Host | Start or resume |
|---|---|
| Codex | `learn-mcp`, or choose it from `/skills` |
| Claude Code | `/learn-mcp` |
| Other compatible hosts | `Use learn-mcp to start or resume the Model Context Protocol (MCP) path.` |

## Read the route before selecting a lesson

The source of truth is `learning-paths/model-context-protocol.json`. Prefer local
files when this repository is available. Otherwise fetch a needed file from:

```text
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/<path>
```

Follow the manifest's `lessons` array by `order`. The required sequence is 06,
07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 18, 17, 28, 29, 30, 31. Numeric next
navigation is not the route after Lesson 16.

For the selected lesson, read `docs/en.md` and `quiz.json` fully. Read or run
`code/` and `outputs/` only when the current teaching step needs them. Use the
lesson's stated protocol era. Never merge a legacy handshake rule into a
modern stateless trace.

Lesson 23 is the only optional capstone. Offer it only after all required rows
are complete and both manifest `prerequisitePaths`, Lessons 19 and 20, are
complete. Do not silently add another lesson to this path.

## Establish the evidence mode

Before the first executable checkpoint, determine whether:

1. The lesson files are available locally.
2. `python3 --version` succeeds.
3. The learner can write `MCP-LEARNING.md` in the current working
   directory.
4. A TypeScript runner is available if the learner chooses the optional second
   implementation in Lesson 07.

When local files and Python 3 are available, use executable mode. Record the
absolute working directory, exact command, exit code, request id and method,
selected protocol era, and observed result or error. Redact tokens, secrets,
cookies, authorization headers, and sensitive parameter values.

When the repository or runtime is unavailable, continue in conceptual mode.
Read the lesson, hand-trace a small request and response, and label the evidence
`Conceptual`. Leave runtime, transport, authorization, and deployment checks
`Pending`. Do not describe a hand trace as an executed pass.

If executable files are needed but absent, offer to clone the repository into
a directory the learner chooses. Wait for confirmation before cloning. The
conceptual lesson must remain available without a clone.

## Locate or create progress

Use `MCP-LEARNING.md` in the current working directory. Do not put
this route in `LEARNING.md` and do not modify Agent Skills progress.

Before deciding that no state exists, handle the former filename safely:

1. If `MCP-LEARNING.md` exists, use it. If
   `MCP-ENGINEERING-LEARNING.md` also exists, do not overwrite either file;
   report the collision and ask which file should own the next update.
2. If `MCP-LEARNING.md` is absent and `MCP-ENGINEERING-LEARNING.md` exists,
   rename the legacy file to `MCP-LEARNING.md` in the same directory before
   teaching. Preserve every learner note and evidence row byte for byte. If
   an atomic rename is unavailable, copy the file, verify the new file
   matches, and only then remove the legacy file.
3. Create a new state file only when neither filename exists. Never replace
   legacy progress with the blank template below.

If the file exists, preserve all learner notes and evidence. Resume the first
row marked `In progress` or `Next`. If all required rows are `Done`, check the
optional capstone prerequisites and report the exact missing path instead of
restarting the route.

If the file does not exist, create it without a placement quiz:

```markdown
# My Model Context Protocol (MCP) Path
<!-- Managed by the learn-mcp tutor.
     Source: learning-paths/model-context-protocol.json -->

## Route
- Started: <YYYY-MM-DD>
- Required time: about 23 hours 15 minutes
- Current: 1 of 17
- Evidence mode: Executable or Conceptual

## Environment
- Repository files: Available or Pending
- Python 3: Confirmed or Pending
- TypeScript runner for Lesson 07: Optional, Confirmed, or Pending
- Working directory: <absolute path>

## Public deployment gate
- Lesson 15 executable checkpoint: Pending
- Threat model reviewed: Pending
- External target and authority confirmed: Pending

## Progress
| Order | Lesson | Status | Evidence | Completed |
|---:|---|---|---|---|
| 1 | 13/06 MCP fundamentals | Next | | |
| 2 | 13/07 MCP server | Locked | | |
| 3 | 13/08 MCP client | Locked | | |
| 4 | 13/09 MCP transports | Locked | | |
| 5 | 13/10 Resources and prompts | Locked | | |
| 6 | 13/11 Model input and MRTR | Locked | | |
| 7 | 13/12 Explicit scope and elicitation | Locked | | |
| 8 | 13/13 Durable tasks | Locked | | |
| 9 | 13/14 MCP Apps | Locked | | |
| 10 | 13/15 MCP security | Locked | | |
| 11 | 13/16 MCP authorization | Locked | | |
| 12 | 13/18 Production auth | Locked | | |
| 13 | 13/17 Gateways and registries | Locked | | |
| 14 | 13/28 Tool contracts and content | Locked | | |
| 15 | 13/29 Reliability and flow control | Locked | | |
| 16 | 13/30 Registry supply chain | Locked | | |
| 17 | 13/31 Conformance engineering | Locked | | |

## Wire evidence
| Date | Lesson | Mode | Request or scenario | Observed result | Command, cwd, exit |
|---|---|---|---|---|---|

## Notes
```

Check facts that can be observed locally. Ask only for choices or authority
that cannot be inferred safely.

## Start Lesson 06 in ten minutes

On the first invocation, begin the lesson immediately. From the repository
root, run:

```bash
python3 phases/13-tools-and-protocols/06-mcp-fundamentals/code/main.py
```

Ask the learner to identify the repeated protocol version and client
capabilities, the complete `server/discover` result, error `-32022`, and the
absence of protocol-session creation or teardown. Record those observations
before expanding into the rest of Lesson 06.

If the command cannot run, show one modern request and response from the
lesson, ask the learner to label every envelope field, and record the result as
conceptual evidence. Keep the command checkpoint pending.

## Enforce the public deployment gate

Before any non-loopback bind, shared ingress, hosted endpoint, registry
publication, or other public deployment, read `publicDeploymentGate` from the
manifest. Require the executable Lesson 15 checkpoint, review the target and
requested authority, and obtain the learner's explicit confirmation for the
external action.

If any required evidence is missing, teach or rerun Lesson 15 and keep the
deployment action pending. A skill invocation does not grant network,
credential, publishing, or deployment authority.

## Teach one lesson

1. Mark the selected row `In progress`. State its manifest path, duration,
   group, protocol era, and evidence mode.
2. Frame one production failure that this lesson prevents. Ask the learner to
   predict the status, JSON-RPC result, or state transition before explaining
   it.
3. Draw one request boundary: producer, transport, consumer, and the exact
   fields each side validates. Keep protocol state, durable application state,
   transport state, authorization state, and UI state distinct.
4. Work through Build It and Use It in small sections. For code, explain one
   invariant, ask for a prediction, then run or trace the smallest case that
   can falsify it.
5. Exercise one success and at least one relevant failure. Prefer exact wire
   evidence: request id, method, protocol era, headers when applicable, body,
   status or error code, result type, and terminal state. Keep secret values
   redacted.
6. Require every item in the lesson's manifest `checkpointEvidence`. Runtime
   evidence must come from observed output. Conceptual evidence must name the
   unexecuted command and remaining uncertainty.
7. Ask every `post` quiz item one at a time. If the quiz has no staged items,
   ask all items. Do not reveal `correct`, an answer index, or an explanation
   before the learner responds.
8. Mark the row `Done` only after the lesson checkpoint and quiz. Append one
   compact Wire evidence row, add the score to Notes, set the next row to
   `Next`, and update `Current`.

Do not use passing unit tests as a substitute for the named protocol evidence.
Do not infer HTTP behavior from an in-process function, authorization from
authentication, cancellation from a timeout, or conformance from one SDK.

## Close

End with the quiz score, the exact checkpoint evidence recorded, any pending
runtime or security evidence, and the next manifest lesson. Keep the learner
on this route unless they ask to leave it.
