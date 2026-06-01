# 10 · Serverless 大模型的冷启动缓解

> 一个 20 GB 的模型镜像，从冷态到可对外服务，7B 模型需要 5-10 分钟，70B 模型则需要 20 分钟以上。在真正的 Serverless 世界里，这不是「预热」——而是一次宕机。缓解手段作用于五个层面：预置节点镜像（AWS 上的 Bottlerocket、双卷架构）、模型流式加载（NVIDIA Run:ai Model Streamer，已原生集成进 vLLM）、GPU 显存快照（Modal 的 checkpoint，重启最多快 10 倍）、暖池（`min_workers=1`）、分层加载（ServerlessLLM 的 NVMe→DRAM→HBM 流水线，延迟降低 10-200 倍），以及只搬运输入 token（KB 级）而非 KV 缓存（GB 级）的实时迁移。Modal 公布的冷启动下限是 2-4 秒；Baseten 默认 5-10 秒，配合预热可达亚秒级。本课将教你如何度量、预算并叠加这五个层面。

**类型：** 学习
**语言：** Python（标准库，玩具级冷启动路径模拟器）
**前置：** 阶段 17 · 02（推理平台经济学）、阶段 17 · 03（GPU 自动扩缩容）
**时长：** 约 60 分钟

## 学习目标

- 列举冷启动缓解的五个层面，并在每一层各举出一个工具或模式。
- 把一个 70B 模型的总冷启动时间，计算为（节点供给）+（权重下载）+（权重载入 HBM）+（引擎初始化）之和。
- 解释为什么实时迁移（live migration）传输的是输入 token（KB 级）而非 KV 缓存（GB 级），以及随之而来的代价是什么（重算）。
- 说明暖池（warm pool）的权衡取舍（为闲置 GPU 付费，还是承受冷启动长尾延迟），以及当达到何种 SLA 阈值时 `min_workers > 0` 会变成必选项。

## 问题所在

你的 Serverless 大模型端点在夜间缩容到零。早上 8 点流量陡增。第一个请求要等待以下步骤完成：

1. Karpenter 供给一个 GPU 节点：45-60 秒。
2. 容器拉取一个 30 GB 的带权重镜像：120-300 秒。
3. 引擎把权重载入 HBM：45-120 秒，取决于模型大小和存储速度。
4. vLLM 或 TRT-LLM 初始化 CUDA graph、KV 缓存池、tokenizer：10-30 秒。

总计：220-510 秒（大约 3-8 分钟）才能吐出第一个 token。而你的 SLA 是 2 秒。你上线了一个暖池（`min_workers=1`），问题似乎消失了——但现在你要 7×24 小时为一个闲置 GPU 付费。如果你的服务有 5 个产品、每个都配一个暖副本，那就是 5 × 24 × 30 = 3,600 GPU·小时/月，无论是否有用户真正调用过。

冷启动缓解，就是在保留 Serverless 经济性的同时，逼近常驻在线（always-on）的延迟表现。

## 核心概念

### 第 1 层 —— 预置节点镜像（Bottlerocket）

在 AWS 上，Bottlerocket 的双卷架构把操作系统与数据分离。对数据卷做快照、把容器镜像预先拉取进去；然后在你的 `EC2NodeClass` 中引用该快照 ID。新节点启动时权重已经在本地 NVMe 上——第 2 步以及第 3 步的一部分就此消失。它与 Karpenter 原生兼容。典型收益：对大模型而言每次冷启动可省 2-4 分钟。

GCP 上的等价做法：使用预先烘焙好容器层的自定义 VM 镜像。Azure 上：用同样模式的托管磁盘快照。

### 第 2 层 —— 模型流式加载（Run:ai Model Streamer）

与其在回答第一个请求前加载完整文件，不如把权重逐层（layer-by-layer）流式载入 GPU 显存，并在第一个 transformer block 驻留就绪后立即开始处理。NVIDIA Run:ai Model Streamer 在 2026 年的 vLLM 中原生集成。它支持 S3、GCS 和本地 NVMe。通过让 I/O 与计算初始化相互重叠，对大模型可将权重加载时间大致减半。

### 第 3 层 —— GPU 显存快照（Modal）

Modal 在首次加载后对 GPU 状态（权重、CUDA graph、KV 缓存区域）做一次 checkpoint。之后的重启直接把内容反序列化进 HBM——比重新初始化快 10 倍。这是最接近「2 秒启动一块暖 GPU」的方案。权衡之处：快照是按 GPU 拓扑（per-GPU-topology）绑定的，所以一旦 Karpenter 把你迁到不同的机型（SKU），就得重新做 checkpoint。

### 第 4 层 —— 暖池（min_workers=1）

最简单的缓解手段：始终保留一个就绪副本。代价是 7×24 小时一块 GPU 的小时费。这笔账对小模型很残酷（你付 0.85-1.50 美元/小时去规避一次 30 秒的冷启动），对大模型却很划算（付 4 美元/小时去规避一次 5 分钟的冷启动）。暖池变成必选项的 SLA 阈值：通常是在 70B 以上模型上要求 TTFT P99 < 60 秒时。

### 第 5 层 —— 分层加载（ServerlessLLM）

ServerlessLLM 把存储视为一个层级体系：NVMe（快但容量大）、DRAM（中等但分层）、HBM（小但即时）。权重被预先加载到 DRAM，再按需载入 HBM。论文报告称，相比朴素的「磁盘到 HBM」，冷加载延迟降低 10-200 倍。生产环境的采用尚属早期，但与 vLLM 的集成已经存在。

