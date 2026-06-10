# 18 · 基于 LMCache KV 卸载的 vLLM 生产栈

> vLLM 的 production-stack 是参考性的 Kubernetes 部署方案——把路由器、推理引擎与可观测性串联在一起。LMCache 则是「KV 卸载（KV offloading）」层，负责把「KV 缓存（KV cache）」从 GPU 显存中抽离出来，并在不同查询与引擎之间复用（先放到 CPU DRAM，再下沉到磁盘 / Ceph）。vLLM 0.11.0 的 KV 卸载连接器（KV Offloading Connector，2026 年 1 月）通过「连接器 API（Connector API）」（v0.9.0+）使其变为异步且可插拔。卸载延迟对用户不可见。即便没有共享前缀，LMCache 依然有价值——当某块 GPU 用尽 KV 槽位时，被抢占的请求可以从 CPU 恢复，而无需重新计算 prefill。已发布的基准测试在 16x H100（80GB HBM）、跨 4 台 a3-highgpu-4g 上运行：当 KV 缓存超出 HBM 时，原生 CPU 卸载与 LMCache 都能显著提升吞吐；而在 KV 占用很低时，所有配置都与基线持平，仅带来很小的开销。

**类型：** 学习
**语言：** Python（标准库，玩具级 KV 溢出模拟器）
**前置：** 第 17 阶段 · 04（vLLM 服务内部机制），第 17 阶段 · 06（SGLang/RadixAttention）
**时长：** 约 60 分钟

## 学习目标

- 画出 vLLM production-stack 的各层：路由器、引擎、KV 卸载、可观测性。
- 解释 KV 卸载连接器 API（v0.9.0+），以及 0.11.0 的异步路径如何隐藏卸载延迟。
- 量化 LMCache 的 CPU-DRAM 在何时有帮助（KV > HBM）、何时反而增加开销（KV 小到足以放进 HBM）。
- 在给定部署约束下，在原生 vLLM CPU 卸载与 LMCache 连接器之间做出选择。

## 问题所在

你的 vLLM 服务显示 GPU 的 HBM 已 100% 占满，而且只要并发一上升就出现抢占（preemption）事件。请求被驱逐、重新排队，于是你在一分钟内对同一个 2K-token 的 prompt 重新做了四次 prefill。GPU 算力被花在冗余的 prefill 上;「有效吞吐（goodput）」远低于原始吞吐。

增加 GPU 的成本是线性增长的。增加 HBM 则根本不可能。但 CPU DRAM 很便宜——单个插槽就有 512 GB 以上，其延迟比 HBM 差好几个数量级，但对于「临时保温」的 KV 缓存来说完全够用。

LMCache 把 KV 缓存抽离到 CPU DRAM，让被抢占的请求能快速恢复，并让跨引擎重复出现的前缀共享缓存，而无需每个引擎都重新 prefill。

## 核心概念

### vLLM production-stack

`github.com/vllm-project/production-stack` 是参考性的 Kubernetes 部署方案：

- **路由器（Router）**——具备缓存感知能力（第 17 阶段 · 11）。消费 KV 事件。
- **引擎（Engines）**——vLLM 工作进程。每块 GPU 一个，或每个 TP/PP 组一个。
- **KV 缓存卸载（KV cache offload）**——LMCache 部署或原生连接器。
- **可观测性（Observability）**——Prometheus 抓取、Grafana 仪表盘、OTel 链路追踪。
- **控制平面（Control plane）**——服务发现、配置、滚动更新。

以 Helm chart + operator 的形式发布。

### KV 卸载连接器 API（v0.9.0+）

vLLM 0.9.0 引入了用于可插拔 KV 缓存后端的连接器 API。你的引擎把 block 卸载给连接器;连接器负责存储它们（RAM、磁盘、对象存储、LMCache）。当某个请求需要某个 block 时，连接器再把它加载回来。

vLLM 0.11.0（2026 年 1 月）新增了异步卸载路径——卸载可以在后台进行，因此在常见情形下引擎不会被它阻塞。端到端的延迟与吞吐仍取决于工作负载形态、KV 缓存命中率以及系统压力;vLLM 官方文档指出，自定义内核（custom-kernel）卸载在命中率较低时可能会拉低吞吐，并且异步调度与「投机解码（speculative decoding）」之间存在已知的交互问题。

### 原生 CPU 卸载 vs LMCache

**原生 vLLM CPU 卸载**：引擎本地（engine-local）。把 KV block 存储在主机 RAM 中。实现简单、零网络跳数。不跨引擎共享。

