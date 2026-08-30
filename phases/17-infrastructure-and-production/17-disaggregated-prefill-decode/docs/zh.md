# 解耦预填充/解码 —— NVIDIA Dynamo和llm-d

> 预填充是计算约束的；解码是内存约束的。在同一GPU上运行两者浪费一种资源。解耦将它们拆分到单独池上，并通过NIXL（RDMA/InfiniBand或TCP回退）在它们之间传输KV缓存。NVIDIA Dynamo（GTC 2025宣布，1.0 GA）位于vLLM/SGLang/TRT-LLM之上 —— 其Planner Profiler + SLA Planner自动速率匹配预填充:解码比率以满足SLO。NVIDIA发布此范围内的吞吐量增益 —— developer.nvidia.com（2025-06）显示在中等延迟状态下，GB200 NVL72 + Dynamo上DeepSeek-R1 MoE约6倍改进，Dynamo产品页面（developer.nvidia.com，无日期）宣传GB300 NVL72 + Dynamo上相比Hopper高达50倍MoE吞吐量。"30倍"数字是社区对完整栈Blackwell + Dynamo + DeepSeek-R1报告的聚合；我们尚未找到单一主要来源准确陈述30倍，因此将其视为方向性声明。llm-d（Red Hat + AWS）是Kubernetes原生的：预填充/解码/路由器作为独立服务，带每角色HPA。llm-d 0.5添加分层KV卸载、缓存感知LoRA路由、UCCL网络、扩展到零。经济学：多个客户披露的内部汇总表明，在恒定SLA下从共处服务切换到Dynamo解耦时，$2M级推理支出节省30-40%（即每年$600-800K）；具体$2M→$600-800K数字是内部综合，非单一已发布案例研究 —— 将其用作数量级锚点，非参考引用。短提示（<512 token，短输出）无法证明传输成本的合理性。

**类型：** 学习
**语言：** Python（标准库，玩具解耦 vs 共处模拟器）
**前置知识：** 第17阶段 · 04（vLLM服务内部），第17阶段 · 08（推理指标）
**时间：** 约75分钟

## 学习目标

- 解释为什么预填充和解码具有不同的最优GPU分配，并量化共处下的浪费。
- 绘制解耦架构：预填充池、解码池、通过NIXL的KV传输、路由器。
- 命名解耦不回报的条件（短提示、短输出）。
- 区分NVIDIA Dynamo（栈之上）与llm-d（Kubernetes原生）并将每个匹配到运营上下文。

## 问题

你在8个H100上运行Llama 3.3 70B。在混合工作负载（长提示 + 短输出）下，GPU在解码期间空闲，因为大部分计算花在预填充上。在不同工作负载（短提示 + 长输出）下，相反发生。共处预填充 + 解码意味着你过度配置两者。

预算影响：20-40%的GPU时间浪费在错误资源上。你正在购买H100计算来运行内存约束解码，或购买H100 HBM带宽来运行计算约束预填充。两者都是昂贵的浪费。

解耦将预填充和解码拆分到针对每个瓶颈单独调整大小的池上。KV缓存通过高带宽互连从预填充池传输到解码池。

## 概念

### 为什么瓶颈不同

**预填充** —— 在一个前向中运行完整输入提示上的transformer。矩阵乘法主导；计算约束。H100 FP8提供约2000 TFLOPS有用吞吐量。批次效率良好 —— 一个前向处理许多token。

**解码** —— 每次生成一个token，每次迭代读取完整权重。内存带宽约束。HBM3提供约3 TB/s。仅在高并发时批次效率良好 —— 权重读取在批次间摊销。

共处它们：你为两者优化购买GPU。H100对两者都擅长，但成本相同。规模上，你想要预填充池在H100/计算重；解码池在H200/内存重，或带激进量化。

### 架构

```
            ┌──────────────┐
  请求 →    │    路由器    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (仅提示)                       │
            ┌──────────────┐    KV缓存    ┌───────▼──────┐
            │ 预填充池     │ ─── NIXL ───►│ 解码池       │
            │  (计算)      │                │  (内存)      │
            └──────────────┘                └──────┬───────┘
                                                   │ token
                                                   ▼
                                                 客户端
```

NIXL是NVIDIA的节点间传输。可用时使用RDMA/InfiniBand，否则TCP回退。传输延迟是真实的 —— 70B FP8上4K token提示的KV缓存通常20-80毫秒。这就是短提示无法证明解耦合理的原因：传输税超过节省。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025宣布，1.0 GA）：
- 作为编排器位于vLLM、SGLang、TRT-LLM之上。
- Planner Profiler测量工作负载，SLA Planner自动配置预填充:解码比率。
- Rust核心，Python可扩展性。
- 吞吐量增益：NVIDIA报告中等延迟状态下GB200 NVL72 + Dynamo上DeepSeek-R1 MoE 6倍（developer.nvidia.com，2025-06）；完整Blackwell + Dynamo + DeepSeek-R1栈上"高达30倍"的社区报告缺乏单一主要来源，应视为方向性。
- GB300 NVL72 + Dynamo：相比Hopper高达50倍MoE吞吐量（developer.nvidia.com，无日期）。

