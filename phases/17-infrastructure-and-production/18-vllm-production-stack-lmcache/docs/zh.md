# 带LMCache KV卸载的vLLM生产栈

> vLLM的生产栈是参考Kubernetes部署 —— 路由器、引擎和可观测性连接在一起。LMCache是将KV缓存从GPU内存中提取出来并在查询和引擎间重用的KV卸载层（CPU DRAM，然后磁盘/Ceph）。vLLM 0.11.0 KV卸载连接器（2026年1月）通过Connector API（v0.9.0+）使其异步且可插拔。卸载延迟对用户不可见。即使没有共享前缀，LMCache也有价值 —— 当GPU耗尽KV槽位时，被抢占的请求可以从CPU恢复，而非重新计算预填充。在4个a3-highgpu-4g上的16x H100（80GB HBM）上发布的基准测试：当KV缓存超过HBM时，原生CPU卸载和LMCache都大幅改善吞吐量；在低KV占用下，所有配置与基线匹配，开销很小。

**类型：** 学习
**语言：** Python（标准库，玩具KV溢出模拟器）
**前置知识：** 第17阶段 · 04（vLLM服务内部），第17阶段 · 06（SGLang/RadixAttention）
**时间：** 约60分钟

## 学习目标

- 绘制vLLM生产栈层：路由器、引擎、KV卸载、可观测性。
- 解释KV卸载连接器API（v0.9.0+）以及0.11.0异步路径如何隐藏卸载延迟。
- 量化LMCache CPU-DRAM何时帮助（KV > HBM）vs 增加开销（KV小到适合HBM）。
- 给定部署约束，在原生vLLM CPU卸载和LMCache连接器之间选择。

## 问题

你的vLLM服务显示GPU在100% HBM上，并发爬升时发生抢占事件。请求被逐出、重新排队，你在一分钟内对相同2K token提示重新预填充四次。GPU计算花在冗余预填充上；goodput远低于原始吞吐量。

添加更多GPU成本线性。添加更多HBM不可能。但CPU DRAM便宜 —— 一个插槽有512 GB+，延迟比HBM差几个数量级，但对"临时温"KV缓存没问题。

LMCache将KV缓存提取到CPU DRAM，因此被抢占的请求快速恢复，且跨引擎的重复前缀共享缓存而不每个引擎重新预填充。

## 概念

### vLLM生产栈

`github.com/vllm-project/production-stack`是参考Kubernetes部署：

- **路由器** —— 缓存感知（第17阶段 · 11）。消费KV事件。
- **引擎** —— vLLM工作器。每个GPU或每个TP/PP组一个。
- **KV缓存卸载** —— LMCache部署或原生连接器。
- **可观测性** —— Prometheus抓取、Grafana仪表板、OTel跟踪。
- **控制平面** —— 服务发现、配置、滚动更新。

作为Helm chart + operator发布。

### KV卸载连接器API（v0.9.0+）

vLLM 0.9.0引入用于可插拔KV缓存后端的连接器API。你的引擎将块卸载到连接器；连接器存储它们（RAM、磁盘、对象存储、LMCache）。请求需要块，连接器加载它回来。

vLLM 0.11.0（2026年1月）添加异步卸载路径 —— 卸载可以在后台发生，因此引擎在常见情况下不阻塞。端到端延迟和吞吐量仍然取决于工作负载形状、KV缓存命中率和系统压力；vLLM自己的说明指出，自定义内核卸载可能在低命中率下降低吞吐量，且异步调度与投机解码有已知交互问题。

### 原生CPU卸载 vs LMCache

**原生vLLM CPU卸载**：引擎本地。在主机RAM中存储KV块。快速实现，零网络跳。不跨引擎。

**LMCache连接器**：集群规模。在共享LMCache服务器（CPU DRAM + Ceph/S3层）中存储块。块可被任何引擎访问。16x H100基准测试已发布。

当单个引擎有HBM压力时选择原生。当多个引擎共享前缀（带通用系统提示的RAG、带共享模板的多租户）时选择LMCache。

### 基准行为

跨4个a3-highgpu-4g的16x H100（80 GB HBM）测试：

- 低KV占用（短提示、低并发）：所有配置与基线匹配，LMCache增加约3-5%开销。
- 中等占用：LMCache开始在跨引擎前缀重用上帮助。
- KV超过HBM：原生CPU卸载和LMCache都大幅改善吞吐量；LMCache增益更大，因为跨引擎共享。

### LMCache何时是决定性的

- 系统提示跨租户共享的多租户服务。
- 文档块跨查询重复的RAG。
- 相同基础上微调变体（LoRA），其中基础模型KV重用削减冗余工作。
- 抢占重工作负载：从CPU恢复比重新预填充便宜。

### 何时不启用

- 小HBM压力 —— 你支付开销而无收益。
- 短上下文（<1K token） —— 传输时间 > 重新预填充。
- 单租户单提示工作负载 —— 无重用可捕获。

### 与解耦服务集成

第17阶段 · 17解耦服务 + LMCache复合：从预填充池到解码池的KV传输如果未使用则落在LMCache中；后续查询从LMCache拉取。第17阶段 · 11缓存感知路由器可以路由到其本地或LMCache共享缓存匹配的引擎。

### 你应该记住的数字

- vLLM 0.9.0：Connector API发布。
- vLLM 0.11.0（2026年1月）：异步卸载路径；端到端延迟影响取决于工作负载、KV命中率和系统压力（非绝对保证）。
- 16x H100基准测试：当KV占用超过HBM时，LMCache帮助。
- 小HBM压力：3-5%开销无收益。

## 使用它

`code/main.py`模拟带和不带LMCache的抢占重工作负载。报告避免的重新预填充、吞吐量增益和盈亏平衡HBM利用率。

## 交付它

本课程产出`outputs/skill-vllm-stack-decider.md`。给定工作负载形状和vLLM部署，决定原生 vs LMCache vs 都不。

## 练习

1. 运行`code/main.py`。在什么HBM利用率下，LMCache开始回报？
2. 租户在200查询/小时跨共享6K token系统提示。计算每个租户的预期LMCache节省。
3. LMCache服务器是单点故障。设计HA策略（副本、回退到原生）。
4. LMCache存储到Ceph旋转磁盘。对于70B FP8上4K token KV（500 MB），读取时间 vs 重新预填充是多少？
5. 争论vLLM 0.11.0异步路径是否"免费" —— 开销隐藏在哪里？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 生产栈 | "参考部署" | vLLM的Kubernetes Helm chart + operator |
| 连接器API | "KV后端接口" | vLLM 0.9.0+可插拔KV存储接口 |
| 原生CPU卸载 | "引擎本地溢出" | 在同引擎的主机RAM中存储KV |
| LMCache | "集群KV缓存" | CPU DRAM + 磁盘上的跨引擎KV缓存服务器 |
| 0.11.0异步 | "非阻塞卸载" | 隐藏在引擎流后的卸载 |
| 抢占 | "逐出以腾出空间" | HBM满时KV缓存洗牌 |
| 前缀重用 | "相同系统提示" | 多个查询共享开头；缓存命中 |
| Ceph层 | "磁盘层" | 缓存层次结构中DRAM下方的持久存储 |

## 延伸阅读

- [vLLM博客 —— KV卸载连接器（2026年1月）](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM生产栈GitHub](https://github.com/vllm-project/production-stack) —— Helm chart + operator。
- [企业规模LLM推理的LMCache（arXiv:2510.09665）](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) —— 连接器实现。
- [vLLM 0.11.0发布说明](https://github.com/vllm-project/vllm/releases) —— 异步路径详情。