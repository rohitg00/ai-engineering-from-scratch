# オーケストレーションパターン: Supervisor, Swarm, Hierarchical

> 2026 年の frameworks では、supervisor-worker、swarm / peer-to-peer、hierarchical、debate という 4 つの orchestration patterns が繰り返し現れる。Anthropic の指針は「必要に合った正しい system を作ること」。単純に始め、single agent + 5 つの workflow patterns では不十分になったときだけ topology を追加する。

**種類:** 学習 + 構築
**言語:** Python (stdlib)
**前提:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**時間:** 約60分

## 学習目標

- 繰り返し現れる 4 つの orchestration patterns と、それぞれが合う場面を挙げる。
- 2026 年の LangChain recommendation を説明する: tool-call-based supervision vs supervisor libraries。
- Anthropic の「right system を作る」ルールと、それが topology 選択をどう gate するかを説明する。
- 共通の scripted LLM に対して、4 つすべてを stdlib で実装する。

## 問題

teams は必要になる前に「multi-agent」に手を伸ばしがちである。frameworks をまたいで 4 つの patterns が繰り返し現れる。名前を付けられるようになると、正しいものを選べる。あるいは topology 自体を使わない判断もできる。

## コンセプト

### Supervisor-worker

- 中央の routing LLM が specialist agents に dispatch する。
- 判断すること: 自分へ loop back するか、specialist に hand off するか、終了するか。
- Specialists は互いに会話しない。すべての routing は supervisor 経由。

Frameworks: LangGraph `create_supervisor`, Anthropic orchestrator-workers, CrewAI Hierarchical Process。

**2026 年の LangChain recommendation:** `create_supervisor` ではなく direct tool calls で supervision する。より細かい context engineering control が得られる。各 specialist が何を見るかを正確に決められる。

### Swarm / peer-to-peer

- Agents が shared tool surface 経由で直接 hand off する。
- 中央 router はない。
- supervisor より低 latency (hops が少ない)。
- 推論しにくい (単一の control point がない)。

Frameworks: LangGraph swarm topology、OpenAI Agents SDK handoffs (すべての agents が互いに hand off できる場合)。

### Hierarchical

- supervisors が sub-supervisors を管理し、その sub-supervisors が workers を管理する。
- LangGraph では nested subgraphs、CrewAI では nested crews として実装される。
- operational complexity と引き換えに、大規模な agent populations へ scale する。

必要になる場面: single supervisor の context budget にすべての specialists の descriptions が入らないとき。

### Debate

- parallel proposers + iterative cross-critique (Lesson 25)。
- 厳密には orchestration ではなく verification に近いが、frameworks では topology choice として現れる。

### CrewAI Crew vs Flow

CrewAI は 2 つの deployment modes を formalize する。

- deterministic event-driven automation には **Flow** (production の starting point として推奨)。
- autonomous role-based collaboration には **Crew**。

これは上記 4 patterns と直交するが、topology に対応づけられる。Flow は通常 supervisor または hierarchical。Crew は通常 LLM router を持つ supervisor。

### Anthropic の指針

「LLM space での成功は、最も洗練された system を作ることではない。必要に合った正しい system を作ることだ。」

判断順:

1. Single agent + workflow patterns (Lesson 12) — ここから始める。
2. Supervisor-worker — 2-4 人の specialists がいるとき。
3. Swarm — latency が reasoning clarity より重要なとき。
4. Hierarchical — supervisor context budget が破綻するときだけ。
5. Debate — cost より accuracy が重要なとき。

### このパターンが失敗するところ

- **Topology-first thinking。** multi-agent が何を解決するか特定する前に「multi-agent が必要」と考える。
- **swarm で bouncing handoffs。** A -> B -> A -> B。hop counters を使う。
- **Fake hierarchy。** 「enterprise」だから 3 layers、実際の teams は 2 つだけ。collapse する。

## 構築

`code/main.py` は scripted LLM に対して 4 つの patterns すべてを stdlib で実装する。

- `Supervisor` — 中央 router。
- `Swarm` — direct handoffs を伴う peer-to-peer。
- `Hierarchical` — supervisors of supervisors。
- `Debate` — parallel proposers + critique。

各 pattern は同じ 3-intent task (refund / bug / sales) を処理する。trace shapes が異なる。

実行:

```
python3 code/main.py
```

出力: pattern ごとの trace + op count。Supervisor は最も明快。swarm は最短。hierarchical は最も深い。debate は最も高価。

## 利用

- supervisor と hierarchical (nested subgraphs) には **LangGraph**。
- handoffs-as-tools (supervisor-shaped) には **OpenAI Agents SDK**。
- production deterministic には **CrewAI Flow**。
- debate や正確な control が必要な場合は **Custom**。

## 出荷

`outputs/skill-orchestration-picker.md` は topology を選び、実装する。

## 演習

1. router を取り除き、supervisor-worker を swarm に変換する。何が壊れるか。何が改善するか。
2. swarm に hop counter を追加する。3 handoffs 後に拒否する。A->B->A の bouncing を捕まえられるか。
3. 12-specialist domain 向けに 2-level hierarchical system を構築する。nesting なしでは context budget はどこで破綻するか。
4. production-shaped workload 上で 4 patterns を profile する。どの metric (latency, cost, accuracy, debuggability) でどれが勝つか。
5. Anthropic の "Building Effective Agents" post を読む。自分の production flows を 4 つのどれかに map する。きれいに map できないものはあるか。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| Supervisor-worker | "Router + specialists" | 中央 LLM が specialists に dispatch し、specialists 同士は会話しない |
| Swarm | "Peer-to-peer" | shared tools 経由の direct handoffs。central router はない |
| Hierarchical | "Supervisors of supervisors" | 大規模 populations 向けの nested subgraphs |
| Debate | "Proposer + critique" | parallel proposers、cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | context control のため、direct tool calls として supervisor を実装する |
| Crew | "Autonomous team" | CrewAI の role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI の event-driven production mode |

## 参考文献

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — 5 patterns + agent vs workflow
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — supervisor, swarm, hierarchical
- [CrewAI docs](https://docs.crewai.com/en/introduction) — Crew vs Flow
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — debate pattern
