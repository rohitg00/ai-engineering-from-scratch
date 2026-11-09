# 预写缓存服务  激素注意力和KV重复使用

> 处理KV缓存作为一个在基层树中存储的第一类,可重复使用的资源,并与它一起进行调度变化:而不是FCFS (首次来,首次服务) 作为vLLM时间表,一个缓存知性调度器优先考虑使用更长的共享前置器的请求. 轮是引擎,它围绕着这个想法构建. 在Llama 3.1 8B上,SGLang达到16,200个/秒,达到vLLM的12,500个,占比29%. 在前重的RAG工作负载上,优势达到6.4倍. 在语音克隆式工作负载上,缓存击中率已清除了86%. 在2026年将部署在xAI,LinkedIn,Cursor,Oracle,GCP,Azure,AWS等400,000+个GPU上. 序列是工程师的杆.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## 学习目标

- 图表Radix注意:如何在一个基因树中存储前置,以及如何在同一分支根基的序列中共享KV块.
- 解释缓存预示的时间表以及为什么FCFS对预写量较高的流量是错误的.
- 计算预期工作负载加快,以预先缓存击率和快速长度分布为基础.
- 给出一个即时订单的纪律,使6.4x数量是真实的,而不是丢失的上.

## 问题

经典服务处理每个请求的提示是不透明的.即使5000个RAG请求都以相同的2000个代币系统提示加上相同的检索序言开始,vLLM将2000个代币前填写5000次.GPU一遍又一遍.

观察:代理和RAG工作负载中的提示几乎总是共享长个预写.系统提示,工具方案,几次示例,检索标题,对话历史记录 所有请求都重复.如果你一次存储了该预写的KV缓存,然后再使用它,你不会再预写.

根源注意力执行了这一点.代币在根源树中被索引;每个节点拥有从根开始的代币序列的KV块.一个新的请求通过树:任何与代币匹配的节点都会重复使用该节点的KV块.预填成本变得与"新"后音相比例,而不是完整提示.

挑战是安排.如果两个请求共享2000个代币前,而第三个只共享200个代币,你想将两个长共享的请求一起服务,以便长前保持在HBM中.FCFS做相反的它服务了谁来第一,可能在下一个长前请求碰到之前驱逐热分支.

## 概念

### 作为KV指数的基底树

基底树 (紧的三角形) 存储代币序列.每个节点拥有代币范围,KV区块为该范围计算.孩子们将序列扩展到一个或多个代币.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

系统提示+"文本: <doc A>"+"问题: Carol"的新请求. 编程程序运行:系统前匹配 (124个块重复使用),doc-A分支匹配 (31个块重复使用),然后仅为"问题: Carol" (4个块) 分配新块.预填成本: 4个块新代币.没有树: 160 块. ~40倍的预填节省.

### 缓存预定时间

假如缓存出现故障,Radix树支持的重复使用是无意义的.

1. **Depth-first dispatch**在排列中选择下一个请求时, 优先选择与当前运行集相同的分支的请求. 这将保持热分支的固定.
2. **LRU at branch level, not block level**消除整个分支 (从最短使用的叶子开始),而不是单个块,以便缓存形状与基底形状相匹配.

要求共享2000个代币,是50个代币的请求背后,然后2000个代币的分支被驱逐出境,

### 您应该记住的基准号码

- 拉马 3.1 8B,H100,ShareGPT 1K提示:SGLang ~16,200个时/秒对VLLM ~12,500 (~29%的边缘).
- 预写重的RAG (相同的系统 +相同的文件,不同的问题):在SGLang上高达6.4x.
- 语音克隆工作量:前置缓存击中率为86.4%.
- 产量打击率在SGLang客户中:50-99%取决于迅速的纪律.
- 在2026年将部署在400,000+的GPU上.

### 订单给你了

如果您的客户端构建提示如`[system, tools, context, history, question]`在某些请求中,`[system, context, tools, history, question]`树木不能找到一个共同的前. 树木的两个不同的序列,

工程师的杆:您的提示模板是一个缓存键. 修复顺序. 首先把不可变的东西 (系统,工具,方案) 放在第一位. 接下来放回文本. 排名用户问题. 不要把动态内容插入预写中.

实际情况:从可缓存的前中移动动动态内容,在一个变化中,从7%到74%的缓存击中率.

### 雷迪克斯注意力赢得和输掉的地方

获奖:
- 总结:
- 代理 (相同的工具方案,不同的查询).
- 聊天长系统提示.
- 语音/视觉工作负载,重复序言.

输出 (返回vLLM级输出):
- 单次生成,具有独特的提示 (编码完成,无系统提示的开放式聊天).
- 动态提示,每个请求都将独特的内容插入预सर्ग中.

### 为什么这是一个调度器问题,而不是一个核心问题

您可以将KV重复使用作为一个内核技巧.SGLang的见解是,重复使用只会付出,如果调节器保持热分支居民.一个天真的"如果可用"政策将在混合负载下乱缓存. 基因树索引调度器是使内核技巧成为29%的生产边缘.

### 与vLLM相互作用

两种系统并非严格的竞争对手.`--enable-prefix-caching`                                                                                                                                                                                                                                                              

```figure
roofline
```

## 用它

`code/main.py`运行相同的工作负载通过两个,报告预先缓存击率和吞吐量德尔塔.然后运行一个"缩订"工作负载显示6.4x崩.

其他[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=4096)机器显示了实际L4运行中的Radix缓存.四个组每个组都有自己的4,096代币系统提示.一个组的第一个请求计算了提示.当提示保持在缓存中,后来的请求只计算了128代币问题.关闭Radix缓存,以看到中位数的第一个代币从479 ms到14706 ms.

## 运送它

这一课产生了`outputs/skill-radix-scheduler-advisor.md`鉴于工作负载描述 (即时模板形状,检索模式,同时租户数量),它产生了即时订单的处方和SGLang采用的无需处方.

## 运动

1. 跑步`code/main.py`根据FCFS和缓存意识的相同工作负载进行比较. 预填储蓄,解码储蓄或排队延迟的达尔塔来自哪里?
2. 修改工作负载,让提示随机转移`[system, tools, context]`什么会发生在撞击率?
3. 计算HBM的成本,以将2000个代币系统提示居民作为一个基底分支在Llama 3.1 8B上. 与没有预写重复使用的16个序列批次的成本进行比较.
4. 阅读SGLang RadixAttention论文. 用三句话解释为什么树状LRU驱逐器在前重负载下比块状LRU更好.
5. 给出三个可能的原因和你会为每一个用户进行的诊断.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## 进一步阅读

- [SGLang GitHub](https://github.com/sgl-project/sglang)来源和文件.
- [SGLang documentation](https://sgl-project.github.io/)                                                                                                                                                                                                                                                              
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104)设计参考.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/)基准数字和时间表理性.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) vLLM自己的基像实施,比较.