**LMCache 连接器**：集群级（cluster-scale）。把 block 存储在共享的 LMCache 服务器中（CPU DRAM + Ceph/S3 层）。任何引擎都可访问这些 block。已发布 16x H100 基准测试。

当单个引擎出现 HBM 压力时，选原生方案。当多个引擎共享前缀时（例如带有公共系统提示的 RAG、共享模板的多租户场景），选 LMCache。

### 基准测试表现

在 4 台 a3-highgpu-4g 上分布的 16x H100（80 GB HBM）测试：

- 低 KV 占用（短 prompt、低并发）：所有配置都与基线持平，LMCache 带来约 3-5% 的开销。
- 中等占用：LMCache 开始在跨引擎的前缀复用上发挥作用。
- KV 超出 HBM：原生 CPU 卸载与 LMCache 都能显著提升吞吐;LMCache 的增益更大，因为它支持跨引擎共享。

### LMCache 何时起决定性作用

- 多租户服务，且系统提示在各租户间共享。
- RAG 场景，文档片段在多次查询间重复。
- 基于同一基座模型的微调变体（LoRA），基座模型的 KV 复用可削减冗余工作。
- 抢占密集型工作负载：从 CPU 恢复比重新 prefill 更划算。

### 何时不应启用

- HBM 压力很小——你只付出开销却得不到收益。
- 上下文很短（<1K token）——传输时间 > 重新 prefill。
- 单租户单 prompt 工作负载——没有可捕获的复用。

### 与分离式服务（disaggregated serving）的集成

第 17 阶段 · 17 的分离式服务 + LMCache 会产生叠加效应：从 prefill 池传往 decode 池的 KV，若未被使用就会落入 LMCache;后续查询便可从 LMCache 拉取。第 17 阶段 · 11 的缓存感知路由器可以把请求路由到「本地缓存」或「LMCache 共享缓存」相匹配的那个引擎。

### 你应该记住的数字

- vLLM 0.9.0：连接器 API 发布。
- vLLM 0.11.0（2026 年 1 月）：异步卸载路径;端到端延迟的影响取决于工作负载、KV 命中率与系统压力（并非绝对保证）。
- 16x H100 基准测试：当 KV 占用超出 HBM 时，LMCache 有帮助。
- HBM 压力小：3-5% 的开销且无收益。

## 动手用起来

`code/main.py` 模拟了一个抢占密集型工作负载，分别在有 LMCache 和无 LMCache 的情况下运行。它会报告避免的重新 prefill 次数、吞吐增益，以及收支平衡点对应的 HBM 利用率。

## 交付产物

本课产出 `outputs/skill-vllm-stack-decider.md`。给定工作负载形态与 vLLM 部署情况，它会判断该选原生方案、LMCache，还是两者都不用。

## 练习

1. 运行 `code/main.py`。在 HBM 利用率达到多少时，LMCache 才开始带来回报？
2. 某租户在每小时 200 次查询中共享一个 6K-token 的系统提示。计算该租户每小时预期能从 LMCache 节省多少。
3. LMCache 服务器是单点故障。设计高可用（HA）策略（副本、回退到原生方案）。
4. LMCache 存储到机械硬盘上的 Ceph。对于 70B FP8 下的 4K-token KV（500 MB），其读取时间与重新 prefill 相比如何？
5. 论证 vLLM 0.11.0 的异步路径是否「免费」——开销究竟藏在哪里？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Production-stack | 「参考部署方案」 | vLLM 的 Kubernetes Helm chart + operator |
| Connector API | 「KV 后端接口」 | vLLM 0.9.0+ 的可插拔 KV 存储接口 |
| Native CPU offload | 「引擎本地溢出」 | 把 KV 存储在同一引擎的主机 RAM 中 |
| LMCache | 「集群级 KV 缓存」 | 部署在 CPU DRAM + 磁盘上的跨引擎 KV 缓存服务器 |
| 0.11.0 async | 「非阻塞卸载」 | 卸载被隐藏在引擎数据流之后 |
| Preemption | 「驱逐以腾出空间」 | HBM 满时的 KV 缓存腾挪 |
| Prefix reuse | 「相同的系统提示」 | 多个查询共享开头部分;缓存命中 |
| Ceph tier | 「磁盘层」 | 缓存层级中位于 DRAM 之下的持久化存储 |

## 延伸阅读

- [vLLM 博客 — KV 卸载连接器（2026 年 1 月）](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) — Helm chart + operator。
- [LMCache 面向企业级 LLM 推理（arXiv:2510.09665）](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) — 连接器实现。
- [vLLM 0.11.0 发布说明](https://github.com/vllm-project/vllm/releases) — 异步路径细节。
