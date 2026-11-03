---
id: budget-exhausted-looks-like-an-answer
title: Read the loop, what the caller gets at the turn cap
card: agents
kind: code-reading
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, debugging]
tags: [agent-loop, turn-budget, code-reading, return-type]
minutes: 8
lessons: [phases/14-agent-engineering/01-the-agent-loop, phases/19-capstone-projects/20-agent-harness-loop-contract]
manuals: []
practice: []
cheatsheet: [agent-harness]
related: [agents/the-agent-loops-forever]
updated: 2026-11-03
---

Read this run method from the toy agent loop. A caller shows the returned string to the user as the answer. What is wrong with the contract, and how would you change it?

```python
def run(self, user_message: str) -> str:
    self.history.append(Turn(kind="user", content=user_message))
    for step in range(self.max_turns):
        reply = self.llm.respond(self.history)
        if reply["kind"] == "finish":
            self.history.append(Turn(kind="final", content=reply["content"]))
            return reply["content"]
        thought = reply.get("thought", "")
        self.history.append(Turn(kind="thought", content=thought))
        call = ToolCall(name=reply["action"], args=reply.get("args", {}))
        observation = self.tools.dispatch(call)
        self.history.append(Turn(kind="action", content=call.name, tool_call=call, observation=observation))
    self.history.append(Turn(kind="final", content="budget exhausted"))
    return "budget exhausted"
```

## Short answer

The method returns a plain string in both cases, so the caller cannot tell a real answer from a run that hit the cap. The text `budget exhausted` goes to the user as if the model said it. The fix is to return a typed result with a reason, or to yield control the way the harness contract does, so that the caller decides whether to extend the budget or stop.

## Full answer

### What the code does

The loop runs at most `max_turns` iterations. Each iteration asks the model for one reply. A `finish` reply ends the run and returns its content. Any other reply is an action: the loop records the thought, dispatches the tool, and appends the observation. When the loop runs out of iterations, it appends a final turn with the text `budget exhausted` and returns that text.

### The three problems

1. **One return type for two outcomes.** A finished run and a capped run both return `str`. The caller has no field to test. Any code that shows the result to the user shows the cap message as an answer.
2. **The cap is a dead end.** The partial state is in `self.history`, but nothing tells the caller that the run can continue. The harness contract treats the budget as a yield: it emits `budget.warn`, fires `on_budget_exceeded`, and returns a pull request with a reason. The caller inspects the state and calls `resume`.
3. **A reply with no action and no finish is a crash.** The code reads `reply["action"]` for every non-finish reply. A model that answers in prose without a tool call raises a `KeyError`. The lesson lists a turn with no tool calls as a normal stop condition.

### The change

Return a small result object with the final text, a reason such as `finished`, `budget` or `no_tool_call`, and the turn count. Keep the history on the object so that the caller can resume or hand off. Treat a reply without an action as a stop, not as an error. Keep the budget as a cap on this call, and let the caller decide what to do after it.

## Follow-ups

- **Level 2:** Where is the observation formatter in this code? Expected: inside `tools.dispatch`, which returns an error string for an unknown tool, bad arguments, or an exception, so the model always gets a string back.
- **Level 2:** A tool raises an exception. What does the model see on the next turn? Expected: an observation that starts with `error:` and carries the exception type and text, which lets it correct the call.
- **Level 3:** How does the harness know which state to return to after a budget pause? Expected: it records the previous state before it pauses, resets the counters on resume, and re-enters executing or reflecting from that record.
- **Level 3:** What property of the harness makes a saved trace replayable without a model? Expected: the state machine is deterministic, so the same event log re-enters the same state.

## Wrong answers

- "Return an empty string at the cap, and the caller will handle it." An empty string is still a string, and the caller still has no reason code to test.
- "Raise an exception at the cap." The partial history is useful, and an exception forces the caller to restart from zero instead of resuming.
- "Set the maximum turns high enough that the cap is never reached." The cap exists for the run that does not converge, and a high cap only makes that run longer.

## Taught in

The [agent loop lesson](../../../phases/14-agent-engineering/01-the-agent-loop/) ships this loop, and the [harness loop contract](../../../phases/19-capstone-projects/20-agent-harness-loop-contract/) replaces the string with a pull point that the caller resumes.
