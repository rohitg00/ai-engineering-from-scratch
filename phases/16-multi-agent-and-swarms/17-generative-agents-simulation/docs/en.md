# Generative Agents と創発的シミュレーション

> Park et al. 2023（UIST '23, arXiv:2304.03442）は、25 体のエージェントからなる sandbox **Smallville** に、3 部構成のアーキテクチャを入れた。**memory stream**（自然言語ログ）、**reflection**（エージェントが自分の stream から生成する高次の synthesis）、**plan**（日単位の behavior、その後 sub-plans）である。画期的な結果は、Valentine's Day party の創発だった。1 体のエージェントに「Valentine's Day party を開きたい」という seed を与えただけで、それ以上の scripting なしに、招待が集団内に広がり、日程が調整され、最初はそれをまったく知らなかった 24 体のエージェントから party が実現した。ablation は、believability には 3 components すべてが必要であることを示す。documented failures は spatial-norm errors（閉店中の店に入る、1 人用 bathroom を共有する）である。これは 2026 年の agent simulations と multi-agent social evaluation の reference architecture である。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**所要時間:** 約75分

## 問題

多くの multi-agent systems は、planner が計画し、coder が書き、reviewer がレビューする tightly-scripted teams である。これは well-defined tasks には有効だ。しかし、agent が memory、priorities、open world を持つときに生じる、創発的で unscripted な behavior は捉えられない。研究、社会シミュレーション、そしてますます game AI では、この第 2 の種類が必要になる。

Smallville architecture はその benchmark である。Park 2023 以前の agent simulations は浅い script-followers が中心だったが、それ以降、この pattern は open world の generative agents における default になった。2026 年に agent simulation を構築するなら、Smallville の 3 components を使うか、使わない理由を明示的に正当化することになる。

## コンセプト

### 3 つの components

**Memory stream。** observations、actions、reflections、plans の append-only log。各 entry は timestamp、type、description（natural language）、そして derived metadata を持つ: **recency**、**importance**（agent 自身が 1-10 で評価）、**relevance**（current query との cosine similarity）。

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

