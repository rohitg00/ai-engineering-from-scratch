# Parallel / Swarm / Networked Architectures

> supervisor との対比: 中央の意思決定者を置かない。agent は共有 event bus を読み、非同期に作業を取り、結果を書き戻す。LangGraph は、分散型で動的な環境向けに「Swarm Architecture」を明示的にサポートしている。Matrix (arXiv:2511.21686) は control flow と data flow の両方を、分散 queue を流れる直列化された message として表現し、orchestrator のボトルネックをなくす。トレードオフは明確だ。scalability と引き換えに determinism と traceability を手放す。swarm は、多数の独立した sub-problem を持つタスクに合う。一貫した単一の plan が必要なタスクには合わない。

**種別:** 学習 + 構築
**言語:** Python (stdlib, `threading`, `queue`)
**前提条件:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**所要時間:** 約75分

## 問題

supervisor は数人の worker まではスケールする。では数百人ならどうか。supervisor 自身がボトルネックになる。誰が何をするかという判断が、すべて1つの agent を通るからだ。1つの遅い plan step が、システム全体を止める。

swarm architecture は設計を反転させる。中央 planner が作業を dispatch する代わりに、worker が共有 queue から作業を取る。「coordination」は event bus の semantics に埋め込まれる。orchestrator はいない。システムは queue が耐えられるところまでスケールする。

## コンセプト

### The shape

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

orchestrator はいない。各 worker は、task を取り、処理し、result を書き込む。必要なら follow-up も enqueue する。この繰り返しだ。

### When swarm fits

- **独立した task が多数ある。** scraping、変換、分類。task 同士が依存しない。
- **所要時間がばらつく work。** 100ms の task と 10s の task が混在するなら、swarm は自動で load balance する。速い worker が次の job を取る。supervisor は所要時間を事前に見積もらなければならない。
- **determinism より throughput。** 厳密な順序より、全体の完了時間が重要な場合。

### When swarm fails

- **順序付き workflow。** step 3 が step 2 の output を必要とするなら、swarm では step 2 の完了前に step 3 が走る危険がある。
- **global plan が必要な task。** 複雑な research question には planner が効く。researcher の swarm は独立した fact を生むが、一貫した report にはならない。
- **debugging。** 中央 log がなく非同期に動くため、bug の再現が高くつく。

### Matrix (arXiv:2511.21686)

Matrix は、swarm を自然な結論まで押し進めた 2025 年の paper だ。control flow と data flow の両方が、分散 queue 上の直列化 message になる。中央 coordinator はいない。fault tolerance は message durability から得られる。scalability は system ではなく message broker の問題になる。

貢献は、multi-agent coordination を「supervisor が次にどの agent を選ぶか」ではなく「この agent はどの message topic を subscribe するか」として扱う programming model だ。これにより、system は pub/sub event mesh のように見える。

### LangGraph's Swarm Architecture

LangGraph 2025 docs は、multi-agent pattern の1つとして「Swarm Architecture」を明示的に説明している。agents は node だが、edge は cycle を持つ directed graph を形成し、任意の node が pool から activate され得る。worker は supervisor assignment ではなく、condition によって available work を選ぶ。

### Failure mode: starvation and hot-spotting

すべての worker が最も早く取れる task を引くと、long-running task は最後の1つになるまで選ばれない。典型的な queue starvation だ。

mitigation:
- explicit aging 付き priority queue (待ち時間に応じて priority を上げる)。
- worker specialization: 一部の worker は "long" task だけを取る。
- back-pressure: queue に入る fast task の数を制限する。

### The content-based routing link

swarm は content-based routing (Lesson 22) と自然に組み合わさる。generic queue の代わりに、message type ごとに queue を持つ。specialist worker は自分の type だけを subscribe する。これが、数千 agent までスケールする message-bus architecture の土台になる。

## 実装

`code/main.py` は、共有 `queue.Queue` から task を取る4つの worker thread による swarm を実装する。task には所要時間のばらつきがある (速い task と遅い task)。demo は次を比較する:

- **Sequential baseline:** 1つの worker がすべての task を直列処理する。
- **Fixed assignment:** 各 task が特定 worker に事前割り当てされる (supervisor-style)。
- **Swarm:** worker が共有 queue から task を取る。

swarm は自動で load balance する。fixed assignment では、割り当てられた task が遅い worker を待つ間、速い worker が idle になる。

Run:

```
python3 code/main.py
```

output には worker ごとの task count (swarm は不均等だが最適に分散する) と wall-clock time が表示される。

## Use It

`outputs/skill-swarm-fit.md` は、ある task が swarm と supervisor のどちらを使うべきかを評価する。input は task independence、duration variance、ordering requirement、debuggability need。

## Ship It

Checklist:

- **aging 付き priority queue。** long-task starvation を防ぐ。
- **worker idempotency。** worker が途中で crash すると、task は複数回取られることがある。worker は idempotent でなければならない。
- **durable queue。** production では Kafka、Redis Streams、database-backed queue を使う。`queue.Queue` は in-memory のみ。
- **task ごとの observability。** すべての task に trace ID を持たせ、すべての worker が start/end をそれ付きで log する。
- **back-pressure。** worker が処理するより queue が速く増えるなら、producer を遅くする。

## Exercises

1. `code/main.py` を実行する。variable-duration workload で、swarm は sequential よりどれくらい速いか。fixed assignment よりどれくらい速いか。
2. priority queue 版を追加する (`queue.PriorityQueue` を使う)。task の "importance" field で priority を割り当てる。continuous load の下で low-priority task が starvation するか観察する。
3. hot-spot detector を実装する。ある worker が最も遅い worker の3倍以上の task を処理したら log する。それは task-duration distribution について何を示しているか。
4. Matrix paper (arXiv:2511.21686) の abstract と Section 3 を読む。Matrix が受け入れる具体的な tradeoff (scalability gain) と、手放すもの (traceability、determinism) を1つずつ挙げる。
5. swarm demo を `(task_type, payload)` tuple の `queue.Queue` に変換し、worker が特定 type だけを subscribe するようにする。task が heterogeneous な場合、どんな routing rule が妥当か。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | worker が shared queue から pull する。central orchestrator はいない。 |
| Event bus | "Agents subscribe to topics" | type や content によって task を worker に route する message broker。 |
| Starvation | "Task never runs" | 高 priority の work が継続的に到着するため、低 priority task が選ばれない。 |
| Hot-spotting | "One worker drowns" | 1つの worker に task が集中する load imbalance。 |
| Back-pressure | "Slow down the producer" | queue が満杯になったとき、upstream に production 停止を伝える mechanism。 |
| Idempotent worker | "Safe to re-run" | 同じ task を2回処理しても同じ result になる。worker が途中で crash し得るため必須。 |
| Durable queue | "Survives crashes" | disk または replicated storage に backed された queue。worker crash で task が失われない。 |
| Matrix framework | "Full message-passing swarm" | data flow と control flow の両方が distributed queue 上の serialized message。 |

## 参考文献

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — explicit swarm support
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) — full message-passing swarm
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) — why a specific production system explicitly chose supervisor over swarm
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) — event-driven actor rewrite。v0.2 の GroupChat より swarm に近い
