# 分离式 Prefill/Decode — NVIDIA Dynamo 与 llm-d

> Prefill 是计算密集型的；decode 是内存密集型的。将两者放在同一 GPU 上运行会浪费其中一种资源。分离式架构将它们分配到独立的资源池，并通过 NIXL（RDMA/InfiniBand 或 TCP 回退）在两者之间传输 KV cache。NVIDIA Dynamo（GTC 2025 宣布，1.0 GA）位于 vLLM/SGLang/TRT-LLM 之上——它的 Planner Profiler + SLA Planner 自动匹配 prefill:decode 比率以满足 SLO。NVIDIA 发布的大致吞吐量提升数据如下：developer.nvidia.com（2025-06）显示 DeepSeek-R1 MoE 在 GB200 NVL72 + Dynamo 上、中延迟场景下约提升 6 倍；Dynamo 产品页面（developer.nvidia.com，未标注日期）宣称在 GB300 NVL72 + Dynamo 上 MoE 吞吐量相比 Hopper 提升高达 50 倍。"30 倍"这个数字是社区对全栈 Blackwell + Dynamo + DeepSeek-R1 报告的汇总结果；我们未找到确切实说 30 倍的单一原始来源，因此应将其视为方向性说法。llm-d（Red Hat + AWS）是 Kubernetes 原生的：prefill / decode / router 作为独立 Service 运行，并支持按角色的 HPA。llm-d 0.5 增加了层级 KV 卸载、缓存感知的 LoRA 路由、UCCL 网络、以及 scale-to-zero。经济性：对多个客户披露信息的内部汇总表明，在恒定 SLA 下从共置服务切换到带 Dynamo 的分离式架构时，200 万美元级推理支出可节省 30–40%（即每年 60-80 万美元）；具体的 200 万→60-80 万美元数字是内部综合数据，并非单个已发布的案例研究——请将其作为数量级参考，而非确切引用来源。短提示（<512 个 token，短输出）不值得承担传输成本。

**类型：** 学习  
**语言：** Python（stdlib，用于演示的分离式 vs 共置模拟器）  
**前置知识：** 阶段 17 · 04（vLLM 服务内部机制），阶段 17 · 08（推理指标）  
**时长：** ~75 分钟

## 学习目标

- 解释为什么 prefill 和 decode 需要不同的最优 GPU 分配，并量化共置下的资源浪费。
- 绘制分离式架构图：prefill 池、decode 池、通过 NIXL 的 KV 传输、router。
- 指出分离式架构在何种情况下不划算（短提示、短输出）。
- 区分 NVIDIA Dynamo（栈上协调器）与 llm-d（Kubernetes 原生），并将两者匹配到各自的操作场景。

## 问题

你在 8 张 H100 上运行 Llama 3.3 70B。在混合负载下（长提示 + 短输出），GPU 在 decode 期间空闲，因为大部分计算都花在了 prefill 上。在不同的负载下（短提示 + 长输出），情况则相反。共置 prefill + decode 意味着你同时对两者进行了过度配置。

预算影响：20-40% 的 GPU 时间浪费在了错误的资源上。你购买 H100 算力来运行内存密集型的 decode，或者购买 H100 HBM 带宽来运行计算密集型的 prefill。两者都是昂贵的浪费。

分离式架构将 prefill 和 decode 分配到各自独立的资源池，每个池针对其瓶颈进行了优化。KV cache 通过高带宽互连从 prefill 池传输到 decode 池。

## 概念

### 为什么瓶颈不同

**Prefill** — 在一次前向传播中对整个输入提示运行 transformer。矩阵乘法占主导；计算密集型。H100 FP8 提供约 2000 TFLOPS 的有效吞吐量。批量效率良好——一次前向传播可处理多个 token。

**Decode** — 一次生成一个 token，每次迭代都要读取全部权重。内存带宽受限。HBM3 提供约 3 TB/s。批量效率仅在高并发下才良好——读取权重的开销在批量中摊销。

