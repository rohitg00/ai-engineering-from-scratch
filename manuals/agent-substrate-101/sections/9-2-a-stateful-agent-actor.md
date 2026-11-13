# A stateful agent actor

> An agent that writes each turn to a durable directory keeps its conversation under both snapshot fidelities, and the fidelity decides what else it keeps and how fast it returns.

You have an agent that talks to a model and keeps a conversation. You want to run one copy for each user, and you do not want to pay for a pod while the user reads the answer. The question that decides your design is simple. What does the agent still know after a suspend?

When you finish this section, you can build an agent actor that keeps its conversation across a suspend. You can also choose a snapshot fidelity from a measured cost, and give the agent a model key that it never holds.

## The agent

The demo agent is one Python file of 100 lines with no dependencies. It serves three paths, and it handles one chat turn at a time.

- `POST /chat` adds your message to the conversation, calls the model, and stores both messages.
- `POST /note` keeps a text in a Python variable and in a file under `/tmp`. Nothing durable holds it.
- `GET /history` returns the conversation and five facts about the state of the process.

The agent keeps the conversation in two places. One is a list in process memory. The other is a SQLite file in `/data`, which the template mounts as a durable directory. When the process starts, it loads the list from the file.

```python
def stored_turns():
    with database() as connection:
        return [{"role": role, "content": content}
                for role, content in connection.execute("select role, content from turns order by n")]


memory = stored_turns()
rehydrated = len(memory)
```

That one load at the start is the whole design. A process that restarts with an empty memory reads its past from the durable directory. The full file is in [the stateful agent folder](manuals/agent-substrate-101/capture/demos/stateful-agent).

```figure
id: fig-9-2
kind: comparison
title: what the agent holds after a suspend, under each fidelity
claim: The conversation returned under both fidelities, and the note, the file under /tmp, and the process itself returned only under memory fidelity.
caption: Read the two columns as the same agent after its first suspend. Green rows came back and rose rows did not. The values are from the two recorded sessions. From capture/lab/N-demos/stateful-agent/session-memory.tsv and session-volumes.tsv.
```

## The model key

The agent sends the text `Bearer placeholder` in its `Authorization` header. It has no other key. The real key is a Kubernetes Secret in a namespace that the actor cannot read. The egress gateway replaces the header on the way out.

```listing
title: the egress policy of the agent actor, as the API stores it
source: capture/lab/N-demos/stateful-agent/egress-policy-memory-live.yaml
lang: yaml
note: The rules. The metadata lines above them are cut.
---
…
rules:
- http:
    effects:
      replaceHeaders:
      - credentialUri: ate-secret://k8s.io/default/demo-agent-secrets/model-key/token
        header: Authorization
        prefix: 'Bearer '
    hostnames:
    - mock-llm.demo-agent.svc.cluster.local
    ports:
      numbers:
      - 80
```

