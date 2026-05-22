# 分离式 Prefill/Decode — NVIDIA Dynamo 和 llm-d

> Prefill 是计算绑定的；decode 是内存绑定的。在相同 GPU 上同时运行两者会浪费一种资源。分离式将它们拆分到独立的资源池中，并通过 NIXL（RDMA/InfiniBand 或 TCP 回退）在它们之间传输 KV 缓存。NVIDIA Dynamo（GTC 2025 发布，1.0 GA）位于 vLLM/SGLang/TRT-LLM 之上——其 Planner Profiler + SLA Planner 自动匹配 prefill:decode 比率以满足 SLO。NVIDIA 发布的该领域的吞吐量增益——developer.nvidia.com (2025-06) 显示在中等延迟机制下，在 GB200 NVL72 + Dynamo 上 DeepSeek-R1 MoE 提升了约 6 倍，而 Dynamo 产品页面（developer.nvidia.com，未注明日期）宣传在 GB300 NVL72 + Dynamo 上 MoE 吞吐量最高提升 50 倍（相对于 Hopper）。"30 倍"数字是跨完整 Blackwell + Dynamo + DeepSeek-R1 报告的全栈社区聚合；我们未找到确切说明 30 倍的单一主要来源，因此将其视为方向性声明。llm-d（Red Hat + AWS）是 Kubernetes 原生的：prefill / decode / 路由器作为独立的 Services，具有每角色的 HPA。llm-d 0.5 增加了分层 KV 卸载、缓存感知 LoRA 路由、UCCL 网络和缩放到零。经济学：多个客户披露的内部汇总表明，在从同置服务切换到使用 Dynamo 的分离式架构且 SLA 不变时，200 万美元级别的推理支出可节省 30-40%（即每年 60-80 万美元）；具体的 200 万→60-80 万数字是一个内部复合值，不是单一发布的案例研究——将其用作数量级锚点，而非参考引用。短提示（<512 tokens，短输出）无法证明传输成本的合理性。

**类型：** 学习
**语言：** Python（标准库，简单的分离式与同置模拟器）
**先修要求：** 阶段 17 · 04（vLLM 服务内部）、阶段 17 · 08（推理指标）
**时间：** 约 75 分钟

## 学习目标

- 解释为什么 prefill 和 decode 具有不同的最优 GPU 分配，并量化同置下的浪费。
- 绘制分离式架构图：prefill 池、decode 池、通过 NIXL 的 KV 传输、路由器。
- 说出分离式不值得的情况（短提示、短输出）的条件。
- 区分 NVIDIA Dynamo（栈上层的）与 llm-d（Kubernetes 原生的），并将每个匹配到操作上下文。

## 问题

你在 8 个 H100 上运行 Llama 3.3 70B。在混合工作负载（长提示 + 短输出）下，GPU 在 decode 期间处于空闲状态，因为大部分计算都花在了 prefill 上。在不同的工作负载（短提示 + 长输出）下，情况相反。同置的 prefill + decode 意味着你两者都过度供应了。

预算影响：GPU 时间的 20-40% 被浪费在错误的资源上。你购买 H100 计算来运行内存绑定的 decode，或购买 H100 HBM 带宽来运行计算绑定的 prefill。两者都是昂贵的浪费。

分离式将 prefill 和 decode 拆分到为各自的瓶颈调整大小的独立池中。KV 缓存通过高带宽互连从 prefill 池传输到 decode 池。

## 概念

### 为什么瓶颈不同

**Prefill**——在一次前向传递中对完整输入提示运行 transformer。矩阵乘法占主导；计算绑定。H100 FP8 提供约 2000 TFLOPS 的有效吞吐量。批次效率很好——一次前向处理许多 tokens。

**Decode**——一次生成一个 token，每次迭代读取完整权重。内存带宽绑定。HBM3 提供约 3 TB/s。批次效率仅在高度并发时良好——权重读取在批次中分摊。

同置它们：你购买针对两者优化的 GPU。H100 在两者上都很好，但无论哪种方式成本相同。在大规模下，你希望 prefill 池在 H100 / 计算密集型上；decode 池在 H200 / 内存密集型上，或使用激进量化。

### 架构

```
           ┌──────────────┐
 请求 → │    路由器    │ ───────────────────────┐
           └──────┬───────┘                        │
                   │                                │
                   ▼（仅提示）                  │
           ┌──────────────┐    KV 缓存    ┌──────▼───────┐
           │ Prefill 池  │ ◀── NIXL ───► │ Decode 池   │
           │ （计算）   │                │ （内存）    │
           └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                客户端
```

NIXL 是 NVIDIA 的节点间传输。在可用时使用 RDMA/InfiniBand，否则回退到 TCP。传输延迟是真实的——在 70B FP8 上，4K token 提示的 KV 缓存传输通常耗时 20-80 毫秒。这就是为什么短提示不值得分离式：传输税超过了节省。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 发布，1.0 GA）：
- 作为 vLLM、SGLang、TRT-LLM 的编排器位于它们之上。
- Planner Profiler 测量工作负载，SLA Planner 自动配置 prefill:decode 比率。
- Rust 核心，Python 可扩展性。
- 吞吐量增益：NVIDIA 报告在中等延迟机制下，在 GB200 NVL72 + Dynamo 上 DeepSeek-R1 MoE 提升约 6 倍（developer.nvidia.com，2025-06）；社区关于在完整 Blackwell + Dynamo + DeepSeek-R1 栈上"最高 30 倍"的报告缺乏单一主要来源，应视为方向性的。
- GB300 NVL72 + Dynamo：根据 Dynamo 产品页面（developer.nvidia.com，未注明日期），相对于 Hopper，MoE 吞吐量最高提升 50 倍。