将它们共置：你购买的 GPU 需要同时为两者优化。H100 在这两方面都表现良好，但无论如何成本相同。在大规模场景下，你希望 prefill 池使用 H100 / 计算密集型硬件；decode 池使用 H200 / 内存密集型硬件，或配合激进量化。

### 架构

```
            ┌──────────────┐
  请求 →    │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (仅提示)                        │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill 池    │ ─── NIXL ────► │ Decode 池     │
            │  (计算)       │                │  (内存)       │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 客户端
```

NIXL 是 NVIDIA 的节点间传输协议。在可用时使用 RDMA/InfiniBand，否则回退到 TCP。传输延迟是真实存在的——对于 70B FP8 模型上 4K token 提示的 KV cache，通常为 20-80 ms。这就是短提示不适合分离式架构的原因：传输成本超过了节省的收益。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 宣布，1.0 GA）：
- 位于 vLLM、SGLang、TRT-LLM 之上，作为编排器。
- Planner Profiler 测量工作负载，SLA Planner 自动配置 prefill:decode 比率。
- Rust 核心，Python 可扩展。
- 吞吐量提升：NVIDIA 报告 DeepSeek-R1 MoE 在 GB200 NVL72 + Dynamo 上、中延迟场景下提升 6 倍（developer.nvidia.com，2025-06）；社区关于全栈 Blackwell + Dynamo + DeepSeek-R1 "高达 30 倍"的报告缺乏单一原始来源，应视为方向性数据。
- GB300 NVL72 + Dynamo：根据 Dynamo 产品页面（developer.nvidia.com，未标注日期），MoE 吞吐量相比 Hopper 提升高达 50 倍。

**llm-d**（Red Hat + AWS，Kubernetes 原生）：
- Prefill / decode / router 作为独立的 Kubernetes Service 运行。
- 按角色的 HPA，使用队列深度（prefill）/ KV 利用率（decode）信号。
- `topologyConstraint packDomain: rack` 将 prefill+decode 集群打包到同一机架，以实现高带宽 KV 传输。
- llm-d 0.5（2026）：层级 KV 卸载、缓存感知的 LoRA 路由、UCCL 网络、scale-to-zero。

如果你想要一个托管式的栈上编排器，使用 Dynamo。如果你想要 Kubernetes 原生原语并且致力于 CNCF 生态系统，使用 llm-d。

### 经济性

内部综合数据（并非单个已发布的案例研究——仅作为数量级参考）：

- 共置服务的年推理支出为 200 万美元。
- 切换到带 Dynamo 的分离式架构。
- 相同的请求量，相同的 P99 延迟 SLA。
- 报告节省：60 万–80 万美元/年（降低 30–40%）。
- 无新硬件投入。

我们综合了多个客户披露信息得出此数字，而非单个可引用的案例研究；最接近的已发布数据点是 Baseten 的 2 倍更快 TTFT / 61% 更高吞吐量（使用 Dynamo KV 路由，baseten.co，2025-10），以及 VAST + CoreWeave 在 40–60% KV 命中率下每个 token 成本降低 60–130% 的预测（vastdata.com，2025-12）。节省来自对每个池进行合理规模配置；prefill 密集的负载（8K+ 前缀的 RAG）比均衡负载受益更多。

### 何时不该使用分离式架构

- 提示 < 512 token 且输出 < 200 token：传输成本超过收益。
- 小型集群（< 4 张 GPU）：没有足够的池多样性。
- 团队无法运营两个具有按角色扩缩能力的 GPU 池：Dynamo 有帮助，但并非零成本。
- 没有 RDMA 网络：TCP 传输成本更高。

### Router 与阶段 17 · 11 的集成

分离式 router 是 KV-cache-aware 的（阶段 17 · 11）。请求会落到持有其前缀的 decode 池上——如果没有匹配，则走 prefill → decode 流程。命中率与分离式架构的效果相互叠加——缓存感知的 router 决定了是否需要进行新的 prefill。

