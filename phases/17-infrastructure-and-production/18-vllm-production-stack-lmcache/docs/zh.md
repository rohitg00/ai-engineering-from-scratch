# 基于 LMCache KV 卸载的 vLLM 生产栈

> vLLM 的生产栈是参考性的 Kubernetes 部署方案——集成了路由器、引擎和可观测性。LMCache 是 KV 卸载层，将 KV 缓存从 GPU 内存中提取出来，并在查询和引擎之间复用（先使用 CPU DRAM，再使用磁盘/Ceph）。vLLM 0.11.0 的 KV 卸载连接器（2026 年 1 月）通过连接器 API（v0.9.0+）实现了异步化和可插拔化。卸载延迟对用户不可见。即使没有共享前缀，LMCache 也很有价值——当 GPU 的 KV 槽位耗尽时，被抢占的请求可以从 CPU 恢复，而无需重新计算 prefill。已发布的基准测试在 4 个 a3-highgpu-4g 上的 16 块 H100（80GB HBM）上进行：当 KV 缓存超过 HBM 容量时，原生 CPU 卸载和 LMCache 都能显著提升吞吐量；在低 KV 占用时，所有配置与基线基本持平，仅有少量额外开销。

**类型：** 学习
**语言：** Python（标准库，玩具级 KV 溢出模拟器）
**前置要求：** 阶段 17·04（vLLM 服务内部机制）、阶段 17·06（SGLang/RadixAttention）
**时长：** 约 60 分钟

## 学习目标

- 绘制 vLLM 生产栈各层：路由器、引擎、KV 卸载、可观测性。
- 解释 KV 卸载连接器 API（v0.9.0+），以及 0.11.0 异步路径如何隐藏卸载延迟。
- 量化 LMCache CPU-DRAM 何时有帮助（KV > HBM）vs 何时增加额外开销（KV 足够小，能完全放入 HBM）。
- 根据部署约束选择原生 vLLM CPU 卸载还是 LMCache 连接器。

## 问题

你的 vLLM 服务中，当并发量上升时，GPU 的 HBM 使用率达到 100%，并且出现大量抢占事件。请求被驱逐、重新排队，然后你在一分钟内四次重新计算同一个 2K token 提示词（prompt）的 prefill。GPU 算力浪费在冗余的 prefill 上；有效吞吐量远低于原始吞吐量。

增加更多 GPU 的成本是线性的。增加更多 HBM 是不可能的。但 CPU DRAM 很便宜——一个插槽就有 512 GB 以上，延迟虽然比 HBM 差几个数量级，但对于"临时保持热状态"的 KV 缓存来说已经足够。

LMCache 将 KV 缓存提取到 CPU DRAM，使被抢占的请求能快速恢复，并且不同引擎之间可以共享重复的前缀，无需每个引擎都重新执行 prefill。

## 概念

### vLLM 生产栈

`github.com/vllm-project/production-stack` 是参考性的 Kubernetes 部署方案：

- **路由器** — 缓存感知（阶段 17·11）。消费 KV 事件。
- **引擎** — vLLM 工作节点。每 GPU 或每 TP/PP 组一个。
- **KV 缓存卸载** — LMCache 部署或原生连接器。
- **可观测性** — Prometheus 采集、Grafana 仪表盘、OpenTelemetry 追踪。
- **控制面** — 服务发现、配置、滚动更新。

以 Helm Chart + Operator 的形式提供。

### KV 卸载连接器 API（v0.9.0+）

vLLM 0.9.0 引入了可插拔 KV 缓存后端的连接器 API。你的引擎将块卸载到连接器；连接器存储它们（RAM、磁盘、对象存储、LMCache）。当请求需要某个块时，连接器将其加载回来。

vLLM 0.11.0（2026 年 1 月）增加了异步卸载路径——卸载可以在后台进行，因此引擎在通常情况下不会因此而阻塞。端到端延迟和吞吐量仍然取决于工作负载形状、KV 缓存命中率和系统压力；vLLM 自身的说明指出，自定义内核卸载在低命中率下可能会降低吞吐量，并且异步调度与推测解码（speculative decoding）存在已知的交互问题。

### 原生 CPU 卸载 vs LMCache

**原生 vLLM CPU 卸载**：引擎本地。将 KV 块存储在主机的 RAM 中。实现快速，零网络跳转。不能跨引擎共享。

**LMCache 连接器**：集群级别。将块存储在共享的 LMCache 服务器（CPU DRAM + Ceph/S3 分层存储）中。任何引擎都可以访问这些块。已发布 16 块 H100 的基准测试。

