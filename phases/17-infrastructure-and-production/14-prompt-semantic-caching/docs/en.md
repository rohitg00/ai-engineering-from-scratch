# Prompt Caching と Semantic Caching の経済性

> **Pricing snapshot dated 2026-04.** 以下の数値は、このレッスン公開時に取得した vendor rate cards に基づきます。下流で引用する前に、linked docs で確認してください。

> Caching は 2 つの layer で起こります。L2（provider-level）prompt/prefix caching は、繰り返される prefix に対して attention KV を再利用します。Anthropic の prompt-caching docs は、長い prompt で最大 90% cost reduction と 85% latency reduction をうたっています。Claude 3.5 Sonnet では cache read が $0.30/M、fresh が $3.00/M で、5-minute TTL と 1-hour TTL option の 2x write premium があります（docs.anthropic.com、2026-04）。OpenAI prompt caching は prompts ≥1024 tokens に自動適用され、cached input は fresh に比べておおむね 90% discount で価格付けされます（platform.openai.com、2026-04）。Model ごとの正確な cached rate は live rate card に依存します。L1（app-level）semantic caching は、embedding similarity hit 時に LLM を完全に skip します。Vendor の「95% accuracy」は match correctness を指し、hit rate ではありません。報告されている production hit rates は、open-ended chat の 10% から structured FAQ の 70% まであります。どの provider も公式 baseline を公開していないため、これらは guarantees ではなく community telemetry として扱ってください。Production pitfalls: parallelization は caching を壊します（最初の cache write 前に発行された N parallel requests は spend を数倍に膨らませます）。また dynamic content が prefix 内にあると cache hit は完全に防がれます。ProjectDiscovery は、dynamic text を cacheable prefix から外すことで hit rate を 7% から 74% に改善したと報告しました（2025-11）。

**種別:** 学習
**言語:** Python (stdlib、toy two-layer cache simulator)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 06 (SGLang RadixAttention)
**所要時間:** 約 60 分

## 学習目標

- L2 prompt/prefix caching（provider での KV reuse）と L1 semantic caching（similar prompts で LLM bypass）を区別できる。
- Anthropic の `cache_control` explicit marking と 2 つの TTL options（5-min vs 1-hour）、それぞれの price multipliers を説明できる。
- Hit rate、prompt/response mix、token prices に基づいて expected monthly savings を計算できる。
- Bills を 5-10x 膨らませる parallelization anti-pattern と、hit rate を collapse させる dynamic-content anti-pattern を説明できる。

## 問題

RAG service に prompt caching を追加しました。Bill は変わりません。Hit rate を測ると 7% です。Prompt は static に見えますが、実際は違います。System prompt には分単位で format された current date、request ID、diversity のために randomized example reorder が含まれています。すべての request が新しい cache entry を write し、read はゼロです。

別に、agent は user question ごとに 10 個の parallel tool calls を実行します。10 個すべてが最初の cache write が完了する前に provider に到着します。10 writes、0 reads です。Bill は「caching あり」で想定した額の 5-10x になります。

Caching は flag ではなく protocol です。2 つの layer と 2 つの異なる failure mode があります。

## コンセプト

### L2 — provider prompt/prefix caching

Provider は cacheable prefix の attention KV を保存し、同じ prefix の次の request で再利用します。Write cost は一度だけ支払い、reads はほぼ無料です。

**Anthropic（Claude 3.5 / 3.7 / 4 series）**: request 内の explicit `cache_control` marker。どの blocks が cacheable かを tag します。TTL は 5-minute（write cost は base の 1.25x）または 1-hour（write cost は base の 2x）。Cache reads は Claude 3.5 Sonnet で $0.30/M、fresh が $3.00/M なので 10x cheaper です（docs.anthropic.com、2026-04 時点）。Rates は model により異なります（Opus/Haiku は別途公開）。必ず live pricing page を確認してください。

**OpenAI**: prompts ≥1024 tokens に automatic caching（platform.openai.com、2026-04）。Explicit flag はありません。Current gpt-4o/gpt-5 rate cards では cached input は fresh のおおむね 10x cheaper です。Docs も release notes も official hit-rate baseline を公開していません。Careful prompt design で community reports は 30–60% 付近に集まります。自分の値は `usage.cached_tokens` で monitor してください。

**Google（Gemini）**: explicit API による context caching。1M-token context では caching の効果がさらに大きくなります。

**Self-hosted（vLLM、SGLang）**: Phase 17 · 06 で RadixAttention を扱います。自前 compute で同じ pattern です。

### L1 — app-level semantic caching

LLM を呼ぶ前に prompt を hash し、embedding し、似た cached request（cosine similarity が threshold、通常 0.95+ を超える）を探します。Hit したら cached response を返します。Miss したら LLM を呼び、結果を cache します。

Open-source: Redis Vector Similarity、GPTCache、Qdrant。Commercial: Portkey Cache、Helicone Cache。

