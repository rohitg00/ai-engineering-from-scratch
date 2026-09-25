# 前缀缓存服务 — RadixAttention 与 KV 复用

> 把 KV 缓存当作存储在基数树中的一等可复用资源，调度方式也随之改变：不再是 vLLM 那种 FCFS(先来先服务)，缓存感知调度器会优先处理共享前缀更长的请求——本质上是对基数树做深度优先遍历，让热点分支驻留在 HBM 中。SGLang 正是围绕这一思想构建服务的推理引擎。在 Llama 3.1 8B 上使用类似 ShareGPT 的 1K 提示时，SGLang 达到约 16,200 tok/s,而 vLLM 约为 12,500,领先约 29%。在前缀密集的 RAG 工作负载上，优势可达 6.4 倍。在语音克隆形态的工作负载上，缓存命中率超过 86%。2026 年部署于 400,000+ 块 GPU,覆盖 xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS。坑点在于：当前缀顺序不一致时，6.4 倍的收益会消失——顺序控制是工程师手中的杠杆。

**Type:** Learn
**Languages:** Python(标准库，玩具级基数树缓存 + 缓存感知调度器)
**Prerequisites:** Phase 17 · 04(Serving Engine Internals)、Phase 14(Agentic RAG)
**Time:** 约 75 分钟

## 学习目标

- 画出 RadixAttention 的结构：前缀如何存储在基数树中，以及 KV 块如何在根植于同一分支的多个序列之间共享。
- 解释缓存感知调度，以及为什么 FCFS 不适合前缀密集的流量。
- 给定前缀缓存命中率和提示长度分布，计算工作负载的预期加速比。
- 说出让 6.4 倍收益成真(而非白白流失)的提示排序纪律。

## 问题所在

传统服务把每个请求的提示当作不透明的内容。即使 5,000 个 RAG 请求都以相同的 2,000 token 系统提示加上相同的检索前言开头，vLLM 也会把这 2,000 token 的前缀 prefill 5,000 次。GPU 在反复做同样的工作。

关键观察：智能体与 RAG 工作负载中的提示几乎总是共享长前缀。系统提示、工具 schema、few-shot 示例、检索头部、对话历史——所有这些都在请求间重复。如果把该前缀的 KV 缓存只存储一次并复用，就不必再次 prefill。

RadixAttention 正是这样做的。token 被索引在基数树中；每个节点拥有从根到该节点路径上的 token 序列对应的 KV 块。新请求沿树行走：任何 token 匹配的节点都复用其 KV 块。Prefill 成本变为与“新”后缀成正比，而不是与完整提示成正比。

难点在于调度。如果两个请求共享 2,000 token 的前缀，而第三个请求只共享其中 200 token,你希望把那两个长共享请求放在一起处理，使长前缀驻留在 HBM 中。FCFS 恰恰相反——它按到达顺序处理，可能在下一个长前缀请求到来之前就把热点分支逐出。

## 核心概念

### 作为 KV 索引的基数树

基数树(压缩字典树)存储 token 序列。每个节点拥有一个 token 区间以及为该区间计算出的 KV 块。子节点在此基础上延长一个或多个 token。

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

一个新请求带有系统提示 + "Context: <doc A>" + "Question: Carol"。调度器沿树行走：系统前缀匹配(复用 124 个块)，doc-A 分支匹配(复用 31 个块)，然后只为 "Question: Carol" 分配新块(4 个块)。Prefill 成本：4 个块的新 token。没有树：160 个块。Prefill 节省约 40 倍。

### 缓存感知调度

如果缓存不断被搅动，基于基数树的复用就毫无意义。两条关键策略：

1. **深度优先派发**。从队列中选取下一个请求时，优先选择与当前运行集合根植于同一分支的请求。这能钉住热点分支。
2. **分支级 LRU,而非块级 LRU**。按整棵分支逐出(从最久未用的叶子开始)，而不是逐个块逐出，使缓存形状与基数树形状一致。

FCFS 违反了这两条。一个共享 2,000 token 的请求排在一个共享 50 token 的请求后面，然后那个 2,000 token 的分支被逐出，以便容纳 50 token 的请求。

### 你应该记住的基准数据

- Llama 3.1 8B、H100、ShareGPT 1K 提示：SGLang 约 16,200 tok/s vs vLLM 约 12,500(领先约 29%)。
- 前缀密集的 RAG(相同系统提示 + 相同文档，问题不同)：SGLang 上最高 6.4 倍。
- 语音克隆工作负载：86.4% 的前缀缓存命中率。
- SGLang 客户的生产命中率：50–99%,取决于提示纪律。
- 2026 年部署于 400,000+ 块 GPU。

