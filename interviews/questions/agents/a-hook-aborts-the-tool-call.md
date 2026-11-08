---
id: a-hook-aborts-the-tool-call
title: Read the harness, a hook aborts a tool call mid-plan
card: agents
kind: code-reading
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, debugging]
tags: [harness, hooks, state-machine, event-stream, pull-point]
minutes: 12
lessons: [phases/19-capstone-projects/20-agent-harness-loop-contract]
manuals: []
practice: []
cheatsheet: [agent-harness, agent-state-graphs]
related: [agents/budget-exhausted-looks-like-an-answer]
updated: 2026-11-03
---

Read this part of the harness loop. A subscriber on `before_tool_call` raises `HookAbort` on the second step of a three-step plan, because the tool name is on a deny list. Trace what the loop does next: which events it emits, which hooks fire, which state it enters, and what the caller receives.

```python
step = self._plan[self._cursor]
self.hooks.fire("before_step", {"step": step})
self._emit("step.start", {"step_id": step.id, "desc": step.description})
if step.requires_tool:
    try:
        self.hooks.fire("before_tool_call", {"step": step})
    except HookAbort as exc:
        step.error = f"hook_abort:{exc}"
        self._emit("tool.error", {"step": step.id, "error": step.error})
        self.hooks.fire("on_error", {"step": step, "error": step.error})
        self._transition(State.REFLECTING)
        return self._step()
    self.budget.tool_calls += 1
    self._emit("tool.call", {"step": step.id, "tool": step.tool_name, "args": step.tool_args})
    self._transition(State.AWAITING_TOOL)
    self._emit("step.end", {"step_id": step.id, "outcome": "awaiting_tool"})
    self.hooks.fire("after_step", {"step": step, "outcome": "awaiting_tool"})
    return PullRequest(reason="tool_call", state=self.state, payload={...})
```

## Short answer

The abort is handled inside the loop, not thrown to the caller. The loop records the error on the step, emits `tool.error`, fires `on_error`, moves to the reflecting state and calls itself again. Reflecting advances the cursor and counts a turn, so the denied step is skipped, not retried, and the loop goes on to the third step. The caller never sees the abort as an exception: it sees the next pull request for the third step's tool call or the completion, or a pause with a budget-exceeded reason if a budget limit ran out first, and it can read the denied step in the event stream.

## Full answer

### Step by step

1. `before_step` fires and `step.start` is emitted for step two.
2. `before_tool_call` fires. The subscriber raises `HookAbort`.
3. The loop writes `hook_abort:<reason>` into `step.error`.
4. It emits `tool.error` with the step id and the error text.
5. It fires `on_error` with the step and the error.
6. It transitions to `REFLECTING`. The transition table allows executing to reflecting.
7. It calls `_step()` again. In the reflecting branch the cursor moves to step three and the turn count goes up by one.
8. Step three requires a tool, so the loop fires its hooks, counts a tool call, emits `tool.call`, transitions to `AWAITING_TOOL`, emits `step.end`, fires `after_step`, and returns a pull request with reason `tool_call`.

### What did not happen

- No `tool.call` event for step two, and no increment of the tool-call counter, because the abort came before both.
- No `step.end` event and no `after_step` hook for step two. The abort path leaves the step without a closing event. That is a gap a reader should name: a subscriber that pairs `step.start` with `step.end` sees an open step.
- No retry. The contract skips the step and reflects. A retry policy would live in the planner, which can return a new plan from reflecting.

### Why this shape

Hooks are imperative and can mutate, abort or skip. Events are observational and only record. The abort is a hook decision, and the record of it is an event, so a tracer that subscribes to the stream sees the denial without inspecting the loop. The state machine is deterministic, so a replay of the same event log re-enters the same state without calling a model.

### How the caller learns about the denial

The pull request it receives is for step three. To see the denial it reads the event stream for `tool.error` with the `hook_abort` prefix, or it registers an `on_error` subscriber. A production harness would also put the denied step into the handoff's failed attempts.

## Follow-ups

- **Level 3:** The abort happens on the last step of the plan. What does the caller receive? Expected: a session result with reason `goal_met`, because reflecting moves the cursor past the end, even though the last step never ran, so the caller must read the events to see the denied step.
- **Level 3:** Why does the loop count the turn in reflecting and not in executing? Expected: a turn is one completed step, and reflecting is where the loop decides whether to advance, replan or finish.
- **Level 4:** Which invariant does `_transition` protect, and what would break without it? Expected: only the listed state pairs are legal, so a bug that moved from awaiting tool straight to executing would raise instead of corrupting the replay.
- **Level 4:** How would you make the abort path emit a matching `step.end`? Expected: emit `step.end` with an outcome of `aborted` before the transition, so that every start has an end and a tracer can pair them.

## Wrong answers

- "HookAbort propagates to the caller as an exception." The loop catches it, records it and continues, so the caller sees the next pull request or the result.
- "The denied step is retried with a different tool." The contract skips to reflecting and advances the cursor, and a retry needs the planner to return a new plan.
- "The tool-call counter goes up because a tool call was attempted." The counter increments only after the hook passes, so a denied call does not spend budget.

## Taught in

The [harness loop contract](../../../phases/19-capstone-projects/20-agent-harness-loop-contract/) defines the states, the hook topics, the event stream and this abort path.
