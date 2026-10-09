# permissions, --safety, and hooks

> Deny, allow, and ask patterns, then a safety mode, then hooks decide whether a tool call runs, and the docs say none of them is a security boundary.

Your agent runs in CI with `--exec`, and nobody watches the terminal. You want `echo` to run, `rm` never to run, and every other call to fail closed unless its label is `safe`. The agent file and one flag can say that, but only for calls that go through `docker-agent`.

When you finish this section, you can write `permissions` patterns, pick a `--safety` mode for an unattended run, and predict what a `pre_tool_use` hook changes.

```rule
label: what permissions are not
source: docs-agent Permissions
---
"Permissions are enforced client-side. They help prevent accidental operations but should not be relied upon as a security boundary for untrusted agents."
```

The same page says the `restricted` mode "is defense in depth against unwanted tool calls, not a security boundary" {{docs-agent Permissions}}. For isolation, run the agent in a sandbox, as [docker-agent run --sandbox](#s-docker-agent-run-sandbox-end-to-end) shows.

## The guarded agent

```listing
title: one shell toolset, a hook, and two patterns
source: capture/fixtures/agents/guarded.yaml
lang: yaml
note: The models block is cut.
---
version: "16"

agents:
  root:
    model: local
    description: Runs shell commands under a permission list and a hook.
    instruction: |
      Run exactly the shell commands the user lists, one tool call per
      command, in the given order. Then report each command and its
      result or refusal in one line each.
    max_iterations: 8
    toolsets:
      - type: shell
    hooks:
      pre_tool_use:
        - matcher: shell
          preempt_yolo: true
          hooks:
            - type: command
              command: ./fixtures/hooks/log-hook.sh
              env:
                M101_HOOK_LOG: ./work/hook-stdin.jsonl

permissions:
  allow:
    - "shell:cmd=echo*"
  deny:
    - "shell:cmd=rm*"
…
```

**Permission pattern:** a tool name glob with optional argument conditions, such as `shell:cmd=rm*`, in an `allow`, `ask`, or `deny` list. Patterns from the agent file and from `settings.permissions` in the user config merge, and a deny from either side wins {{docs-agent Permissions}}.

**Safety mode:** what the runtime does with a call that no pattern matched. It reads the call's label, `safe`, `destructive`, or `unknown`, and the mode decides {{docs-agent Permissions}}:

| Mode | `safe` | `destructive` | `unknown` |
|---|---|---|---|
| `strict` | ask | ask | ask |
| `balanced` | allow | ask | ask |
| `restricted` | allow | deny | deny |
| `autonomous` | allow | allow | allow |

`--yolo` is the same as `--safety autonomous` {{help-agent docker-agent run}}. A session that never chooses a mode keeps "the historical default: read-only tools auto-approve, everything else asks" {{docs-agent Permissions}}. That is why the `wc -l` call in [run, new, and doctor](#s-docker-agent-run-new-and-doctor) asked although its label was `safe`, because `shell` carries `readOnlyHint: false`.

## Three calls in two modes

The kit sent the same three messages under `--safety strict` and `--safety restricted`, one command per message, with no terminal to answer a prompt.

| Command | What decided | `strict` | `restricted` |
|---|---|---|---|
| `echo m101-ok` | `allow: shell:cmd=echo*` | ran, `m101-ok` | ran, `m101-ok` |
| `pwd` | no pattern, label `safe` | asked, then "The user rejected the tool call." | ran, `$CAPTURE` |
| `rm -rf work/m101-nothing` | `deny: shell:cmd=rm*` | "Tool 'shell' is denied by permissions configuration." | the same denial |

The patterns behaved the same in both modes, and only the unmatched `pwd` changed. Under `restricted`, the mode allowed the `safe` label. Under `strict`, the runtime raised `tool_call_confirmation`, and the empty terminal turned it into a rejection (`20-strict.txt`, `20-restricted.txt`).

## The order, and what a hook can change

The docs give one order for every call {{docs-agent Permissions}}:

1. `preempt_yolo` `pre_tool_use` hooks run first, and no mode or allow rule can bypass their deny or ask.
2. A `deny` pattern blocks the call.
3. An `allow` pattern approves it.
4. An `ask` pattern prompts the user.
5. With no match, the safety mode applies to the call's label.
6. On a mode ask, default `pre_tool_use` hooks can allow, deny, or ask.
7. With no decision, the user is asked.

**Hook:** a `command`, `builtin`, `model`, or `evaluator` entry that runs at a named event {{schema HookDefinition}}. A `command` hook reads one JSON object on stdin and can answer with JSON on stdout. Exit code 2 blocks, and the default timeout is 60 seconds {{docs-agent Hooks}}.

```listing
title: what the hook received for the rm call
source: capture/out/20-hook-stdin.jsonl
lang: jsonl
note: The third of three lines, one per call of the restricted run.
---
{"agent_name": "root", "cwd": "$CAPTURE", "hook_event_name": "pre_tool_use", "safety_policy": "restricted", "session_id": "<uuid>", "tool_input": {"cmd": "rm -rf work/m101-nothing"}, "tool_name": "shell", "tool_use_id": "<call-id>"}
```

`log-hook.sh` appends that line to a file and prints `"permission_decision":"allow"`. The stream shows it as `pre_tool_use_pre_yolo` with `"allowed": true` on all three calls, yet `rm` was denied and strict still asked for `pwd`. From a preempting hook, "an allow verdict is advisory" {{schema HookMatcherConfig}}. Its deny or ask would have ended the call.

Two more hooks run on every call: `tool_input_transform` and `tool_response_transform` appear in each stream, although no file declares them. `redact_secrets`, `true` by default, installs a builtin on those events {{schema AgentConfig}}. A hook can also run several times at once. When one message asked for three commands, the hook ran three times at once, and two runs appended to the log file together (`capture/README.md`). Write each record in one write.

```figure
id: fig-5-5
kind: decision
title: three shell calls through the approval order
claim: The preempting hook allows every call only as advice, the patterns decide `rm` and `echo`, and the safety mode alone decides `pwd`.
caption: Read top down. Each question box is one stage of the order, and the box to its right is what the capture saw at that stage. Rose is a denial or rejection, and olive a command that ran. From capture/fixtures/agents/guarded.yaml, capture/out/20-strict.ndjson, 20-restricted.ndjson, and 20-hook-stdin.jsonl.
```

```takeaways
- Run unattended agents with `--safety restricted`, so unmatched calls that are not safe fail closed.
- Put destructive commands in `deny`, because no mode and no hook allow can override a deny.
- Use a `preempt_yolo` hook to deny or ask, and never to grant.
- Run the agent in a sandbox when you do not trust it, because permissions run client-side.
```

Sources: docs-agent Permissions, Hooks (research/sources/docs-docker-agent.md, pages configuration/permissions, configuration/hooks); schema AgentConfig, HookMatcherConfig, HookDefinition (research/sources/agent-schema.json); help-agent docker-agent run (research/sources/help-docker-agent.md); capture/README.md; capture/fixtures/agents/guarded.yaml; capture/fixtures/hooks/log-hook.sh; capture/out/18-transcript.txt, 20-strict.txt, 20-strict.ndjson, 20-restricted.txt, 20-restricted.ndjson, 20-hook-stdin.jsonl
