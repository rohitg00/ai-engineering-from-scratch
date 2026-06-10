# 17 · 预填充/解码分离——NVIDIA Dynamo 与 llm-d

> 「预填充（Prefill）」是计算受限的，「解码（Decode）」是显存带宽受限的。把两者跑在同一块 GPU 上，必然浪费其中一种资源。分离（Disaggregation）把它们拆到各自独立的资源池，并通过 NIXL（RDMA/InfiniBand，或在不可用时回退到 TCP）在两者之间传输 KV 缓存。NVIDIA Dynamo（GTC 2025 发布，1.0 正式可用）位于 vLLM/SGLang/TRT-LLM 之上——它的 Planner Profiler + SLA Planner 会自动对齐预填充与解码的速率比，以满足 SLO。NVIDIA 公布的吞吐提升大致在这个量级——developer.nvidia.com（2025-06）显示，在中等延迟区间下，GB200 NVL72 + Dynamo 上的 DeepSeek-R1 MoE 有约 6 倍提升；Dynamo 产品页（developer.nvidia.com，未注明日期）则宣称 GB300 NVL72 + Dynamo 相比 Hopper 最高可达 50 倍 MoE 吞吐。所谓「30 倍」的数字是社区基于全栈 Blackwell + Dynamo + DeepSeek-R1 多份报告的汇总；我们没有找到任何单一一手来源明确给出恰好 30 倍，因此应将其视为方向性论断。llm-d（Red Hat + AWS）是 Kubernetes 原生的：预填充 / 解码 / 路由器各自作为独立的 Service，并按角色配置 HPA。llm-d 0.5 新增了分层 KV 卸载、缓存感知的 LoRA 路由、UCCL 网络、缩容至零（scale-to-zero）。经济性：综合多家客户披露的内部汇总数据显示，在恒定 SLA 下，将服务从同机部署（colocated）切换到基于 Dynamo 的分离部署后，约 200 万美元量级的推理支出可节省 30–40%（即每年 60–80 万美元）；其中具体的「200 万→60–80 万美元」数字是一个内部合成结果，而非单一已发表的案例研究——请将其作为数量级锚点，而非可引用的参考文献。短提示（<512 token、短输出）并不足以抵消传输成本。

**类型：** 学习
**语言：** Python（标准库，预填充分离 vs 同机部署的玩具级模拟器）
**前置：** Phase 17 · 04（vLLM 服务内部机制）、Phase 17 · 08（推理指标）
**时长：** 约 75 分钟

## 学习目标

- 解释为什么预填充与解码的最优 GPU 配置不同，并量化同机部署下的浪费。
- 画出分离架构图：预填充池、解码池、经由 NIXL 的 KV 传输、路由器。
- 指出分离「不」划算的条件（短提示、短输出）。
- 区分 NVIDIA Dynamo（栈上层）与 llm-d（Kubernetes 原生），并把两者各自匹配到合适的运维场景。

## 问题所在

你在 8 块 H100 上运行 Llama 3.3 70B。在混合负载（长提示 + 短输出）下，GPU 在解码阶段空闲，因为大部分算力都花在了预填充上。在另一种负载（短提示 + 长输出）下，情况正好相反。同机部署预填充 + 解码意味着你对两者都得过量配置。

预算影响：20–40% 的 GPU 时间被浪费在了错误的资源上。你买的是 H100 的算力，却拿去跑显存带宽受限的解码；或者买的是 H100 的 HBM 带宽，却拿去跑计算受限的预填充。两者都是昂贵的浪费。

分离把预填充与解码拆到各自独立的资源池，并按各自的瓶颈来定容量。KV 缓存通过高带宽互连从预填充池传输到解码池。

## 核心概念

### 为什么瓶颈不同

**预填充**——在一次前向传播中对完整输入提示运行 Transformer。矩阵乘法占主导；计算受限。H100 FP8 可提供约 2000 TFLOPS 的有效吞吐。批处理效率较好——一次前向就能处理大量 token。

**解码**——一次生成一个 token，每次迭代都要读取全部权重。显存带宽受限。HBM3 可提供约 3 TB/s。只有在高并发下批处理效率才好——权重读取在整个 batch 上被摊薄。

把两者同机部署：你买的是对两者都优化的 GPU。H100 两者都擅长，但无论用于哪一项成本都一样。在规模化部署时，你会希望预填充池用 H100 / 偏算力；解码池用 H200 / 偏显存，或者配合激进的量化。

### 架构

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL 是 NVIDIA 的跨节点传输层。可用时使用 RDMA/InfiniBand，否则回退到 TCP。传输延迟是真实存在的——对于 70B FP8 上 4K-token 提示的 KV 缓存，通常为 20–80 ms。这正是短提示不足以支撑分离的原因：传输税超过了节省的收益。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 发布，1.0 正式可用）：
- 作为编排器位于 vLLM、SGLang、TRT-LLM 之上。
- Planner Profiler 测量负载，SLA Planner 自动配置预填充:解码的比例。
- Rust 内核，Python 可扩展性。
- 吞吐提升：NVIDIA 报告称在中等延迟区间下，GB200 NVL72 + Dynamo 上的 DeepSeek-R1 MoE 有 6 倍提升（developer.nvidia.com，2025-06）；社区关于全栈 Blackwell + Dynamo + DeepSeek-R1 「最高 30 倍」的报告缺乏单一一手来源，应视为方向性论断。
- GB300 NVL72 + Dynamo：据 Dynamo 产品页（developer.nvidia.com，未注明日期），相比 Hopper 最高可达 50 倍 MoE 吞吐。

