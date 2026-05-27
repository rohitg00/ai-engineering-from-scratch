# vLLM Production Stack 与 LMCache KV 卸载

> vLLM 的 production-stack 是参考 Kubernetes 部署——路由器、引擎和可观测性连接在一起。LMCache 是 KV 卸载层，将 KV 缓存从 GPU 内存中提取出来，并在查询和引擎之间重用它（CPU DRAM，然后磁盘/Ceph）。vLLM 0.11.0 KV Offloading Connector（2026 年 1 月）通过 Connector API（v0.9.0+）使这个过程异步且可插拔。卸载延迟不对用户可见。即使没有共享前缀，LMCache 也很有价值——当 GPU 的 KV 槽位不足时，被抢占的请求可以从 CPU 恢复，而不是重新计算 prefill。在 16x H100（80GB HBM）上跨 4 个 a3-highgpu-4g 发布的基准测试：当 KV 缓存超过 HBM 时，原生 CPU 卸载和 LMCache 都大幅提高吞吐量；在低 KV 占用空间下，所有配置都与基线匹配，开销很小。

**类型：** 学习
**语言：** Python（标准库，简单的 KV-spill 模拟器）
**先修要求：** 阶段 17 · 04（vLLM 服务内部）、阶段 17 · 06（SGLang/RadixAttention）
**时间：** 约 60 分钟

## 学习目标

- 绘制 vLLM production-stack 层：路由器、引擎、KV 卸载、可观测性。
- 解释 KV Offloading Connector API（v0.9.0+）以及 0.11.0 异步路径如何隐藏卸载延迟。
- 量化 LMCache CPU-DRAM 何时有帮助（KV > HBM）vs 增加开销（KV 足够小以适合 HBM）。
- 在原生 vLLM CPU 卸载和 LMCache connector 之间做出选择，给定部署约束。

## 问题

你的 vLLM 服务显示，每当并发攀升时，GPU 的 HBM 就达到 100%，并发生抢占事件。请求被驱逐、重新排队，你在不到一分钟内对同一 2K token 提示重新 prefill 四次。GPU 计算浪费在冗余的 prefill 上；goodput 远低于原始吞吐量。

添加更多 GPU 的成本是线性的。添加更多 HBM 是不可能的。但是 CPU DRAM 很便宜——一个插槽具有 512 GB+，延迟比 HBM 差几个数量级，但对于"临时温暖"的 KV 缓存来说没问题。

LMCache 将 KV 缓存提取到 CPU DRAM，以便被抢占的请求快速恢复，并且跨引擎的重复前缀可以共享缓存，而无需每个引擎重新 prefill。

## 概念

### vLLM production-stack

`github.com/vllm-project/production-stack` 是参考 Kubernetes 部署：

- **路由器**——缓存感知（阶段 17 · 11）。使用 KV 事件。
- **引擎**——vLLM workers。每个 GPU 一个或每个 TP/PP 组一个。
- **KV 缓存卸载**——LMCache 部署或原生 connector。
- **可观测性**——Prometheus 抓取、Grafana 仪表板、OTel 跟踪。
- **控制平面**——服务发现、配置、滚动更新。

作为 Helm chart + operator 提供。

### KV Offloading Connector API (v0.9.0+)

vLLM 0.9.0 引入了 Connector API，用于可插拔的 KV 存储后端。你的引擎将块卸载到 connector；connector 存储它们（RAM、磁盘、对象存储、LMCache）。请求需要一个块，connector 将其加载回来。

vLLM 0.11.0（2026 年 1 月）添加了一个异步卸载路径——卸载可以在后台发生，因此在常见情况下引擎不会阻塞它。端到端延迟和吞吐量仍取决于工作负载形状、KV 缓存命中率和系统压力；vLLM 自己的注释指出，自定义内核卸载在低命中率下会降低吞吐量，并且异步调度与 speculative decoding 存在已知的相互作用问题。

### 原生 CPU 卸载 vs LMCache

**原生 vLLM CPU 卸载**：引擎本地。在主机 RAM 中存储 KV 块。实现快速，零网络跳数。不跨引擎。

