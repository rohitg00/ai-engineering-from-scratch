# 多区域 LLM 服务和 KV 缓存局部性

> 轮询负载均衡对缓存 LLM 推理主动有害。未落在持有其前缀的节点上的请求支付完整 prefill 成本——在长提示时大约 800 ms P50 对比缓存命中的约 80 ms。在 2026 年，生产模式是缓存感知路由器（Rust 中的 vLLM Router、llm-d router），它使用 KV 缓存事件并在前缀哈希匹配上路由。最近的研究（GORGO）使跨区域网络延迟成为路由目标中的显式项。商业"跨区域推理"产品（Bedrock 跨区域推理、GKE 多集群网关）将推理视为不透明的——它们处理可用性，而不是 TTFT。摩根大通和梅奥诊所在 2024 年 11 月以约 22 分钟运行 us-east-1 故障转移。DR 现实：32% 的 LLM DR 故障是因为团队备份了权重但忘记了 tokenizer 文件或量化配置。

**类型：** 学习
**语言：** Python（标准库，简单的前缀缓存感知路由器模拟器）
**先修要求：** 阶段 17 · 04（vLLM 服务）、阶段 17 · 06（SGLang RadixAttention）
**时间：** 约 60 分钟

## 学习目标

- 解释为什么轮询负载均衡破坏缓存推理并量化 TTFT 惩罚。
- 绘制缓存感知路由器图：输入（KV 缓存事件）、算法（前缀哈希匹配）、决胜局（GPU 利用率）。
- 说出 LLM 的 32% DR 故障驱动因素（缺少 tokenizer 文件 / 量化配置）并陈述三文件 DR 检查清单。
- 区分商业跨区域产品（Bedrock CRI、GKE Multi-Cluster Gateway）与 KV 感知路由。

## 问题

你的服务在 us-east-1、us-west-2 和 eu-west-1 中运行。你在前面放置了一个带有轮询的 ALB。生产中的前缀缓存命中率降至 8%。TTFT P50 增加两倍。你的 vLLM 日志显示每个请求都在支付完整 prefill 成本。

轮询对于无状态服务是最优的。LLM 推理在设计上是有状态的——KV 缓存编码模型看到的一切。盲目路由是路由到错误的缓存。

另外，你的团队有一个 DR 计划。你将模型权重备份到 S3 跨区域。区域中断发生；你尝试故障转移；副本拒绝启动。你忘记了 tokenizer.json、量化配置和 RoPE 缩放配置在单独你未同步的存储桶中。

多区域 LLM 服务是一个缓存问题、一个路由问题和一个 DR 卫生问题——而不是负载均衡器问题。

## 概念

### 缓存感知路由

请求带着提示到达。路由器哈希前缀（比如前 512 个 token）；它询问每个副本"你是否缓存了这个前缀？"副本在分配和驱逐块时在发布/订阅通道上发布 KV 缓存事件。路由器选择匹配的副本，如果没有匹配则回退到基于 GPU 利用率的决胜局。

**vLLM Router**（Rust，2026 年生产栈）：订阅 `kv.cache.block_added` 事件，维护前缀哈希 → 副本索引，使用 O(1) 查找进行路由。当没有匹配时回退到最小队列深度。

**llm-d router**：相同模式，Kubernetes 原生。通过 ControlPlane API 发布事件。

**SGLang RadixAttention**（阶段 17 · 06）是副本内等效项。跨副本路由是严格上游的。

### 数字

在 2K token 提示上的 TTFT P50，Llama 3.3 70B FP8，H100：

- 缓存命中（相同副本，前缀驻留）：约 80 ms。
- 缓存未命中（冷 prefill）：约 800 ms。

10 倍差距。如果你的路由器在副本之间命中 60-80% 的前缀缓存，你在 N 副本容量下近似单个副本性能。如果它命中 10%，你近似朴素扩缩。

### 跨区域有一个新约束——网络延迟

区域间 RTT：

- us-east-1 ↔ us-west-2：约 65 ms。
- us-east-1 ↔ eu-west-1：约 75 ms。
- us-east-1 ↔ ap-southeast-1：约 220 ms。

如果路由将来自 us-east-1 的请求发送到 ap-southeast-1 中的热前缀，保存的 prefill（800 → 80 ms）被 440 ms 往返淹没。GORGO（2026 年研究）使这一点显式——最小化 `prefill_time + network_latency` 联合，而不是单独的 prefill。通常答案是保持路由区域性的，除非在 prefill 占主导的巨大多 MB 前缀上。

