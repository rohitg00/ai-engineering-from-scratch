# A client

> A working client is a loop that reads cards, picks an agent for each skill, and has a branch for every state a task can reach.

The planner has one job: deliver a change to `payments-api`. It must run the tests on commit `a41d7c3`, get the diff reviewed, and deploy build `2026.10.06-1` to staging. It starts with three port numbers, a token for the deployer, and the name of the base branch. The file `capture/planner.py` does the whole job in 86 lines, and `19-planner.log` records each decision.

When you finish this section, you can write a client that delegates by skill and handles every state a task reaches.

## Discover: read every card first

Before it sends anything, the planner reads the card on each port. It takes the interface whose `protocolBinding` is `JSONRPC` at `protocolVersion` `1.0`, and it files each skill id under the agent that offers it. It also notes each card's `streaming` flag and `securityRequirements`.

The specification's rule is positional, to "select the first supported transport" {{spec §8.3.2}}. Both rules agree here, because JSON-RPC comes first on all three cards. [Discovery and supported interfaces](#s-discovery-and-supported-interfaces) gives the full selection rule.

## Delegate: send once, then switch on the reply

Each delegation is one `SendMessage` without `returnImmediately`. It blocks until the task reaches a terminal or an interrupted state, as [SendMessage](#s-send-message) explains. The bearer token goes only to agents whose card asked for one, as [security schemes](#s-security-schemes-and-in-task-authorization) describes. A loop then switches on the reply.

```listing
title: delegate, the loop that switches on every reply
source: capture/planner.py
lang: python
note: The loop of the delegate method, complete. The lines above it, which pick the agent and send the message, are cut.
---
        while True:
            if "error" in reply:
                self.note(f"  error {reply['error']['code']}: {reply['error']['message']}")
                return None
            result = reply["result"]
            if "message" in result:
                self.note("  direct reply, no task to follow")
                return result["message"]
            task = result["task"] if "task" in result else result
            state = task["status"]["state"]
            self.note(f"  task {task['id'][:8]} is {state}")
            if state in TERMINAL:
                return task
            question = task["status"]["message"]["parts"][0]["text"]
            if state == "TASK_STATE_INPUT_REQUIRED":
                answer = self.answer(question)
                self.note(f"  it asks: {question} The planner answers from its own context: {answer}")
                _, reply = self.client.rpc(f"SendMessage: answer {agent['name']}", agent["port"], "SendMessage", {"message": self.client.message(answer, task_id=task["id"], context_id=task["contextId"])}, headers=headers)
                continue
            if state == "TASK_STATE_AUTH_REQUIRED":
                self.note(f"  it needs approval: {question} The planner cannot approve, so it asks the operator and subscribes.")
                return self.follow(agent, task, headers)
```

The reply has three shapes, checked in order: an error, a direct `message`, or a `task` {{proto SendMessageResponse}}. The `TERMINAL` tuple holds all four terminal states, `TASK_STATE_REJECTED` included, the one clients forget most often.

On `TASK_STATE_INPUT_REQUIRED`, the planner answers on the same task, with its `taskId` and `contextId`, as [interrupted states](#s-input-required-and-auth-required) explains. On `TASK_STATE_AUTH_REQUIRED`, the planner has nothing to send, so it passes the task to `follow`.

## Follow: subscribe, then call the operator

The first frame of a subscription is a snapshot of the task, as [streaming](#s-streaming-and-subscribe-to-task) shows. The planner subscribes first and calls the operator only when that snapshot arrives.

```listing
title: follow, until the stream ends
source: capture/planner.py
lang: python
note: The whole method. The operator call stands in for a person who approves outside A2A.
---
    def follow(self, agent, task, headers):
        def on_frame(index, event):
            if index == 1:
                self.operator(task)

        _, events = self.client.rpc(f"SubscribeToTask on {agent['name']}", agent["port"], "SubscribeToTask", {"id": task["id"]}, headers=headers, on_frame=on_frame)
        final = events[-1]["result"]["statusUpdate"]["status"]["state"]
        self.note(f"  the stream ends at {final}")
        return {"id": task["id"], "status": {"state": final}}
```

The operator call is a `POST /approve/<task id>`, outside A2A. The stream is open before the operator acts, so no update after the approval can pass the planner unseen {{spec §7.6.2}}. Three more frames follow the snapshot, and the last one carries `TASK_STATE_COMPLETED`.

## The run, decision by decision

Between delegations, the `ship` method decides whether to go on. It stops if the test task did not complete, if any test failed, or if any finding has high severity. [Figure](#fig-planner-run) draws the run in `19-planner.log` as three lanes, with the decisions below them.

```figure
id: fig-planner-run
kind: flow
title: the planner's run, decision by decision
claim: The planner reads three cards, delegates three skills in turn, answers a question, escalates an approval, and decides from data parts before each next step.
caption: Read the three lanes left to right, then the decisions row. Each lane is one delegation, top to bottom, with the states the replies carried. Task ids are shortened to 8 characters. From capture/out/19-planner.log and 19-planner.http.
```

Each decision reads a data part, never free text: `passed` and `failed` from `summary.json`, and `severity` from each finding in `review.json`. On commit `9f3c2e1`, one test fails, and the planner would stop before the review.

## What a production planner adds

Against agents it does not control, a planner needs more than the kit's loop.

- **Safe retries.** Resend a failed message with the same `messageId` {{spec §3.3.1}}. Keep the first reply, because a resend without `taskId` creates a second task in the reference SDK {{sdk src/a2a/server/agent_execution/active_task.py}}.
- **Timeouts.** The kit's client gives each request 15 seconds, in `capture/wire.py`, and the specification sets none. For long work, set `returnImmediately` and follow the task.
- **Card checks.** Cache cards with standard HTTP caching {{spec §8.6}}, and verify the deployer's `signatures` as [extended and signed cards](#s-extended-cards-and-signatures) shows.
- **Capability checks.** The planner records `streaming` and never reads it. Against an agent without streaming, its `SubscribeToTask` gets `UnsupportedOperationError` {{spec §3.3.4}}.
- **A branch for every state.** The loop has no branch for `TASK_STATE_SUBMITTED` or `TASK_STATE_WORKING`. A server that answers a blocking send at once ([conflict D2](#s-ref-sources)) would leave it looping on the same reply.
- **Checks on every result.** The `ship` method reads the review artifact without checking that the review task completed, and `follow` needs a `GetTask` call when a stream drops.
- **A real operator channel.** Route each approval to a person through an authenticated channel, and record who approved.

```rule
label: read the card before the call
source: spec §3.3.4
---
"Clients SHOULD validate capability support by examining the Agent Card before attempting operations that require optional capabilities."
```

```takeaways
- Map skills to agents from the cards before the first delegation.
- Give the reply loop a branch for every result shape and every task state.
- Subscribe to a task in `TASK_STATE_AUTH_REQUIRED` before the operator approves it.
```

Sources: spec §3.3.1, §3.3.4, §7.6.2, §8.3.2, §8.6 (research/sources/specification.md); proto SendMessageResponse (research/sources/a2a.proto); sdk src/a2a/server/agent_execution/active_task.py at a2a-python 1.2.2; capture/planner.py, capture/wire.py, capture/run.py, capture/agents.py; capture/out/19-planner.http, 19-planner.log
