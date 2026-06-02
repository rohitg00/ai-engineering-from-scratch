# Prefill/Decode 解耦服务 —— NVIDIA Dynamo 与 llm-d

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Prefill 是 compute-bound（计算瓶颈），decode 是 memory-bound（内存瓶颈）。把两者跑在同一张 GPU 上，必然浪费其中一种资源。Disaggregation（解耦）把它们拆到独立的资源池里，并通过 NIXL（RDMA/InfiniBand，或回退到 TCP）在两池间传输 KV cache。NVIDIA Dynamo（GTC 2025 发布，1.0 GA）位于 vLLM/SGLang/TRT-LLM 之上 —— 它的 Planner Profiler + SLA Planner 会自动匹配 prefill:decode 的速率比例以满足 SLO。NVIDIA 公布的吞吐增益大致在这个量级 —— developer.nvidia.com（2025-06）显示在中等延迟区间内，DeepSeek-R1 MoE 在 GB200 NVL72 + Dynamo 上有约 6 倍的提升；Dynamo 产品页（developer.nvidia.com，未注日期）则宣称在 GB300 NVL72 + Dynamo 上 MoE 吞吐相对 Hopper 最高可达 50 倍。所谓「30 倍」是社区把 Blackwell + Dynamo + DeepSeek-R1 全栈报告汇总起来的近似值；我们没找到任何一份单独的一手资料明确写着 30 倍，所以请把它当作方向性结论。llm-d（Red Hat + AWS）则是 Kubernetes 原生的：prefill / decode / router 各为独立的 Service，按角色单独配置 HPA。llm-d 0.5 增加了分层 KV 卸载、cache-aware 的 LoRA 路由、UCCL 网络层、scale-to-zero。经济性：把多份客户披露做内部汇总后，估计在恒定 SLA 下，从同机部署切到 Dynamo 解耦，能从 200 万美元级别的 inference（推理）支出里省下 30–40%（即每年 60–80 万美元）；这里 200 万 → 60–80 万的具体数字是内部综合估算，不是某一份公开案例研究 —— 请把它当数量级锚点，而不是引用来源。短 prompt（<512 token、输出也短）是不值得为传输买单的。

**Type:** Learn
**Languages:** Python（标准库，玩具级 disaggregated-vs-colocated 模拟器）
**Prerequisites:** Phase 17 · 04（vLLM Serving Internals）、Phase 17 · 08（Inference Metrics）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 解释 prefill 和 decode 为什么需要不同的 GPU 配比，并量化同机部署下的浪费。
- 画出解耦架构图：prefill 池、decode 池、经 NIXL 的 KV 传输、router。
- 说出何时解耦**不**划算（prompt 短、输出短）。
- 区分 NVIDIA Dynamo（stack-above 编排器）和 llm-d（Kubernetes 原生），并把它们各自映射到合适的运维场景。

## 问题（The Problem）

你在 8 张 H100 上跑 Llama 3.3 70B。在「长 prompt + 短输出」的混合负载下，GPU 在 decode 阶段闲置，因为大部分算力都耗在 prefill 上了。换成「短 prompt + 长输出」的负载，情况正好反过来。把 prefill + decode 同机部署，意味着两边都在过度配置。

预算影响：20–40% 的 GPU 时间用错了资源。你买 H100 的算力却拿来跑 memory-bound 的 decode；或者你买 H100 的 HBM 带宽却拿来跑 compute-bound 的 prefill。两种都是昂贵的浪费。

解耦的做法是把 prefill 和 decode 拆到各自按瓶颈定容量的池子里。KV cache 通过高带宽互联从 prefill 池传给 decode 池。

## 概念（The Concept）

### 为什么瓶颈不同（Why the bottlenecks differ）

**Prefill** —— 一次 forward 把整个输入 prompt 过一遍 transformer。矩阵乘法主导，是 compute-bound 的。H100 FP8 能吐出约 2000 TFLOPS 的有效吞吐。批处理效率好 —— 一次 forward 处理很多 token。

**Decode** —— 一次只生成一个 token，每轮都要把整组权重读一遍，是受 memory-bandwidth 限制的。HBM3 大概 3 TB/s。批处理效率只有在高并发下才好 —— 因为权重读取的开销可以摊到 batch 里所有请求上。

把两者同机部署：你要为「两边都不差」的 GPU 买单。H100 两边都行，但定价不会因此减半。当规模上来，你会希望 prefill 池用 H100 / 偏算力的卡；decode 池用 H200 / 偏内存的卡，或者上激进的量化。

### 架构（The architecture）

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

NIXL 是 NVIDIA 的跨节点传输层。条件允许时用 RDMA/InfiniBand，否则回退到 TCP。传输延迟是真实开销 —— 70B FP8 模型上一个 4K-token prompt 的 KV cache，典型耗时是 20–80 ms。这就是短 prompt 不值得解耦的原因：传输税超过了节省。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 发布，1.0 GA）：
- 作为编排器，位于 vLLM、SGLang、TRT-LLM 之上。
- Planner Profiler 测量负载，SLA Planner 自动配置 prefill:decode 比例。
- Rust 内核，Python 可扩展。
- 吞吐增益：NVIDIA 报告中等延迟区间内，DeepSeek-R1 MoE 在 GB200 NVL72 + Dynamo 上有 6 倍提升（developer.nvidia.com，2025-06）；社区流传的 Blackwell + Dynamo + DeepSeek-R1 全栈「最高 30 倍」缺乏一手出处，应当作方向性结论。
- GB300 NVL72 + Dynamo：根据 Dynamo 产品页（developer.nvidia.com，未注日期），MoE 吞吐相对 Hopper 最高可达 50 倍。

