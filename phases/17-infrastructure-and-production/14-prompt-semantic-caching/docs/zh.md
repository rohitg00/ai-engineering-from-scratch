# Prompt 缓存与语义缓存的经济学

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> **价格快照截至 2026-04。** 下文涉及的数字均反映本课发布时各厂商的官方报价；引用前请对照下方链接的最新文档核实。

> 缓存发生在两个层级。L2（厂商层）prompt/前缀缓存复用重复前缀的 attention KV——Anthropic 的 prompt caching 文档宣称在长 prompt 上可降本最多 90%、降低延迟 85%；以 Claude 3.5 Sonnet 为例，cache read 为 $0.30/M，新鲜输入为 $3.00/M，5 分钟 TTL 默认，1 小时 TTL 选项的 write 价格为 2x（docs.anthropic.com，2026-04）。OpenAI 的 prompt caching 对 ≥1024 token 的 prompt 自动生效，cached input 相比 fresh 大约打 1 折（platform.openai.com，2026-04）；具体每个模型的 cached 价取决于实时 rate card。L1（应用层）语义缓存则在 embedding 相似度命中时直接跳过 LLM。厂商所谓的「95% accuracy」指的是命中后返回结果是否语义合适，而非命中率本身——生产环境上报的命中率从 10%（开放式聊天）到 70%（结构化 FAQ）不等；两家厂商都没有给出官方基线，因此把这些数字当作社区遥测数据看待，而非保证。生产中两个常见坑：并行会摧毁缓存（在第一次 cache write 完成前发出 N 个并行请求，可能让账单翻好几倍），以及前缀里塞动态内容会让命中率彻底归零。ProjectDiscovery 公开了一个案例（2025-11）：把动态文本从可缓存前缀里挪走，命中率从 7% 提升到 74%。

**Type:** Learn
**Languages:** Python（stdlib，玩具版双层缓存模拟器）
**Prerequisites:** Phase 17 · 04（vLLM Serving Internals）、Phase 17 · 06（SGLang RadixAttention）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 区分 L2 prompt/前缀缓存（厂商侧 KV 复用）与 L1 语义缓存（在相似 prompt 上绕过 LLM）。
- 解释 Anthropic 的 `cache_control` 显式标记、两种 TTL 选项（5 分钟 vs 1 小时）以及它们对应的价格倍率。
- 给定命中率、prompt/响应配比、token 单价，计算预期月度节省。
- 说出会让账单膨胀 5-10 倍的并行反模式，以及会让命中率塌掉的动态内容反模式。

## 问题（The Problem）

你给 RAG 服务接上了 prompt caching。账单纹丝不动。你测命中率，是 7%。你的 prompt 看起来很「静态」，但其实不是——system prompt 里包含精确到分钟的当前时间、一个 request ID，以及为「多样性」打乱顺序的随机示例。每个请求都在写一条新的缓存条目，读零次。

另一边，你的 agent 对每个用户问题并行发出十次 tool call。十个请求都在第一次 cache write 完成之前到达厂商。十次写入，零次读取。账单是「带缓存」原本应该花的 5-10 倍。

缓存是协议，不是开关。两层、两种不同的失败模式。

## 概念（The Concept）

### L2 — 厂商 prompt/前缀缓存

厂商为可缓存前缀存住 attention KV，在下一次匹配前缀的请求里复用。你为 write 付一次费，read 几乎免费。

**Anthropic（Claude 3.5 / 3.7 / 4 系列）**：在请求里显式打 `cache_control` 标记。你来标哪些块可以被缓存。TTL：5 分钟（write 1.25x base）或 1 小时（write 2x base）。Cache read：Claude 3.5 Sonnet 上 $0.30/M，相比新鲜输入 $3.00/M 便宜 10 倍（docs.anthropic.com，截至 2026-04）。各模型价格不同（Opus/Haiku 单独发布）；务必去看实时定价页。

**OpenAI**：对 ≥1024 token 的 prompt 自动缓存（platform.openai.com，2026-04）。没有显式 flag。cached input 在当前 gpt-4o/gpt-5 的 rate card 上比 fresh 大约便宜 10 倍。文档和 release notes 都没有公布官方命中率基线；社区报告在精心设计 prompt 的前提下，集中在 30-60%。监控 `usage.cached_tokens` 来量化你自己的命中率。

**Google（Gemini）**：通过显式 API 做 context caching；1M token 上下文意味着缓存收益更大。

**自托管（vLLM、SGLang）**：Phase 17 · 06 讲过 RadixAttention——同一套模式跑在你自己的算力上。

### L1 — 应用层语义缓存

在调用 LLM 之前，先对 prompt 做哈希、做 embedding，去找相似的已缓存请求（cosine 相似度高于阈值，通常 0.95+）。命中就返回缓存的响应。未命中就调 LLM 然后把结果存起来。

开源：Redis Vector Similarity、GPTCache、Qdrant。商业：Portkey Cache、Helicone Cache。

厂商的 accuracy 数字指的是返回的缓存响应在语义上是否合适——不是命中频率。生产命中率：

