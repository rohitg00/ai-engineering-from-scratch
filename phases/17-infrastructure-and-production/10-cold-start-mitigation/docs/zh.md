# 无服务器 LLM 的冷启动缓解

> 20 GB 模型镜像从冷启动到服务需要 5-10 分钟（7B）到 20+ 分钟（70B）。在真正的无服务器世界中，这不是预热——这是中断。缓解在五个层操作：预置节点镜像（AWS 上的 Bottlerocket、双卷架构）、模型流式传输（NVIDIA Run:ai Model Streamer、vLLM 中原生）、GPU 内存快照（Modal 检查点，高达 10 倍更快重启）、热池（`min_workers=1`）、分层加载（ServerlessLLM 的 NVMe→DRAM→HBM 管道，10-200 倍延迟减少），以及传输输入 token（KB）而不是 KV 缓存（GB）的实时迁移。Modal 发布 2-4 秒冷启动作为基础；Baseten 5-10 秒默认，亚秒级带预热。本课教你测量、预算和堆叠五个层。

**类型：** 学习
**语言：** Python（标准库，简单的冷启动路径模拟器）
**先修要求：** 阶段 17 · 02（推理平台经济学）、阶段 17 · 03（GPU 自动扩缩）
**时间：** 约 60 分钟

## 学习目标

- 列举冷启动缓解的五个层，并说出每个层的一个工具或模式。
- 将总冷启动时间计算为（节点供应）+（权重下载）+（权重加载到 HBM）+（引擎初始化）对于 70B 模型的总和。
- 解释为什么实时迁移传输输入 token（KB）而不是 KV 缓存（GB），以及惩罚是什么（重新计算）。
- 说出热池权衡（为空闲 GPU 付费或接受冷启动尾部）以及 `min_workers > 0` 成为强制性的 SLA 阈值。

## 问题

你的无服务器 LLM 端点在夜间缩放到零。在上午 8 点流量激增。第一个请求等待同时：

1. Karpenter 供应 GPU 节点：45-60 秒。
2. 容器拉取带有权重的 30 GB 镜像：120-300 秒。
3. 引擎将权重加载到 HBM：45-120 秒，取决于模型大小和存储速度。
4. vLLM 或 TRT-LLM 初始化 CUDA 图、KV 缓存池、tokenizer：10-30 秒。

总计：在返回一个 token 之前 220-510 秒（大约 3-8 分钟）。你的 SLA 是 2 秒。你部署一个热池（`min_workers=1`）并且问题似乎消失了——但现在你为 24x7 的一个空闲 GPU 付费。如果你的服务有 5 个产品，每个都有一个热副本，那是 5 × 24 × 30 = 3,600 GPU 小时/月，无论是否有单个用户调用。

冷启动缓解是如何在保持无服务器经济学的同时近似始终开启的延迟。

## 概念

### 第 1 层——预置节点镜像（Bottlerocket）

在 AWS 上，Bottlerocket 的双卷架构将操作系统与数据分离。使用预拉取的容器镜像快照数据卷；在你的 `EC2NodeClass` 中引用快照 ID。新节点启动时权重已在本地 NVMe 上——第 2 步和第 3 步部分消失。原生与 Karpenter 一起工作。典型节省：大模型的每次冷启动 2-4 分钟。

GCP 上的等效项：带有预烘焙容器层的自定义 VM 镜像。在 Azure 上：具有相同模式的托管磁盘快照。

### 第 2 层——模型流式传输（Run:ai Model Streamer）

不是在回答第一个请求之前加载完整文件，而是将权重逐层流式传输到 GPU 内存，并在第一个 transformer 块驻留时立即开始处理。NVIDIA Run:ai Model Streamer 在 vLLM 2026 中原生提供。与 S3、GCS 和本地 NVMe 一起工作。通过将 I/O 与计算设置重叠，将大模型权重大约减半加载时间。

### 第 3 层——GPU 内存快照（Modal）

Modal 在首次加载后获取 GPU 状态（权重、CUDA 图、KV 缓存区域）的检查点。后续重启直接反序列化到 HBM——比重新初始化快 10 倍。这是"在 2 秒内启动热 GPU"最接近的事物。权衡：快照是每个 GPU 拓扑的，因此如果 Karpenter 将你迁移到不同的 SKU，你需要重新检查点。

### 第 4 层——热池（min_workers=1）

最简单的缓解：保持一个副本始终就绪。成本是 GPU 的每小时费率 24x7。算术对于小模型是残酷的（你支付 0.85-1.50 美元/小时以避免 30 秒冷启动），对大模型是友好的（支付 4 美元/小时以避免 5 分钟冷启动）。热池变得强制性的 SLA 阈值：通常是 70B+ 模型上的 TTFT P99 < 60 秒。

### 第 5 层——分层加载（ServerlessLLM）