**llm-d**（Red Hat + AWS，Kubernetes 原生）：
- Prefill / decode / 路由器作为独立的 Kubernetes Services。
- 具有队列深度（prefill）/ KV 利用率（decode）信号的每角色 HPA。
- `topologyConstraint packDomain: rack` 将 prefill+decode 集群打包在同一个机架上，以实现高带宽 KV 传输。
- llm-d 0.5（2026）：分层 KV 卸载、缓存感知 LoRA 路由、UCCL 网络、缩放到零。

如果你想使用托管的栈上层编排器，请使用 Dynamo。如果你想使用 Kubernetes 原语并且致力于 CNCF 生态系统，请使用 llm-d。

### 经济学

内部复合（不是单一发布的案例研究——数量级锚点）：

- 同置服务上每年 200 万美元的推理支出。
- 使用 Dynamo 切换到分离式。
- 相同请求量，相同 P99 延迟 SLA。
- 报告的节省：每年 60-80 万美元（减少 30-40%）。
- 无新硬件。

我们从多个客户披露中综合了这个数字，而不是单一可引用的案例研究；最近的发布数据点是 Baseten 在使用 Dynamo KV 路由时 TTFT 提升 2 倍 / 吞吐量提升 61%（baseten.co，2025-10），以及 VAST + CoreWeave 预测的在 40-60% KV 命中率下每美元 token 提升 60-130%（vastdata.com，2025-12）。节省来自正确调整每个池的大小；prefill 密集型工作负载（具有 8K+ 前缀的 RAG）比较平衡的工作负载获益更多。

### 何时不分离

- 提示 < 512 tokens 且输出 < 200 tokens：传输税占主导。
- 小集群（< 4 个 GPU）：池多样性不足。
- 团队无法操作具有每角色扩缩的两个 GPU 池：Dynamo 有帮助，但并非微不足道。
- 无 RDMA 架构：TCP 传输税更重。

### 路由器与阶段 17 · 11 集成

分离式路由器是 KV 缓存感知的（阶段 17 · 11）。请求落在持有其前缀的 decode 池上——如果没有匹配，它流经 prefill → decode。命中率和分离式复合——缓存感知路由器决定是否甚至需要新的 prefill。

### MoE 在 Blackwell 上才是真正数字的所在

GB300 NVL72 + Dynamo 显示相对于 Hopper 基线，MoE 吞吐量提升 50 倍。MoE 专家路由在 prefill 上是计算密集型的，但在 decode 上是内存密集型的（专家缓存），因此分离式是双重胜利。2026 年前沿模型服务是 MoE 主导的（DeepSeek-V3、未来的 GPT-5 变体）。

### 你应该记住的数字

基准数字会漂移——NVIDIA 和推理栈每季度都会更新结果。在引用之前重新检查。

- 在中等延迟机制下，在 GB200 NVL72 + Dynamo 上的 DeepSeek-R1：相对于基线提升约 6 倍（developer.nvidia.com，2025-06）；关于完整 Blackwell + Dynamo 栈上"最高 30 倍"的社区声明是缺乏单一主要来源的方向性聚合。
- GB300 NVL72 + Dynamo：相对于 Hopper，MoE 吞吐量最高提升 50 倍（developer.nvidia.com，未注明日期）。
- 节省锚点（内部复合，不是单一案例研究）：在恒定 SLA 下，每年 200 万支出可节省 60-80 万美元。
- 分离式阈值：提示 >512 tokens + 输出 >200 tokens。
- 通过 NIXL 的 KV 传输：在 70B FP8 上，4K 提示 KV 耗时 20-80 毫秒。

## 使用它

`code/main.py` 模拟同置与分离式服务。报告吞吐量、每请求成本和提示长度交叉点。

## 交付它

本课生成 `outputs/skill-disaggregation-decider.md`。给定工作负载和集群，决定是否分离。

## 练习

1. 运行 `code/main.py`。在何种提示长度下分离式击败同置？
2. 为具有 P99 前缀长度 8K、输出 300 的 RAG 服务设计 prefill 池和 decode 池。
3. Dynamo vs llm-d：为一个没有 Python 运行时偏好的纯 Kubernetes 商店选择一个。
4. 计算 KV 传输成本：70B FP8 上的 4K prefill = 约 500 MB KV。在 RDMA 100 GB/s 下，传输 = 5 毫秒。在 TCP 10 GB/s 下 = 50 毫秒。哪个对你的 SLA 重要？
5. MoE 专家路由改变 KV 访问模式。分离式在 MoE 中表现如何，每个 token 激活不同的专家？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Disaggregated serving | "拆分 prefill/decode" | 为每个阶段提供独立的 GPU 池 |
| NIXL | "NVIDIA 传输" | Dynamo 的节点间 KV 传输（RDMA/TCP） |
| NVIDIA Dynamo | "编排器" | vLLM/SGLang/TRT-LLM 的栈上层协调器 |
| llm-d | "Kubernetes 原生" | Red Hat + AWS K8s 分离式栈 |
| Planner Profiler | "Dynamo 自动配置" | 测量工作负载，配置池比率 |
| SLA Planner | "Dynamo 策略" | 自动匹配 prefill:decode 以满足 SLO |
| `packDomain: rack` | "llm-d 拓扑" | 将 prefill+decode 打包在同一个机架上以实现快速 KV |
| UCCL | "统一集合" | llm-d 0.5 用于缩放到零的网络层 |
| MoE expert routing | "每个 token 的专家" | DeepSeek-V3 模式；分离式有帮助 |

## 进一步阅读

- [NVIDIA——介绍 Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA——在 Kubernetes 上部署分离式 LLM 推理工作负载](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM 分离式服务博客](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 发行说明](https://github.com/llm-d/llm-d/releases)