### MoE on Blackwell 才是真正数据所在

GB300 NVL72 + Dynamo 显示出相比 Hopper 基线 50 倍的 MoE 吞吐量。MoE 专家路由在 prefill 上是计算密集型的，但在 decode 上却是内存密集型的（专家缓存），因此分离式架构带来了双重收益。2026 年前沿模型服务以 MoE 为主导（DeepSeek-V3、未来的 GPT-5 变体）。

### 你应该记住的数字

基准测试数据会变化——NVIDIA 和推理栈每个季度都会发布更新结果。引用前请重新核对。

- DeepSeek-R1 在 GB200 NVL72 + Dynamo 上：中延迟场景下相比基线约提升 6 倍吞吐量（developer.nvidia.com，2025-06）；社区关于全栈 Blackwell + Dynamo 架构"高达 30 倍"的说法是方向性汇总，缺少单一原始来源。
- GB300 NVL72 + Dynamo：MoE 吞吐量相比 Hopper 提升高达 50 倍（developer.nvidia.com，未标注日期）。
- 节省参考值（内部综合数据，并非单个案例研究）：在恒定 SLA 下，年支出从 200 万美元降至 60-80 万美元。
- 分离式阈值：提示 >512 token + 输出 >200 token。
- 通过 NIXL 的 KV 传输：70B FP8 模型上 4K 提示的 KV 传输时间为 20-80 ms。

## 使用它

`code/main.py` 模拟共置 vs 分离式服务。输出吞吐量、每个请求的成本以及提示长度的交叉点。

## 交付物

本课程生成 `outputs/skill-disaggregation-decider.md`。根据工作负载和集群，决定是否采用分离式架构。

## 练习

1. 运行 `code/main.py`。在什么提示长度下分离式架构优于共置？
2. 为一个 P99 前缀长度为 8K、输出为 300 的 RAG 服务设计 prefill 池和 decode 池。
3. Dynamo vs llm-d：为一个纯 Kubernetes 环境且无 Python 运行时偏好的团队选择一种方案。
4. 计算 KV 传输成本：70B FP8 模型上 4K prefill = ~500 MB KV。在 RDMA 100 GB/s 下，传输时间 = 5 ms。在 TCP 10 GB/s 下 = 50 ms。哪一种对你的 SLA 重要？
5. MoE 专家路由改变了 KV 访问模式。当 MoE 针对不同 token 激活不同专家时，分离式架构如何表现？

## 关键术语

| 术语 | 人们所说的 | 实际含义 |
|------|-----------|---------|
| Disaggregated serving | "分离 prefill/decode" | 为每个阶段使用独立的 GPU 池 |
| NIXL | "NVIDIA 传输协议" | Dynamo 的节点间 KV 传输（RDMA/TCP） |
| NVIDIA Dynamo | "编排器" | 用于 vLLM/SGLang/TRT-LLM 的栈上协调器 |
| llm-d | "Kubernetes 原生" | Red Hat + AWS 的 K8s 分离式栈 |
| Planner Profiler | "Dynamo 自动配置" | 测量工作负载，配置池比率 |
| SLA Planner | "Dynamo 策略" | 自动匹配 prefill:decode 以满足 SLO |
| `packDomain: rack` | "llm-d 拓扑" | 将 prefill+decode 打包到同一机架以实现快速 KV 传输 |
| UCCL | "统一集合通信" | llm-d 0.5 的网络层，支持 scale-to-zero |
| MoE expert routing | "每个 token 的专家" | DeepSeek-V3 模式；分离式架构有助于优化 |

## 延伸阅读

- [NVIDIA — 介绍 Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — 在 Kubernetes 上进行分离式 LLM 推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM 分离式服务博客](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 发布说明](https://github.com/llm-d/llm-d/releases)
