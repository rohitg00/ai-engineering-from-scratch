# Serverless LLM 的冷启动缓解

> 一个 20 GB 的模型镜像从冷状态到可服务需要 5-10 分钟（7B）到 20 多分钟（70B）。在真正的 serverless 世界中，这不是预热——而是一次故障。缓解措施作用于五个层面：预置节点镜像（AWS 上的 Bottlerocket、双卷架构）、模型流式加载（NVIDIA Run:ai Model Streamer，vLLM 原生支持）、GPU 内存快照（Modal checkpoints，重启速度最高提升 10 倍）、暖池（`min_workers=1`）、分层加载（ServerlessLLM 的 NVMe→DRAM→HBM 流水线，延迟降低 10-200 倍），以及迁移输入 token（KB 级）而非 KV cache（GB 级）的活迁移。Modal 公布的冷启动下限为 2-4 秒；Baseten 默认 5-10 秒，预 warming 后可低于 1 秒。本课教你如何测量、预算并叠加这五层措施。

**Type:** Learn
**Languages:** Python (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## 学习目标

- 列举冷启动缓解的五个层面，并说出每个层面的一种工具或模式。
- 将 70B 模型的总冷启动时间计算为（节点供给）+（权重下载）+（权重加载进 HBM）+（引擎初始化）之和。
- 解释为什么活迁移传输的是输入 token（KB）而非 KV cache（GB），以及代价是什么（重计算）。
- 说出暖池的权衡（为空闲 GPU 付费或接受冷启动尾部延迟），以及 SLA 阈值达到多少时 `min_workers > 0` 成为必需。

## 问题所在

你的 serverless LLM 端点夜间缩容到零。早 8 点流量激增。第一个请求要等待：

1. Karpenter 供给一个 GPU 节点：45-60 秒。
2. 容器拉取含权重的 30 GB 镜像：120-300 秒。
3. 引擎将权重加载进 HBM：视模型大小和存储速度需 45-120 秒。
4. vLLM 或 TRT-LLM 初始化 CUDA graphs、KV cache 池、tokenizer：10-30 秒。

总计：在返回第一个 token 之前需要 220-510 秒（约 3-8 分钟）。你的 SLA 是 2 秒。你上线了暖池（`min_workers=1`），问题似乎消失了——但现在你要为一个空闲 GPU 支付 7×24 小时的费用。如果你的服务有 5 个产品，每个产品一个暖副本，那就是 5 × 24 × 30 = 3,600 GPU 小时/月，无论是否有任何一个用户调用。

冷启动缓解就是如何在保持 serverless 经济性的同时，逼近常驻（always-on）服务的延迟。

## 概念

### 第 1 层 — 预置节点镜像（Bottlerocket）

在 AWS 上，Bottlerocket 的双卷架构将 OS 与数据分离。对预拉取了容器镜像的数据卷做快照；在 `EC2NodeClass` 中引用该快照 ID。新节点启动时权重已在本地 NVMe 上——第 2 步和第 3 步的一部分消失了。原生兼容 Karpenter。典型节省：大模型每次冷启动缩短 2-4 分钟。

GCP 上的等价方案：预烘焙容器层的自定义 VM 镜像。Azure 上：托管磁盘快照，采用相同模式。

### 第 2 层 — 模型流式加载（Run:ai Model Streamer）

不是在响应第一个请求前加载完整文件，而是逐层将权重流式加载进 GPU 内存，并在第一个 transformer block 驻留后立即开始处理。NVIDIA Run:ai Model Streamer 已在 vLLM 2026 中原生提供。支持 S3、GCS 和本地 NVMe。通过将 I/O 与计算设置重叠，可将大模型的权重加载时间大致减半。

### 第 3 层 — GPU 内存快照（Modal）

Modal 在首次加载后对 GPU 状态（权重、CUDA graphs、KV cache 区域）做 checkpoint。后续重启直接反序列化到 HBM——比重新初始化快 10 倍。这是最接近“2 秒启动一个暖 GPU”的方案。权衡：快照是按 GPU 拓扑的，如果 Karpenter 将你迁移到不同 SKU，你需要重新 checkpoint。

### 第 4 层 — 暖池（min_workers=1）

最简单的缓解：始终保持一个副本就绪。成本是一个 GPU 的时费 ×24×7。对小模型而言这笔账很残酷（你付 $0.85-$1.50/小时来避免 30 秒冷启动），但对大模型很划算（付 $4/小时避免 5 分钟冷启动）。暖池成为必需的 SLA 阈值：通常是 70B+ 模型的 TTFT P99 < 60 秒。

### 第 5 层 — 分层加载（ServerlessLLM）

ServerlessLLM 将存储视为一个层级结构：NVMe（快但大）、DRAM（中等但分层）、HBM（小但即时）。权重预加载到 DRAM；按需加载进 HBM。论文报告冷加载延迟相较朴素磁盘到 HBM 的方式降低 10-200 倍。生产落地尚早，但已有与 vLLM 的集成。

### 第 6 层 — 活迁移（附加模式）

当节点不可用（spot 回收、节点排水）时，传统做法是冷启动另一个副本并排空请求队列。活迁移将输入 token（千字节级）迁移到一个已加载模型的目的地，并在目的地重算 KV cache。重计算比在网络上传输 GB 级 KV cache 更便宜。适用于分离式（disaggregated）部署。

### 暖池的算账

对于一个 P99 TTFT SLA 为 2 秒的服务，问题不是“要不要暖池”，而是“需要多少暖副本，哪些路径使用它们”。

- 高价值交互路径（实时聊天、语音 agent）：`min_workers=1-2`。
- 后台批处理路径（夜间分类）：接受缩容到零，5-10 分钟冷启动可容忍。
- 高级套餐：`min_workers` 每个租户配备专用容量。

### 优化之前先测量

70B 模型在新节点上的冷启动解剖（示意）：

| 阶段 | 时间 | 缓解措施 |
|-------|------|-----------|
| 节点供给 | 50s | Bottlerocket + 预置镜像，暖池 |
| 镜像拉取 | 180s | 预置数据卷（消除） |
| 权重到 HBM | 75s | 模型流式加载（减半）；GPU 快照（消除） |
| 引擎初始化 | 20s | 持久化 CUDA graph cache |
| 首次前向 | 3s | 固有最小延迟 |
| **总冷启动** | **328s** | |
| **缓解后总计** | **~15s** | 降低 22 倍 |

### 应该记住的数字

- Modal 冷启动：2-4 秒（使用 GPU 快照）。
- Baseten 默认冷启动：5-10 秒；预 warming 后低于 1 秒。
- 裸 70B 冷启动：3-8 分钟。
- Run:ai Model Streamer：权重加载提速约 2 倍。
- ServerlessLLM 分层加载：延迟降低 10-200 倍（论文数字）。

```figure
cold-start-pipeline
```

## 实践

`code/main.py` 模拟有和没有各层缓解的冷启动路径。报告总冷启动时间、暖池成本，以及暖池开始回本的盈亏平衡请求率。

## 上线

本课产出 `outputs/skill-cold-start-planner.md`。给定 SLA、模型大小和流量形态，选择要叠加哪些缓解措施。

## 练习

1. 运行 `code/main.py`。计算暖副本比通过在 SLO 下额外丢弃请求来支付冷启动税更便宜的盈亏平衡请求率。
2. 你部署一个 13B 模型，P99 TTFT SLA 为 3 秒。选出达到该目标的最小缓解栈（层数最少）。
3. Bottlerocket 预置消除了镜像拉取，但权重仍需从快照加载到 HBM。若快照支撑的 NVMe 读取速度为 7 GB/s，计算 70B 模型的墙钟时间。
4. 你的 serverless 提供商提供 GPU 快照（Modal），而你的团队以“快照会泄露 PII”为由拒绝。为双方辩论——现实的风险是什么，缓解手段是什么（临时快照、加密、命名空间隔离）？
5. 设计一个分层暖池策略：付费用户、试用用户和批处理负载各需多少暖副本？给出算式。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 冷启动 | “大停顿” | 从请求到新副本返回第一个 token 的时间 |
| 暖池 | “常驻最小值” | `min_workers >= 1` 以保持至少一个副本就绪 |
| 预置镜像 | “烘焙好的 AMI” | 容器权重已预驻留的节点镜像 |
| Bottlerocket | “AWS 节点 OS” | 支持双卷快照的 AWS 容器优化 OS |
| 模型流式加载器 | “流式加载” | 权重 I/O 与计算设置重叠 |
| GPU 快照 | “checkpoint 到 HBM” | 序列化加载后的 GPU 状态；重启时反序列化 |
| 分层加载 | “NVMe + DRAM + HBM” | 存储层级结构；按需加载 |
| 活迁移 | “移动 token” | 传输输入（KB），在目的地重算 KV |
| `min_workers` | “暖副本” | Serverless 最小保活数量 |
| 缩容到零 | “完全 serverless” | 空闲时零成本；接受全额冷启动税 |

## 延伸阅读

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) — Modal 公布的基准测试与 checkpoint 架构。
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — 预置数据卷快照模式。
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — 权重加载与计算设置重叠。
- [Baseten — Cold-start mitigation](https://www.baseten.co/blog/cold-start-mitigation/) — 预 warming 实践手册。
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — 分层加载设计。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — 分离式部署的活迁移。