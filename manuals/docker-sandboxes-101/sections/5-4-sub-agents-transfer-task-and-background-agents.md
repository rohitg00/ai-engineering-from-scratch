# sub_agents, transfer_task, and background_agents

> `transfer_task` runs a sub-agent in a clean sub-session and returns its answer, `handoff` moves the whole session to another agent, and background agents need approval to start.

You want a coordinator that asks a writer for one sentence and then lets a reviewer answer the user. One agent file can say both things: a delegation that comes back, and a move that does not.

When you finish this section, you can choose between `sub_agents`, `handoffs`, and `background_agents`, and read each one in an event stream.

## The team file

```listing
title: a coordinator, a writer, and a reviewer
source: capture/fixtures/agents/team.yaml
lang: yaml
note: The writer and reviewer instructions and the models block are cut.
---
version: "16"

agents:
  root:
    model: local
    description: Coordinates a writer and a reviewer.
    instruction: |
      You coordinate two colleagues and never write text yourself.
      For every request: first call transfer_task to ask the writer for
      the text, then call handoff to pass the conversation to the reviewer.
    max_iterations: 6
    sub_agents: [writer]
    handoffs: [reviewer]
    toolsets:
      - type: background_agents

  writer:
    model: local
    description: Writes one sentence on a given topic.
…
    max_iterations: 3

  reviewer:
    model: local
    description: Reviews the sentence it receives.
…
```

