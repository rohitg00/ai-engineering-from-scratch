# Supervisor / Orchestrator-Worker Pattern

> 1 つの lead agent が plan と delegate を行い、specialized workers が parallel contexts で実行して報告します。これは Anthropic の Research system の背後にある pattern です (Claude Opus 4 が lead、Sonnet 4 が subagents)。internal research evals では single-agent Opus 4 に対して +90.2% と測定されています。Anthropic の engineering post は、BrowseComp の variance の 80% が token usage だけで説明できると報告しています。multi-agent が勝つ主因は、各 subagent が fresh context window を得ることです。

**種別:** 学習 + 構築
**言語:** Python (stdlib, `threading`)
**前提条件:** Phase 16 · 04 (Primitive Model)
**所要時間:** 約75分

## 問題

research は、single-agent systems が失敗しやすい典型 task です。「2023 年から 2026 年の multi-agent systems で何が変わったか?」と尋ねると、single agent は 5 papers を順番に読み、その text で context の半分を埋め、そのすべてをまとめて reason しなければなりません。5 本目に到達する頃には 1 本目を忘れています。parallelize もできません。

supervisor pattern はこれを直します。1 つの lead agent が search を plan し、各 sub-question を worker に delegate し、synthesize します。各 worker は narrow question のための自分専用の 200k-token window を持ちます。lead は raw papers を見ません。worker summaries だけを見ます。

Anthropic の production Research system は、internal research evals で single Opus 4 に対して +90.2% を報告しています。同じ post は BrowseComp variance の 80% が *token usage alone* で説明されると述べています。subagent ごとの fresh context が主 mechanism です。

## コンセプト

### Pattern

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

lead は raw materials を読みません。workers は lead が synthesize するまで互いの work を見ません。各 arrow は narrow artifact を持つ handoff です。

### なぜ勝つのか

3 つの mechanisms:

1. **Fresh context per subagent.** "FIPA-ACL heritage" を調べる worker は、lead が planning に使った 40k tokens を背負いません。1 question のために 200k window を使えます。
2. **Specialization via prompt.** lead の prompt は "decompose and synthesize" であり "research" ではありません。各 worker の prompt は "find what changed in X" のように narrow です。focused prompts は focused outputs を生みます。
3. **Parallelism.** workers は concurrently に走ります。wall-clock time は `sum(worker_times)` ではなく、概ね `max(worker_times) + plan + synthesis` です。

### Engineering lessons (Anthropic 2025)

Anthropic post の production lessons は 2026 年でも有効です。

- **Scale effort to query complexity.** simple queries は 1 agent、3-10 tool calls。complex queries は 10+ agents。caller ではなく lead が見積もるべきです。
- **Broad then narrow.** まず broad sub-questions に分解し、answer が depth を必要とする場合に sub-question ごとにさらに workers を起動します。
- **Rainbow deployments.** agents は long-running で stateful です。traditional blue-green は効きません。Anthropic は rainbow、つまり old versions を drain しながら new versions を gradual rollout します。
- **Token usage dominates.** multi-agent は single-agent の約 15 倍の tokens を使います。task value が cost に見合う場合だけ実行します。

### LangGraph turn

LangGraph はもともと high-level `create_supervisor` helper を持つ `langgraph-supervisor` library を出荷しました。2025 年、LangChain は supervisor pattern を tool-calling で直接実装する recommendation に移しました。tool calls の方が *what the supervisor sees* (context engineering) をより制御できるからです。library はまだ動きますが、docs は tool-calling form を推奨しています。

### Failure modes

- **Lead hallucinates the plan.** lead が real question を分解していない sub-questions を生成すると、workers は wrong target を正確に research します。
- **Workers over-explore.** explicit scope boundaries がないと、workers は assigned sub-question を越えて drift し、synthesis step を汚します。
- **Synthesis conflicts.** 2 workers が contradictory facts を返します。lead は re-ask (round を追加) するか、disagreement を明示する必要があります。silent に一方を選ぶのが最悪です。user は disagreement を知りません。

### supervisor が間違っている場面

