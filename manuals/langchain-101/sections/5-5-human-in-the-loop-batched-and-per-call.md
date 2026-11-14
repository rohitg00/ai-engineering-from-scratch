# Human in the loop: HumanInTheLoopMiddleware, batched and per call

> `HumanInTheLoopMiddleware` pauses tool calls for review, and `per_call` mode is the safe choice, because batched mode lets an edit switch tools and a jumping middleware skip review.

Your agent can send email and delete files, and a person must approve each of those calls before it runs. You add one middleware with a list of tool names. The reviewer edits one call to point at a different tool, and in one mode that tool runs. In the other mode the same edit raises an error.

When you finish this section, you can pause chosen tool calls for review and answer each pause with one of four decisions. You can also choose the settings that keep the review in force.

## Which calls pause

**HumanInTheLoopMiddleware:** the middleware that pauses an agent when the model asks for a tool in its `interrupt_on` map. It waits for a decision on each such call.

The `interrupt_on` map takes a tool name and `True`, which allows all four decisions, or a config with `allowed_decisions`. The kit gives `add` every decision and `lookup_order` two:

```listing
title: an agent with two tools under review, batched mode
source: capture/s_middleware.py
lang: python
---
    agent = create_agent(fake, tools=[add, lookup_order], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True, "lookup_order": {"allowed_decisions": ["approve", "reject"]}})], checkpointer=checkpointer)
```

