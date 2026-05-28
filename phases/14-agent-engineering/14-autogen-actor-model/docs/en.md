# AutoGen v0.4: Actor Model and Agent Framework

> AutoGen v0.4 (Microsoft Research, 2025年1月) は、agent orchestrationをactor model中心に再設計しました。async message exchange、event-driven agents、fault isolation、自然なconcurrency。frameworkは現在maintenance modeで、Microsoft Agent Framework (2025年10月public preview) が後継になりつつあります。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**所要時間:** 約75分

## Learning Objectives

- actor modelを説明する: agentはactor、messageが唯一のIPC、failureはactorごとにisolateされる。
- AutoGen v0.4の3つのAPI layer (Core、AgentChat、Extensions) と、それぞれの役割を挙げる。
- message deliveryとhandlingを分離するとfault isolationと自然なconcurrencyが得られる理由を説明する。
- Pythonでstdlib actor runtimeを実装し、two-agent code-review flowをそこへportする。

## 問題

多くのagent frameworkはsynchronousです。1つのagentがproduceし、もう1つのagentがcall stack内でconsumeします。failureはstackを落とします。concurrencyは後付けになります。distributionには書き換えが必要です。

AutoGen v0.4の答えはactor modelです。各agentはprivate inboxを持つactorです。interactionはmessageだけです。runtimeはdeliveryとhandlingを分離します。failureは1つのactorにisolateされます。concurrencyはnativeです。distributionはtransportを変えるだけです。

## The Concept

### Actors

actorは次を持ちます。

- private state (外部から直接触れない)。
- inbox (message queue)。
- handler: `receive(message) -> effects`。effectは"reply"、"send to other actor"、"spawn new actor"、"update state"、"stop self"など。

2つのactorはmemoryを共有できません。messageを送ることだけができます。

### Three API layers in AutoGen v0.4

1. **Core.** low-level actor framework。`AgentRuntime`、`Agent`、`Message`、`Topic`。async message exchange、event-driven。
2. **AgentChat.** task-driven high-level API (v0.2のConversableAgentの置き換え)。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions.** integration群。OpenAI、Anthropic、Azure、tools、memory。

### Why decoupling matters

v0.2 modelでは、`agent_a.chat(agent_b)`を同期的に呼ぶと、agent_bが返るまでagent_aがblockされます。v0.4では、`send(agent_b, msg)`がmessageをagent_bのinboxに入れてreturnします。runtimeが後でdeliveryします。結果は3つあります。

- **Fault isolation.** Agent BがcrashしてもAgent Aはcrashしません。runtimeがBのhandler failureをcatchし、log、retry、dead-letterなどを決めます。
- **Natural concurrency.** 多数のmessageを同時にin flightにでき、actorはinboxをconcurrentlyにprocessします。
- **Distribution-ready.** actorがin-processでも別hostでも、inbox + transportは同じabstractionです。

### Topologies

- **RoundRobinGroupChat.** agentがfixed rotationで順番に発話する。
- **SelectorGroupChat.** selector agentがconversation contextに基づいて次のagentを選ぶ。
- **Magentic-One.** web browsing、code execution、file handling向けのreference multi-agent team。AgentChat上に構築されている。

### Observability

OpenTelemetry supportは組み込みです。各messageがspanをemitし、tool callには2026年のOTel GenAI semantic conventionsに従う`gen_ai.*` attributesが付きます (Lesson 23)。

### Status: maintenance mode

2026年初頭時点で、AutoGen v0.7.xはresearchとprototypingにはstableです。Microsoftはactive developmentをMicrosoft Agent Framework (2025年10月1日public preview、2026年Q1末に1.0 GA目標) へ移しています。AutoGen patternsはきれいにport forwardできます。actor modelが残るdurableなideaです。

## 実装

`code/main.py`はstdlib actor runtimeを実装しています。

- `Message` — `sender`、`recipient`、`topic`、`body`を持つtyped payload。
- `Actor` — `receive(message, runtime)`を持つabstract。
- `Runtime` — shared queue、delivery、failure isolationを持つevent loop。
- two-actor demo: `ReviewerAgent`がcodeをreviewし、`ChecklistAgent`がchecklistを実行する。consensusに達するまでmessageを交換する。

実行:

```
python3 code/main.py
```

traceでは、message delivery、一方のactor内のsimulated failureが他方をcrashさせないこと、shared verdictへの収束が見えます。

## Use It

- **AutoGen v0.4/v0.7** (maintenance) — research、prototyping、multi-agent patternsにはstable。
- **Microsoft Agent Framework** (public preview) — forward path。refreshされたAPIに同じactor-model ideasが入る。
- **LangGraph swarm topology** (Lesson 13) — shared-tool handoffによる類似pattern。
- **Custom actor runtime** — 特定transport (NATS、RabbitMQ、gRPC) が必要な場合。

## Ship It

`outputs/skill-actor-runtime.md`は、指定されたmulti-agent taskに対して、minimal actor runtimeとteam template (RoundRobinまたはSelector) を生成します。

## Exercises

1. dead-letter queueを追加する。handlerがraiseしたら、失敗messageをhuman inspection用に保留する。toyではDLQにどのくらいhitするか。
2. `SelectorGroupChat`を実装する。selector actorがconversation stateに基づいて次のmessage処理者を選ぶ。
3. distributed transportを追加する。in-process queueをJSON-over-HTTP serverに差し替え、actorを別processで動かせるようにする。
4. messageごとのOTel span (またはno-op stand-in) をwireする。Lesson 23に従って`gen_ai.agent.name`、`gen_ai.operation.name`をemitする。
5. AutoGen v0.4のarchitecture postを読む。toyを実際の`autogen_core` APIへportする。productionで重要なのに何をskipしたか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | 「Agent」 | private state + inbox + handler。shared memoryはない |
| Message | 「Event」 | typed payload。actorがinteractionする唯一の方法 |
| Inbox | 「Mailbox」 | actorごとのpending message queue |
| Runtime | 「Agent host」 | messageをrouteし、failureをisolateするevent loop |
| Topic | 「Channel」 | actor間のnamed publish-subscribe route |
| Fault isolation | 「Let it crash」 | 1つのactor failureが他actorをcrashさせない |
| RoundRobinGroupChat | 「Fixed-rotation team」 | agentが順番にturnを取る |
| SelectorGroupChat | 「Context-routed team」 | selectorが次のagentを選ぶ |
| Magentic-One | 「Reference team」 | web + code + files向けのmulti-agent squad |

## 参考文献

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — redesign post
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — graph-shaped alternative
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — AutoGenがdefaultでemitするspanの仕様