Vendor accuracy claims は、返した cached response が semantically appropriate だった頻度を指します。Hit する頻度ではありません。Production hit rates:

- Open-ended chat: 10-15%。
- Structured FAQ / support: 40-70%。
- Code questions: 20-30%（小さな variants が hits を壊す）。
- Voice agents repeating prompts: 50-80%（voice normalization fixed set）。

### Parallelization anti-pattern

Agent が 10 tool calls を parallel に実行します。10 個すべてが同じ 4K-token system prompt を持ちます。Anthropic cache writes は per-request です。最初の cache-write は provider が prompt を見てから約 300 ms 後に完了します。Requests 2-10 は同じ millisecond window に到着し、それぞれ cache miss になります。10 write premiums、0 read discounts を支払います。

修正: sequential-first で batch します。Request 1 だけを先に実行し、1 の cache が populate されてから 2-10 を fire します。最初の tool call に 300 ms を追加しますが、bill を 5-10x 節約します。

### Dynamic content anti-pattern

System prompt が次のように見えます。

```
You are a helpful assistant. The current time is 14:32:17.
User ID: abc123. Today is Tuesday...
```

すべての request が unique です。すべてが write です。Hit はゼロです。

修正: 本当に static なものは cacheable prefix に移し、dynamic content は cache boundary の後に付けます。

```
[cacheable]
You are a helpful assistant. [rules, examples, instructions]
[/cacheable]
[dynamic, not cached]
Current time: 14:32:17. User: abc123.
```

ProjectDiscovery はこの方法で cache hit rate を 7% から 74% に改善し、その anatomy を公開しました。

### Overnight workloads では batch + cache を重ねる

Batch APIs（Phase 17 · 15）は 24-hour turnaround で 50% discount を与えます。その上に cached input を載せるとさらに約 10x です。Overnight classification、labeling、report generation workloads は、stacking により synchronous-uncached cost の約 10% まで下げられます。

### 覚えておくべき数値

Pricing points は linked vendor docs から 2026-04 に取得したもので、数か月ごとに変動します。依存する前に再確認してください。

- Anthropic cached read: Claude 3.5 Sonnet で $0.30/M、fresh input よりおおむね 10x cheaper（docs.anthropic.com）。
- Anthropic cache write premium: 1.25x（5-min TTL）または 2x（1-hour TTL）。
- OpenAI auto-cache: prompts ≥1024 tokens に適用。Current rate cards では cached input は fresh input のおおむね 10%（platform.openai.com）。
- Semantic cache hit rate（community-reported）: open chat で約 10%、structured FAQ で最大約 70%。Vendor-documented baseline ではない。
- ProjectDiscovery: dynamic を prefix から外して 7% → 74% hit rate（project blog、2025-11）。
- Parallelization anti-pattern: N parallel requests が最初の cache write を miss すると、bill inflation は典型的に 5–10x と報告される。

## 使ってみる

`code/main.py` は mixed workloads 上で L1 + L2 caching を simulate します。Hit rates、bill を報告し、parallelization penalty を示します。

## Ship It

このレッスンは `outputs/skill-cache-auditor.md` を生成します。Prompt template と traffic を与えると cacheability を audit し、restructure を推奨します。

## 演習

1. `code/main.py` を実行してください。Parallelization flag を切り替えます。Bill はどのくらい変わりますか。
2. System prompt に date があります。外に移してください。Before/after の hit rate math を示してください。
3. Request arrival rate を前提に、1-hour TTL（2x write）と 5-minute TTL（1.25x write）の break-even を計算してください。
4. Semantic cache は 0.95 threshold で 20% hit します。0.85 では 50% hit しますが、incorrect cached responses が見えます。正しい threshold を選び、理由を述べてください。
5. User question ごとに 10 parallel sub-queries を batch しています。End-to-end latency を増やさずに cache-friendly に書き換えてください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| L2 prompt cache | "prefix cache" | Provider が repeated prefix の KV を保存 |
| `cache_control` | "Anthropic cache marker" | Cacheable blocks を明示する attribute |
| Cache write premium | "write tax" | 最初の miss-to-cache にかかる追加 cost（1.25x または 2x） |
| L1 semantic cache | "embedding cache" | LLM 呼び出し前に app-level で hash-and-embed |
| GPTCache | "LLM caching lib" | 人気の OSS L1 cache library |
| Cache hit rate | "hits / total" | Cache から served された requests の割合 |
| Parallelization anti-pattern | "the N-write trap" | N parallel requests が cache を N 回 miss する |
| Dynamic content trap | "the time-in-prompt trap" | Prefix 内の dynamic bytes が hit rate を壊す |
| RadixAttention | "intra-replica cache" | SGLang の prefix-cache implementation |

## 参考資料

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — official `cache_control` semantics and TTLs。
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — automatic caching behavior and eligibility。
- [TianPan — Semantic Caching for LLMs Production](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production)
- [ProjectDiscovery — Cut LLM Costs 59% With Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [DigitalOcean / Anthropic — Prompt Caching](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)
