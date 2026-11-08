# Which router to use

> The router spreads rollout requests over the engines, and the choice matters once you run more than one engine or many turns.

Every rollout request goes through a router before it reaches an engine. On one GPU with one engine, the router has one place to send each request. With many engines, or with agent sessions, where it sends a request decides how well the engines reuse their caches.

When you finish this section, you can explain what the router does in a Miles run, and when to change it.

## The two routers

| Router | How to select it | Routes by | Notes |
|---|---|---|---|
| SGLang router, a Rust service | the default | tokens | supports split prefill and decode |
| Miles router, a Python service | `--use-miles-router` | text requests, each to the engine with the fewest open requests | no split prefill and decode, and marks an engine unhealthy after 3 failed checks by default |

Miles starts one router for each model in the run, with no GPU of its own. Since release v0.1.1, Miles always starts its own router, and you cannot point a run at a router you started yourself.

The default SGLang router comes from a build that the Miles team keeps for Miles. That build passes RL fields through the router to the engine and back. Two examples are the sampled token set for sampling replay and the top log probabilities.

Our runs used the default router. The launch line in our logs shows it:

```listing
title: the router that our runs started
source: capture/gpu/out-gb10/router-launch.txt
lang: text
note: One line from the log of the e6a-base run.
---
sglang_router.launch_router --log-level warn --prometheus-port 20036 --request-timeout-secs 14400 --host 172.17.0.3 --port 20034
```

## Routing for agent sessions

With `--use-session-server`, the router keeps every turn of one conversation on the same engine. Each turn then reuses the cache of the turns before it. Miles sets the routing policy for this case by itself.

With attention data parallelism on the engines, Miles makes the router aware of the data-parallel ranks. The router can then pick a rank inside an engine.

## When to change the router

- On one engine, keep the default. There is nothing to balance.
- With many engines and single-turn prompts, keep the default.
- With agent sessions, turn on the session server, and let Miles set the policy.
- Use the Miles router only when you need to send text requests. It cannot route split prefill and decode.

When requests fail, read the router log next to the engine log. A request that fails at the router never reaches an engine.

```takeaways
- Keep the default SGLang router on one engine and for single-turn prompts.
- Use the session server for agents, so that each conversation stays on one engine.
- Read the router log when requests fail before they reach an engine.
```

Sources: Miles router arguments, router specification, and session server settings at main 08752a12; Miles release notes v0.1.1; the Miles router build repository; capture/gpu/out-gb10/router-launch.txt.