**llm-d**（Red Hat + AWS，Kubernetes 原生）：
- prefill / decode / router 是三个独立的 Kubernetes Service。
- 按角色配 HPA：prefill 看队列深度，decode 看 KV 利用率。
- `topologyConstraint packDomain: rack` 把同一 clique 的 prefill+decode 紧凑打包到同一机架，方便高带宽 KV 传输。
- llm-d 0.5（2026）：分层 KV 卸载、cache-aware 的 LoRA 路由、UCCL 网络层、scale-to-zero。

如果你想要一个托管式的 stack-above 编排器，选 Dynamo。如果你要 Kubernetes 原生原语、并且已经押注 CNCF 生态，选 llm-d。

### 经济性（Economics）

内部综合数据（不是某一份公开案例研究 —— 当数量级锚点用）：

- 同机部署的年 inference 支出 200 万美元。
- 切换到 Dynamo 解耦。
- 同样的请求量、同样的 P99 延迟 SLA。
- 报告的节省：每年 60–80 万美元（30–40% 降幅）。
- 没买新硬件。

这个数字是我们从多份客户披露里综合出来的，不是某一份可引用的案例研究；最接近的公开数据点是 Baseten 报告的 Dynamo KV routing 带来 2 倍 TTFT 提速 / 61% 吞吐提升（baseten.co，2025-10），以及 VAST + CoreWeave 在 40–60% KV 命中率下预测每美元 token 数提升 60–130%（vastdata.com，2025-12）。节省来自给每个池子各自合理定容；偏 prefill 的负载（带 8K+ 前缀的 RAG）比均衡负载收益更大。

### 何时**不要**解耦（When NOT to disaggregate）

- prompt < 512 token、输出 < 200 token：传输税大于收益。
- 小集群（< 4 卡 GPU）：池子多样性不够。
- 团队没法运维两个分别按角色伸缩的 GPU 池：Dynamo 能帮忙，但也并非零门槛。
- 没有 RDMA 网络：TCP 传输税更重。

### Router 与 Phase 17 · 11 的整合

解耦架构里的 router 是 KV-cache-aware 的（见 Phase 17 · 11）。请求会被打到持有其前缀的 decode 池上 —— 没命中才走 prefill → decode 的链路。命中率和解耦是互相叠加的 —— cache-aware 的 router 会先决定是否真的需要再做一次 prefill。

### Blackwell 上的 MoE 才是真正的数字所在（MoE on Blackwell is where the real numbers are）

GB300 NVL72 + Dynamo 在 MoE 吞吐上相对 Hopper 基线达到 50 倍。MoE 的 expert 路由在 prefill 阶段是计算密集的，在 decode 阶段又是内存密集的（expert 缓存），所以解耦是双重收益。2026 年的前沿模型服务以 MoE 为主（DeepSeek-V3、未来的 GPT-5 变体）。

### 你应该记住的数字（Numbers you should remember）

基准数字会漂移 —— NVIDIA 和整个 inference 栈每个季度都会发新结果。引用前请重新核对。

- DeepSeek-R1 在 GB200 NVL72 + Dynamo 上：中等延迟区间相对基线约 6 倍吞吐（developer.nvidia.com，2025-06）；社区在 Blackwell + Dynamo 全栈上声称的「最高 30 倍」是没有单一一手出处的方向性汇总。
- GB300 NVL72 + Dynamo：MoE 吞吐相对 Hopper 最高 50 倍（developer.nvidia.com，未注日期）。
- 节省锚点（内部综合，非单一案例）：在 200 万美元年支出基础上，恒定 SLA 下每年省 60–80 万美元。
- 解耦门槛：prompt > 512 token、输出 > 200 token。
- KV 经 NIXL 传输：70B FP8 上的 4K-prompt KV 大约 20–80 ms。

## 用起来（Use It）

`code/main.py` 模拟同机部署 vs 解耦部署的服务。报告吞吐、单请求成本，以及 prompt 长度上的交叉点。

## 上线部署（Ship It）

本课产出 `outputs/skill-disaggregation-decider.md`。给定负载和集群规格，判定是否要解耦。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。在多长的 prompt 处，解耦才开始打过同机部署？
2. 为一个 P99 前缀长 8K、输出 300 的 RAG 服务设计 prefill 池和 decode 池。
3. Dynamo vs llm-d：给一家纯 Kubernetes、对 Python 运行时无偏好的公司选一个。
4. 算一下 KV 传输成本：70B FP8 上 4K prefill ≈ 500 MB 的 KV。RDMA 100 GB/s 下传 5 ms；TCP 10 GB/s 下传 50 ms。哪个对你的 SLA 才是关键？
5. MoE 的 expert 路由会改变 KV 访问模式。当每个 token 激活不同 expert 时，解耦的行为会怎么变？

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | 给两个阶段各配独立的 GPU 池 |
| NIXL | "NVIDIA transport" | Dynamo 的跨节点 KV 传输（RDMA/TCP） |
| NVIDIA Dynamo | "the orchestrator" | vLLM/SGLang/TRT-LLM 之上的 stack-above 协调器 |
| llm-d | "Kubernetes native" | Red Hat + AWS 的 K8s 解耦栈 |
| Planner Profiler | "Dynamo auto-config" | 测量负载、配置池子比例 |
| SLA Planner | "Dynamo policy" | 自动匹配 prefill:decode 速率以满足 SLO |
| `packDomain: rack` | "llm-d topology" | 把 prefill+decode 紧凑打包到同机架，便于快速 KV 传输 |
| UCCL | "unified collective" | llm-d 0.5 用于 scale-to-zero 的网络层 |
| MoE expert routing | "expert per token" | DeepSeek-V3 范式；解耦能带来双重收益 |

## 延伸阅读（Further Reading）

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
