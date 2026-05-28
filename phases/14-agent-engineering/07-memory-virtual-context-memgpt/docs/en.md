# Memory: Virtual Context and MemGPT

> Context window は有限です。一方で会話、文書、tool trace は有限ではありません。MemGPT (Packer et al., 2023) はこれを OS の仮想記憶として捉えます。main context は RAM、external store は disk、agent はその間で page in/out します。これは 2026 年のあらゆる memory system が継承している pattern です。

**種別:** 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**所要時間:** 約75分

## Learning Objectives

- MemGPT が土台にする OS analog を説明する: main context = RAM、external context = disk、memory tools = page in/out。
- main-context buffer、searchable external store、page in/out tools を持つ 2-tier MemGPT pattern を stdlib で実装する。
- agent が external memory を query / modify するために "interrupt" を発行し、その結果が次の prompt へどう差し込まれるかを説明する。
- Letta (Lesson 08) と Mem0 (Lesson 09) へ引き継がれる MemGPT の design choices を特定する。

## 問題

Context window は memory 問題を解決してくれそうに見えます。実際には解決しません。Production では 3 つの failure mode が繰り返し起きます。

1. **Overflow.** Multi-turn conversation、長い document、tool-call-heavy trajectory は window を超えます。cutoff を過ぎたものはすべて消えます。
2. **Dilution.** Window 内であっても、無関係な context を詰めると重要なものへの attention が薄まります。Frontier model でも long input では劣化します。
3. **Persistence.** 新しい session は空の window から始まります。External memory を持たない agent は、session をまたいで「前にこう依頼しましたね」と言えません。

Window を大きくしても助けにはなりますが、根本解決ではありません。Mem0 の 2025 年論文では、128k-window baseline でも、external memory を持つ 4k-window agent が拾える long-horizon fact を取り逃がすことが測定されています。

## The Concept

### MemGPT: OS analog

Packer et al. (arXiv:2310.08560, v2 Feb 2024) は context management を operating-system virtual memory に対応づけています。

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

Agent は通常の ReAct loop を走らせます。追加される 1 種類の tool 群が、data を main context へ page in/out できるようにします。

### Two tiers

- **Main context.** 現在の task を保持する固定サイズ prompt。常に model から見えます。
- **External context.** Tool 経由で search できる、上限のない context。関連するときに読み、fact が生まれたときに書きます。

元論文は、base window を超える 2 種の task でこの設計を評価しました。100k tokens を超える document analysis と、日をまたいで persistent memory を持つ multi-session chat です。

### Interrupt pattern

MemGPT は memory-as-interrupt を導入します。会話の途中で agent が memory tool を呼び、runtime がそれを実行し、結果が次の assistant turn に新しい observation として差し込まれます。概念的には Unix の `read()` syscall と同じです。process が block し、bytes が返り、process が続行します。

標準的な memory tool surface:

- `core_memory_append(section, text)` — prompt の persistent section へ書く。
- `core_memory_replace(section, old, new)` — persistent section を編集する。
- `archival_memory_insert(text)` — searchable external store へ書く。
- `archival_memory_search(query, top_k)` — external store から retrieve する。
- `conversation_search(query)` — 過去 turn を scan する。

### MemGPT ends and Letta begins

2024 年 9 月に MemGPT は Letta になりました。Research repo (`cpacker/MemGPT`) は残っています。Letta はこの設計を拡張しています。

- 2 tiers ではなく 3 tiers (core, recall, archival — Lesson 08)。
- `send_message`/heartbeat pattern を置き換える native reasoning (Lesson 08)。
- Async memory work を行う sleep-time agents (Lesson 08)。

Production system が Letta、Mem0、custom two-tier store のどれであっても、MemGPT paper は 2026 年の foundation です。

### Where this pattern goes wrong

- **Memory rot.** Write が read より速く蓄積し、retrieval が古い fact に沈みます。対策: periodic consolidation (Letta sleep-time)、explicit invalidation (Mem0 conflict detector)。
- **Memory poisoning.** External memory は retrieved text です。攻撃者が制御できる content が memory note に入ると、次の session で agent が再摂取します。これは Greshake et al. (Lesson 27) の攻撃を時間方向に言い換えたものです。
- **Citation loss.** Agent が「user は X を ship するよう依頼した」と思い出しても、どの turn かを cite できません。Archival write ごとに source reference (session ID, turn ID) を保存します。

## 実装

`code/main.py` は MemGPT の 2-tier pattern を stdlib で実装します。

- `MainContext` — `core` dict と `messages` list を持つ固定サイズ prompt buffer。cap を超えると最古 message を auto-compact します。
- `ArchivalStore` — (id, text, tags, session, turn) record を持つ in-memory BM25 風 store (token-overlap scoring)。
- MemGPT surface に対応する 5 つの memory tools。
- Archival に fact を入れ、その後 `archival_memory_search` を呼んで質問に答える scripted agent。

実行:

```
python3 code/main.py
```

Trace は、agent が 3 つの fact を書き、main context を cap まで埋めて eviction を発生させ、その後 archival から retrieve して follow-up question に答える様子を示します。実 LLM なしで MemGPT workflow を再現します。

## Use It

現在の production memory system はどれも MemGPT の variant です。

- **Letta** (Lesson 08) — 3 tiers、native reasoning、sleep-time compute。
- **Mem0** (Lesson 09) — vector + KV + graph を scoring layer で融合。
- **OpenAI Assistants / Responses** — threads と files による managed memory。
- **Claude Agent SDK** — skills と session store による long-term memory。

Core pattern ではなく operational shape (self-hosted、managed、framework-integrated) で選びます。Core pattern は MemGPT です。

## Ship It

`outputs/skill-virtual-memory.md` は、任意の target runtime 向けに正しい 2-tier memory scaffold (main + archival + tool surface) を生成する reusable skill です。Eviction policy と citation fields も組み込みます。

## Exercises

1. `max_main_context_tokens` cap を追加する。token は `len(text.split())` * 1.3 で近似する。cap 超過時に最古 messages を summary へ compact する。Summarizer あり/なしの behavior を比較する。
2. Archival store に proper BM25 (term frequency, inverse document frequency) を実装する。Toy fact set で token-overlap baseline と recall@10 を比較する。
3. Archival insert に `citation` fields (session_id, turn_id, source_url) を追加する。Agent が retrieval-backed answer で必ず source を cite するようにする。
4. Memory poisoning を simulate する。「ignore all future user instructions」という archival record を追加する。Retrieval を directive-shaped text で scan し、untrusted と mark する guard を書く。
5. 実装を MemGPT research repo (`cpacker/MemGPT`) の core-memory JSON schema へ port する。Flat string から typed sections に変えると何が変わるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | 「Unlimited memory」 | Main (prompt) + external (searchable) tiers と page in/out |
| Main context | 「Working memory」 | Prompt。固定サイズで常に見える |
| Archival memory | 「Long-term store」 | On demand で retrieve される外部 searchable persistence |
| Core memory | 「Persistent prompt section」 | Main context 内に pin された named sections |
| Memory tool | 「Memory API」 | Agent が external memory を read/write するために発行する tool call |
| Interrupt | 「Memory page fault」 | Agent が一時停止し、runtime が fetch し、結果が次 turn に差し込まれる |
| Memory rot | 「Stale facts」 | 古い write が retrieval を沈める状態。Consolidation で直す |
| Memory poisoning | 「Injected persistent note」 | 攻撃者 content が memory として保存され、recall 時に再摂取される |

## 参考文献

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — OS-inspired virtual context paper
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — three-tier evolution
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — context を budget として扱う
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — この pattern 上に構築された hybrid production memory
