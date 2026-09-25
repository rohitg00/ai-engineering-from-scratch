# 提示词缓存与语义缓存经济学

> **定价快照日期为 2026-04。** 下文中的数字反映本课程发布时捕获的供应商价目表；在向下游引用之前，请对照链接的文档进行核实。

> 缓存发生在两个层面。L2(供应商级)提示词/前缀缓存为重复前缀复用注意力 KV —— Anthropic 的提示词缓存文档宣称在长提示词上最高可降低 90% 成本和 85% 延迟；对于 Claude 3.5 Sonnet,缓存读取价格为 $0.30/M vs $3.00/M(相对于新鲜输入)，5 分钟 TTL,1 小时 TTL 选项的写入溢价为 2 倍(docs.anthropic.com, 2026-04)。OpenAI 提示词缓存对 ≥1024 token 的提示词自动生效，缓存输入价格约为新鲜输入的 90% 折扣(platform.openai.com, 2026-04);每个模型的具体缓存费率取决于实时价目表。L1(应用级)语义缓存在嵌入相似度命中时完全跳过 LLM。供应商宣称的“95% 准确率”指的是匹配正确性，而非命中率 —— 已报告的生产命中率从 10%(开放式聊天)到 70%(结构化 FAQ)不等；两家供应商均未发布官方基准，因此请将这些数据视为社区遥测数据而非保证。生产中的陷阱：并行化会破坏缓存(在首次缓存写入完成前发出的 N 个并行请求可能使支出膨胀数倍)，前缀内的动态内容会完全阻止缓存命中。ProjectDiscovery 报告通过将动态文本移出可缓存前缀，将命中率从 7% 提升到 74%(2025-11)。

**Type:** Learn
**Languages:** Python (标准库，简易双层缓存模拟器)
**Prerequisites:** Phase 17 · 04 (推理引擎内部机制), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 分钟

## 学习目标

- 区分 L2 提示词/前缀缓存(供应商处的 KV 复用)与 L1 语义缓存(相似提示词绕过 LLM)。
- 解释 Anthropic 的 `cache_control` 显式标记以及两种 TTL 选项(5 分钟 vs 1 小时)及其价格乘数。
- 给定命中率、提示词/响应组合和 token 价格，计算预期的月度节省。
- 说出会将账单膨胀 5-10 倍的并行化反模式，以及会令命中率崩溃的动态内容反模式。

## 问题所在

你为 RAG 服务添加了提示词缓存。账单却持平。你测量命中率；只有 7%。你的提示词看起来是静态的，但实际不是 —— 系统提示词包含精确到分钟的当前日期、一个请求 ID,以及为多样性而随机重排的示例。每个请求都写入新的缓存条目，读取为零。

另外，你的智能体对每个用户问题运行十个并行的工具调用。全部十个请求都在首次缓存写入完成之前到达供应商。十次写入，零次读取。你的账单是“有缓存”预期成本的 5-10 倍。

缓存是一种协议，不是一个开关。两个层面，两种不同的失败模式。

## 核心概念

### L2 — 供应商提示词/前缀缓存

供应商为可缓存前缀存储注意力 KV,并在下一个匹配该前缀的请求上复用。你支付一次写入成本，读取几乎免费。

**Anthropic (Claude 3.5 / 3.7 / 4 系列)**：请求中的显式 `cache_control` 标记。你指定哪些块是可缓存的。TTL:5 分钟(写入成本为基础的 1.25 倍)或 1 小时(写入成本为基础的 2 倍)。缓存读取：$0.30/M on Claude 3.5 Sonnet vs $3.00/M(相对新鲜输入)—— 便宜 10 倍(docs.anthropic.com,截至 2026-04)。费率因模型而异(Opus/Haiku 单独发布)；务必对照实时定价页面核对。

**OpenAI**:对 ≥1024 token 的提示词自动缓存(platform.openai.com, 2026-04)。无显式标志。根据当前 gpt-4o/gpt-5 价目表，缓存输入比新鲜输入便宜约 10 倍。文档和发布说明均未发布官方命中率基准；社区报告在精心设计提示词的情况下集中在 30–60%。监控 `usage.cached_tokens` 来测量你自己的命中率。

**Google (Gemini)**:通过显式 API 进行上下文缓存；1M token 的上下文意味着缓存回报更高。

**自托管 (vLLM, SGLang)**:Phase 17 · 06 涵盖 RadixAttention —— 在你自己的算力上实现同样的模式。

### L1 — 应用级语义缓存

在调用 LLM 之前，先对提示词做哈希、嵌入，并查找相似的缓存请求(余弦相似度高于阈值，通常为 0.95 以上)。命中则返回缓存的响应。未命中则调用 LLM 并缓存结果。

开源：Redis Vector Similarity、GPTCache、Qdrant。商业：Portkey Cache、Helicone Cache。

供应商的准确率声明指的是返回的缓存响应在语义上合适的频率 —— 而非你命中的频率。生产命中率：

