# 11 · 多区域 LLM 服务与 KV 缓存局部性

> 轮询（round-robin）负载均衡对带缓存的 LLM 推理是有实质危害的。一个请求若没有落在持有其前缀的节点上，就要付出完整的预填充（prefill）成本——长提示词在 P50 下约为 800 ms，而命中缓存时仅约 80 ms。在 2026 年，生产环境的标准做法是缓存感知路由器（cache-aware router）（用 Rust 写的 vLLM Router、llm-d router），它消费 KV 缓存事件，并基于前缀哈希（prefix-hash）匹配进行路由。近期研究（GORGO）把跨区域网络延迟显式地纳入了路由目标函数。商业化的「跨区域推理」产品（Bedrock cross-region inference、GKE 多集群网关）把推理当作黑盒处理——它们解决的是可用性，而非首字时延（TTFT）。摩根大通（JPMorgan）和梅奥诊所（Mayo Clinic）在 2024 年 11 月执行 us-east-1 故障切换时耗时约 22 分钟。灾备（DR）的现实是：32% 的 LLM 灾备失败，是因为团队备份了权重，却忘了备份分词器（tokenizer）文件或量化配置。

**类型：** 学习
**语言：** Python（标准库，玩具级前缀缓存感知路由器模拟器）
**前置：** 阶段 17 · 04（vLLM Serving）、阶段 17 · 06（SGLang RadixAttention）
**时长：** 约 60 分钟

## 学习目标

- 解释为什么轮询负载均衡会破坏带缓存的推理，并量化其 TTFT 代价。
- 画出缓存感知路由器的结构图：输入（KV 缓存事件）、算法（前缀哈希匹配）、决胜规则（GPU 利用率）。
- 说出 LLM 灾备失败 32% 的成因（缺失分词器文件 / 量化配置），并给出一份三类文件的灾备清单。
- 区分商业化跨区域产品（Bedrock CRI、GKE 多集群网关）与 KV 感知路由。

## 问题所在

你的服务运行在 us-east-1、us-west-2 和 eu-west-1。你在前面放了一个 ALB 做轮询。生产环境的前缀缓存命中率掉到了 8%。TTFT P50 翻了三倍。你的 vLLM 日志显示每个请求都在付完整的预填充成本。

轮询对无状态服务是最优的。但 LLM 推理在设计上就是有状态的——KV 缓存编码了模型见过的一切。盲目路由，就是把请求路由进了错误的缓存。

另外，你的团队有一份灾备计划。你把模型权重跨区域备份到了 S3。一次区域性宕机来袭；你尝试故障切换；副本却拒绝启动。你忘了 tokenizer.json、量化配置和 RoPE 缩放配置都在另一个你没有同步的存储桶里。

多区域 LLM 服务是一个缓存问题、一个路由问题，以及一个灾备卫生（DR-hygiene）问题——而不是一个负载均衡器问题。

## 核心概念

### 缓存感知路由

请求带着提示词到达。路由器对前缀做哈希（比如前 512 个 token），然后问每个副本「你缓存了这个前缀吗？」。副本在分配和驱逐块（block）时，会把 KV 缓存事件发布到一个发布/订阅（pub/sub）通道上。路由器挑选有匹配的那个副本，如果没有人命中，则回退（fall through）到基于 GPU 利用率的决胜规则。

**vLLM Router**（Rust，2026 production-stack）：订阅 `kv.cache.block_added` 事件，维护一个 前缀哈希 → 副本 的索引，以 O(1) 查找进行路由。无匹配时回退到最小队列深度（least-queue-depth）。

**llm-d router**：同样的模式，原生支持 Kubernetes。通过 ControlPlane API 发布事件。

**SGLang RadixAttention**（阶段 17 · 06）是副本内（intra-replica）的对应物。跨副本（cross-replica）路由严格位于其上游。

### 数据

在 2K-token 提示词、Llama 3.3 70B FP8、H100 上的 TTFT P50：
- 缓存命中（同一副本，前缀常驻）：约 80 ms。
- 缓存未命中（冷预填充）：约 800 ms。

10 倍差距。如果你的路由器在跨副本间能命中 60-80% 的前缀缓存，你就能在 N 个副本的容量下逼近单副本的性能。如果只命中 10%，那就只能逼近朴素扩展（naive scaling）的水平。

### 跨区域有了新的约束——网络延迟

跨区域往返时延（RTT）：
- us-east-1 ↔ us-west-2：约 65 ms。
- us-east-1 ↔ eu-west-1：约 75 ms。
- us-east-1 ↔ ap-southeast-1：约 220 ms。

如果路由把一个来自 us-east-1 的请求送到 ap-southeast-1 上的热点前缀，那么省下的预填充时间（800 → 80 ms）会被 440 ms 的往返时延彻底淹没。GORGO（2026 年研究）把这一点显式化了——要联合最小化 `prefill_time + network_latency`，而不是只看预填充。通常的答案是：保持区域内路由，除非遇到预填充占主导的、数 MB 量级的超大前缀。

