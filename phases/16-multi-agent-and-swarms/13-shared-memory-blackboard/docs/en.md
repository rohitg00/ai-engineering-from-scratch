# Shared Memory and Blackboard Patterns

> 2026 年の multi-agent system では2つの approach が併存している。**message pool** (AutoGen GroupChat や MetaGPT のように全員が全員の message を見る) と、**subscription 付き blackboard** (Context-Aware MCP や Matrix framework のように agent が relevant event を subscribe する) だ。どちらも multi-agent system の唯一の stateful part であり、つまり興味深い bug が潜む場所でもある。参照すべき failure mode は **memory poisoning** だ。1つの agent が「fact」を hallucinate し、他の agent がそれを verified として扱い、即時 crash よりはるかに debug しにくい形で accuracy が徐々に低下する。この lesson では stdlib で両方の structure を作り、poisoning attack を注入し、production で実際に効く3つの mitigation を示す。

**種別:** 学習 + 構築
**言語:** Python (stdlib, `threading`)
**前提条件:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**所要時間:** 約75分

## 問題

multi-agent system には、agent が fact を共有する場所が必要だ。文字通りの選択肢は「すべてを message として渡す」ことだが、それは余分な copy を伴う shared state の再発明である。別の選択肢は「全員に global log を与える」ことだが、global log は無制限に増え、poison されやすい。3つ目は「agent ごとに view を project する」ことだ。これは scalable だが schema が重い。

agent の1つが hallucinate し、その hallucination を shared state に書き込むと、その state を読む downstream agent は hallucination を fact として採用する。人間が気づく頃には reasoning chain は5段階深く、root cause は3番目に書かれた message だったりする。multi-agent accuracy decay の debugging は crash の debugging より難しい。

これが memory poisoning だ。MAST taxonomy (Cemri et al., arXiv:2503.13657) で2番目によく文書化された failure family であり、構造的な問題である。provenance と、書き込めない verifier を持たない shared-memory design は、いずれ必ずこれを示す。

## コンセプト

### The two main topologies

**Full message pool.** すべての agent がすべての message を読む。AutoGen GroupChat と MetaGPT がこれを使う。simple、transparent、inspectable だが、約10 agent を超えると各 agent の context が他 agent の作業で埋まるため scaling しない。

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.** agent が topic への interest を宣言し、substrate が relevant message だけを route する。CA-MCP (arXiv:2601.11595) と Matrix decentralized framework (arXiv:2511.21686) がこれを使う。より大きく scale するが、subscription が意味を持つように upfront schema design が必要になる。

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### When each wins

- **Full pool** は agent が少なく (< 10)、heterogeneous で、conversation が short-horizon のときに勝つ。全員がすべてを見るなら、誰が何を言ったかの reasoning は trivial だ。
- **Blackboard** は agent が多く、role としては homogeneous だが instance 数が多い (swarms)、かつ conversation が long-running のときに勝つ。routing が token cost と context pollution を節約する。

production system ではよく混在する。上位に小さな full pool (planning layer)、下位に blackboards (worker layer) を置く。

### Memory poisoning, in one scenario

3つの agent が research task に取り組む。Agent A は retrieval agent。Agent B は summarizer。Agent C は analyst。

1. A が page を fetch し、shared state に message を書く: "The study reports a 42% accuracy improvement."
2. fetch した page は実際には "4.2% improvement" と言っていた。A が小数点を hallucinate した。
3. B は shared state を読み、"Large 42% accuracy gain reported (source: A)." と書く。
4. C は shared state を読み、"Recommend adoption — 42% lift is transformative." と書く。
5. final report は存在しなかった 42% という数値を引用する。

どの agent も crash していない。test も fail していない。system は「動いた」。hallucination は shared state を通じて、1つの agent の context から downstream agent 全員の reasoning に移った。

### Why this is structural

shared state がなければ、agent A の hallucination は A の context に留まる。downstream agent は再 fetch または再 derive して error に気づくかもしれない。naive shared state では、A の context が全員の context になり、hallucination が fact として laundering される。

問題は shared state そのものではない。provenance と independent verifier のない shared state が問題である。3つの mitigation がこれに対応する:

1. **すべての write に provenance を付与する。** shared state の各 entry は、誰が、いつ、どの prompt で、(該当するなら) どの source を cite して書いたかを記録する。downstream agent は provenance に応じて skeptical に読む。
2. **write を version 化し、append-only として扱う。** correction は古い entry を in-place update するのではなく、それを supersede する new entry である。audit trail を保持する。
3. **shared state に書き込めない agent を少なくとも1つ置く。** read-only verifier agent が entry を sample し、source を再 fetch して inconsistency を flag する。pool に書き込めないため、pool によって poison されない。

### Blackboard precedent (Hayes-Roth, 1985)

blackboard pattern は LLM agents より40年前から存在する。Hayes-Roth (1985, "A Blackboard Architecture for Control") は、global blackboard を observe し、partial solution を contribute し、他の source を trigger する specialist Knowledge Sources を説明した。2026 年の blackboard (CA-MCP、Matrix) は、LLM agents を Knowledge Sources、JSON blobs を partial solutions とした同じ pattern だ。古い literature には、write contention、opportunistic control、consistency への解決策がすでに文書化されており、modern system はそれを再発見している。