Memory retrieval は 3 つの score を組み合わせる: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`。Top-k entries が current prompt に入る。

**Reflection。** 定期的に（N memories ごと、または重要 events で）、agent は recent memories から高次の syntheses を生成する。Reflection entries は stream に戻され、他の memory と同じように retrieval 可能になる。これにより agent は「understandings」を形成する。これはこの architecture における long-term beliefs に相当する。

**Plan。** Top-down decomposition。まず大まかな day-level plan（「work に行く、Klaus と dinner を食べる」）。次に hour-level plans。そして action-level plans。Plans は revisable である。observation が plan と矛盾したら、agent は影響を受ける segment だけを replan する。

### なぜ 3 つすべてが重要か（ablation）

Park et al. は observation、reflection、plan の各要素を落とした ablations を実行した。どれを落としても believability が下がる:

- **observation** がないと、agent は context を取り逃がし、古い beliefs に基づいて行動する。
- **reflection** がないと、agent は高次の beliefs を形成できず、interactions は浅いままになる。
- **plan** がないと、behavior は reactive noise になり、goals が散逸する。

human raters による believability scores は 3 つすべてがあるとき最も高く、どれか 1 つを落とすと measurable regression が生じる。

### Valentine's Day の創発

1 体の agent、Isabella Rodriguez に「Feb 14 5pm に Hobbs Cafe で Valentine's Day party を開きたい」という goal を seed する。他の 24 agents にはその seed を与えない。simulated days の間に:

1. Isabella の plan に人を招待することが含まれる。
2. 各 invitation が neighbor の memory stream に observation として入る。
3. その neighbor の reflection が「Isabella is throwing a party」という beliefs を生成する。
4. neighbor の plan に「Feb 14 の party に参加する」が組み込まれる。
5. neighbors が別の neighbors に伝える。central coordination なしに invitation が広がる。
6. Feb 14 5pm、複数の agents が Hobbs Cafe に集まる。

これは technical sense での emergence である。system-level behavior（party）が、central orchestrator なしに、local interactions（bilateral invitations + individual planning）から生じた。

### documented failure modes

Park et al. は明示的に次を記録している:

- **Spatial norm errors。** Agents が閉店中の store に入る。1 人用 bathroom を同時に使おうとする。食事向けでない room で食事をする。model は environment だけから social-physical norms を推論しない。
- **Memory overflow。** deep simulation runs では memory-retrieval cost が増える。実用上の対処は periodic memory compaction（summarize-and-prune）と low-importance entries への decay。
- **Reflection hallucination。** reflections が memory stream に存在しない relationships を invent することがある。mitigation: reflection prompts に source memory ids を含め、retrieval time に verify する。

これらは production-relevant failure modes である。2026 年のどの agent simulation もそれらを継承する。

### 3-component implementation rules

1. **Memory は append-only。** memory entry を mutate しない。correction は新しい entry。
2. **Importance scores は安くする。** write time に LLM へ importance 1-10 の評価をさせる。score は cache する。
3. **Retrieval は ranked であり、filtered ではない。** combined score の Top-k。hard filters は context を失うため使わない。
4. **Reflection は periodic に走る。** unprocessed memories の importance 合計が threshold（例: 150）を超えたとき trigger する。
5. **Plans は revisable。** new observation が plan と矛盾したら、whole plan ではなく affected segment だけを regenerate する。

### Smallville を超える generative agents

2024-2026 年の follow-up literature はこの architecture を拡張している:

- **policy / market research 向け multi-agent social simulation。** Smallville 風の populations が features に対する user behavior を simulate する。A/B tests より速いが、accuracy は議論がある。
- **games 向け NPC AI。** Smallville agents を持つ RPG は scripted quests ではなく emergent storylines を生む。
- **Generative-agent evaluation benchmarks。** metric は task accuracy ではなく、long runs にわたる behavior の believability + coherence になる。

この architecture が reference である。extensions は components を差し替える（memory に vector store、retrieval-augmented reflection、neurosymbolic plan）が、3-part structure は維持する。

### multi-agent engineering にとってなぜ重要か

Smallville は、components が正しければ multi-agent emergence が安価に得られる proof of concept である。この architecture はすでに open-source models でも再現されている（smaller LLMs では believability が急落ではなく緩やかに低下する）。**emergent social behavior** が必要な production system はこの形を使う。**tight task execution** が必要な system は、この phase の前半で扱った supervisor / roles / primitives patterns を使う。

## 実装

`code/main.py` は stdlib Python で 3 components を実装する。agent policies は scripted で、real LLM は使わない。demo は Valentine's-party emergence を miniature で再現する:

- `MemoryStream` — recency/importance/relevance retrieval を備えた append-only log。
- `reflect(stream)` — recent high-importance memories に対する scripted reflection。
- `plan(agent_state)` — current beliefs に基づく day-level と hour-level plans。
- Scenario: 5 agents。Agent 1 は「5pm に party を開く」から始める。simulated ticks の間に invitation が広がり、agents が converge する。

Run:

```
python3 code/main.py
```

期待される出力: tick-by-tick trace。final tick までに 5 agents 中少なくとも 3 agents が plan に party を持ち、party location に converge する。single seed が orchestrator なしに coordinated arrival を生んだことが分かる。

## Use It

`outputs/skill-simulation-designer.md` は generative-agent simulation を設計する。agents 数、memory schema、reflection cadence、plan horizon、evaluation metric を定義する。

## Ship It

production simulations の rules:

- **Memory is the database。** scale では real store（vector DB、Postgres）を選ぶ。in-memory stdlib は prototypes 用。
- **retrieval trace を log する。** 各 action について、それを動かした top-k memories を log する。これが debug ability である。
- **agent ごとの token budget を切る。** tick あたり各 agent の retrieve + reflect + plan は O(k) LLM calls。N agents × T ticks × calls-per-tick は budget を容易に超える。
- **memory を periodic に compact する。** low-importance entries を summarize-and-prune する。retention policy は design decision であって detail ではない。
- **spatial / social norm violations を明示的に detect する。** architecture はそれらを学習しない。

## Exercises

1. `code/main.py` を実行する。3+ agents が party に converge することを確認する。agents を 10 に増やすと、emergence はまだ起きるか。
2. reflection step を取り除く。behavior はどう見えるか。Park 2023 の ablation finding に対応づける。
3. 競合する seeded goal（「Klaus wants to give a research talk at 5pm」）を導入する。agents は分裂するか、片方の goal が支配するか。何がそれを決めるか。
4. spatial constraints を追加する: Hobbs Cafe は最大 4 agents まで。simulation は overflow を graceful に扱うか、それとも「single-person bathroom」failure pattern に当たるか。
5. Park et al.（arXiv:2304.03442）Section 6（emergent behavior experiments）を読む。miniature で再現できない behavior を 1 つ特定する。それを再現するには architecture のどの component を強化する必要があるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | 「agent の diary」 | observations、actions、reflections、plans の append-only log。 |
| Recency | 「memory がどれだけ新しいか」 | age による exponential-decay score。 |
| Importance | 「agent がどれだけ気にするか」 | write time に 1-10 で self-rated。cache される。 |
| Relevance | 「current query とどれだけ関係するか」 | cosine similarity（embedding-based）。 |
| Reflection | 「higher-order belief」 | recent memories から生成され、新しい memory として再投入される synthesis。 |
| Plan | 「day/hour/action decomposition」 | top-down plan tree。observations が矛盾すると revisable。 |
| Smallville | 「Park 2023 の sandbox」 | Valentine's Day emergence を生んだ 25-agent simulation。 |
| Believability | 「quality metric」 | behavior が plausible agent らしく見えるかの human-rater score。 |

## 参考文献

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) — reference architecture
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) — publication venue
- [Smallville code release](https://github.com/joonspk-research/generative_agents) — reference Python implementation
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) — structured-memory agents の prior art
