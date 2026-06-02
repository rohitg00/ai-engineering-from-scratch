# Serverless LLM 的冷启动缓解（Cold Start Mitigation for Serverless LLMs）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 20 GB 的模型镜像，从冷态到能对外服务，要花 5-10 分钟（7B）到 20 分钟以上（70B）。在真正的 serverless 世界里，这不叫预热——这叫故障。缓解手段分布在五层：预先种子化的节点镜像（AWS 上的 Bottlerocket，双卷架构）、模型流式加载（NVIDIA Run:ai Model Streamer，已在 vLLM 中原生支持）、GPU 显存快照（Modal 的 checkpoint，重启快至 10 倍）、warm pool（`min_workers=1`）、分层加载（ServerlessLLM 的 NVMe→DRAM→HBM 流水线，延迟降低 10-200 倍），以及把输入 token（KB 级）而不是 KV cache（GB 级）搬过去的 live migration（在线迁移）。Modal 把 2-4 秒冷启动公布为下限；Baseten 默认 5-10 秒，配预热可做到亚秒级。本课教你如何度量、给冷启动做预算，并把这五层叠起来用。

**Type:** Learn
**Languages:** Python (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 列举冷启动缓解的五个层级，并在每一层至少能说出一个工具或模式。
- 把 70B 模型的总冷启动时间拆成 (节点 provision) + (权重下载) + (权重加载到 HBM) + (引擎初始化) 四项之和，并能算出来。
- 解释为什么 live migration 传的是输入 token（KB），而不是 KV cache（GB），以及代价是什么（重新计算）。
- 说出 warm pool 的取舍（要么为闲置 GPU 付费，要么接受冷启动长尾），以及在什么 SLA 阈值下 `min_workers > 0` 变成强制项。

## 问题（The Problem）

你的 serverless LLM 端点在半夜缩到零。早上八点流量爆发。第一个请求在那等着：

1. Karpenter 起一个 GPU 节点：45-60 秒。
2. 容器拉一个带权重的 30 GB 镜像：120-300 秒。
3. 引擎把权重加载进 HBM：取决于模型大小和存储速度，要 45-120 秒。
4. vLLM 或 TRT-LLM 初始化 CUDA graph、KV cache 池、tokenizer：10-30 秒。

合计：220-510 秒（大约 3-8 分钟）才吐回第一个 token。你的 SLA 是 2 秒。你上线了一个 warm pool（`min_workers=1`），问题貌似消失了——但现在你要为一台闲置 GPU 7×24 付费。如果你的服务有 5 个产品、每个都跑一个 warm replica，那就是 5 × 24 × 30 = 3,600 GPU 小时/月，不管有没有用户调用。

冷启动缓解，就是在保留 serverless 经济性的同时，把延迟逼近常驻服务。

## 概念（The Concept）

### 第 1 层 — 预先种子化的节点镜像（Bottlerocket）

在 AWS 上，Bottlerocket 的双卷架构把 OS 和数据分开。把数据卷做成快照，里面预先 pull 好你的容器镜像；在 `EC2NodeClass` 里引用这个快照 ID。新节点启动时，权重已经在本地 NVMe 上了——上面的步骤 2 和步骤 3 的一部分直接消失。原生兼容 Karpenter。对大模型来说，每次冷启动通常能省 2-4 分钟。

GCP 上的对应方案：自定义 VM 镜像，把容器层提前烘进去。Azure 上：托管磁盘快照走同样的套路。

### 第 2 层 — 模型流式加载（Run:ai Model Streamer）

不再是把整份文件加载完才能回应第一个请求，而是把权重一层一层流进 GPU 显存，第一个 transformer block 一就位就开始处理。NVIDIA Run:ai Model Streamer 在 vLLM 2026 中已经原生集成，支持 S3、GCS 和本地 NVMe。通过让 I/O 与计算初始化重叠，大模型的权重加载时间大致能砍一半。

### 第 3 层 — GPU 显存快照（Modal）

Modal 在首次加载完之后给 GPU 状态（权重、CUDA graph、KV cache 区域）打一个 checkpoint。后续重启时直接反序列化进 HBM——比重新初始化快 10 倍。这是目前最接近「2 秒启动一台暖 GPU」的方案。代价是：快照绑定 GPU 拓扑，所以如果 Karpenter 把你迁到另一种 SKU，你得重新做 checkpoint。

### 第 4 层 — warm pool（min_workers=1）

最简单的缓解：始终留一份 replica。代价是一台 GPU 7×24 的小时单价。在小模型上这笔账很难看（你花 $0.85-$1.50/小时去躲一个 30 秒的冷启动），在大模型上还算划算（花 $4/小时去躲一个 5 分钟的冷启动）。warm pool 变成强制项的 SLA 阈值通常是：70B+ 模型上 TTFT P99 < 60 秒。

### 第 5 层 — 分层加载（ServerlessLLM）

ServerlessLLM 把存储当作一个层级体系：NVMe（快、容量大）、DRAM（中等、分层）、HBM（极小但即时）。权重预先加载到 DRAM，按需再载入 HBM。论文里的数据是：相比朴素的 disk-to-HBM，冷加载延迟降低 10-200 倍。生产采用还在早期，但已经有跟 vLLM 集成的方案。

### 第 6 层 — live migration（在线迁移，附加模式）

当一个节点不可用（spot 被抢占、节点 drain）时，传统做法是冷启动另一份 replica，再把请求队列 drain 掉。live migration 则是把输入 token（KB 级）搬到已经载好模型的目标节点上，在目标端重新计算 KV cache。重新计算比把 GB 级的 KV cache 通过网络搬过去更便宜。适用于 disaggregated 部署。

### warm pool 的算账

对于 P99 TTFT SLA 为 2 秒的服务，问题不是「要不要 warm pool」，而是「开多少 warm replica，给哪些链路开」。

- 高价值的交互链路（实时聊天、语音 agent）：`min_workers=1-2`。
- 后台批处理链路（凌晨分类）：可以缩到零，能容忍 5-10 分钟的冷启动。
- 高级套餐：按租户配 `min_workers`，独立容量。

### 优化前先度量

70B 模型在新节点上的冷启动剖面（示意）：

| 阶段 | 耗时 | 缓解手段 |
|-------|------|-----------|
| 节点 provision | 50s | Bottlerocket + 预种子镜像、warm pool |
| 镜像拉取 | 180s | 预种子数据卷（消除） |
| 权重到 HBM | 75s | Model streamer（减半）；GPU 快照（消除） |
| 引擎初始化 | 20s | 持久化 CUDA graph 缓存 |
| 第一次前向传播 | 3s | 固有最小延迟 |
| **冷启动合计** | **328s** | |
| **叠加缓解后合计** | **~15s** | 降低 22 倍 |

### 你应该记住的几个数字

- Modal 冷启动：2-4 秒（带 GPU 快照）。
- Baseten 默认冷启动：5-10 秒；预热后亚秒级。
- 70B 原始冷启动：3-8 分钟。
- Run:ai Model Streamer：权重加载约 2 倍加速。
- ServerlessLLM 分层加载：延迟降低 10-200 倍（论文数据）。

## 用起来（Use It）

`code/main.py` 模拟带与不带每种缓解手段的冷启动路径。给出冷启动总耗时、warm pool 成本，以及 warm pool 开始划算的请求速率盈亏平衡点。

## 上线部署（Ship It）

本课产出 `outputs/skill-cold-start-planner.md`。给定 SLA、模型大小和流量形态，挑出该叠哪些缓解手段。

## 练习（Exercises）

1. 跑 `code/main.py`。算出请求速率的盈亏平衡点：超过这个速率后，常驻一份 warm replica 比为掉到 SLO 之外的额外请求付出的冷启动税更便宜。
2. 你部署一个 13B 模型，P99 TTFT SLA 是 3 秒。挑出能达成目标的最小缓解栈（层数最少）。
3. Bottlerocket 预种子可以消除镜像拉取，但权重还是得从快照加载到 HBM。假设快照所在的 NVMe 读速率是 7 GB/s，算一下 70B 模型的 wall-clock 时间。
4. 你的 serverless 厂商提供 GPU 快照（Modal），你团队拒绝接入，理由是「快照会泄漏 PII」。从两面去论证——现实风险到底是什么，对应的缓解措施又有哪些（短生命周期快照、加密、命名空间隔离）？
5. 设计一个分层 warm pool 策略：付费用户、试用用户、批处理负载分别开多少 warm replica？把账算给我看。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Cold start | 「那个长长的卡顿」 | 一份新 replica 上从请求到第一个 token 的时间 |
| Warm pool | 「always-on 最小数」 | `min_workers >= 1`，至少留一份 replica 待命 |
| Pre-seeded image | 「烘好的 AMI」 | 节点镜像里已驻留容器权重 |
| Bottlerocket | 「AWS 的节点 OS」 | AWS 面向容器的 OS，支持双卷快照 |
| Model streamer | 「流式加载」 | 让权重 I/O 与计算初始化重叠 |
| GPU snapshot | 「checkpoint 到 HBM」 | 把加载完的 GPU 状态序列化下来；重启时反序列化 |
| Tiered loading | 「NVMe + DRAM + HBM」 | 存储分层；按需加载 |
| Live migration | 「搬 token」 | 搬走输入（KB），在目标端重算 KV |
| `min_workers` | 「warm replica 数」 | serverless 的最小保活数 |
| Scale-to-zero | 「彻底 serverless」 | 闲置零成本；接受完整冷启动税 |

## 延伸阅读（Further Reading）

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) — Modal 公开的基准与 checkpoint 架构。
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — 预种子数据卷快照模式。
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — 让权重加载与计算初始化重叠。
- [Baseten — Cold-start mitigation](https://www.baseten.co/blog/cold-start-mitigation/) — 预热实操手册。
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — 分层加载设计。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — disaggregated 部署中的 live migration。