### Projection vs full view

pure blackboard は、すべての subscriber に同じ projection (topic-scoped) を与える。より積極的な設計は **per-agent projection** だ。各 agent は自分の role に合わせた view を受け取る。LangGraph の state reducers が 2026 年の canonical implementation である。reducer function が global state を role-specific slice に fold する。

per-agent projection はさらに scale するが、schema が必要になる。schema がなければ、各 agent の prompt 内で ad-hoc projection を再構築することになる。

### Write-contention patterns

複数 agent が同時に書くことは、LLM problem である前に concurrency problem だ。効く pattern は3つ:

- **Sequential writer (single producer).** すべての write を1つの coordinator agent に通し、serialize する。simple だが bottleneck。
- **Optimistic concurrency with versioning.** 各 entry が version を持つ。writer は version mismatch で fail し retry する。classic database technique。
- **Topic partitioning.** 異なる agent が異なる topic を所有する。cross-topic contention がない。設計された partition boundary が必要。

2026 年の framework の多くは sequential writer を default にする。LLM call は十分遅いため contention は稀で、bottleneck はあまり痛くない。

### The unwritable verifier

最も重要な mitigation は read-only verifier だ。implementation rules:

- verifier は team と state を共有する (blackboard または pool を読む)。
- verifier は shared state への write handle を持たない。別の verification channel だけに書く。
- verifier は write で cite された source を independently fetch する。disagreement を flag する。
- verifier の output は human または別の decision agent に route し、pool に feed back しない。

この分離がないと、verifier の output が pool の新 entry になり、poisoned pool が verifier を poison し、verifier が verification を poison する。

## 実装

`code/main.py` は stdlib Python で両 topology、toy poisoning attack、3つの mitigation を実装する。

- `MessagePool` — thread-safe append-only log with full read-out。
- `Blackboard` — topic-keyed pub/sub with per-agent subscriptions。
- `ProvenanceEntry` — すべての write が (writer、timestamp、prompt_hash、source_uri) を記録する。
- `PoisoningScenario` — agent A が小数点を hallucinate する3 agent research task を実行し、final report を出力する。
- `Verifier` — source を再 fetch し inconsistency を flag する read-only agent。同じ scenario を verifier 付きで実行する。

Run:

```
python3 code/main.py
```

期待される出力:
- Run 1 (no verifier): hallucinated 42% が final report に伝播する。
- Run 2 (with verifier): verifier が inconsistency を flag し、pool は "flagged" とラベルされ、final report は retraction を含む。

## Use It

`outputs/skill-memory-auditor.md` は、multi-agent system の shared-memory design を provenance、versioning、verifier separation の観点で audit する skill だ。new multi-agent architecture を production 前にこれで確認する。

## Ship It

あらゆる shared-memory design で:

- すべての write に provenance を記録する: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`。
- log を append-only にする。correction は superseded entry を参照する new entry にする。
- independent source access を持つ read-only verifier agent を少なくとも1つ deploy する。
- verifier output は shared pool ではなく、別 channel に route する。
- supersession である write の比率を log する。比率上昇は hallucination pattern の早期 evidence になる。

## Exercises

1. `code/main.py` を実行する。run 1 が hallucination を伝播し、run 2 がそれを捕捉することを確認する。
2. 2つ目の hallucination を追加する。agent B が dataset size を捏造する。verifier はどちらにも手作業 tuning なしで両方を捕捉すべき。
3. full pool を topic partitions (`prices`, `summaries`, `analyses`) を持つ blackboard に切り替える。topic partitioning はどの poisoning scenario を難しくし、どれには効かないか。
4. Hayes-Roth (1985, "A Blackboard Architecture for Control") を読む。この lesson で扱っていない control pattern のうち、2026 system に有益なものを2つ特定する。
5. CA-MCP (arXiv:2601.11595) を読む。その Shared Context Store を `code/main.py` の MessagePool または Blackboard class に map する。CA-MCP はその上にどの primitive を追加しているか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | すべての agent が読む append-only log。完全な transparency、poor scaling。 |
| Blackboard | "Shared workspace" | topic-keyed pub/sub。agent は relevant topic を subscribe する。より大きく scale する。 |
| Provenance | "Who wrote what" | 各 write の metadata: writer、timestamp、prompt、sources。 |
| Memory poisoning | "Hallucinations spreading" | 1つの agent の error が shared state に入り、downstream agents が fact として採用する。 |
| Append-only | "No in-place updates" | correction は supersede する new entry。audit trail を保持する。 |
| Unwritable verifier | "Independent auditor" | source を再 fetch し inconsistency を flag する read-only agent。 |
| Projection | "Scoped view" | global state から計算された per-agent view。LangGraph reducers が canonical case。 |
| Knowledge Source | "Specialist agent" | blackboard participant に対する Hayes-Roth 1985 の用語。 |

## 参考文献

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST taxonomy。memory poisoning は coordination-failure sub-family
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) — coordinated MCP servers の Shared Context Store
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) — central orchestrator なしの message-queue-based blackboard
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — production の per-agent projection pattern
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — production deployment からの provenance と verification notes