The model in this demo is a mock server in the cluster, not a real model. It answers from the messages that it receives, and it reports which key arrived. In every one of the 16 model calls of our two sessions it reported the real key. [Credential injection](#s-credential-injection) explains the mechanism and its limits.

## Two sessions, one for each fidelity

We made the same template two times. One copy asks for `SNAPSHOT_FIDELITY_MEMORY` and the other for `SNAPSHOT_FIDELITY_VOLUMES`. Each session has two turns and a note, then three rounds of suspend, one turn, and one more turn.

```listing
title: the session under memory fidelity
source: capture/lab/N-demos/stateful-agent/session-memory.tsv
lang: text
note: The header, the first three steps, and the two turns after the first suspend. The reply text is cut at the mark.
---
step	http	seconds	reply
turn 1, new actor	200	0.584397	{"reply": "turn 1: you said 'my name is Ada'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 2, "db_turns": 2, "rehydrated_from_db": 0, "note": null, "scratch_file": false, "proces …
note, memory only	200	0.072225	{"memory_turns": 2, "db_turns": 2, "rehydrated_from_db": 0, "note": "remember the number 42", "scratch_file": true, "process_age_s": 10.8}
turn 2, warm	200	0.112794	{"reply": "turn 2: you said 'what is my name'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 4, "db_turns": 4, "rehydrated_from_db": 0, "note": "remember the number 42", "scratch_file" …
turn 3, after suspend 1	200	0.297402	{"reply": "turn 3: you said 'message after suspend 1'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 6, "db_turns": 6, "rehydrated_from_db": 0, "note": "remember the number …
turn 3b, warm	200	0.101483	{"reply": "turn 4: you said 'warm message 1'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 8, "db_turns": 8, "rehydrated_from_db": 0, "note": "remember the number 42", "scratch_file" …
```

Under memory fidelity the agent is the same process after the suspend. The note is there, the file under `/tmp` is there, and `process_age_s` keeps growing. The agent loaded nothing from SQLite, because it never started again.

```listing
title: the session under volumes fidelity
source: capture/lab/N-demos/stateful-agent/session-volumes.tsv
lang: text
note: The header, the first three steps, and the two turns after the first suspend. The reply text is cut at the mark.
---
step	http	seconds	reply
turn 1, new actor	200	5.083124	{"reply": "turn 1: you said 'my name is Ada'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 2, "db_turns": 2, "rehydrated_from_db": 0, "note": null, "scratch_file": false, "proces …
note, memory only	200	0.068069	{"memory_turns": 2, "db_turns": 2, "rehydrated_from_db": 0, "note": "remember the number 42", "scratch_file": true, "process_age_s": 0.4}
turn 2, warm	200	0.096986	{"reply": "turn 2: you said 'what is my name'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 4, "db_turns": 4, "rehydrated_from_db": 0, "note": "remember the number 42", "scratch_file" …
turn 3, after suspend 1	200	5.059144	{"reply": "turn 3: you said 'message after suspend 1'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 6, "db_turns": 6, "rehydrated_from_db": 4, "note": null, "scratch_file": …
turn 3b, warm	200	0.093130	{"reply": "turn 4: you said 'warm message 1'. Your first message was 'my name is Ada'. Gateway sent the real key.", "memory_turns": 8, "db_turns": 8, "rehydrated_from_db": 4, "note": null, "scratch_file": false, "process_ag …
```

Under volumes fidelity the agent is a new process after each suspend. Its age is 0.3 seconds when it answers. The note and the file are gone. The conversation is complete, because the new process loaded four turns from SQLite. The model still received the first message of the session in each call.

## What each fidelity costs

**We measured** the time of each turn at the client, on a second x86 server guest (16 vCPU, 31 GB), through `kubectl ate proxy`. Each session has three turns that follow a suspend and four turns on a running actor. The mock model answers at once, so these times hold no model time.

```figure
id: fig-9-2b
kind: chart
title: the time of one turn, by fidelity and by the state of the actor
claim: A turn that resumed the actor took 0.30 seconds under memory fidelity and 4.5 to 5.1 seconds under volumes fidelity.
caption: Each dot is one turn. The left group is a turn on a running actor, and the right group is a turn that had to resume the actor first. From capture/lab/summary/demos-x86.json.
```

| Turn | Memory fidelity | Volumes fidelity |
|---|---|---|
| on a running actor | 0.09 to 0.11 s | 0.09 to 0.10 s |
| after a suspend | 0.30 to 0.32 s | 4.49 to 5.06 s |
| first turn of a new actor | 0.58 s | 5.08 s |

The lifecycle log of the actor shows where the time goes. Under memory fidelity the restore took 0.15 to 0.17 seconds. Under volumes fidelity it took 4.3 to 4.8 seconds, because the sandbox boots the image and starts Python each time. We did not measure which part of that boot is the largest.

This result differs from the kagent run in [kagent 1.0 on Substrate](#s-kagent-on-substrate), where a resume under volumes fidelity took 0.38 seconds. The kagent harness is a compiled program in another image. Your own image decides this number, so measure it before you choose.

## Limits of the demo

- The model is a mock. A real model adds its own time to each turn.
- One actor ran in each session. We did not measure many agents that resume at the same time. [Sizing a pool](#s-sizing-a-pool) has bursts of up to 300 counter actors.
- SQLite holds each turn after the model answers. A crash between the answer and the write loses that turn.
- The agent has no authentication. Each caller that can reach the router can read the conversation.

## What to change for production

Keep the write to the durable directory even when you choose memory fidelity. A crashed actor returns to its last durable snapshot, and a revert can drop the newest memory. The durable directory is part of that snapshot, so the file goes back with it. A turn is safe only after the next synchronous suspend, or in a store outside the actor.

Choose memory fidelity when a user waits for the first answer after a pause, and your agent holds little memory. Choose volumes fidelity when the agent holds much memory or when you want a clean process after each suspend. For a clean process on every turn, the harness must suspend the actor between turns. Then make the image start fast.

```takeaways
- Write each turn to a durable directory, and load it when the process starts.
- Give the agent a placeholder key, and let the egress policy insert the real one.
- Measure a resume with your own image under both fidelities before you choose one.
- Treat process memory and files under /tmp as lost when you use volumes fidelity.
```

Sources: capture/lab/N-demos/stateful-agent/session-memory.tsv, capture/lab/N-demos/stateful-agent/session-volumes.tsv, capture/lab/N-demos/stateful-agent/egress-policy-memory-live.yaml, capture/lab/N-demos/stateful-agent/lifecycle-memory.log, capture/lab/N-demos/stateful-agent/lifecycle-volumes.log, capture/lab/N-demos/stateful-agent/mock-llm.log, capture/lab/summary/demos-x86.json, capture/demos/stateful-agent/agent.py, capture/demos/stateful-agent/template.yaml
