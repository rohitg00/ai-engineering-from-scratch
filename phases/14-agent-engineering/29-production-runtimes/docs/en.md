# 本番ランタイム: Queue, Event, Cron

> Production agents は 6 つの runtime shapes で動く: request-response、streaming、durable execution、queue-based background、event-driven、scheduled。framework を選ぶ前に shape を選ぶ。observability はどの shape でも load-bearing である。

**種類:** 学習
**言語:** Python (stdlib)
**前提:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**時間:** 約60分

## 学習目標

- 6 つの production runtime shapes を挙げ、それぞれを framework / product pattern に対応づける。
- 長期 task で durable execution (LangGraph) が重要な理由を説明する。
- event-driven runtime と、Claude Managed Agents が合う場面を説明する。
- multi-step agents において observability-as-load-bearing という主張を説明する。

## 問題

Production agents は、Jupyter notebook では表面化しない形で失敗する。step 37 の network timeouts、voice call 途中で user が切断、machine reboot で cron job が死ぬ、background worker が memory 不足になる。runtime shape が、どの失敗を生き残れるかを決める。

## コンセプト

### Request-response

- Synchronous HTTP。user は完了を待つ。
- 短い tasks (<30s) でのみ成立する。
- Stacks: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa)。
- Observability: 標準的な HTTP access logs + OTel spans。

### Streaming

- progressive output のための SSE または WebSocket。
- LiveKit はこれを voice/video 向け WebRTC に拡張する (Lesson 22)。
- Stacks: streaming support を持つ任意の framework + SSE/WS を扱う frontend。
- Observability: chunk ごとの timing、first-token latency、tail latency。

### Durable execution

- すべての step 後に state を checkpoint し、failure 時に自動 resume する。
- AutoGen v0.4 actor model は failure を 1 agent に隔離する (Lesson 14)。
- LangGraph の core differentiator (Lesson 13)。
- step count が不明で recovery cost が高い場合に必須。

### Queue-based / background

- job が queue に入り、workers が取り出し、results は webhooks または pub/sub で戻る。
- long-horizon agents には必須 (Anthropic の computer use announcement によると、task ごとに dozens-to-hundreds of steps)。
- Stacks: Celery (Python), BullMQ (Node), SQS + Lambda (AWS), custom。
- Observability: queue depth、job ごとの latency distribution、DLQ size。

### Event-driven

- Agents が triggers を subscribe する: new email、PR opened、cron fire。
- Claude Managed Agents はこれを out of the box でカバーする (Lesson 17)。
- CrewAI Flows (Lesson 15) は event-driven deterministic workflows を構造化する。
- Observability: trigger source、event-to-start latency、agent latency。

### Scheduled

- 定期実行される cron-shaped agents。
- durable execution と組み合わせ、失敗した nightly run が次 tick で resume できるようにする。
- Stacks: Kubernetes CronJob + durable framework、hosted (Render cron, Vercel cron)。

### 2026 年の deployment patterns

- event-driven production には **CrewAI Flows**。
- Python microservices には **Agno** stateless FastAPI。
- embedding には **Mastra** server adapters (Express, Hono, Fastify, Koa)。
- managed voice には **Pipecat Cloud / LiveKit Cloud** (Lesson 22)。
- hosted long-running async には **Claude Managed Agents**。

### Observability is load-bearing

OpenTelemetry GenAI spans (Lesson 23) と Langfuse/Phoenix/Opik backend (Lesson 24) がなければ、step 40 で失敗した multi-step agent は debug できない。production では optional ではない。「素早く debug できる」と「logging を増やして最初から replay する」の違いである。

### production runtimes が失敗するところ

- **Wrong shape choice。** 5 分 task に request-response を選ぶ。users は切断し、workers は積み上がり、retries が重なる。
- **DLQ がない。** dead-letter のない queue workers。failed jobs が消える。
- **Opaque background work。** background agent が trace export なしで動く。user が報告するまで failures は見えない。
- **durable state を省略する。** restart する余裕がない 30 秒超の run には durable execution が必要。

## 構築

`code/main.py` は stdlib の multi-shape demo である。

- Request-response endpoint (plain function)。
- Streaming handler (generator)。
- DLQ 付き queue-based worker。
- Event trigger registry。
- Cron-shaped scheduler。

実行:

```bash
python3 code/main.py
```

出力: 同じ task に対する各 shape の behavior を示す 5 つの traces。同じ agent logic でも outer shells が異なる。6 つ目の shape である durable execution は、Lesson 13 の LangGraph checkpointing で意図的に扱っている。

## 利用

- chat-style UX には **Request-response**。
- progressive responses には **Streaming**。
- long-horizon tasks には **Durable**。
- batch / async / long-running には **Queue**。
- agent reactivity には **Event**。
- housekeeping (memory consolidation, evals, cost reports) には **Cron**。

## 出荷

`outputs/skill-runtime-shape.md` は task 向け runtime shape を選び、observability requirements を接続する。

## 演習

1. Lesson 01 の ReAct loop を、自分の stack の 6 shapes すべてに port する。どの shape がどの product surface に合うか。
2. queue-based demo に DLQ を追加する。10% の job failure を simulate し、DLQ size を表示する。
3. その日の top 20 traces に対して nightly に走る cron-triggered eval agent を書く。
4. backpressure 付き streaming を実装する。client が遅い場合、agent を pause する。これは turn budget とどう相互作用するか。
5. Claude Managed Agents docs を読む。self-hosted long-horizon agent を managed に移すのはどのような場合か。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| Request-response | "Synchronous" | user が待つ。短い tasks 専用 |
| Streaming | "SSE / WS" | progressive output。より良い UX。latency は chunk ごとに観測可能 |
| Durable execution | "Resume from failure" | checkpointed state。最後の step から restart |
| Queue-based | "Background jobs" | producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | agent が external events に反応する |
| DLQ | "Dead-letter queue" | failed jobs の置き場 |
| Claude Managed Agents | "Hosted harness" | caching + compaction を備えた Anthropic-hosted long-running async |

## 参考文献

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — durable execution details
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — hosted long-running async
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — "dozens-to-hundreds of steps per task"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor-model fault isolation