ServerlessLLM 将存储视为层次结构：NVMe（快速但大）、DRAM（中等但分层）、HBM（微小但即时）。权重预加载到 DRAM；按需加载到 HBM。论文报告与朴素磁盘到 HBM 相比，冷加载的 10-200 倍延迟减少。生产采用处于早期阶段，但存在与 vLLM 的集成。

### 第 6 层——实时迁移（奖励模式）

当节点变得不可用时（spot 驱逐、节点排空），传统模式是冷启动另一个副本并排空请求队列。实时迁移将输入 token（千字节）移动到已加载模型的目地，并在目地重新计算 KV 缓存。重新计算比通过网络传输 GB 的 KV 缓存更便宜。适用于分离式部署。

### 热池数学

对于具有 2 秒 P99 TTFT SLA 的服务，问题不是"热池是/否"，而是"多少热副本，以及哪些路径获得它们。"

- 高价值交互路径（实时聊天、语音代理）：`min_workers=1-2`。
- 后台批处理路径（夜间分类）：接受缩放到零，5-10 分钟冷启动可容忍。
- 高级层：每个租户带专用容量的 `min_workers`。

### 在优化之前测量

新鲜节点上 70B 模型的冷启动分析（说明性）：

| 阶段 | 时间 | 缓解 |
|-------|------|-----------|
| 节点供应 | 50 秒 | Bottlerocket + 预置镜像、热池 |
| 镜像拉取 | 180 秒 | 预置数据卷（消除） |
| 权重到 HBM | 75 秒 | Model streamer（减半）；GPU 快照（消除） |
| 引擎初始化 | 20 秒 | 持久 CUDA 图缓存 |
| 首次前向 | 3 秒 | 最小固有延迟 |
| **总冷启动** | **328 秒** | |
| **缓解后总计** | **约 15 秒** | 22 倍减少 |

### 你应该记住的数字

- Modal 冷启动：2-4 秒（带 GPU 快照）。
- Baseten 默认冷启动：5-10 秒；带预热时亚秒级。
- 原始 70B 冷启动：3-8 分钟。
- Run:ai Model Streamer：约 2 倍权重点加载速度。
- ServerlessLLM 分层加载：10-200 倍延迟减少（论文数字）。

## 使用它

`code/main.py` 模拟有和没有每种缓解的冷启动路径。报告总冷启动时间、热池成本和盈亏平衡请求率，高于该费率热池通过避免 SLO 下的额外请求丢弃来自付费。

## 交付它

本课生成 `outputs/skill-cold-start-planner.md`。给定 SLA、模型大小和流量形状，选择要堆叠的缓解措施。

## 练习

1. 运行 `code/main.py`。计算盈亏平衡请求率，高于该费率热副本比通过 SLO 下额外请求丢弃支付冷启动税更便宜。
2. 你部署具有 3 秒 P99 TTFT SLA 的 13B 模型。选择实现它的最小缓解栈（最少层）。
3. Bottlerocket 预置消除了镜像拉取，但权重仍从快照加载到 HBM。如果快照支持的 NVMe 以 7 GB/s 读取，计算 70B 模型的挂钟时间。
4. 你的无服务器提供商提供 GPU 快照（Modal），你的团队因为"快照泄漏 PII"而拒绝。辩论双方——现实风险是什么，以及缓解措施（临时快照、加密、命名空间隔离）是什么？
5. 设计分层热池策略：付费用户、试用用户和批处理工作负载需要多少热副本？展示数学。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Cold start | "大暂停" | 从请求到新鲜副本上第一个 token 的时间 |
| Warm pool | "始终开启最小值" | `min_workers >= 1` 以保持至少一个副本就绪 |
| Pre-seeded image | "烘焙 AMI" | 容器权重预驻留的节点镜像 |
| Bottlerocket | "AWS 节点操作系统" | 具有双卷快照支持的 AWS 容器优化操作系统 |
| Model streamer | "流式加载" | 将权重点 I/O 与计算设置重叠 |
| GPU snapshot | "检查点到 HBM" | 序列化加载后 GPU 状态；重启时反序列化 |
| Tiered loading | "NVMe + DRAM + HBM" | 存储层层次结构；按需加载 |
| Live migration | "移动 token" | 传输输入（KB），在目地重新计算 KV |
| `min_workers` | "热副本" | 无服务器最小保活计数 |
| Scale-to-zero | "完全无服务器" | 空闲时零成本；接受完整冷启动税 |

## 延伸阅读

- [Modal——冷启动性能](https://modal.com/docs/guide/cold-start)——Modal 发布的基准测试和检查点架构。
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket)——预置数据卷快照模式。
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer)——将权重点加载与计算设置重叠。
- [Baseten——冷启动缓解](https://www.baseten.co/blog/cold-start-mitigation/)——预热操作手册。
- [ServerlessLLM 论文 (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu)——分层加载设计。
- [NVIDIA——Kubernetes 上的分离式 LLM 推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)——分离式部署的实时迁移。