**llm-d**（Red Hat + AWS，Kubernetes 原生）：
- 预填充 / 解码 / 路由器各自作为独立的 Kubernetes Service。
- 按角色配置 HPA，分别以队列深度（预填充）/ KV 利用率（解码）为信号。
- `topologyConstraint packDomain: rack` 把预填充 + 解码的协作单元（clique）打包到同一机架上，以实现高带宽 KV 传输。
- llm-d 0.5（2026）：分层 KV 卸载、缓存感知的 LoRA 路由、UCCL 网络、缩容至零。

如果你想要一个托管式的栈上层编排器，用 Dynamo。如果你想要 Kubernetes 原生的原语并且已投入 CNCF 生态，用 llm-d。

### 经济性

内部合成数据（并非单一已发表案例研究——仅作数量级锚点）：

- 同机部署服务每年 200 万美元推理支出。
- 切换到基于 Dynamo 的分离部署。
- 相同请求量、相同 P99 延迟 SLA。
- 报告的节省：每年 60–80 万美元（减少 30–40%）。
- 不新增硬件。

我们是从多家客户的披露中综合得出这个数字，而非来自单一可引用的案例研究；最接近的已发表数据点是 Baseten 在使用 Dynamo KV 路由后 TTFT 快 2 倍 / 吞吐提升 61%（baseten.co，2025-10），以及 VAST + CoreWeave 预测在 40–60% KV 命中率下每美元 token 数提升 60–130%（vastdata.com，2025-12）。节省来自对每个资源池的合理定容；预填充密集型负载（带 8K+ 前缀的 RAG）比均衡型负载受益更多。

### 何时「不要」分离

- 提示 < 512 token 且输出 < 200 token：传输税主导收益。
- 小集群（< 4 块 GPU）：资源池多样性不足。
- 团队无力运维两套带按角色伸缩的 GPU 池：Dynamo 有帮助，但并非毫不费力。
- 没有 RDMA 网络结构：TCP 传输税更重。

### 路由器与 Phase 17 · 11 的衔接

分离式路由器是 KV 缓存感知的（Phase 17 · 11）。一个请求会落到持有其前缀的解码池上——若无匹配，则走预填充 → 解码流程。命中率与分离会叠加增益——缓存感知路由器会决定一次新的预填充是否真的有必要。

### Blackwell 上的 MoE 才是真正出数字的地方

GB300 NVL72 + Dynamo 相比 Hopper 基线展现出 50 倍 MoE 吞吐。MoE 的专家路由在预填充阶段是计算密集的，在解码阶段是显存密集的（专家缓存），因此分离是双重收益。2026 年的前沿模型服务以 MoE 为主导（DeepSeek-V3、未来的 GPT-5 变体）。

### 你应该记住的数字

基准数字会变动——NVIDIA 和整个推理栈每个季度都会发布更新结果。引用前请重新核对。

- GB200 NVL72 + Dynamo 上的 DeepSeek-R1：在中等延迟区间下相比基线约 6 倍吞吐（developer.nvidia.com，2025-06）；社区关于全栈 Blackwell + Dynamo 「最高 30 倍」的说法是缺乏单一一手来源的方向性汇总。
- GB300 NVL72 + Dynamo：相比 Hopper 最高可达 50 倍 MoE 吞吐（developer.nvidia.com，未注明日期）。
- 节省锚点（内部合成，非单一案例研究）：在恒定 SLA 下，从每年 200 万美元支出中节省每年 60–80 万美元。
- 分离阈值：提示 >512 token + 输出 >200 token。
- 经由 NIXL 的 KV 传输：70B FP8 上 4K 提示的 KV 为 20–80 ms。

## 动手用它

`code/main.py` 模拟同机部署 vs 分离部署的服务。报告吞吐、每请求成本，以及提示长度的交叉点（crossover）。

## 交付它

本课产出 `outputs/skill-disaggregation-decider.md`。给定负载与集群，判定是否应当分离。

## 练习

1. 运行 `code/main.py`。在多长的提示下，分离开始优于同机部署？
2. 为一个 P99 前缀长度 8K、输出 300 的 RAG 服务设计预填充池与解码池。
3. Dynamo vs llm-d：为一家纯 Kubernetes、对 Python 运行时无偏好的团队选一个。
4. 计算 KV 传输成本：70B FP8 上 4K 预填充 = 约 500 MB KV。在 RDMA 100 GB/s 下，传输 = 5 ms；在 TCP 10 GB/s 下 = 50 ms。哪一个对你的 SLA 才是关键？
5. MoE 专家路由会改变 KV 访问模式。当 MoE 为每个 token 激活不同专家时，分离的表现如何？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 分离式服务（Disaggregated serving） | 「拆分预填充/解码」 | 为每个阶段配置独立的 GPU 池 |
| NIXL | 「NVIDIA 传输层」 | Dynamo 的跨节点 KV 传输（RDMA/TCP） |
| NVIDIA Dynamo | 「那个编排器」 | vLLM/SGLang/TRT-LLM 的栈上层协调器 |
| llm-d | 「Kubernetes 原生」 | Red Hat + AWS 的 K8s 分离栈 |
| Planner Profiler | 「Dynamo 自动配置」 | 测量负载，配置资源池比例 |
| SLA Planner | 「Dynamo 策略」 | 自动对齐预填充:解码速率以满足 SLO |
| `packDomain: rack` | 「llm-d 拓扑」 | 把预填充 + 解码打包到同一机架以加速 KV |
| UCCL | 「统一集合通信」 | llm-d 0.5 用于缩容至零的网络层 |
| MoE 专家路由 | 「每 token 一组专家」 | DeepSeek-V3 模式；分离有助益 |

## 延伸阅读

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
