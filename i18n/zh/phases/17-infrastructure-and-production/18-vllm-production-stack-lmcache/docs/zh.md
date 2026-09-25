# 生产级服务栈 — KV 卸载与缓存感知路由

> 生产级服务栈将路由器、引擎和可观测性集成到一个 Kubernetes 部署中——并将 KV cache 视为可以离开 GPU 的资源。KV 卸载将 KV cache 从 GPU 显存中提取出来，并在查询与引擎之间复用(先放 CPU DRAM,再放磁盘/Ceph)。vLLM 的 production-stack 是参考部署；LMCache 是卸载层。vLLM 0.11.0 的 KV Offloading Connector(2026 年 1 月)使其变为异步，并可通过 Connector API(v0.9.0+)插拔。卸载路径通常对请求路径不可见，但 cache 未命中和回迁可能增加端到端延迟。即使没有共享前缀，LMCache 也很有价值——当 GPU 的 KV slot 耗尽时，被抢占的请求可以从 CPU 恢复，而无需重新计算 prefill。已发布的基准测试基于 4 台 a3-highgpu-4g 上的 16x H100(80GB HBM):当 KV cache 超出 HBM 时，原生 CPU offload 和 LMCache 都能显著提升吞吐；在低 KV 占用时，所有配置与基线持平，仅有少量开销。

**Type:** Learn
**Languages:** Python (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)、Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 分钟

## 学习目标

- 绘制 vLLM production-stack 的层次结构：router、engines、KV offload、observability。
- 解释 KV Offloading Connector API(v0.9.0+),以及 0.11.0 的异步路径如何隐藏卸载延迟。
- 量化 LMCache CPU-DRAM 何时有帮助(KV > HBM),何时增加开销(KV 小到足以放进 HBM)。
- 在给定部署约束的情况下，在原生 vLLM CPU offload 和 LMCache connector 之间做选择。

## 问题

你的 vLLM 服务显示 GPU HBM 占用 100%,且并发一上升就出现抢占事件。请求被驱逐、重新排队，你在一天内对同一段 2K-token prompt 重新 prefill 了四次。GPU 算力被浪费在冗余 prefill 上；goodput 远低于原始吞吐。

增加 GPU 成本线性上升。增加 HBM 不可能。但 CPU DRAM 便宜——一个 socket 就有 512 GB 以上，延迟比 HBM 差几个数量级，但对“临时保温”的 KV cache 来说足够。

LMCache 将 KV cache 提取到 CPU DRAM,使被抢占的请求能快速恢复，并让跨引擎的重复前缀共享 cache,无需每个引擎重新 prefill。

## 概念

### vLLM production-stack

`github.com/vllm-project/production-stack` 是参考的 Kubernetes 部署：

- **Router** — 缓存感知(Phase 17 · 11)。消费 KV 事件。
- **Engines** — vLLM worker。每个 GPU 或每个 TP/PP 组一个。
- **KV cache offload** — LMCache 部署或原生 connector。
- **Observability** — Prometheus 抓取、Grafana 仪表盘、OTel 追踪。
- **控制平面** — 服务发现、配置、滚动更新。

以 Helm chart + operator 形式交付。

### KV Offloading Connector API(v0.9.0+)

vLLM 0.9.0 引入了用于可插拔 KV cache 后端的 Connector API。引擎将 block 卸载到 connector;connector 存储它们(RAM、磁盘、对象存储、LMCache)。请求需要某个 block 时，connector 将其加载回来。

vLLM 0.11.0(2026 年 1 月)增加了异步卸载路径——卸载可以在后台进行，因此在常见情况下引擎不会被其阻塞。端到端延迟和吞吐仍取决于负载形态、KV cache 命中率和系统压力；vLLM 自己的说明指出，自定义 kernel 的卸载在低命中率下会降低吞吐，且异步调度与投机解码存在已知的交互问题。

### 原生 CPU offload vs LMCache

**原生 vLLM CPU offload**:引擎本地。将 KV block 存储在宿主机 RAM 中。实现简单，无网络跳数。不跨引擎。