### 第 6 层 —— 实时迁移（附加模式）

当一个节点变得不可用时（spot 抢占、节点排空），传统做法是冷启动另一个副本并排干请求队列。实时迁移（live migration）则把输入 token（KB 级）搬到一个已加载好模型的目标节点，并在目标节点上重算 KV 缓存。重算比通过网络传输 GB 级 KV 缓存更便宜。该模式适用于解耦（disaggregated）部署。

### 暖池数学

对于一个 P99 TTFT SLA 为 2 秒的服务，问题不是「要不要暖池」，而是「要几个暖副本，以及哪些路径配上它们」。

- 高价值的交互式路径（实时聊天、语音 agent）：`min_workers=1-2`。
- 后台批处理路径（夜间分类任务）：可接受缩容到零，5-10 分钟的冷启动可以容忍。
- 高级套餐（Premium tier）：按租户设置 `min_workers`，配以专属容量。

### 先度量，再优化

一个 70B 模型在全新节点上的冷启动剖析（示意）：

| 阶段 | 耗时 | 缓解手段 |
|-------|------|-----------|
| 节点供给 | 50s | Bottlerocket + 预置镜像、暖池 |
| 镜像拉取 | 180s | 预置数据卷（消除） |
| 权重载入 HBM | 75s | 模型流式加载（减半）；GPU 快照（消除） |
| 引擎初始化 | 20s | 持久化的 CUDA graph 缓存 |
| 首次前向 | 3s | 固有最小延迟 |
| **冷启动总计** | **328s** | |
| **叠加缓解后总计** | **~15s** | 降低 22 倍 |

### 你应该记住的数字

- Modal 冷启动：2-4 秒（配合 GPU 快照）。
- Baseten 默认冷启动：5-10 秒；配合预热可达亚秒级。
- 原始 70B 冷启动：3-8 分钟。
- Run:ai Model Streamer：权重加载约 2 倍加速。
- ServerlessLLM 分层加载：延迟降低 10-200 倍（论文数据）。

## 上手实践

`code/main.py` 对冷启动路径建模，分别给出叠加与不叠加每种缓解手段的情形。它会报告总冷启动时间、暖池成本，以及暖池能回本的盈亏平衡请求速率（break-even request rate）。

## 交付物

本课产出 `outputs/skill-cold-start-planner.md`。给定 SLA、模型大小和流量形态，它会挑选出应当叠加哪些缓解手段。

## 练习

1. 运行 `code/main.py`。计算盈亏平衡请求速率——高于该速率时，保留一个暖副本比通过在 SLO 处额外丢弃请求来承担冷启动税更便宜。
2. 你部署一个 13B 模型，P99 TTFT SLA 为 3 秒。挑选出能达成该目标的最小缓解栈（层数最少）。
3. Bottlerocket 预置消除了镜像拉取，但权重仍需从快照载入 HBM。若快照所在的 NVMe 读取速度为 7 GB/s，计算 70B 模型的实际墙钟时间（wall-clock）。
4. 你的 Serverless 提供商提供 GPU 快照（Modal），但你的团队拒绝使用，理由是「快照会泄露 PII」。请正反两面论证——现实风险到底是什么，缓解措施又是什么（临时性快照、加密、命名空间隔离）？
5. 设计一套分层暖池策略：付费用户、试用用户和批处理工作负载各配几个暖副本？给出算式。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 冷启动（Cold start） | 「那次大停顿」 | 在全新副本上从请求到第一个 token 的时间 |
| 暖池（Warm pool） | 「常驻在线最小值」 | `min_workers >= 1`，至少保持一个副本就绪 |
| 预置镜像（Pre-seeded image） | 「烘焙好的 AMI」 | 容器权重已预先驻留的节点镜像 |
| Bottlerocket | 「AWS 节点 OS」 | AWS 容器优化操作系统，支持双卷快照 |
| 模型流式加载器（Model streamer） | 「流式加载」 | 让权重 I/O 与计算初始化相互重叠 |
| GPU 快照（GPU snapshot） | 「checkpoint 到 HBM」 | 序列化加载后的 GPU 状态；重启时反序列化 |
| 分层加载（Tiered loading） | 「NVMe + DRAM + HBM」 | 存储层级体系；按需加载 |
| 实时迁移（Live migration） | 「搬 token」 | 传输输入（KB 级），在目标节点重算 KV |
| `min_workers` | 「暖副本」 | Serverless 的最小保活数量 |
| 缩容到零（Scale-to-zero） | 「完全 Serverless」 | 空闲时零成本；承担完整的冷启动税 |

## 延伸阅读

- [Modal — 冷启动性能](https://modal.com/docs/guide/cold-start) —— Modal 公布的基准数据与 checkpoint 架构。
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) —— 预置数据卷快照模式。
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) —— 让权重加载与计算初始化相互重叠。
- [Baseten — 冷启动缓解](https://www.baseten.co/blog/cold-start-mitigation/) —— 预热操作手册。
- [ServerlessLLM 论文（USENIX OSDI'24）](https://www.usenix.org/conference/osdi24/presentation/fu) —— 分层加载设计。
- [NVIDIA — 在 Kubernetes 上的解耦式大模型推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) —— 面向解耦部署的实时迁移。