### 排序坑点

6.4 倍的收益依赖于一致的提示模板顺序。如果你的客户端在某些请求中把提示构造为 `[system, tools, context, history, question]`,而在另一些请求中构造为 `[system, context, tools, history, question]`,树就无法找到共享前缀。在人看来是共享前缀的东西，对基数树来说是两条不同的序列。

工程师的杠杆：提示模板就是缓存键。固定顺序。把所有不可变内容(系统提示、工具、schema)放在最前。检索上下文其次。用户问题放在最后。不要把动态内容交错混入前缀。

研究中的一个真实案例：把动态内容从可缓存前缀中移出，仅凭这一处改动就把某个部署的缓存命中率从 7% 提升到 74%。

### RadixAttention 的优势与劣势

优势：
- RAG(相同检索前言，问题不同)。
- 智能体(相同工具 schema,查询不同)。
- 带长系统提示的对话。
- 带重复前言的语音/视觉工作负载。

劣势(吞吐回落到 vLLM 水平)：
- 提示各不相同的单次生成(代码补全、无系统提示的开放式对话)。
- 每个请求都把不同内容混入前缀的动态提示。

### 为什么这是调度器问题，而不仅仅是内核问题

你可以把 KV 复用实现为一种内核技巧。SGLang 的洞见是：只有调度器让热点分支保持驻留，复用才有回报。朴素的“有则复用”策略在混合负载下会不断搅动缓存。正是基于基数树索引的调度器，才把内核技巧变成了 29% 的生产优势。

### 与 vLLM 的关系

两者并非严格的竞争对手。2026 年 vLLM 加入了前缀缓存(`--enable-prefix-caching`)和缓存感知路由器(Rust 编写的 vLLM Router)。差距缩小了，但没有完全消失——SGLang 的整个技术栈以基数为先；vLLM 则是后加上的。对于前缀复用主导的工作负载，SGLang 仍是默认选择。对于没有强前缀模式的通用服务，vLLM 依旧持平或更优。

```figure
roofline
```

## 使用它

`code/main.py` 实现了一个玩具级基数树 KV 缓存，以及一个带有两种策略的调度器：FCFS 与缓存感知。它用同一工作负载分别跑两种策略，报告前缀缓存命中率和吞吐差异。然后运行一个“乱序”工作负载，展示 6.4 倍收益的崩塌。

## 交付它

本课产出 `outputs/skill-radix-scheduler-advisor.md`。给定工作负载描述(提示模板形态、检索模式、并发租户数)，它输出一份提示排序建议，以及是否采用 SGLang 的 go/no-go 结论。

## 练习

1. 运行 `code/main.py`。在同一工作负载上对比 FCFS 与缓存感知。差异来自哪里——prefill 节省、decode 节省，还是排队延迟？
2. 修改工作负载，使提示随机排列 `[system, tools, context]`。重新运行。命中率发生了什么？为什么？
3. 在 Llama 3.1 8B 上，把 2,000 token 的系统提示作为一个基数分支常驻 HBM,计算其成本。并与无前缀复用时 16 序列批处理的成本作比较。
4. 阅读 SGLang RadixAttention 论文。用三句话解释，在前缀密集负载下，树形 LRU 逐出为何优于块形 LRU。
5. 某客户报告缓存命中率只有 8%。说出三个可能原因，以及针对每个原因你会运行的诊断方法。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| RadixAttention | "SGLang 那套东西" | KV 缓存以基数树索引,共享前缀复用块 |
| Radix tree | "压缩字典树" | 每个节点拥有一个 token 区间及其 KV 块的树 |
| Cache-aware scheduler | "热点分支优先" | 优先处理与常驻分支共享前缀的请求的调度器 |
| Prefix-cache hit rate | "你的提示有多少是免费的" | 从复用的 KV 块中服务的提示 token 比例 |
| FCFS | "先来先服务" | 破坏前缀局部性的默认调度 |
| Branch-level LRU | "逐出叶子" | 与基数树形状匹配的逐出策略 |
| Prompt template ordering | "缓存键" | 提示各组成部分的顺序决定树能共享什么 |
| System prompt pinning | "常驻前缀" | 把不可变的系统部分钉住,避免逐出抖动 |

## 延伸阅读

- [SGLang GitHub](https://github.com/sgl-project/sglang) — 源码与文档。
- [SGLang 文档](https://sgl-project.github.io/) — RadixAttention 与调度细节。
- [SGLang 论文 — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) — 设计参考。
- [LMSYS 博客 — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) — 基准数据与调度器设计依据。
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/prefix_caching.html) — vLLM 自家的类基数树实现，可用于对比。