- 开放式聊天：10-15%。
- 结构化 FAQ / 支持：40-70%。
- 代码问题：20-30%(微小变体会破坏命中)。
- 重复提示词的语音智能体：50-80%(语音归一化后的固定集合)。

### 并行化反模式

你的智能体并行发出 10 个工具调用。全部 10 个都带有相同的 4K token 系统提示词。Anthropic 缓存写入按请求计费；首次缓存写入在供应商收到提示词后约 300 ms 完成。请求 2-10 在同一毫秒窗口内到达，每个都看到缓存未命中。你支付 10 次写入溢价，获得 0 次读取折扣。

修复方法：采用“先串行”的批处理 —— 单独发出请求 1,然后在请求 1 的缓存填充后再发出 2-10。为首次工具调用增加 300 ms;节省 5-10 倍账单。

### 动态内容反模式

你的系统提示词看起来像：

```
You are a helpful assistant. The current time is 14:32:17.
User ID: abc123. Today is Tuesday...
```

每个请求都是唯一的。每个请求都写入。零命中。

修复方法：将真正静态的内容移到可缓存前缀；将动态内容附加到缓存边界之后：

```
[cacheable]
You are a helpful assistant. [rules, examples, instructions]
[/cacheable]
[dynamic, not cached]
Current time: 14:32:17. User: abc123.
```

ProjectDiscovery 就是这样将缓存命中率从 7% 提升到 74%,并公布了剖析过程。

### 批处理 + 缓存叠加用于过夜工作负载

批处理 API(Phase 17 · 15)提供 50% 折扣，但需 24 小时周转。在此基础上叠加缓存输入可获得约 10 倍收益。过夜分类、标注和报告生成工作负载通过叠加可降至同步无缓存成本的约 10%。

### 应记住的数字

定价点捕获于 2026-04,来自链接的供应商文档，且每隔几个月就会变动 —— 依赖之前请重新核对。

- Anthropic 缓存读取：Claude 3.5 Sonnet 上 $0.30/M,比新鲜输入便宜约 10 倍(docs.anthropic.com)。
- Anthropic 缓存写入溢价：1.25 倍(5 分钟 TTL)或 2 倍(1 小时 TTL)。
- OpenAI 自动缓存：适用于 ≥1024 token 的提示词；当前价目表上缓存输入价格约为新鲜输入的 10%(platform.openai.com)。
- 语义缓存命中率(社区报告)：开放式聊天约 10%;结构化 FAQ 最高约 70%。并非供应商文档化的基准。
- ProjectDiscovery:通过将动态内容移出前缀，命中率从 7% → 74%(项目博客， 2025-11)。
- 并行化反模式：当 N 个并行请求未命中首次缓存写入时，典型报告为账单膨胀 5–10 倍。

```figure
semantic-cache-hit
```

## 使用它

`code/main.py` 在混合工作负载上模拟 L1 + L2 缓存。报告命中率、账单，并展示并行化惩罚。

## 交付它

本课程产出 `outputs/skill-cache-auditor.md`。给定提示词模板和流量，审计可缓存性并推荐重构方案。

## 练习

1. 运行 `code/main.py`。切换并行化标志。账单变化多少？
2. 你的系统提示词中有日期。把它移出去。展示前后的命中率计算。
3. 给定你的请求到达率，计算 1 小时 TTL(2 倍写入)与 5 分钟 TTL(1.25 倍写入)的盈亏平衡点。
4. 语义缓存阈值 0.95 时命中 20%。阈值 0.85 时命中 50%,但你会看到错误的缓存响应。选择正确的阈值并说明理由。
5. 你为每个用户问题批量发出 10 个并行子查询。在不增加端到端延迟的前提下，为缓存友好性重写。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| L2 提示词缓存 | “前缀缓存” | 供应商为重复前缀存储 KV |
| `cache_control` | “Anthropic 缓存标记” | 显式标记可缓存块的属性 |
| 缓存写入溢价 | “写入税” | 首次未命中写入缓存的额外成本(1.25 倍或 2 倍) |
| L1 语义缓存 | “嵌入缓存” | 调用 LLM 之前的应用级哈希加嵌入 |
| GPTCache | “LLM 缓存库” | 流行的开源 L1 缓存库 |
| 缓存命中率 | “命中数 / 总数” | 由缓存服务的请求比例 |
| 并行化反模式 | “N 次写入陷阱” | N 个并行请求 N 次未命中缓存 |
| 动态内容陷阱 | “提示词含时间陷阱” | 前缀中的动态字节会扼杀命中率 |
| RadixAttention | “副本内缓存” | SGLang 的前缀缓存实现 |

## 延伸阅读

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 官方 `cache_control` 语义与 TTL。
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — 自动缓存行为与适用条件。
- [TianPan — Semantic Caching for LLMs Production](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production)
- [ProjectDiscovery — Cut LLM Costs 59% With Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [DigitalOcean / Anthropic — Prompt Caching](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)