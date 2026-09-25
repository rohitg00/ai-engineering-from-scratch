# 分离式 Prefill/Decode —— NVIDIA Dynamo 与 llm-d

> Prefill 是计算受限的；decode 是内存带宽受限的。在同一个 GPU 上同时运行两者会浪费其中一种资源。分离式架构将它们拆分到不同的资源池，并通过 NIXL（RDMA/InfiniBand，或 TCP 回退）在池间传输 KV cache。NVIDIA Dynamo（GTC 2025 发布，1.0 GA）位于 vLLM/SGLang/TRT-LLM 之上——其 Planner Profiler + SLA Planner 自动匹配 prefill:decode 的速率比例以满足 SLO。NVIDIA 公布的吞吐量提升在这一区间——developer.nvidia.com（2025-06）显示，在中等延迟场景下，GB200 NVL72 + Dynamo 上 DeepSeek-R1 MoE 的吞吐量提升约 6 倍；Dynamo 产品页面（developer.nvidia.com，未注明日期）宣称在 GB300 NVL72 + Dynamo 上相比 Hopper，MoE 吞吐量最高提升 50 倍。"30 倍"这一数字是社区对多份 Blackwell + Dynamo + DeepSeek-R1 全栈报告的综合结果；我们没有找到任何单一的一手来源明确给出 30 倍这一数字，因此应将其视为方向性说法。llm-d（Red Hat + AWS）是 Kubernetes 原生的：prefill / decode / router 作为独立的 Service，各自配置 per-role HPA。llm-d 0.5 增加了分层 KV 卸载、cache 感知的 LoRA 路由、UCCL 网络和 scale-to-zero。经济性：对多项客户披露信息的内部汇总表明，在 SLA 不变的前提下，从 colocated serving 切换到使用 Dynamo 的分离式架构，可节省 $2M-class inference spend (i.e., $（600-800K/年）；这一 $2M→$（600-800K）具体数字是内部综合结果，并非单一公开案例——请将其作为数量级参考，而非可引用的出处。短 prompt（<512 token，短输出）不值得承担传输开销。

**Type:** Learn
**Languages:** Python（标准库，toy 分离式-vs-colocated 模拟器）
**Prerequisites:** Phase 17 · 04（Serving Engine Internals），Phase 17 · 08（Inference Metrics）
**Time:** 约 75 分钟

## 学习目标

- 解释为什么 prefill 和 decode 有不同的最优 GPU 配置，并量化 colocated 架构下的浪费。
- 绘制分离式架构图：prefill 池、decode 池、通过 NIXL 进行 KV 传输、router。
- 说出分离式架构不划算的条件（短 prompt、短输出）。
- 区分 NVIDIA Dynamo（叠层之上）与 llm-d（Kubernetes 原生），并将各自对应到相应的运维场景。

## 问题

你在 8 张 H100 上运行 Llama 3.3 70B。在混合负载（长 prompt + 短输出）下，GPU 在 decode 阶段空闲，因为大部分算力消耗在 prefill 上。在另一种负载（短 prompt + 长输出）下，情况相反。Colocated prefill + decode 意味着你对两者都过度配置了。

预算影响：20-40% 的 GPU 时间浪费在了错误的资源上。你花钱购买 H100 算力来运行内存带宽受限的 decode，或购买 H100 HBM 带宽来运行计算受限的 prefill。两者都是昂贵的浪费。

分离式架构将 prefill 和 decode 拆分到按各自瓶颈规模设计的独立资源池。KV cache 通过高带宽互连从 prefill 池传输到 decode 池。

## 概念

### 为什么瓶颈不同

**Prefill** —— 在一次前向中跑完整个输入 prompt 的 transformer。矩阵乘法占主导；计算受限。H100 FP8 可提供约 2000 TFLOPS 的有效吞吐量。批处理效率很好——一次前向处理大量 token。

**Decode** —— 每次生成一个 token，每次迭代都要读取全部权重。内存带宽受限。HBM3 提供约 3 TB/s。只有高并发时批处理效率才好——权重读取可在整个 batch 上摊销。

将两者放在一起：你购买的 GPU 必须兼顾两者。H100 两者都擅长，但成本相同。在规模化场景下，你会希望 prefill 池使用 H100 / 偏计算型；decode 池使用 H200 / 偏内存型，或采用激进量化。

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

NIXL 是 NVIDIA 的节点间传输层。可用时使用 RDMA/InfiniBand，否则回退到 TCP。传输延迟是真实存在的——70B FP8 下 4K token prompt 的 KV cache 通常需要 20-80 ms。这就是短 prompt 不值得分离式部署的原因：传输开销超过节省的成本。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 发布，1.0 GA）：
- 作为编排器位于 vLLM、SGLang、TRT-LLM 之上。
- Planner Profiler 测量负载，SLA Planner 自动配置 prefill:decode 比例。
- Rust 核心，Python 可扩展性。
- 吞吐量提升：NVIDIA 报告在中等延迟场景下，GB200 NVL72 + Dynamo 上 DeepSeek-R1 MoE 提升 6 倍（developer.nvidia.com，2025-06）；社区声称在 Blackwell + Dynamo + DeepSeek-R1 全栈上"最高 30 倍"缺乏单一一手来源，应视为方向性说法。
- GB300 NVL72 + Dynamo：据 Dynamo 产品页面（developer.nvidia.com，未注明日期），相比 Hopper MoE 吞吐量最高提升 50 倍。

**llm-d**（Red Hat + AWS，Kubernetes 原生）：
- Prefill / decode / router 作为独立的 Kubernetes Service。
- Per-role HPA，分别使用队列深度（prefill）/ KV 利用率（decode）信号。
- `topologyConstraint packDomain: rack` 将 prefill+decode 集群打包在同一机架上，以实现高带宽 KV 传输。
- llm-d 0.5（2026）：分层 KV 卸载、cache 感知的 LoRA 路由、UCCL 网络、scale-to-zero。

如果你想要一个托管式叠层编排器，用 Dynamo。如果你想要 Kubernetes 原生原语并已投入 CNCF 生态，用 llm-d。

### 经济性

内部综合数据（并非单一公开案例——数量级参考）：

- 每年 $2M 的推理支出，colocated serving。
- 切换到使用 Dynamo 的分离式架构。
- 请求量相同，P99 延迟 SLA 相同。
- 报告的节省：$600K–$（800K/年，降幅 30–40%）。
- 无新硬件。

这个数字是我们从多项客户披露信息中综合得出的，而非单一可引用的案例；最接近的公开数据点是 Baseten 使用 Dynamo KV 路由实现 2 倍 TTFT / 61% 更高吞吐量（baseten.co，2025-10），以及 VAST + CoreWeave 预测在 40–60% KV 命中率下每美元 token 数提升 60–130%（vastdata.com，2025-12）。节省来自于按规模正确配置每个池；prefill 密集型负载（带 8K+ 前缀的 RAG）受益大于均衡型负载。

### 何时不应分离

- Prompt < 512 token 且输出 < 200 token：传输开销超过收益。
- 小集群（< 4 GPU）：池多样性不足。
- 团队无法运维两个带 per-role 扩缩容的 GPU 池：Dynamo 有帮助，但并非易事。
- 无 RDMA 网络：TCP 传输开销更重。

### Router 与 Phase 17 · 11 的集成

分离式 router 具备 KV-cache 感知能力（Phase 17 · 11）。请求会落到持有其前缀的 decode 池上——若无匹配，则流转 prefill → decode。命中率和分离式部署会相互放大——cache 感知的 router 决定了是否还需要新的 prefill。

### Blackwell 上的 MoE 才是真正的数字所在

GB300 NVL72 + Dynamo 展示了相比 Hopper 基线 50 倍的 MoE 吞吐量。MoE 专家路由在 prefill 上计算密集，但在 decode 上内存密集（专家缓存），因此分离式部署是双重收益。2026 年的前沿模型 serving 以 MoE 为主（DeepSeek-V3、未来的 GPT-5 变体）。

### 你应该记住的数字

基准测试数字会漂移——NVIDIA 和推理栈每个季度都会发布更新结果。引用前请重新核对。

- DeepSeek-R1 在 GB200 NVL72 + Dynamo 上：中等延迟场景下相比基线约 6 倍吞吐量（developer.nvidia.com，2025-06）；社区在 Blackwell + Dynamo 全栈上"最高 30 倍"的说法是方向性综合，没有单一一手来源。
- GB300 NVL72 + Dynamo：相比 Hopper MoE 吞吐量最高 50 倍（developer.nvidia.com，未注明日期）。
- 节省参考（内部综合，非单一案例）：$600-800K/year off a $，SLA 不变的 $2M 年支出。
- 分离式部署阈值：prompt >512 token 且输出 >200 token。
- 通过 NIXL 的 KV 传输：70B FP8 下 4K prompt 的 KV 需 20-80 ms。

```figure
prefill-decode-split
```

## 使用

`code/main.py` 模拟 colocated 与分离式 serving。报告吞吐量、每请求成本以及 prompt 长度的交叉点。

## 上线

本课产出 `outputs/skill-disaggregation-decider.md`。给定负载和集群，判断是否应采用分离式架构。

## 练习

1. 运行 `code/main.py`。在什么 prompt 长度下分离式优于 colocated？
2. 为一个 P99 前缀长度 8K、输出 300 的 RAG 服务设计 prefill 池和 decode 池。
3. Dynamo vs llm-d：为一个不偏好 Python 运行时的纯 Kubernetes 团队选择一个。
4. 计算 KV 传输成本：70B FP8 下 4K prefill = 约 500 MB KV。RDMA 100 GB/s 时，传输耗时 5 ms。TCP 10 GB/s 时为 50 ms。哪个对你的 SLA 更重要？
5. MoE 专家路由改变了 KV 访问模式。分离式部署在每 token 激活不同专家的 MoE 上表现如何？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 分离式 serving | "拆分 prefill/decode" | 每个阶段使用独立的 GPU 池 |
| NIXL | "NVIDIA 传输层" | Dynamo 的节点间 KV 传输（RDMA/TCP） |
| NVIDIA Dynamo | "那个编排器" | 位于 vLLM/SGLang/TRT-LLM 之上的协调器 |
| llm-d | "Kubernetes 原生" | Red Hat + AWS 的 K8s 分离式栈 |
| Planner Profiler | "Dynamo 自动配置" | 测量负载，配置池比例 |
| SLA Planner | "Dynamo 策略" | 自动匹配 prefill:decode 速率以满足 SLO |
| `packDomain: rack` | "llm-d 拓扑" | 将 prefill+decode 打包在同一机架上以实现快速 KV |
| UCCL | "统一集合通信" | llm-d 0.5 用于 scale-to-zero 的网络层 |
| MoE 专家路由 | "每 token 一个专家" | DeepSeek-V3 模式；分离式部署有助于此 |

## 延伸阅读

- [NVIDIA —— Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA —— Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving 博客](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 发布说明](https://github.com/llm-d/llm-d/releases)