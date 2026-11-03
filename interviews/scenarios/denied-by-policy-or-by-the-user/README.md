---
id: denied-by-policy-or-by-the-user
title: Two refusals, two wordings, one agent file
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-breadth]
tags: [agents, permissions, safety-mode, hooks, tool-calls]
minutes: 20
lessons: []
manuals: [docker-sandboxes-101#s-permissions-safety-and-hooks]
practice: []
cheatsheet: []
related: [scenarios/five-identical-calls]
updated: 2026-11-03
system:
  version: docker-agent v1.149.0 and sbx v0.47.0
  model: ai/qwen3:4b through the local model runner, at temperature 0
  hardware: one Mac, no GPU
source:
  - manuals/docker-sandboxes-101/capture/fixtures/agents/guarded.yaml
  - manuals/docker-sandboxes-101/capture/fixtures/hooks/log-hook.sh
  - manuals/docker-sandboxes-101/capture/out/20-restricted.txt
  - manuals/docker-sandboxes-101/capture/out/20-strict.txt
  - manuals/docker-sandboxes-101/capture/out/20-hook-stdin.jsonl
  - manuals/docker-sandboxes-101/capture/out/20-debug-tool.txt
  - manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md
---

## Situation

Two tickets arrive on the same morning about one agent file. The file gives an agent a shell toolset, an `allow` pattern for `echo`, a `deny` pattern for `rm`, and a logging hook on every shell call. Both engineers sent the same three messages: run `echo m101-ok`, run `pwd`, run `rm -rf work/m101-nothing`.

The first engineer runs the agent in a pipeline with `--exec --safety restricted`. The ticket says that the agent refuses `rm` with the text `Tool 'shell' is denied by permissions configuration` and asks for the deny pattern to be removed, because the pipeline needs a cleanup step. The second engineer runs it on a laptop with `--exec --safety strict`. The ticket says that the agent refuses `pwd` with the text `The user rejected the tool call`, that no prompt ever appeared, and that the hook must be broken, because it answers allow on every call. You hold both tickets and the capture of both runs.

## Evidence

- [the toolset, the hook and the two patterns of the guarded agent](evidence/the-agent-file.txt)
- [the three commands under --safety restricted](evidence/the-restricted-run.txt)
- [the second and third commands under --safety strict](evidence/the-strict-run.txt)
- [the three records the hook wrote, one per call](evidence/what-the-hook-received.txt)
- [the hook script](evidence/what-the-hook-answered.txt)
- [the shell tool called directly, with no model in the loop](evidence/the-tool-without-the-model.txt)
- [the order the runtime applies to every tool call](evidence/the-order-of-decisions.txt)

## Questions

1. The two refusals have two wordings. Before you open the agent file, say what each wording tells you about where the decision was made.
2. No pattern names `pwd`. Why did it run in one mode and not in the other?
3. The hook answered allow on all three calls. Why did that change nothing, and what could the hook have changed?
4. What does the direct tool run prove, and what does it not prove?
5. Which ticket reports a bug, which reports the design at work, and what do you change for each?

## Walkthrough

1. **Read the agent file.** One toolset of type `shell`. A `pre_tool_use` hook with `matcher: shell` and `preempt_yolo: true`, which runs a script. Under `permissions`, `allow` holds `shell:cmd=echo*` and `deny` holds `shell:cmd=rm*`. Nothing names `pwd`.
2. **Read the restricted run.** `echo` ran and printed `m101-ok`. `pwd` ran and printed the working directory. The `rm` call never reached a tool: the response says that the configuration denies the tool. That is the `deny` pattern, which matches `rm*`.
3. **Read the strict run.** `echo` ran again. For `pwd`, the runtime raised `tool_call_confirmation` with metadata `blast_radius: safe`, `category: fs-read`, and `safety_label: safe`. Under `strict`, every label asks. With `--exec` there was no terminal, so the ask became a rejection, and the model got a message that said the user rejected the call. The `rm` call got the same denial as in the other mode. The two wordings mark two decision points: a denial names the policy, and a rejection names the person who was asked.
4. **Read the hook records and the script.** The hook wrote three records in the restricted run, one per call, including the `rm` call. The records carry `safety_policy: restricted` and the full `tool_input`. The script appends the record and prints `permission_decision: allow`. The order of decisions puts preempting hooks first, and from there an allow is advice only: a deny or an ask from the hook would have ended the call, an allow does not grant it. The deny pattern then blocked `rm` at the second step.
5. **Read the direct tool run.** `debug tool` called the shell tool of the same agent file with `echo m101-direct` and printed `m101-direct` with exit 0. The tool works. The refusals are decisions, not tool failures. The direct run does not say what the model would call, so it closes only the question about the toolset.
6. **Map each command to the order.** `echo`: step three, an allow pattern. `rm`: step two, a deny pattern, in both modes. `pwd`: no pattern, so step five, the safety mode on the label `safe`: `restricted` allows a safe label, and `strict` asks.

## Resolution

The first ticket describes the policy doing its job. A `deny` pattern blocks the call in every mode, and the manual's order places it above every allow, every ask, and every mode. Keep the pattern. A pipeline that must delete files does that outside the agent, or with a narrower deny that still excludes `rm -rf`. Removing the one rule that no mode and no hook can override leaves an unattended agent with no gate.

The second ticket reports a mode that does not fit an unattended run. `strict` asks on every unmatched call, and `--exec` without a terminal turns every ask into a rejection. The fix is `--safety restricted` for the laptop run, which lets a `safe` label run and refuses `destructive` and `unknown`, or an `allow` pattern for `pwd`. The hook is not broken: a preempting hook grants nothing, and its log of three records shows that it saw every call. The proof is the restricted run: `pwd` printed the working directory, `rm` stayed refused, and the hook recorded all three.

One line from the manual belongs in both ticket replies: the client enforces permissions, they stop accidents, and they are not a security boundary. For an agent you do not trust, run it in a sandbox.

## Wrong turns

- "The hook is broken, because it returned allow and the call was still refused." From a preempting hook an allow verdict is advice. Its deny or ask would have ended the call. Nothing is broken.
- "Remove the deny pattern so the cleanup step runs in the pipeline." The deny is the one rule that no mode and no hook can override. An unattended agent with `rm` allowed has no gate left.
- "Run with `--yolo` so nothing asks." That is `autonomous`: every unmatched call runs, `destructive` and `unknown` included. The `pwd` case needs `restricted` or one allow pattern.
- "The shell toolset is misconfigured on the laptop." The direct run printed `m101-direct` with exit 0 against the same agent file. The tool works, and the decision layer refused.

## Generalize

Read the wording of a refusal first. A denial names the policy, a rejection names the user, and a prompt in a headless run becomes a rejection. Then map each call to the decision order: preempting hooks, deny, allow, ask, mode. Choose the mode by who is watching the terminal, and remember that none of this is a security boundary.

## Taught in

[The permissions section](../../../manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md#three-calls-in-two-modes) runs these three commands in both modes and gives the decision order.
