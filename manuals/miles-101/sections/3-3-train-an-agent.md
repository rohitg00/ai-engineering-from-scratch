# Train an agent with tool calls and many turns

> An agent rollout has many turns and tool calls, and Miles runs them through a generate function that you choose by name.

A math rollout is one prompt and one answer. An agent rollout is a conversation: the model writes, calls a tool, reads the result, and writes again. Each turn adds tokens that the trainer must score exactly as the engine produced them.

When you finish this section, you can pick a starting point for an agent recipe and know the settings that keep its turns consistent.

We have not run an agent recipe on our GB10. This page comes from the Miles source and examples.

## Start from an example

Miles has agent recipes. Two of them are in the experimental folder. Pick the one closest to your task, and change its tools and data:

| Example | What the agent does |
|---|---|
| `retool_v2` | writes Python, runs it in a sandbox, and uses the output while it reasons |
| `search-r1`, experimental | calls a search tool over several turns |
| `swe-agent-harbor-docker` | works on code and terminal tasks inside local Docker sandboxes |
| `tau-bench`, experimental | serves a simulated customer with tool calls |

`retool_v2` also has a mode that runs on one GPU with `--fully-async --num-gpus-per-node 1`. That is the closest start for a single-GPU lab.

## Choose the generate function

The rollout of each sample comes from a generate function. Miles has three built in: one turn, many turns, and agentic tool calls. Name your own with `--custom-generate-function-path`, which takes a Python import path.

A generate function receives one sample, its sampling settings, and the router address. It fills in the sample: the tokens, the log probabilities from the engine, and a loss mask. The loss mask marks the tokens that the model wrote, and only those tokens count in the loss. Tool output is context, not model output.

## Keep the tokens of each turn exact

Between turns, an agent loop often turns tokens into text and back into tokens. That round trip can change the tokens, and then the trainer scores a sequence the engine never produced.

Miles avoids that with a session server that passes tokens in and tokens out for every turn. With `--use-session-server`, the router also keeps all turns of one conversation on the same engine. So each turn reuses the cache of the turns before it.

Partial rollout from [section 4.2](#s-handle-long-responses) does not work with these recipes. The session server and the multi-turn and agent generate functions refuse it.

## What to watch

- The share of tokens that the model wrote against the share that tools wrote. A recipe where tools write most of the tokens teaches the model little per step.
- The gap between the trainer and the engine, as in [section 5.2](#s-check-the-first-step). A gap far above your single-turn range points to a token mismatch between turns.
- The step time. Tools add wall-clock time that the GPU spends waiting.

```takeaways
- Start an agent recipe from the Miles example closest to your task.
- Mask tool output so that only the tokens the model wrote count in the loss.
- Use the session server so that each turn keeps its exact tokens and its cache.
```

Sources: Miles examples (retool_v2, search-r1, swe-agent-harbor-docker, tau-bench), generate hub, session server, and router arguments at main 08752a12; Miles fully async documentation.
