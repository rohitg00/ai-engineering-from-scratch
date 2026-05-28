# Group Chat and Speaker Selection

> AutoGen GroupChat と AG2 GroupChat は、N 個の agent が1つの会話を共有する。selector function (LLM、round-robin、custom) が次に誰が話すかを選ぶ。これは emergent multi-agent conversation の典型だ。agent は static graph 内の自分の役割を知っているわけではなく、共有 pool に反応するだけである。AutoGen v0.2 の GroupChat semantics は AG2 fork で保持された。AutoGen v0.4 は event-driven actor model として作り直された。Microsoft は 2026 年 2 月に AutoGen を maintenance mode にし、Semantic Kernel と統合して Microsoft Agent Framework (RC February 2026) にまとめた。GroupChat primitive は AG2 と Microsoft Agent Framework の両方に残っている。一度学べば、どこでも使える。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 04 (Primitive Model)
**所要時間:** 約60分

## 問題

workflow が既知なら static graph (LangGraph) は優れている。だが実際の会話は静的ではない。coder が reviewer に聞くことも、researcher に聞くことも、writer に聞くこともある。あらゆる handoff を hardcode すると edge explosion が起きる。必要なのは、*agents が共有 pool に反応し*、誰が次に話すかを何らかの function が決める仕組みだ。

それが AutoGen GroupChat の役割である。

## コンセプト

### The shape

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

すべての agent がすべての message を見る。各 turn で selector function が呼ばれ、次に話す agent を選ぶ。

### The three selector flavors

**Round-robin.** 固定 cycle。deterministic。N に対して線形にスケールするが context を無視する。topic が legal review でも coder に turn が来る。

**LLM-selected.** recent pool を読んで最適な next speaker を返す LLM call。context-aware だが遅い。各 turn に LLM call が1つ増える。AutoGen の default。

**Custom.** 任意の logic を持つ Python function。典型例は fallback rule 付き LLM-selected (例: "coder の後は必ず verifier に turn を渡す")。

### The ConversableAgent API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` が selector を保持する。agent が turn を完了すると、manager が selector を呼び、selector が次の agent を返す。termination condition まで loop が続く。

### Termination

よくある pattern は3つ:

- **Max rounds.** turn 総数の hard cap。
- **"TERMINATE" token.** agent が sentinel message を出せる。manager はそれを見たら止める。
- **Goal-reached check.** lightweight verifier が各 turn で走り、chat が完了したら止める。

### The AutoGen → AG2 split and the Microsoft Agent Framework merge

2025 年初頭、Microsoft は AutoGen (v0.4) を event-driven actor model 中心に大きく rewrite し始めた。community は AutoGen v0.2 の GroupChat semantics を AG2 として fork し、early adopter が統合済みだった API を保持した。

2026 年 2 月、Microsoft は AutoGen を maintenance mode にし、event-driven actor model を **Microsoft Agent Framework** (RC February 2026、現在は Semantic Kernel と統合) に merge すると発表した。GroupChat concept は両方の track に残るが、実装 details は異なる。v0.2-compatible code では AG2 が推奨 upstream だ。

### When GroupChat fits

- **Emergent conversations。** 可能な next-speaker をすべて事前配線したくない。
- **Role-mixing tasks。** coder が researcher に聞き、researcher が archivist に聞き、archivist が coder に返す。flow は DAG ではない。
- **Exploratory problem-solving。** "assembly line" ではなく "brainstorm meeting" と考える。

### When it fails

- **Strict determinism。** LLM selector は一貫しない場合がある。同じ prompt でも run が変わると next speaker が変わる。
- **Sycophancy cascades。** agent が最も自信ありげに話した相手に従う。明示的に counter-prompt する。
- **Context bloat。** すべての agent がすべての message を読む。10 turn 後には context が巨大になる。projection (Lesson 15) を使って view を scope する。
- **Hot speakers。** selector が専門性を好むため、1つの agent が会話を支配する。selector feature として speaker balance を導入する。

### Group chat vs supervisor

同じ primitives を使うが、default が違う:

- Supervisor: 1つの agent が plan し、他が execute する。selector は「planner に何をすべきか聞く」。
- Group chat: すべての agent が peer。selector は shared pool に対する function。

どちらも Lesson 04 の4つの primitive を使う。group chat は LLM-selected orchestration と full-pool shared state を default にする。

## 実装

`code/main.py` は stdlib だけで GroupChat を実装する。3つの agent (coder、reviewer、manager)、round-robin と LLM-selected 版、`TERMINATE` token による termination を含む。

demo は両 variant の conversation transcript と selector の decision trace を出力する。

Run:

```
python3 code/main.py
```

## Use It

`outputs/skill-groupchat-selector.md` は、与えられた task に対する GroupChat selector を設定する。round-robin / LLM-selected / custom のどれにするか、どんな selector input (recent messages、agent specialties、turn counts) を使うかを決める。

## Ship It

Checklist:

- **Max rounds cap。** 常に置く。typical task では 10-20。
- **Speaker-balance metric。** agent ごとの turn 数を追跡し、imbalance が threshold を超えたら alert する。
- **Termination token。** `TERMINATE` または dedicated verifier agent。
- **Projection or scoped memory。** 約10 message を超えたら、context bloat を防ぐため各 agent に scoped view だけを渡すことを検討する。
- **Selector logging。** LLM-selected variant では selector の input と choice の両方を log する。そうしないと debugging が不可能になる。

## Exercises

1. `code/main.py` を実行する。round-robin と LLM-selected で conversation を比較する。それぞれでどの agent が支配的になるか。
2. selector に "max-speaks-per-agent" rule を追加する。transcript にどう影響するか。
3. goal-reached termination を実装する。reviewer が "approved" を返したら stop する。round cap の前にどのくらいの頻度で trigger するか。
4. AutoGen stable docs の GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) を読む。`GroupChatManager` が使う default selector を特定する。
5. AG2 repo (https://github.com/ag2ai/ag2) を読み、v0.2 GroupChat と v0.4 event-driven version を比較する。v0.4 はどの具体的な性質 (throughput、fault-tolerance、composability) を追加するか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | shared message pool + selector function。AutoGen / AG2 primitive。 |
| Speaker selection | "Who talks next" | next agent を選ぶ function。round-robin、LLM-selected、custom。 |
| GroupChatManager | "The meeting host" | selector を所有し、turn を loop する AutoGen component。 |
| ConversableAgent | "The base agent" | AutoGen base class。message を send/receive できる agent。 |
| Termination token | "The 'stop' word" | chat を終了させる sentinel string (通常 `TERMINATE`)。 |
| Hot speaker | "One agent dominates" | selector が同じ agent を選び続ける failure mode。 |
| Context bloat | "Pool grows unbounded" | 各 agent がすべての prior message を読むため、turn とともに context が増える。 |
| Projection | "Scoped view" | context bloat を防ぐための、shared pool に対する role-specific view。 |

## 参考文献

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — reference implementation
- [AG2 repo](https://github.com/ag2ai/ag2) — community AutoGen v0.2 continuation
- [Microsoft Agent Framework docs](https://microsoft.github.io/agent-framework/) — 統合後の successor、RC February 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) — event-driven actor model rewrite details