All three agents use the model `local`, which is `dmr/ai/qwen3:4b`. Neither `transfer_task` nor `handoff` appears under `toolsets`, because the two lists inject them ([conflict C56](#s-ref-sources-and-the-conflicts-register)).

## transfer_task: a child in a sub-session

**Delegation:** a call of `transfer_task` with `agent`, `task`, and `expected_output`, which `sub_agents` adds to the parent. "The call blocks until the sub-agent returns its result, which becomes the tool's response" {{docs-agent Transfer Task Tool}}.

```listing
title: one delegation and one session move, as events
source: capture/out/19-transcript.txt
lang: text
note: The sub_session_completed line is cut after the task, and the long tool response of the session move is cut after its first sentence.
---
user: Ask the writer for one sentence about microVMs.
root -> tool_call transfer_task {"agent": "writer", "task": "Generate one sentence about microVMs", "expected_output": "A single sentence describing microVMs"}
agent_switching: {"agent_name": "writer", "switching": true, "from_agent": "root", "to_agent": "writer"}
writer: MicroVMs are lightweight virtual machines that provide strong isolation and security for applications with minimal resource overhead.
stream_stopped (stop, normal)
sub_session_completed: {"agent_name": "root", "parent_session_id": "<uuid>", "sub_session": {"id": "<uuid>", "origin": "run", "title": "Transferred task", "messages": [{"message": {"agent_name": "", "message": {"role": "system", "content": "You are a member of a team of agents. Your goal is to complete the following task:\n\n<task>\nGenerate one sentence about microVMs\n</task>…
agent_switching: {"agent_name": "root", "switching": false, "from_agent": "writer", "to_agent": "root"}
root <- tool_call_response Transfer Task: MicroVMs are lightweight virtual machines that provide strong isolation and security for applications with minimal resource overhead.
root -> tool_call handoff {"agent": "reviewer"}
root <- tool_call_response Handoff Conversation: The agent root handed off the conversation to you. …
reviewer: APPROVED: MicroVMs are lightweight virtual machines that provide strong isolation and security for applications with minimal resource overhead.
stream_stopped (stop, normal)
user: Now hand the conversation to the reviewer.
reviewer: APPROVED: MicroVMs are lightweight virtual machines that provide strong isolation and security for applications with minimal resource overhead.
stream_stopped (stop, normal)
```

The writer never saw the user's message. Its sub-session starts with a system message that holds `<task>` and `<expected_output>`. An implicit user message follows, "Please proceed." The sub-session ran under the writer's own `max_iterations: 3`, with `"tools_approved": false`. Then `agent_switching` returned control to `root`, and the sentence came back as the tool response.

"Unlike other tools, `transfer_task` is always auto-approved" {{docs-agent Multi-Agent Systems}}, and the capture agrees: the call raised no confirmation under `--exec`. A delegation to an agent already in the chain fails, and the depth is capped at 10 nested delegations {{docs-agent Transfer Task Tool}}. A `sub_agents` entry can also be a registry reference. Its tag is resolved again on every run unless you pin it to a digest {{schema AgentConfig}}.

## The session move

**Session move:** a call of `handoff` with one argument, `agent`, which `handoffs` adds. The named agent "becomes the active agent and sees the full conversation history" {{docs-agent Multi-Agent Systems}}. In the capture, `root` called it in its next model turn, after the sentence came back. The tool response told `reviewer` which tools and agents it can use, and `reviewer` answered the user.

The second message shows the move. It went straight to `reviewer`, and the transcript has no `root` line after the move. `force_handoff` makes the same move on every final response without a tool call {{schema AgentConfig}}.

## background_agents

**Background agent:** a sub-agent task that `run_background_agent` starts, which returns a task id at once. `list_background_agents`, `view_background_agent`, and `stop_background_agent` follow it, and the target must be in the caller's `sub_agents` {{docs-agent Background Agents Tool}}.

```listing
title: a background agent that never started
source: capture/out/19-background.txt
lang: text
note: Lines 4 to 13, five more confirmations and rejections with the same arguments, are cut.
---
user: Run the writer as a background agent on the topic microVMs, wait for it, and repeat its sentence.
tool_call_confirmation: {"agent_name": "root", "tool_call": {"id": "<call-id>", "type": "function", "function": {"name": "run_background_agent", "arguments": "{\"agent\": \"writer\", \"task\": \"Write one sentence on the topic microVMs\", \"expected_output\": \"A single sentence about microVMs\"}"}}, "metadata": {"safety_label": "unknown"}}
root <- tool_call_response Run Background Agent: The user rejected the tool call.
…
stderr: Error: Agent terminated: detected 5 consecutive identical calls to run_background_agent. This indicates a degenerate loop where the model is not making progress.
```

Under `--exec` with no `--safety`, the call itself asked for approval, and with no terminal it was rejected. The model sent the same call again until the runtime stopped the run with exit 1. The limit is `max_consecutive_tool_calls`, and 0 "uses the default of 5" {{schema AgentConfig}}. Inside a running task, "any tool call that would normally prompt the user for approval will be automatically denied" {{docs-agent Background Agents Tool}}. A headless coordinator therefore needs an `allow` rule for `run_background_agent` and for the tools its sub-agents call. The capture did not test that.

The kit asks for one tool call per message. A turn with two parallel calls cannot be replayed from a cassette, as [session.db, sessions diff, and eval](#s-session-db-sessions-diff-and-eval) explains.

```figure
id: fig-5-4
kind: sequence
title: a delegation that returns, then a move that stays
claim: `transfer_task` sends `writer` only the task and returns its sentence to `root`, while the session move makes `reviewer` answer every later message.
caption: Read top down, one step per beat. Solid ink is a call, dashed ink a reply, and dashed amber the `handoff` call that changes which agent owns the session. The amber box is the writer's sub-session. From capture/out/19-transcript.txt and 19-transfer-task.json.
```

```takeaways
- Use `sub_agents` when the parent needs a result back, and write the task so the child needs no history.
- Use `handoffs` when the next agent should own the rest of the conversation.
- Give a headless coordinator an `allow` rule for `run_background_agent` before you rely on it.
- Pin external sub-agent references to a digest so each run does not resolve a tag.
```

Sources: docs-agent Multi-Agent Systems, Transfer Task Tool, Background Agents Tool (research/sources/docs-docker-agent.md, pages concepts/multi-agent, tools/transfer-task, tools/background-agents); schema AgentConfig (research/sources/agent-schema.json); conflict C56 (research/conflicts-register.md); capture/README.md; capture/fixtures/agents/team.yaml; capture/out/19-team.txt, 19-transcript.txt, 19-transfer-task.json, 19-handoff.json, 19-background.txt, 19-background.ndjson
