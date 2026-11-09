#  NVIDIA 动机和 llm-d

> 预填是计算的,解码是记忆的. 运行两个在同一GPU浪费一个资源. 分类将它们分为单独的池,并通过NIXL (RDMA/InfiniBand或TCP fallback) 传输它们之间的KV缓存. 据NVIDIA Dynamo (GTC 2025宣布, 1.0 GA) 位于vLLM/SGLang/TRT-LLM 以上,其规划器预示器+SLA规划器自动率匹配预填:解码比率以满足SLO. 据NVIDIA发布,在这个球场的吞吐量增长  developer.nvidia.com (2025-06) 显示了 GB200 NVL72 + Dynamo 中度延迟模式上的DeepSeek-R1 MoE的 ~6倍改善,而 Dynamo 产品页面 (developer.nvidia.com,未有日期) 则在 GB300 NVL72 + Dynamo vs Hopper 上宣传到50倍的吞吐量. 对于"30x"的数字,这是全集黑+迪纳摩+深度搜索R1报告的社区总数;我们没有找到一个准确的30x的原始来源, 作为独立服务,每个角色的HPA. 增加了层次性KV脱载,缓存意识的LoRA路由,UCCL网络,规模到零. 经济:多个客户披露的内部推广表明3040%的节省$2M-class inference spend (i.e., $转换从定位分类到与Dynamo分类的定位分类分类的服务时,$2M→$600-800K 图是一个内部复合图,没有单个发表的案例研究使用它作为一个大小顺序的,不是一个参考引用.短提示 (<512代币,短输出) 不证明转移成本.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## 学习目标

- 解释为什么预填和解码具有不同的最佳GPU配置,并量化在配合下的废物.
- 图表分类结构:预填池,解码池,通过NIXL转移KV,路由器.
- 描述分类没有效果的条件 (短提示,短输出).
- 区分NVIDIA Dynamo (上方堆) 和 llm-d (Kubernetes-原生) 并将每个设备与运营环境相匹配.

## 问题

在 8 H100 上运行Llama 3.3 70B. 在混合工作负载 (长提示+短输出) 下,GPU 在解码过程中停滞不前,因为大部分计算都花在预填充上.在不同的工作负载下 (短提示+长输出),相反发生.

预算影响:GPU时间的20-40%浪费在错误的资源上.你购买H100计算器运行内存绑定解码,或者购买H100HBM带宽运行计算绑定预填.这两者都是昂贵的浪费.

分类分开预填和解码,分开为每个瓶尺寸的单独池.KV缓存通过高带宽互联网从预填池转移到解码池.

## 概念

### 瓶的原因

**Prefill**运行变压器在一个前进中完成输入提示.矩阵乘法占主导地位;计算.H100 FP8提供了2000 TFLOPS的有用吞吐量.批量效率很好.

**Decode**一次生成一个代币,每次重量都会读取. 记忆带宽限制. HBM3 给出3 TB/s. 批量效率只有在高同步时才好.

设置它们:您购买了针对两者都优化的GPU.H100对两者都很好,但成本都是一样的.在规模上,您希望在H100/计算重量上预填池;在H200/内存重量上解码池,或具有积极的量化.

### 建筑

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

尼克斯是NVIDIA的节点间运输. 使用RDMA/InfiniBand,如果可用,TCP倒退.传输延迟是真实的通常20-80ms为KV缓存的4K-代币提示70B FP8.这就是为什么短提示不合理分类:转移税超过节约.

### 迪纳摩vsIIM-D

**NVIDIA Dynamo**总体的数据:
- 作为乐团主持人,他坐在vLLM,SGLang,TRT-LLM上.
- 规划器 预定器测量工作负载,SLA规划器自动配置预填:解码比例.
- 芯,Python可扩展性.
- 通过性增长:NVIDIA报告 GB200 NVL72 + Dynamo 中等延迟模式中的DeepSeek-R1 MoE的6x (developer.nvidia.com, 2025-06);社区报告的"高达30x"在全黑+dynamo+DeepSeek-R1堆缺乏单一的首要来源,应该被视为方向性.
- GB300 NVL72 + Dynamo:每一个 Dynamo 产品页面 (developer.nvidia.com,未有日期) 均可达到50倍 MoE 吞吐量与 Hopper.

**llm-d**其他类型:
- 预填/解码/路由器作为独立的Kubernetes服务.
- 按角色 HPA 配备队列深度 (预填) /KV利用 (解码) 信号.
- `topologyConstraint packDomain: rack`包装预填+解码单击在同一架上用于高带宽KV传输.
- 实现0.5 (2026):级别KV脱载,缓存意识的LoRA路由,UCCL网络,规模到零.

如果想要一个管理的堆上方管弦仪,使用IIM-d,如果你想要古伯尼特斯原始人,

### 经济学

内部复合物 (没有发表的单个案例研究大度顺序):

- 根据每年200万美元的推断,
- 转换为与迪纳摩分类.
- 要求量相同,延迟SLA相同.
- 报告的节省: $600K–$平均年产量:800K (减少3040%).
- 没有新的硬件.

我们从多个客户披露而不是单个可引用的案例研究中合成这一数字;最近发布的数据点是Baseten的2倍更快的TTFT / 通过Dynamo KV路由的61%更高的吞吐量 (baseten.co, 2025-10), 节省的原因是每个池的尺寸都适合;预填重工作负载 (RAG含8K+预写) 比平衡的更有利.

### 什么时候 NOT 分类

- 提示 < 512 代币和输出 < 200 代币:转让税占据利.
- 小集群 (<4GPU):池多样性不足.
- 团队不能使用两个GPU池,每个角色的扩展:
- 没有 RDMA 结构:TCP转让税更高.

### 路由器与第17期 · 11期集成

分类路由器是KV缓存意识 (阶段17 · 11). 请求落在一个装配前的解码池上,如果没有匹配,它流动预填 →解码.击率和分类组合,缓存意识的路由器决定是否需要新的预填.

### 黑尔的MoE是真正的数字所在的地方

GB300 NVL72 + Dynamo显示Hopper基线上MoE吞吐量50倍.MoE专家路由在预填充时计算重,但在解码时内存重 (专家缓存),因此分类是双赢.2026年边界模型是MoE主导 (DeepSeek-V3,未来的GPT-5变体).

### 你应该记住的数字

根据"NVIDIA"和"推断堆"的数据,每季度都会更新结果.

- 在GB200 NVL72 + Dynamo上 DeepSeek-R1: ~6x吞吐量与中等延迟模式的基线 (developer.nvidia.com, 2025-06);在全集的Blackwell + Dynamo堆上,社区"高达30x"的索赔是没有单个主要来源的方向聚合物.
- GB300 NVL72 + Dynamo:最大的MoE吞吐量为50倍对Hopper (开发者.nvidia.com,未有日期).
- 储蓄 (内部复合,不包括单个案例研究): $600-800K/year off a $总计每年支出2万美元,
- 分类门:提示>512个令牌 +输出>200个令牌.
- 通过NIXL进行KV传输:为70B FP8的4K提示KV,20-80ms.

```figure
prefill-decode-split
```

## 用它

`code/main.py`报告产量,每次请求成本和快速长度交叉.

## 运送它

这一课产生了`outputs/skill-disaggregation-decider.md`鉴于工作量和集群,决定是否分类.

## 运动

1. 跑步`code/main.py`分离比定位更长?
2. 设计预填池和解码池,为RAG服务设计P99预写长度8K,输出300
3. 迪纳莫vsIIM-D:选择一个纯库伯内特斯店,没有Python运行时间的偏好.
4. 在RDMA100GB/s时,转移 = 5ms.在TCP10GB/s时 = 50ms.对于你的SLA有什么关系?
5. 如何分类对每个代币激活不同的专家进行行为?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | Separate GPU pools for each phase |
| NIXL | "NVIDIA transport" | Dynamo's inter-node KV transfer (RDMA/TCP) |
| NVIDIA Dynamo | "the orchestrator" | Stack-above coordinator for vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Red Hat + AWS K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | Measures workload, configures pool ratios |
| SLA Planner | "Dynamo policy" | Auto-rate-matches prefill:decode to meet SLOs |
| `packDomain: rack` | "llm-d topology" | Pack prefill+decode on same rack for fast KV |
| UCCL | "unified collective" | llm-d 0.5 networking layer for scale-to-zero |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern; disaggregation helps |

## 进一步阅读

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