**LMCache connector**:集群规模。将 block 存储在共享的 LMCache 服务器(CPU DRAM + Ceph/S3 分层)中。block 对任何引擎都可访问。已有已发布的 16x H100 基准测试。

当单个引擎有 HBM 压力时选原生。当多个引擎共享前缀时选 LMCache(带通用 system prompt 的 RAG、带共享模板的多租户)。

### 基准测试行为

16x H100(80 GB HBM)分布在 4 台 a3-highgpu-4g 上的测试：

- 低 KV 占用(短 prompt、低并发)：所有配置与基线持平，LMCache 增加约 3-5% 开销。
- 中等占用：LMCache 在跨引擎前缀复用上开始见效。
- KV 超出 HBM:原生 CPU offload 和 LMCache 都显著提升吞吐；LMCache 收益更大，因为有跨引擎共享。

### LMCache 起决定性作用的场景

- 多租户服务，system prompt 跨租户共享。
- RAG,文档 chunk 在查询间重复。
- 同一基座上的微调变体(LoRA),基座模型的 KV 复用可减少冗余工作。
- 抢占繁重的负载：从 CPU 恢复比重新 prefill 更便宜。

### 何时不应启用

- HBM 压力小——付了开销却没有收益。
- 短上下文(<1K token)——传输时间 > 重新 prefill。
- 单租户单 prompt 负载——没有可复用的内容。

### 与分离式服务的集成

Phase 17 · 17 分离式服务 + LMCache 叠加：从 prefill 池到 decode 池的 KV 传输，若未被使用则落入 LMCache;后续查询从 LMCache 拉取。Phase 17 · 11 的缓存感知 router 可以路由到本地缓存或 LMCache 共享缓存匹配的引擎。

### 应记住的数字

- vLLM 0.9.0:Connector API 发布。
- vLLM 0.11.0(2026 年 1 月)：异步卸载路径；对端到端延迟的影响取决于负载、KV 命中率和系统压力(并非绝对保证)。
- 16x H100 基准：当 KV 占用超出 HBM 时 LMCache 有帮助。
- HBM 压力小时：3-5% 开销，没有收益。

```figure
zero-sharding
```

## 使用它

`code/main.py` 模拟有/无 LMCache 的抢占繁重负载。报告避免的重新 prefill 次数、吞吐增益，以及盈亏平衡的 HBM 利用率。

## 交付它

本课产出 `outputs/skill-vllm-stack-decider.md`。给定负载形态和 vLLM 部署，决定用原生、LMCache 还是都不用。

## 练习

1. 运行 `code/main.py`。HBM 利用率达到多少时 LMCache 开始划算？
2. 某租户跨每小时 200 次查询共享一段 6K-token system prompt。计算每个租户预期的 LMCache 节省。
3. LMCache 服务器是单点故障。设计 HA 策略(副本、回退到原生)。
4. LMCache 存储到机械盘上的 Ceph。对于 70B FP8 下一段 4K-token 的 KV(500 MB),读取时间与重新 prefill 相比如何？
5. 论证 vLLM 0.11.0 异步路径是否“免费”——开销藏在哪里？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Production-stack | “参考部署” | vLLM 的 Kubernetes Helm chart + operator |
| Connector API | “KV 后端接口” | vLLM 0.9.0+ 的可插拔 KV 存储接口 |
| 原生 CPU offload | “引擎本地溢出” | 将 KV 存储在同一引擎的宿主机 RAM 中 |
| LMCache | “集群 KV cache” | 基于 CPU DRAM + 磁盘的跨引擎 KV cache 服务器 |
| 0.11.0 async | “非阻塞卸载” | 卸载隐藏在引擎流之后 |
| 抢占 (Preemption) | “驱逐腾地方” | HBM 满时的 KV cache 挪移 |
| 前缀复用 | “相同的 system prompt” | 多个查询共享开头；cache 命中 |
| Ceph 层 | “磁盘层” | 缓存层次中位于 DRAM 之下的持久存储 |

## 延伸阅读

- [vLLM Blog — KV Offloading Connector(2026 年 1 月)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) — Helm chart + operator。
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) — Connector 实现。
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) — 异步路径细节。