### 商业化的「跨区域推理」在这里帮不上忙

AWS Bedrock cross-region inference 会在容量吃紧时自动把请求路由到其他区域。它优化的是可用性，而非 TTFT，并把推理当作黑盒。GKE 多集群网关（Multi-Cluster Gateway）也是一样——做的是服务级故障切换，对 KV 缓存毫无感知。

即便用了这些产品，你仍然需要一个应用层的缓存感知路由器。它们处理的是「us-east-1 着火了」这种情况。缓存感知路由处理的是 TTFT 这种情况。

### 灾备卫生——32% 文件缺失问题

被广泛引用的 2026 年统计数据：32% 的 LLM 灾备失败，是因为团队备份了权重，却忘了：

- `tokenizer.json` 或 `tokenizer.model`
- 量化配置（`quantize_config.json`、AWQ scales、GPTQ zero-points）
- 模型专属配置（RoPE 缩放、注意力掩码、聊天模板）
- 引擎配置（`vllm_config.yaml`、采样默认值、LoRA 适配器清单）

解决办法是一份「三类文件」最小灾备清单（DR manifest）：

1. HF 模型仓库下的所有文件（权重 + 配置 + 分词器）。
2. 引擎专属的服务配置。
3. 部署清单（K8s YAML、Dockerfile、依赖锁文件）。

此外：每季度做一次灾备演练。摩根大通在 2024 年 11 月的 us-east-1 演练之所以能在 22 分钟内恢复，正是因为预案经过了排练。

### 数据驻留是正交问题

欧盟客户的 PHI 不能离开欧盟。如果你的缓存感知路由器为了匹配前缀，把一个源自巴黎的请求发往 us-east-1，那么无论 TTFT 收益如何，你都违反了 GDPR。在为缓存做优化之前，先按驻留边界对路由器做分区。

### 你应当记住的数据

- 缓存命中 vs 未命中的 TTFT 差距：约 10 倍（2K 提示词下 80 ms vs 800 ms）。
- 美欧之间跨区域 RTT：约 75 ms。
- 灾备失败：32% 缺失分词器/量化配置。
- 摩根大通 us-east-1 故障切换（2024 年 11 月）：22 分钟（SLA 为 30 分钟）。

## 动手用

`code/main.py` 在一个多区域工作负载上模拟了三种路由策略（轮询、缓存感知区域内、缓存感知全局）。它会报告缓存命中率、TTFT P50/P99，以及跨区域账单。

## 交付它

本课产出 `outputs/skill-multi-region-router.md`。给定区域、驻留约束和 SLA，设计一份路由方案。

## 练习

1. 运行 `code/main.py`。在 75 ms RTT 的前提下，提示词长度达到多少时，跨区域路由才会胜过仅本地路由？
2. 你的缓存命中率从 70% 掉到了 12%。诊断三种可能的原因，以及能够分别证实每种原因的可观测指标。
3. 为一个用 vLLM 服务、带 5 个 LoRA 适配器的 70B AWQ 量化模型设计一份灾备清单。列出每一个文件和配置。
4. 论证 Bedrock cross-region inference 对一家有严格 TTFT SLO 的金融科技公司而言是否「足够」。引用具体行为来支撑你的观点。
5. 一个源自巴黎的请求匹配上了 us-east-1 中的某个前缀。你会路由它吗？写出这条策略。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|----------------|------------------------|
| 缓存感知路由（Cache-aware routing） | 「智能负载均衡」 | 基于前缀哈希匹配，路由到持有 KV 缓存的副本 |
| KV 缓存事件（KV-cache events） | 「缓存 pub-sub」 | 副本发布块的添加/驱逐;路由器据此建立索引 |
| 前缀哈希（Prefix hash） | 「缓存键」 | 对前 N 个 token 做哈希，作为路由器查找键 |
| GORGO | 「跨区域路由研究」 | arXiv 2602.11688;将网络延迟作为显式项 |
| 跨区域推理（Cross-region inference） | 「Bedrock CRI」 | AWS 产品;做可用性故障切换，无 TTFT 感知 |
| 灾备清单（DR manifest） | 「那份备份列表」 | 恢复所需的每一个文件——不只是权重 |
| 数据驻留（Data residency） | 「GDPR 边界」 | 关于哪个区域可以看到用户数据的法律约束 |
| RTT | 「往返时延」 | 网络延迟;美欧 75 ms，美亚太 220 ms |
| LLM 感知负载均衡（LLM-aware LB） | 「缓存命中型 LB」 | 作为一个产品品类的缓存感知路由器 |

## 延伸阅读

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — 带网络延迟项的跨区域 KV 缓存复用。
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — 可用性故障切换文档。
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — 缓存感知路由器源码。