### 商业"跨区域推理"对此没有帮助

AWS Bedrock 跨区域推理在容量压力下自动将请求路由到其他区域。它优化可用性，而不是 TTFT，并将推理视为不透明的。GKE Multi-Cluster Gateway 是相同的——服务级故障转移，没有 KV 缓存感知。

即使使用这些，你仍然需要应用层缓存感知路由器。它们处理"us-east-1 着火了"的情况。缓存感知路由处理 TTFT 情况。

### DR 卫生——32% 缺少文件问题

广泛引用的 2026 年统计：32% 的 LLM DR 故障发生是因为团队备份了权重但忘记了：

- `tokenizer.json` 或 `tokenizer.model`
- 量化配置（`quantize_config.json`、AWQ 缩放、GPTQ 零点）
- 模型特定配置（RoPE 缩放、注意力掩码、聊天模板）
- 引擎配置（`vllm_config.yaml`、采样默认值、LoRA 适配器清单）

修复是三文件最小 DR 清单：

1. HF 模型仓库下的所有文件（权重 + 配置 + tokenizer）。
2. 引擎特定服务配置。
3. 部署清单（K8s YAML、Dockerfile、依赖锁定）。

加上：每季度运行一次 DR 演练。摩根大通 us-east-1 演练在 2024 年 11 月仅达到 22 分钟恢复，仅因为演练手册是排练过的。

### 数据驻留是正交的

欧盟客户 PHI 不能离开欧盟。如果你的缓存感知路由器将巴黎发起的请求发送到 us-east-1 以进行前缀匹配，你违反了 GDPR，无论 TTFT 增益如何。在针对缓存优化之前，按驻留边界分区路由器。

### 你应该记住的数字

- 缓存命中 vs 未命中 TTFT 差距：约 10 倍（在 2K 提示上 80 ms vs 800 ms）。
- 区域间 RTT 美国-欧盟：约 75 ms。
- DR 故障：32% 缺少 tokenizer/量化配置。
- 摩根大通 us-east-1 故障转移 2024 年 11 月：22 分钟（30 分钟 SLA）。

## 使用它

`code/main.py` 在多区域工作负载上模拟三种路由策略（轮询、缓存感知区域、缓存感知全局）。报告缓存命中率、TTFT P50/P99 和跨区域账单。

## 交付它

本课生成 `outputs/skill-multi-region-router.md`。给定区域、驻留约束和 SLA，设计路由计划。

## 练习

1. 运行 `code/main.py`。在给定 75 ms RTT 的情况下，跨区域路由在何种提示长度下击败仅本地路由？
2. 你的缓存命中率从 70% 降至 12%。诊断三个可能的原因以及确认每个原因的可观察量。
3. 为在带有 5 个 LoRA 适配器的 vLLM 中服务的 70B AWQ 量化模型设计 DR 清单。列出每个文件和配置。
4. 论证 Bedrock 跨区域推理对于具有严格 TTFT SLO 的金融科技是否"足够"。引用特定行为。
5. 巴黎发起的请求匹配 us-east-1 中的前缀。你是否路由它？编写策略。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Cache-aware routing | "智能 LB" | 在前缀哈希匹配上路由到 KV 缓存持有副本 |
| KV-cache events | "缓存发布-订阅" | 副本发布块添加/驱逐；路由器索引 |
| Prefix hash | "缓存键" | 用作路由器查找的前 N 个 token 的哈希 |
| GORGO | "跨区域路由研究" | arXiv 2602.11688；网络延迟作为显式项 |
| Cross-region inference | "Bedrock CRI" | AWS 产品；可用性故障转移，而不是 TTFT 感知 |
| DR manifest | "备份列表" | 恢复所需的每个文件——不仅仅是权重 |
| Data residency | "GDPR 边界" | 关于哪个区域看到用户数据的法律约束 |
| RTT | "往返时间" | 网络延迟；75 ms 美国-欧盟，220 ms 美国-亚太 |
| LLM-aware LB | "缓存命中 LB" | 作为产品类别的缓存感知路由器 |

## 延伸阅读

- [BentoML——多云和跨区域推理](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv——GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1)——带有网络延迟项的跨区域 KV 缓存重用。
- [TianPan——多区域 LLM 服务缓存局部性](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock 跨区域推理](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)——可用性故障转移文档。
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack)——缓存感知路由器源代码。