- 开放式聊天：10-15%。
- 结构化 FAQ / 客服：40-70%。
- 代码问题：20-30%（小变体就杀掉命中）。
- 重复 prompt 的语音 agent：50-80%（语音规范化后是固定集合）。

### 并行反模式

你的 agent 并行发出 10 次 tool call。10 个请求都带着同一个 4K token 的 system prompt。Anthropic 的 cache write 是按请求维度的；第一次 cache write 大约在厂商看到 prompt 后 300 ms 完成。第 2-10 个请求在同一毫秒级窗口内到达，每个都是 cache miss。你付了 10 次 write premium，享受 0 次 read 折扣。

修法：sequential-first 批处理——先单独发请求 1，等它的 cache 写好后再发 2-10。第一次 tool call 多花 300 ms；账单省 5-10 倍。

### 动态内容反模式

你的 system prompt 长这样：

```
You are a helpful assistant. The current time is 14:32:17.
User ID: abc123. Today is Tuesday...
```

每个请求都是独一无二的。每个请求都在写。零命中。

修法：把真正静态的部分挪到可缓存前缀里；动态内容追加到缓存边界之后：

```
[cacheable]
You are a helpful assistant. [rules, examples, instructions]
[/cacheable]
[dynamic, not cached]
Current time: 14:32:17. User: abc123.
```

ProjectDiscovery 用这种方式把缓存命中率从 7% 提升到 74%，并把改造细节写成了文章。

### 把 batch + cache 叠加给夜间任务用

Batch API（Phase 17 · 15）以 24 小时周转换 50% 折扣。叠加 cached input，再省 ~10x。夜间分类、打标、报告生成这类任务，叠加之后可以跌到「同步不缓存」成本的 ~10%。

### 需要记住的数字

定价点是 2026-04 从厂商文档里抓的，每隔几个月就会漂移——依赖之前先重查。

- Anthropic cached read：Claude 3.5 Sonnet 上 $0.30/M，比新鲜输入便宜约 10 倍（docs.anthropic.com）。
- Anthropic cache write premium：1.25x（5 分钟 TTL）或 2x（1 小时 TTL）。
- OpenAI 自动缓存：对 ≥1024 token 的 prompt 生效；cached input 在当前 rate card 上约为 fresh 的 10%（platform.openai.com）。
- 语义缓存命中率（社区上报）：开放式聊天 ~10%；结构化 FAQ 最高 ~70%。不是厂商文档化的基线。
- ProjectDiscovery：把动态内容从前缀挪走，命中率 7% → 74%（项目博客，2025-11）。
- 并行反模式：典型报告显示，N 个并行请求都没赶上第一次 cache write 时，账单膨胀 5-10 倍。

## 用起来（Use It）

`code/main.py` 在混合工作负载上模拟 L1 + L2 缓存。它会报告命中率、账单，并演示并行带来的惩罚。

## 上线部署（Ship It）

本课产出 `outputs/skill-cache-auditor.md`。给定 prompt 模板和流量画像，对可缓存性做审计，并给出重构建议。

## 练习（Exercises）

1. 跑 `code/main.py`。切换并行 flag。账单变化多少？
2. 你的 system prompt 里有时间。把它挪出去。给出改造前后的命中率算式。
3. 给定你的请求到达率，算出 1 小时 TTL（2x write）相对 5 分钟 TTL（1.25x write）的盈亏平衡点。
4. 阈值 0.95 的语义缓存命中率 20%。降到 0.85 命中率到 50%，但你看到了错误的缓存响应。挑一个合适的阈值并给出理由。
5. 你为每个用户问题并行 batch 出 10 个子查询。在不增加端到端延迟的前提下重写它，让缓存友好。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| L2 prompt cache | 「prefix cache」 | 厂商对重复前缀存 KV |
| `cache_control` | 「Anthropic 缓存标记」 | 显式标注哪些块可缓存的属性 |
| Cache write premium | 「write tax / 写入税」 | 第一次 miss 转 cache 的额外成本（1.25x 或 2x） |
| L1 semantic cache | 「embedding cache」 | 应用层先 hash + embed，再决定要不要调 LLM |
| GPTCache | 「LLM 缓存库」 | 流行的开源 L1 缓存库 |
| Cache hit rate | 「hits / total」 | 由缓存提供服务的请求比例 |
| Parallelization anti-pattern | 「N-write 陷阱」 | N 个并行请求都 miss 了 N 次 |
| Dynamic content trap | 「时间塞 prompt 陷阱」 | 前缀里有动态字节，命中率塌掉 |
| RadixAttention | 「副本内缓存」 | SGLang 的前缀缓存实现 |

## 延伸阅读（Further Reading）

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 官方 `cache_control` 语义与 TTL。
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — 自动缓存的行为与触发条件。
- [TianPan — Semantic Caching for LLMs Production](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production)
- [ProjectDiscovery — Cut LLM Costs 59% With Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [DigitalOcean / Anthropic — Prompt Caching](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)