当单个引擎面临 HBM 压力时，选择原生卸载。当多个引擎共享前缀时（如带有通用系统提示词的 RAG、多租户场景中共享模板），选择 LMCache。

### 基准测试行为

在 4 个 a3-highgpu-4g 上的 16 块 H100（80 GB HBM）测试：

- **低 KV 占用**（短提示词、低并发）：所有配置与基线持平，LMCache 增加约 3-5% 额外开销。
- **中等占用**：LMCache 开始在跨引擎前缀复用上发挥作用。
- **KV 超过 HBM**：原生 CPU 卸载和 LMCache 都显著提升吞吐量；LMCache 提升更大，得益于跨引擎共享。

### LMCache 的决定性场景

- 多租户服务中，租户之间共享系统提示词。
- RAG 场景中，文档块在多个查询间重复出现。
- 基于相同基础模型的微调变体（LoRA），基础模型的 KV 复用减少了冗余计算。
- 抢占密集的工作负载：从 CPU 恢复比重新执行 prefill 更划算。

### 何时不应启用

- HBM 压力较小——你承受额外开销却没有收益。
- 上下文较短（<1K tokens）——传输时间反而超过重新执行 prefill。
- 单租户单提示词工作负载——没有可捕获的复用机会。

### 与解耦式服务的集成

阶段 17·17 解耦式服务 + LMCache 形成叠加效应：KV 从 prefill 池传输到 decode 池时，如果未被使用则落入 LMCache；后续查询从 LMCache 拉取。阶段 17·11 的缓存感知路由器可以将请求路由到其本地缓存或 LMCache 共享缓存匹配的引擎。

### 需要记住的数据

- vLLM 0.9.0：连接器 API 发布。
- vLLM 0.11.0（2026 年 1 月）：异步卸载路径；端到端延迟影响取决于工作负载、KV 命中率和系统压力（并非绝对保证）。
- 16 块 H100 基准测试：当 KV 占用超过 HBM 时，LMCache 发挥作用。
- HBM 压力较小时：3-5% 的额外开销，没有收益。

```figure
zero-sharding
```

## 动手实践

`code/main.py` 模拟了有无 LMCache 情况下的抢占密集型工作负载。报告避免了多少次重新 prefill、吞吐量提升以及盈亏平衡的 HBM 利用率。

## 交付物

本课程产出 `outputs/skill-vllm-stack-decider.md`。根据工作负载形状和 vLLM 部署情况，决策使用原生卸载、LMCache 还是两者都不用。

## 练习

1. 运行 `code/main.py`。在什么 HBM 利用率下，LMCache 开始产生收益？
2. 一个租户在 200 次查询/小时中共享一个 6K token 的系统提示词。计算每个租户预期的 LMCache 节省量。
3. LMCache 服务器是单点故障。设计高可用策略（副本、回退到原生卸载）。
4. LMCache 将数据存储到机械磁盘上的 Ceph。对于一个 4K token 的 KV（70B FP8，约 500 MB），读取时间与重新执行 prefill 相比如何？
5. 论证 vLLM 0.11.0 异步路径是否"免费"——额外开销隐藏在何处？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 生产栈（Production-stack） | "参考部署方案" | vLLM 的 Kubernetes Helm Chart + Operator |
| 连接器 API（Connector API） | "KV 后端接口" | vLLM 0.9.0+ 的可插拔 KV 存储接口 |
| 原生 CPU 卸载（Native CPU offload） | "引擎本地溢出" | 将 KV 存储在同一引擎的主机 RAM 中 |
| LMCache | "集群 KV 缓存" | 跨引擎的 KV 缓存服务器，使用 CPU DRAM + 磁盘 |
| 0.11.0 异步卸载 | "非阻塞卸载" | 卸载隐藏在引擎流之后 |
| 抢占（Preemption） | "驱逐以腾出空间" | HBM 满时的 KV 缓存重排 |
| 前缀复用（Prefix reuse） | "相同的系统提示词" | 多个查询共享开头部分；缓存命中 |
| Ceph 分层（Ceph tier） | "磁盘层" | 缓存层次结构中 DRAM 之下的持久化存储 |

## 延伸阅读

- [vLLM 博客 — KV 卸载连接器（2026 年 1 月）](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM 生产栈 GitHub](https://github.com/vllm-project/production-stack) — Helm Chart + Operator。
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) — 连接器实现。
- [vLLM 0.11.0 发布说明](https://github.com/vllm-project/vllm/releases) — 异步路径详细信息。
