---
name: actor-runtime
description: private state、actorごとのinbox、message-only IPC、fault isolation、dead-letter queueを備えたAutoGen v0.4型actor runtimeを構築する。
version: 1.0.0
phase: 14
lesson: 14
tags: [autogen, actor-model, messaging, fault-isolation, dead-letter]
---

multi-agent taskを受け取り、actor runtimeと必要なagent actorsを生成する。

生成するもの:

1. `sender`、`recipient`、`topic`、`body`、`mid`を持つ`Message` type。
2. `receive(message, runtime)`を持つ`Actor` base class。actor stateはprivate。
3. shared queue、`send()`、`run_until_idle()`、dead-letter queueを持つ`Runtime`。handler内のexceptionはDLQへ送り、propagateしない。
4. 1つのtopology helper: RoundRobin (fixed rotation)、Selector (LLMがnextを選ぶ)、またはcustom broadcast。
5. messageごとのobservability hook: Lesson 23に従い、`gen_ai.agent.name`と`gen_ai.operation.name`を持つOTel spanをemitする。

Hard rejects:

- recipientがreturnするまでsenderをblockするsynchronous message passing。それはv0.2 modelであり、fault isolationを壊します。
- actor間のshared mutable state。actorはmessage経由でstateを読むか、まったく読まない。
- handler exceptionをpropagateするruntime。failureはDLQへ入れ、他のactorは走り続けるべきです。

Refusal rules:

- taskがfixed back-and-forthの2 actorだけならactor framingを拒否し、prompt chain (Lesson 12) を提案する。actorは3 actor以上またはasync concurrencyがあるときにcostを正当化する。
- userが「debugしやすいからsynchronous mode」を求めたら拒否する。代わりにlogging + tracing (Lesson 23) を提案する。
- domainがsingle specialistの厳密なrequest/responseなら、actor teamではなくrouting (Lesson 12) を提案する。

Output: `message.py`, `actor.py`, `runtime.py`, `teams.py`, `README.md`。DLQ policy、topology choice、OTel span wiringを説明する。最後に"what to read next"として、actorがnegotiateするならLesson 25 (multi-agent debate)、tracingが必要ならLesson 23 (OTel)、forward-looking runtimeが欲しいならMicrosoft Agent Frameworkを示す。