**llm-d**（Red Hat + AWS，Kubernetes原生）：
- 预填充/解码/路由器作为独立Kubernetes服务。
- 带队列深度（预填充）/ KV利用率（解码）信号的每角色HPA。
- `topologyConstraint packDomain: rack`将预填充+解码集团打包在同一机架上以实现高带宽KV传输。
- llm-d 0.5（2026）：分层KV卸载、缓存感知LoRA路由、UCCL网络、扩展到零。

如果你想要托管栈之上编排器，使用Dynamo。如果你想要Kubernetes原生原语并致力于CNCF生态系统，使用llm-d。

### 经济学

内部综合（非单一已发布案例研究 —— 数量级锚点）：

- 共处服务上年$200万推理支出。
- 切换到Dynamo解耦。
- 相同请求量，相同P99延迟SLA。
- 报告节省：每年$600K-$800K（30-40%降低）。
- 无新硬件。

我们从多个客户披露综合此数字，而非单一可引用案例研究；最接近的已发布数据点是Baseten的Dynamo KV路由2倍更快TTFT / 61%更高吞吐量（baseten.co，2025-10），以及VAST + CoreWeave在40-60% KV命中率下60-130%更多token/$的预测（vastdata.com，2025-12）。节省来自正确调整每个池的大小；预填充重工作负载（带8K+前缀的RAG）比平衡工作负载受益更多。

### 何时不解耦

- 提示 < 512 token且输出 < 200 token：传输税主导增益。
- 小集群（< 4 GPU）：池多样性不足。
- 团队无法操作两个带每角色扩展的GPU池：Dynamo有帮助但非微不足道。
- 无RDMA结构：TCP传输税更重。

### 路由器与第17阶段 · 11集成

解耦路由器是KV缓存感知的（第17阶段 · 11）。请求落在持有其前缀的解码池上 —— 如果没有匹配，它流动预填充 → 解码。命中率与解耦复合 —— 缓存感知路由器确定是否甚至需要新预填充。

### Blackwell上的MoE是真实数字所在

GB300 NVL72 + Dynamo显示相比Hopper基线50倍MoE吞吐量。MoE专家路由在预填充上是计算重的，但在解码上是内存重的（专家缓存），因此解耦是双赢。2026年前沿模型服务是MoE主导的（DeepSeek-V3、未来GPT-5变体）。

### 你应该记住的数字

基准数字漂移 —— NVIDIA和推理栈每季度发布更新结果。引用前重新检查。

- GB200 NVL72 + Dynamo上的DeepSeek-R1：相比基线约6倍吞吐量，中等延迟状态（developer.nvidia.com，2025-06）；完整Blackwell + Dynamo栈上"高达30倍"的社区声明是没有单一主要来源的方向性聚合。
- GB300 NVL72 + Dynamo：相比Hopper高达50倍MoE吞吐量（developer.nvidia.com，无日期）。
- 节省锚点（内部综合，非单一案例研究）：恒定SLA下，年$200万支出节省$600-800K/年。
- 解耦阈值：提示 > 512 token + 输出 > 200 token。
- 通过NIXL的KV传输：70B FP8上4K提示KV 20-80毫秒。

## 使用它

`code/main.py`模拟共处 vs 解耦服务。报告吞吐量、每次请求成本，以及提示长度交叉点。

## 交付它

本课程产出`outputs/skill-disaggregation-decider.md`。给定工作负载和集群，决定是否解耦。

## 练习

1. 运行`code/main.py`。在什么提示长度下，解耦击败共处？
2. 为P99前缀长度8K、输出300的RAG服务设计预填充池和解码池。
3. Dynamo vs llm-d：为纯Kubernetes商店选择一个，无Python运行时偏好。
4. 计算KV传输成本：70B FP8上4K预填充 = 约500 MB KV。在RDMA 100 GB/s下，传输 = 5毫秒。在TCP 10 GB/s下 = 50毫秒。哪个对你的SLA重要？
5. MoE专家路由改变KV访问模式。解耦如何表现每token激活不同专家的MoE？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 解耦服务 | "拆分预填充/解码" | 每个阶段的独立GPU池 |
| NIXL | "NVIDIA传输" | Dynamo的节点间KV传输（RDMA/TCP） |
| NVIDIA Dynamo | "编排器" | vLLM/SGLang/TRT-LLM的栈之上协调器 |
| llm-d | "Kubernetes原生" | Red Hat + AWS K8s解耦栈 |
| Planner Profiler | "Dynamo自动配置" | 测量工作负载，配置池比率 |
| SLA Planner | "Dynamo策略" | 自动速率匹配预填充:解码以满足SLO |
| `packDomain: rack` | "llm-d拓扑" | 将预填充+解码打包在同一机架以实现快速KV |
| UCCL | "统一集合" | llm-d 0.5网络层，用于扩展到零 |
| MoE专家路由 | "每token专家" | DeepSeek-V3模式；解耦有帮助 |

## 延伸阅读

- [NVIDIA —— 介绍Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA —— Kubernetes上的解耦LLM推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM解耦服务博客](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5发布说明](https://github.com/llm-d/llm-d/releases)