- **Sequential tasks.** step 2 が文字通り step 1 の output を必要とするなら、parallelism は何も買いません。pipeline を使います (CrewAI Sequential、LangGraph linear graph)。
- **Simple queries.** single-agent の方が速く安い。workers 起動前に lead の "scale effort" check を使います。
- **Strict determinism.** supervisor は LLM-selected delegation です。audit/replay が adaptability より重要なら static graphs が適しています。

## 実装

`code/main.py` は `threading` を使って 3 parallel workers の supervisor を実装します。lead は query を sub-questions に分解し、workers は各 sub-question を concurrently に実行し、lead が synthesize します。real LLMs は使いません。workers は fetch-and-summarize を simulate する scripted functions です。

構造:

- `Lead.plan(query)` が query を 3 sub-questions に分割する。
- `Worker.run(sub_q)` が fake summary を返す (production では tool-using agent でよい)。
- `Lead.run(query)` が workers を threads で起動し、join し、synthesize する。

実行:

```
python3 code/main.py
```

output は plan、start/end timestamps 付きの parallel worker traces、final synthesis を示します。3 つの 0.3 秒 workers が ~0.35 秒で走り、0.9 秒ではないことが分かります。

## Use It

`outputs/skill-supervisor-designer.md` は user query から supervisor-pattern design を作ります。lead system prompt、worker roles、sub-question decomposition rules、synthesis template を出力します。new research-style agent system を作る前に使ってください。

## Ship It

supervisor pattern を deploy する前の checklist:

- **Model pairing.** lead は reasoning-tier model (Opus class、`o3` class)。workers は faster/cheaper model (Sonnet、`o4-mini`)。
- **Worker timeout.** median runtime の 2 倍を超える worker は kill する。lead は narrower scope で re-spawn するか、その worker なしで進む。
- **Token cap per worker.** hard limit (expected synthesis input の 10 倍など) を置き、runaway worker に budget を壊されないようにする。
- **Observability.** lead の plan、各 worker の tool calls、synthesis を trace する。post-hoc debugging の基礎になる。
- **Rainbow rollout.** stateful long-running agents は hot swap ではなく gradual version transition が必要。

## Exercises

1. `code/main.py` を実行し、lead が 3 ではなく 5 workers を spawn するよう変更する。wall-clock effect を観察する。この demo では worker count がいくつで spawn overhead が parallel savings を上回るか?
2. worker timeout を実装する。0.5 秒を超える worker を kill し、lead が remaining results を synthesize する。worker が cut されたことを知るにはどんな observability が必要か?
3. lead synthesis に conflict-detection step を追加する。2 workers が contradictory answers を返したら、lead は一方を選ばず disagreement を note する。LLM を呼ばずに contradiction をどう検出するか?
4. Anthropic の Research-system engineering post を読む。この toy demo が production で動くために採用すべき practices を 3 つ挙げる。
5. LangGraph の `create_supervisor` (legacy) と new tool-calling recommendation を比較する。supervisor が見るものをより制御しやすいのはどちらか。Anthropic が raw worker context ではなく sub-answers だけを synthesis に渡す理由は?

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Supervisor | "Lead agent" | plan、delegate、synthesize する orchestrator agent。work 自体はしない。 |
| Worker | "Subagent" | supervisor に narrow scope で呼ばれ、自分の context window を持つ focused agent。 |
| Orchestrator-worker | "Supervisor pattern" | 同じものの別名。2026 literature では両方使う。 |
| Fresh context | "Clean window" | worker の context は system prompt と assigned question から始まり、lead history を含まない。 |
| Rainbow deployment | "Gradual rollout" | long-running stateful agents は blue-green ではなく versioned drain-and-replace が必要。 |
| Token dominance | "Context is the variable" | Anthropic によれば research-eval variance の 80% は model choice ではなく total tokens used から来る。 |
| Scale effort | "Match agent count to complexity" | lead が query difficulty を見積もり、1 vs 10+ workers を使い分ける。 |
| Synthesis conflict | "Workers disagree" | 2 workers が contradictory facts を返す。lead は silent に一方を選ばず disagreement を surface する必要がある。 |

## 参考文献

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — supervisor pattern の production reference
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — tool-calling supervisor は現在の recommended form
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — legacy helper。2026 production でもまだ使われる
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — handoff-based supervisor variant