**LMCache connector**：集群规模。在共享的 LMCache 服务器（CPU DRAM + Ceph/S3 层）中存储块。块可被任何引擎访问。发布了 16x H100 基准测试。

当单个引擎遇到 HBM 压力时，选择原生。当多个引擎共享前缀时（具有公共系统提示的 RAG、具有共享模板的多租户），选择 LMCache。

### 基准测试行为

在跨 4 个 a3-highgpu-4g 发布的 16x H100（80 GB HBM）测试中：

- 低 KV 占用空间（短提示、低并发）：所有配置都与基线匹配，LMCache 增加约 3-5% 的开销。
- 中等占用空间：LMCache 开始帮助跨引擎的前缀重用。
- KV 超过 HBM：原生 CPU 卸载和 LMCache 都大幅提高吞吐量；LMCache 增益更大，因为跨引擎共享。

### LMCache 起决定性作用的情况

- 跨租户的服务，其中系统提示在租户之间共享。
- 文档块在查询中重复的 RAG。
- 同一基础上的微调变体（LoRA），其中基础模型 KV 重用减少了冗余工作。
- 抢占繁重的工作负载：从 CPU 恢复比重新 prefill 更便宜。

### 何时不启用

- 小 HBM 压力——你支付开销而没有任何好处。
- 短上下文（<1K tokens）——传输时间 > 重新 prefill。
- 单租户单提示工作负载——没有可捕获的重用。

### 与分离式服务集成

阶段 17 · 17 分离式服务 + LMCache 复合：如果未使用，来自 prefill 池的 KV 传输会落地到 LMCache 中；后续查询从 LMCache 中提取。阶段 17 · 11 缓存感知路由器可以路由到其本地或 LMCache 共享缓存匹配的引擎。

### 你应该记住的数字

- vLLM 0.9.0：Connector API 发布。
- vLLM 0.11.0（2026 年 1 月）：异步卸载路径；端到端延迟影响取决于工作负载、KV 命中率和系统压力（不是绝对保证）。
- 16x H100 基准测试：当 KV 占用空间超过 HBM 时，LMCache 有帮助。
- 小 HBM 压力：3-5% 的开销而没有好处。

## 使用它

`code/main.py` 模拟有和没有 LMCache 的抢占繁重工作负载。报告避免的重新 prefill、吞吐量增益和盈亏平衡 HBM 利用率。

## 交付它

本课生成 `outputs/skill-vllm-stack-decider.md`。给定工作负载形状和 vLLM 部署，决定原生 vs LMCache vs 都不使用。

## 练习

1. 运行 `code/main.py`。在何种 HBM 利用率下 LMCache 开始付费？
2. 一个租户每小时共享 200 个查询的 6K token 系统提示。计算每个租户的预计 LMCache 节省。
3. LMCache 服务器是单点故障。设计 HA 策略（副本、回退到原生）。
4. LMCache 存储到旋转磁盘上的 Ceph。对于 70B FP8（500 MB）的 4K token KV，读取时间 vs 重新 prefill 是多少？
5. 论证 vLLM 0.11.0 异步路径是否"免费"——开销隐藏在何处？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Production-stack | "参考部署" | vLLM 的 Kubernetes Helm chart + operator |
| Connector API | "KV 后端接口" | vLLM 0.9.0+ 可插拔 KV 存储接口 |
| Native CPU offload | "引擎本地溢出" | 在同一引擎的主机 RAM 中存储 KV |
| LMCache | "集群 KV 缓存" | 在 CPU DRAM + 磁盘上的跨引擎 KV 缓存服务器 |
| 0.11.0 async | "非阻塞卸载" | 隐藏在引擎流后面的卸载 |
| Preemption | "驱逐以腾出空间" | HBM 满时的 KV 缓存混洗 |
| Prefix reuse | "相同系统提示" | 多个查询共享开头；缓存命中 |
| Ceph tier | "磁盘层" | 缓存层次结构中 DRAM 之下的持久存储 |

## 延伸阅读

- [vLLM 博客——KV Offloading Connector（2026 年 1 月）](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack)——Helm chart + operator。
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache)——Connector 实现。
- [vLLM 0.11.0 发行说明](https://github.com/vllm-project/vllm/releases)——异步路径详细信息。