A tool that is not in the map runs with no pause. The middleware pauses with `interrupt`, so the agent needs a checkpointer, as [section 5.4](#s-interrupt-and-resume) showed. The human-in-the-loop page names `AsyncPostgresSaver` for production {{docs oss/python/langchain/human-in-the-loop}}.

## The four decisions

**Decision:** the answer to one paused tool call. Its `type` is `approve`, `edit`, `reject`, or `respond`.

| Decision | The reviewer sends | Does the tool run | The ToolMessage the model gets |
|---|---|---|---|
| `approve` | `{"type": "approve"}` | yes, with the arguments of the model | the tool result, status `success` |
| `edit` | `edited_action` with a `name` and `args` | yes, with the edited arguments | a notice, then the tool result |
| `reject` | an optional `message` | no | the reason, status `error` |
| `respond` | a `message` | no | the message, status `success` |

`respond` is for a tool whose real answer comes from the person. The model reads its message as a successful result. The docs say not to use `respond` to refuse a tool with side effects {{docs oss/python/langchain/human-in-the-loop}}. The kit shows why: the model cannot tell the answer from a tool result. Use `reject` to refuse.

## Batched mode

**Batched mode:** the default `interrupt_mode`. One interrupt holds every paused call of one model message, and one resume answers all of them in order.

The fake model asked for `add` and `lookup_order` in one message. The run paused with one interrupt. Its value lists the calls and the decisions that each one allows:

```listing
title: one interrupt for two calls
source: capture/out/15-mw-hitl-batched.txt
lang: json
note: The descriptions and the arguments of lookup_order are cut.
---
interrupts:
[
  {
    "value": {
      "action_requests": [
        {
          "name": "add",
          "args": {
            "a": 2,
            "b": 3
          },
…
        {
          "name": "lookup_order",
…
      "review_configs": [
        {
          "action_name": "add",
          "allowed_decisions": [
            "approve",
            "edit",
            "reject",
            "respond"
          ]
        },
        {
          "action_name": "lookup_order",
          "allowed_decisions": [
            "approve",
            "reject"
          ]
        }
      ]
```

While the run waits, `next` is `HumanInTheLoopMiddleware.after_model`. The resume sends a list of decisions, one for each call, in the order of `action_requests`. The kit edited `add` to 20 and 30, and rejected `lookup_order`:

```listing
title: the resume for two calls in batched mode
source: capture/s_middleware.py
lang: python
---
    decisions = {"decisions": [
        {"type": "edit", "edited_action": {"name": "add", "args": {"a": 20, "b": 30}}},
        {"type": "reject", "message": "Do not look up orders."},
    ]}
    result = agent.invoke(Command(resume=decisions), cfg, version="v2")
```

The model got two `ToolMessage` objects. The rejected call came first. The edited call ran with the new arguments, and its result starts with a notice that tells the model what ran:

```listing
title: the two ToolMessages after the resume
source: capture/out/15-mw-hitl-batched.txt
lang: json
note: The names and the ids are cut.
---
    "type": "ToolMessage",
    "content": "User rejected the tool call for `lookup_order` with reason: Do not look up orders.",
…
    "tool_call_id": "call_b",
    "status": "error"
…
    "type": "ToolMessage",
    "content": "Note: a human reviewer replaced this tool call before it ran. The call recorded in your message is the one you produced, not the one that executed. This was intentional and authorized. Do not re-issue your original call. Executed instead: add with arguments {\"a\": 20, \"b\": 30}.\n\nTool response:\n50",
…
    "tool_call_id": "call_a",
    "status": "success"
```

The `AIMessage` in the state still holds the original call with 2 and 3. A list with one decision for two calls raised `ValueError: Number of human decisions (1) does not match number of hanging tool calls (2).`, and nothing ran.

## Per-call mode

**Per-call mode:** `interrupt_mode="per_call"`. Each paused call gets its own interrupt with a `response_schema`, and a resume answers any of them by interrupt id.

```listing
title: an agent in per-call mode
source: capture/s_middleware.py
lang: python
---
    agent = create_agent(fake, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True}, interrupt_mode="per_call")], checkpointer=InMemorySaver())
```

The fake asked for `add` twice. The run paused with two interrupts, and `next` was `["tools", "tools"]`. Each interrupt names one call:

```listing
title: the interrupt for the first call
source: capture/out/16-mw-hitl-per-call.txt
lang: json
note: The description is cut.
---
interrupt for call_a:
{
  "id": "<hex-1>",
  "value": {
    "type": "tool_approval",
    "tool_call_id": "call_a",
    "name": "add",
    "args": {
      "a": 2,
      "b": 3
    },
```

The `response_schema` of each interrupt allows the four decisions. In its `EditedAction`, the tool name is a constant, so an edit cannot name a different tool:

```listing
title: the edited action in the response schema
source: capture/out/16-mw-hitl-per-call.txt
lang: json
note: One definition from the schema of the first interrupt.
---
    "EditedAction": {
      "properties": {
        "name": {
          "const": "add",
          "title": "Name",
          "type": "string"
        },
```

The kit resumed with a map from each interrupt id to its decision: approve the first call, reject the second. The first `add` returned `5`, and the second got the reason with status `error`. An answer that the schema rejects raises, and the run keeps waiting. The kit allowed only `approve` on one tool and sent `reject`:

```listing
title: a decision outside the allowed decisions
source: capture/out/16-mw-hitl-per-call.txt
lang: text
note: The help line of pydantic is cut.
---
raised pydantic_core._pydantic_core.ValidationError: 1 validation error for ApproveDecision
type
  Input should be 'approve' [type=literal_error, input_value='reject', input_type=str]
```

After the error, `next` was still `["tools"]`. Per-call mode needs `langchain` 1.4.6 or later. The docs suggest it for new agents and plan to make it the default in the next major release {{docs oss/python/langchain/human-in-the-loop}}. [Figure 5.5](#fig-5-5) sets the two modes side by side.

```figure
id: fig-5-5
kind: comparison
title: batched mode and per-call mode
claim: Batched mode answers one list for all calls of a message, and per-call mode answers each call by its interrupt id against a schema.
caption: Read each row across the two columns. The rows are the pause, the resume, an edit to another tool, and a middleware that jumps to tools. Rose cells are where a review did not hold. From capture/out/15-mw-hitl-batched.txt, capture/out/16-mw-hitl-per-call.txt, and capture/lab/summary/approvals-mac.json.
```

## What the lab found

**We measured** the middleware on the Mac in 27 cases, 3 runs of each. The tools were `send_email` and `delete_file`, both under review, with a scripted fake model. Each start and each resume ran in a new process against `SqliteSaver`, so every resume was a restart. All 3 runs of each case gave the same tool runs, apart from the order of two calls in one step. [Figure 5.5b](#fig-5-5b) shows each run.

```figure
id: fig-5-5b
kind: chart
title: tool runs in each approval case
claim: Each case gave the same tool runs in 3 of 3 runs, and only batched cases ran a tool that no approval allowed.
caption: Read one column for each case. Each dot is one run on the Mac. A dot on the line is a run whose tools matched the decisions, and a rose dot ran a tool that no approval allowed. From capture/lab/summary/approvals-mac.json.
```

The cases have short codes. `B` is batched, `P` is per call, `J` adds a middleware that jumps to `tools`, and `G` is a plain graph.

| Case | What the reviewer did | Result, in 3 of 3 runs |
|---|---|---|
| B2, P2 | edit the arguments of `send_email` | only the edited call ran |
| B3 | edit `send_email` into a call of `delete_file` | `delete_file` ran |
| P3 | the same edit in per-call mode | `ValidationError`, nothing ran |
| B4, P4 | reject | nothing ran, status `error` |
| B5, P5 | respond | nothing ran, status `success` |
| P7 | answer two calls one at a time | each call ran once |
| P8 | a plain value for two waiting calls | `RuntimeError`, nothing ran |
| J1, J3 | batched, the jumping middleware after the review middleware in the list | `send_email` ran at the start, before any decision |
| J2 | batched, the jumping middleware first, reject | `send_email` ran, and the state held two ToolMessages for one call |
| J4, J5 | per call, either order, reject | nothing ran |
| G1, G2 | two parallel interrupts in a graph and a subgraph, answered one at a time | each branch ran its side effect once |

The B3 row settles conflict D102. One batched example in the docs edits a call to a new tool name, and the per-call text keeps the name. The changelog for 1.4.6 says that an edit cannot switch tools {{docs oss/python/releases/changelog}}. At the pin, batched mode still allows the switch, and per-call mode refuses it.

The J rows reproduce issue langchain#40492 in batched mode {{issue langchain#40492}}. The jumping middleware returns `jump_to="tools"` from `after_model`. `after_model` hooks run in the reverse order of the middleware list. So in J1 and J3 its hook ran before the review hook and skipped it.

In J2 the review ran, the call was rejected, and the jump still ran the tool. The two ToolMessages for the call `c1` in J2 break the rule of [section 2.4](#s-tools-toolruntime-and-tool-errors): one answer for each tool call. Per-call mode puts its pause in the tool call itself, and the jump did not skip it.

Two older issues did not reproduce. Issue langchain#33787 said that an edit could still run the original call {{issue langchain#33787}}. In B2 and P2 only the edited call ran. Issue langgraph#9106 said that a resume ran a finished parallel branch again {{issue langgraph#9106}}. In G1 and G2 the finished branch did not run again. The branch still waiting ran its node up to `interrupt` on each resume, which is the rule of section 5.4.

## The safe configuration

These settings kept every review in force in the lab runs:

1. Set `interrupt_mode="per_call"`, so an edit stays on its tool and a jump to `tools` does not skip the review.
2. Use a checkpointer that survives a restart, such as `SqliteSaver` or `PostgresSaver`.
3. Allow only the decisions you need for each tool. Leave out `respond` and `edit` for a tool with side effects, and refuse with `reject`.
4. Answer each interrupt by its id, and check `next` with `get_state` before you resume.
5. Put no middleware that jumps to `tools` in an agent with review, unless you test it in your mode.
6. List `HumanInTheLoopMiddleware` before tool retry and error middleware, as the docs say {{docs oss/python/langchain/human-in-the-loop}}.

The docs also warn about one invalid answer among several sent together. The tools of the valid answers can run while their interrupts still look pending, and a second answer runs them twice {{docs oss/python/langchain/human-in-the-loop}}. The lab did not run that case, or any case with `PostgresSaver`. Both come in the next edition, with the other open items of section 7.6.

```takeaways
- Set interrupt_mode="per_call" on every new agent with review.
- Refuse a call with reject, never with respond.
- Remove edit from allowed_decisions when a reviewer must not change the call.
- Answer each per-call interrupt by its id after you check get_state().next.
- Keep middleware that jumps to tools out of an agent with review.
- Use a checkpointer that survives a restart, because the reviewer can answer hours later.
```

Sources: capture/s_middleware.py, capture/out/15-mw-hitl-batched.txt, capture/out/16-mw-hitl-per-call.txt; capture/lab/summary/approvals-mac.json, capture/lab/T07-approvals-mac/01-cases.jsonl, capture/lab/T07-approvals-mac/01-cases.log; libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/human-in-the-loop, oss/python/releases/changelog); issues langchain-ai/langchain#40492, #33787, and langchain-ai/langgraph#9106, read 2026-11-14.
