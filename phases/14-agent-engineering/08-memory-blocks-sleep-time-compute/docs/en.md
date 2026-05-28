# Memory Blocks and Sleep-Time Compute (Letta)

> MemGPT は 2024 年に Letta になりました。2026 年の進化では 2 つの idea が追加されます。Model が直接編集できる discrete functional memory blocks と、primary agent が idle の間に非同期で memory を consolidate する sleep-time agent です。これが 1 会話を超えて memory を scale させる方法です。

**種別:** 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 07 (MemGPT)
**所要時間:** 約75分

## Learning Objectives

- Letta が使う 3 つの memory tiers (core, recall, archival) と、それぞれの role を説明する。
- Memory-block pattern を説明する: Human block、Persona block、user-defined blocks を first-class typed object として扱う。
- Sleep-time compute とは何か、なぜ critical path の外に置くのか、なぜ primary agent より強い model を使えるのかを説明する。
- Primary agent が response を返し、sleep-time agent が turn 間で block を consolidate する scripted two-agent loop を実装する。

## 問題

MemGPT (Lesson 07) は virtual-memory control flow を解きました。Production では 3 つの問題が出てきます。

1. **Latency.** すべての memory operation が critical path に乗ります。User が待っている間に agent が prune、summarize、reconcile を行うと tail latency が跳ねます。
2. **Memory rot.** Write が蓄積します。矛盾した fact が残ります。Retrieval が stale content に沈みます。
3. **Structure loss.** Flat archival store では「Human block は常に prompt に入る」「Persona block は常に prompt に入る」「Task block は session ごとに swap する」を表現できません。

Letta (letta.com) は 2026 年の rewrite です。Memory blocks は structure を明示し、sleep-time compute は consolidation を critical path の外へ移します。

## The Concept

### Three tiers

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | 常に見える | Main prompt 内 | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | 任意の facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

Core は MemGPT core です。Recall は evicted tail を含む conversation buffer です。Archival は external store です。この split によって MemGPT の 2-tier overloading が整理されます。

### Memory blocks

Block は、core tier にある typed, persistent, editable section です。元の MemGPT paper では 2 つが定義されました。

- **Human block** — user に関する facts (name, role, preferences, goals)。
- **Persona block** — agent の self-concept (identity, tone, constraints)。

Letta は任意の user-defined blocks へ一般化します。現在の goal 用の `Task` block、codebase facts 用の `Project` block、hard constraints 用の `Safety` block などです。各 block は `id`, `label`, `value`, `limit` (character cap), `description` (model がいつ編集すべきかを知るため) を持ちます。

Blocks は tool surface 経由で編集できます。

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` — limit に近い block を condense する。

### Sleep-time compute

2025 年の Letta addition: critical path の外で background の 2 番目の agent を走らせます。Sleep-time agents は conversation transcript と codebase context を処理し、shared blocks に `learned_context` を書き、archival records を consolidate または invalidate します。

そこから得られる性質:

- **No latency cost.** Primary response は memory ops を待ちません。
- **Stronger model allowed.** Sleep-time agent は latency-constrained ではないため、より高価で遅い model を使えます。
- **Natural consolidation window.** User が待っていない間に dedup、summarize、contradicted facts の invalidate を行えます。

形は人間の働き方に近いです。Task を行い、寝かせると、long-term memory が一晩で落ち着きます。

### Letta V1 and native reasoning

Letta V1 (`letta_v1_agent`, 2026) は `send_message`/heartbeat と inline `Thought:` tokens を deprecated にし、native reasoning を使います。Responses API (OpenAI) と extended thinking 付き Messages API (Anthropic) は reasoning を separate channel で出し、turn をまたいで渡します (production では provider 間で encrypted)。Control loop は依然として ReAct です。Thought trace は prompt-shaped ではなく structural です。

### Where this pattern goes wrong

- **Block bloat.** 無限の `block_append` はすぐ limit に達します。Cap を超える write の前に block summarizer を wire します。
- **Silent drift.** Sleep-time agent が block を rewrite しても primary agent が気づきません。Block を version 化し、trace に diff を surface します。
- **Poisoned consolidation.** Sleep-time agent が attacker-reachable content を core に処理してしまいます。Lesson 27 は sleep-time surface にも適用されます。

## 実装

`code/main.py` は次を実装します。

- `Block` — id, label, value, limit, description。
- `BlockStore` — CRUD + `near_limit(label)` helper。
- 2 つの scripted agents — `PrimaryAgent` は turn を serve し、`SleepTimeAgent` は turn 間で consolidate する。
- Block writes を伴う 3-turn conversation と、block を summarize し stale fact を invalidate する sleep-time pass を示す trace。

実行:

```
python3 code/main.py
```

Transcript は split を示します。Primary turns は高速で raw writes を生成し、sleep pass が compact と cleanup を行います。

## Use It

- **Letta** (letta.com) を reference implementation として使う。Self-host または managed cloud。
- **Claude Agent SDK skills** を block-shaped knowledge として使う。Skill は named, versioned, retrievable な instruction block で、agent が on demand で load します。
- **Custom builds** は storage backend を制御したい team 向け。後で migrate できるよう Letta API contract を使います。

## Ship It

`outputs/skill-memory-blocks.md` は、任意の runtime 向けに sleep-time hooks 付きの Letta 形 block system を生成します。Safety rules と citation wiring も含みます。

## Exercises

1. `near_limit` が true を返すとき、block value を model-generated summary に置換する `block_summarize` tool を追加する。どの trigger threshold が summarization calls と block overflow の両方を最小化するか。
2. Archival に sleep-time dedup を実装する。Text が 90% 超の token overlap を持つ 2 records は 1 つに collapse する。Critical path ではなく sleep pass でのみ行う。
3. Blocks を version 化する。すべての write で old value と diff を記録する。Operator が「なぜ agent は X を忘れたのか」を debug できるよう `block_history(label)` を expose する。
4. Sleep-time agents を untrusted writers として扱う。Persona または Safety block に触れるときは commit 前に second-agent review を必須にする。
5. Example を Letta API (`letta_v1_agent`) へ port する。Block schema はどう変わり、native reasoning は trace shape をどう変えるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | 「Editable prompt section」 | Typed, persistent, LLM-editable な core memory segment |
| Human block | 「User memory」 | Core に pin された user に関する facts |
| Persona block | 「Agent identity」 | Core に pin された self-concept、tone、constraints |
| Sleep-time compute | 「Async memory work」 | Critical path 外で consolidation を行う second agent |
| Core / Recall / Archival | 「Tiers」 | Always-visible / conversation / external の 3-layer memory split |
| Block limit | 「Cap」 | Block ごとの character limit。Summarization を強制する |
| Native reasoning | 「Thinking channel」 | Prompt-level `Thought:` ではなく provider-level reasoning output |
| Learned context | 「Sleep output」 | Sleep-time agent が shared blocks へ書く facts |

## 参考文献

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — block pattern
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) — async consolidation
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) — native reasoning rewrite
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — origin
