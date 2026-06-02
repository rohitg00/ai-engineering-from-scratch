# SGLang 与 RadixAttention：应对 prefix-heavy 负载

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> SGLang 把 KV cache 当成一等公民、可复用的资源，存储在一棵 radix tree（基数树）里。vLLM 用 FCFS（first-come, first-served，先来先服务）调度请求，而 SGLang 的 cache-aware（缓存感知）调度器优先服务共享前缀更长的请求——本质上是对 radix 树做深度优先遍历，让热门分支常驻 HBM。在 Llama 3.1 8B 上跑类 ShareGPT 的 1K prompt，SGLang 达到约 16,200 tok/s，vLLM 约 12,500 tok/s，领先约 29%。在 prefix-heavy 的 RAG 负载上，优势可达 6.4 倍。在声音克隆形态的负载上，缓存命中率突破 86%。2026 年部署在 xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS 共计 40 万+ GPU 上。坑在于：一旦前缀顺序不一致，6.4 倍的数字立刻蒸发——顺序就是工程师能拧的旋钮。

**Type:** Learn
**Languages:** Python (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (vLLM Serving Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 画出 RadixAttention 的结构：前缀如何存储在 radix tree 中，KV 块如何在共享同一分支的序列之间复用。
- 解释 cache-aware 调度，以及为什么 FCFS 不适合 prefix-heavy 流量。
- 给定一个负载的前缀缓存命中率与 prompt 长度分布，计算预期加速比。
- 说出让 6.4 倍真正落地、而非白白丢掉的那条 prompt 排序纪律。

## 问题（The Problem）

经典 serving 把每个请求的 prompt 当作不透明的整体。哪怕 5,000 个 RAG 请求都以同一段 2,000-token 的 system prompt 加同一段检索前言开头，vLLM 也会把这 2,000 token 的前缀重复 prefill 5,000 次。GPU 在反复做完全一样的工作。

观察是这样的：agent 与 RAG 负载里的 prompt 几乎总是共享很长的前缀。System prompt、工具 schema、few-shot 例子、检索头、对话历史——这些都跨请求重复。如果你能把这段前缀的 KV cache 存一次然后复用，就不用再 prefill 第二遍。

RadixAttention 干的就是这件事。Token 被索引到一棵 radix tree 里；每个节点拥有从根到该节点这段 token 序列的 KV 块。新请求来了就在树上走：哪个节点的 token 匹配，就复用该节点的 KV 块。Prefill 的代价就只跟「新增的」后缀成正比，而不是整段 prompt。

挑战在调度。如果两个请求共享 2,000-token 前缀，第三个只共享其中 200 token，你希望把那两个长共享前缀的请求放在一起服务，让长前缀留在 HBM 里。FCFS 反其道而行——谁先到就服务谁，可能在下一个长前缀请求到来之前就把热门分支驱逐掉。

## 概念（The Concept）

### radix tree 作为 KV 索引

radix tree（compact trie，紧凑前缀树）存储 token 序列。每个节点拥有一段 token 范围以及为这段范围计算出的 KV 块。子节点把序列再延长一个或多个 token。

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

新请求带着 system prompt + "Context: <doc A>" + "Question: Carol" 进来。调度器在树上走：system 前缀命中（复用 124 块），doc-A 分支命中（复用 31 块），然后只为 "Question: Carol" 分配新块（4 块）。Prefill 代价：4 块新 token。如果没有这棵树：160 块。Prefill 上节省约 40 倍。

### cache-aware 调度

如果 cache 一直被搅乱，radix tree 撑起来的复用就毫无意义。两条关键策略：

1. **深度优先派发**。从队列里挑下一个请求时，优先选择和当前正在跑的请求集落在同一分支上的请求。这样热门分支就被钉住了。
2. **分支级 LRU，而不是块级 LRU**。整条分支地驱逐（从最久未用的叶子开始），而不是单块单块地驱逐，让 cache 形状和 radix 形状对齐。

FCFS 两条都违反。一个共享 2,000 token 的请求排在一个只共享 50 token 的请求后面，结果 2,000-token 的分支为了让那个 50-token 的进来就被驱逐了。

### 你应该背下来的基准（benchmark）数字

- Llama 3.1 8B、H100、ShareGPT 1K prompt：SGLang ~16,200 tok/s vs vLLM ~12,500（领先 ~29%）。
- prefix-heavy 的 RAG（同一 system + 同一 doc，问题不同）：SGLang 上最高 6.4 倍。
- 声音克隆负载：前缀缓存命中率 86.4%。
- SGLang 客户的生产环境命中率：50–99%，取决于 prompt 纪律。
- 2026 年部署在 40 万+ GPU 上。

### 排序的坑

6.4 倍这个数字依赖 prompt 模板顺序的一致性。如果你的客户端在某些请求里把 prompt 拼成 `[system, tools, context, history, question]`，在另一些请求里又拼成 `[system, context, tools, history, question]`，树就找不到共享前缀了。在人眼里像是共享前缀的东西，在 radix tree 看来是两条完全不同的序列。

工程师能拧的旋钮：你的 prompt 模板就是 cache key。把顺序固定下来。把所有不变的（system、tools、schema）放最前。把检索 context 放其次。把用户问题放最后。不要把动态内容掺进前缀里。

研究中的真实案例：把动态内容从可缓存前缀里挪出去，仅这一处改动就把某次部署的命中率从 7% 拉到 74%。

### RadixAttention 在哪些场景赢、哪些场景输

赢：
- RAG（同一检索前言、问题不同）。
- agent（同一工具 schema、查询不同）。
- 带长 system prompt 的聊天。
- 有重复前言的语音 / 视觉负载。

输（退化到 vLLM 级吞吐）：
- 单次生成、prompt 各不相同（代码补全、没有 system prompt 的开放式聊天）。
- 动态 prompt——每个请求都把独特内容掺进前缀里。

### 为什么这是一个调度器问题，而不仅是 kernel 问题

KV 复用可以当成一个 kernel 技巧来实现。SGLang 的洞察是：复用只有在调度器把热门分支留住时才划算。一个朴素的「有就复用」策略在混合负载下会把 cache 搅烂。把 kernel 技巧变成生产环境 29% 领先的，是那个以 radix tree 为索引的调度器。

### 与 vLLM 的相互作用

这两套系统并不是严格的竞争对手。2026 年 vLLM 加上了前缀缓存（`--enable-prefix-caching`）和一个 cache-aware 路由器（用 Rust 写的 vLLM Router）。差距缩小了但没完全消失——SGLang 整套栈是 radix 优先设计的，vLLM 是后嫁接上去的。对前缀复用占主导的负载，SGLang 仍是默认选择。对没有强前缀模式的通用 serving，vLLM 持平甚至更优。

## 用起来（Use It）

`code/main.py` 实现了一个 toy 版的 radix-tree KV cache，外加一个支持两种策略（FCFS 与 cache-aware）的调度器。同一份负载分别跑两种策略，报告前缀缓存命中率与吞吐差。然后再跑一份「打乱顺序」的负载，演示 6.4 倍如何崩塌。

## 上线部署（Ship It）

本课产出 `outputs/skill-radix-scheduler-advisor.md`。给定一份负载描述（prompt 模板形态、检索模式、并发租户数），它会输出一份 prompt 排序处方，以及是否采用 SGLang 的 go / no-go 判定。

## 练习（Exercises）

1. 跑 `code/main.py`。在同一份负载上比较 FCFS 与 cache-aware。差距来自哪里——prefill 节省、decode 节省，还是排队延迟？
2. 修改负载，让 prompt 随机排列 `[system, tools, context]`。再跑一遍。命中率怎么变？为什么？
3. 计算在 Llama 3.1 8B 上把一段 2,000-token 的 system prompt 作为单个 radix 分支常驻的 HBM 开销。和不复用前缀、跑一个 16 序列 batch 的开销做对比。
4. 读 SGLang 的 RadixAttention 论文。用三句话解释为什么在 prefix-heavy 负载下，树形 LRU 驱逐胜过块形 LRU 驱逐。
5. 一个客户报告只有 8% 缓存命中率。给出三个最可能的原因，以及你针对每个原因会跑的诊断手段。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | 「SGLang 那玩意」 | 把 KV cache 索引为一棵 radix tree，让共享前缀复用 KV 块 |
| Radix tree | 「compact trie」 | 每个节点拥有一段 token 范围及其 KV 块的树 |
| Cache-aware scheduler | 「热门分支优先」 | 倾向于服务共享当前常驻分支的请求的调度器 |
| Prefix-cache hit rate | 「你 prompt 里有多少是免费的」 | prompt token 中由复用 KV 块服务的比例 |
| FCFS | 「先来先服务」 | 会破坏前缀局部性的默认调度 |
| Branch-level LRU | 「驱逐叶子」 | 与 radix 形状对齐的驱逐策略 |
| Prompt template ordering | 「cache key」 | prompt 各部分的拼接顺序决定了树能共享什么 |
| System prompt pinning | 「常驻前缀」 | 把不变的 system 部分钉住，避免被频繁驱逐 |

## 延伸阅读（Further Reading）

- [SGLang GitHub](https://github.com/sgl-project/sglang) —— 源码与文档。
- [SGLang documentation](https://sgl-project.github.io/) —— RadixAttention 与调度细节。
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) —— 设计参考。
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) —— 基准数字与调度器思路。
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/prefix_caching.html) —— vLLM 自家的类 radix 实现，可作对比。
