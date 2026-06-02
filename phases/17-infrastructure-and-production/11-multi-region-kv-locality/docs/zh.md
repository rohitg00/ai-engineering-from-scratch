# 多区域 LLM 服务与 KV cache 局部性（Multi-Region LLM Serving and KV Cache Locality）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 对于带缓存的 LLM 推理（inference），轮询（round-robin）负载均衡是有害的。一个请求如果没有落到持有其前缀的节点上，就要付出完整的 prefill 代价 —— 长 prompt 上 P50 大约 800 ms，而命中缓存只需约 80 ms。2026 年的生产范式是 cache-aware router（Rust 实现的 vLLM Router、llm-d router）：消费 KV cache 事件，按 prefix-hash 匹配进行路由。最近的研究（GORGO）把跨区域网络延迟（latency）作为路由目标里的显式项。商业化的「跨区域推理」产品（Bedrock cross-region inference、GKE 多集群网关）把推理当成黑盒 —— 它们解决的是可用性，不是 TTFT。摩根大通和梅奥诊所在 2024 年 11 月演练 us-east-1 故障切换，用了大约 22 分钟。DR（容灾）的现实是：32% 的 LLM DR 失败是因为团队备份了权重，却忘了 tokenizer 文件或量化（quantization）配置。

**Type:** Learn
**Languages:** Python (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 解释为什么轮询负载均衡会破坏带缓存的推理，并量化 TTFT 的代价。
- 画出 cache-aware router 的结构图：输入（KV cache 事件）、算法（prefix-hash 匹配）、tie-breaker（GPU 利用率）。
- 说出 LLM 上 32% DR 失败的元凶（缺失的 tokenizer 文件 / 量化配置），并给出三文件 DR 清单。
- 区分商业化的跨区域产品（Bedrock CRI、GKE 多集群网关）与 KV-aware 路由。

## 问题（The Problem）

你的服务跑在 us-east-1、us-west-2 和 eu-west-1。前面挂一个 ALB 做轮询。生产环境里前缀缓存命中率掉到 8%。TTFT P50 翻三倍。vLLM 日志显示每个请求都在付完整的 prefill 代价。

轮询对无状态服务是最优的。LLM 推理天生有状态 —— KV cache 编码了模型见过的一切。盲路由就是路到错的缓存上。

另一边，你的团队有 DR 计划。你把模型权重跨区域备份到 S3。地区故障来了，你尝试切换；副本却拒绝启动。你忘了 `tokenizer.json`、量化配置、RoPE scaling 配置都在另一个你没同步的桶里。

多区域 LLM 服务是缓存问题、路由问题、DR 卫生问题 —— 不是负载均衡器问题。

## 概念（The Concept）

### 缓存感知路由（Cache-aware routing）

请求带着 prompt 进来。Router 对前缀做 hash（比如前 512 个 token）；它问每个副本「你缓存了这个前缀吗？」。副本在分配和淘汰块时，把 KV cache 事件发布到 pub/sub 通道上。Router 选有匹配的副本，没人匹配就退化到基于 GPU 利用率的 tie-breaker。

**vLLM Router**（Rust，2026 production-stack）：订阅 `kv.cache.block_added` 事件，维护一个 prefix-hash → replica 索引，O(1) 查找路由。无匹配时退化到最短队列深度策略。

**llm-d router**：同样的模式，Kubernetes 原生。通过 ControlPlane API 发布事件。

**SGLang RadixAttention**（Phase 17 · 06）是副本内的对应物。跨副本路由严格在它的上游。

### 数字

2K-token prompt、Llama 3.3 70B FP8、H100 上的 TTFT P50：
- 缓存命中（同副本，前缀驻留）：~80 ms。
- 缓存未命中（冷 prefill）：~800 ms。

10 倍差距。如果你的 router 在跨副本上能拿到 60–80% 的前缀缓存命中，那你在 N 副本容量下逼近单副本的性能。命中率只有 10%，那就接近朴素扩容。

### 跨区域有个新约束 —— 网络延迟

跨区域 RTT：
- us-east-1 ↔ us-west-2：~65 ms。
- us-east-1 ↔ eu-west-1：~75 ms。
- us-east-1 ↔ ap-southeast-1：~220 ms。

如果路由把请求从 us-east-1 送到 ap-southeast-1 的热前缀，省下的 prefill（800 → 80 ms）会被 440 ms 的往返时间淹没。GORGO（2026 年的研究）把这一点写显式 —— 联合最小化 `prefill_time + network_latency`，而不是只看 prefill。通常的答案是：路由保持在区域内，除非是巨型多 MB 前缀，prefill 才占主导。

### 商业化的「跨区域推理」在这里帮不上忙

AWS Bedrock cross-region inference 在容量吃紧时自动把请求路由到其他区域。它优化的是可用性，不是 TTFT，并且把推理当黑盒处理。GKE Multi-Cluster Gateway 同理 —— 服务级故障切换，对 KV cache 一无所知。

即使你用了它们，仍然需要一个应用层的 cache-aware router。它们处理「us-east-1 烧起来了」这种情况。Cache-aware 路由处理 TTFT 这一类。

### DR 卫生 —— 32% 缺文件问题

被广泛引用的 2026 年数据：32% 的 LLM DR 失败发生是因为团队备份了权重，却忘了：

- `tokenizer.json` 或 `tokenizer.model`
- 量化配置（`quantize_config.json`、AWQ scales、GPTQ zero-points）
- 模型特定配置（RoPE scaling、attention masks、chat templates）
- 引擎配置（`vllm_config.yaml`、采样默认值、LoRA adapter 清单）

修复办法是一份三文件最小 DR 清单：

1. HF 模型仓里的全部文件（权重 + 配置 + tokenizer）。
2. 引擎特定的服务配置。
3. 部署清单（K8s YAML、Dockerfile、依赖锁文件）。

外加：每季度做一次 DR 演练。摩根大通在 2024 年 11 月的 us-east-1 演练只用了 22 分钟恢复，原因就是 playbook 被反复演过。

### 数据驻留是正交的

欧盟客户的 PHI 不能离开欧盟。如果你的 cache-aware router 把巴黎发出的请求送到 us-east-1 去匹配前缀，无论 TTFT 提升多少，你都违反了 GDPR。在为缓存做优化之前，先按驻留边界把 router 切分开。

### 你应该记住的数字

- 缓存命中 vs 未命中的 TTFT 差距：~10x（2K prompt 上 80 ms vs 800 ms）。
- 跨区域 RTT 美欧间：~75 ms。
- DR 失败：32% 漏掉 tokenizer / 量化配置。
- 摩根大通 2024 年 11 月 us-east-1 故障切换：22 分钟（30 分钟 SLA）。

## 用起来（Use It）

`code/main.py` 在多区域工作负载上模拟三种路由策略（轮询、区域内 cache-aware、全局 cache-aware）。报告缓存命中率、TTFT P50/P99 和跨区域账单。

## 上线部署（Ship It）

本节产出 `outputs/skill-multi-region-router.md`。给定区域、驻留约束和 SLA，设计一份路由方案。

## 练习（Exercises）

1. 跑一下 `code/main.py`。在 75 ms RTT 下，prompt 长到多少时跨区域路由会优于纯本地路由？
2. 你的缓存命中率从 70% 掉到 12%。给出三种可能原因，以及每种原因可以通过哪些可观测指标确认。
3. 为一个 5 个 LoRA adapter、AWQ 量化的 70B 模型在 vLLM 上设计一份 DR 清单。列出每个文件和配置。
4. 论证 Bedrock cross-region inference 对一家有严格 TTFT SLO 的金融科技公司是否「够用」。引用具体行为。
5. 一个巴黎来源的请求匹配上了 us-east-1 的一个前缀。你路不路？把策略写出来。

## 关键术语（Key Terms）

| 术语 | 大家是怎么说的 | 它实际是什么 |
|------|----------------|------------------------|
| Cache-aware routing | 「smart LB」 | 按 prefix-hash 匹配，路到持有 KV cache 的副本 |
| KV cache events | 「cache pub-sub」 | 副本发布块的添加/淘汰；router 建索引 |
| Prefix hash | 「cache key」 | 前 N 个 token 的 hash，作为 router 查表键 |
| GORGO | 「跨区域路由研究」 | arXiv 2602.11688；网络延迟作为显式项 |
| Cross-region inference | 「Bedrock CRI」 | AWS 产品；可用性故障切换，对 TTFT 无感知 |
| DR manifest | 「备份清单」 | 恢复所需的每个文件 —— 不只是权重 |
| Data residency | 「GDPR 边界」 | 关于哪个区域可以看到用户数据的法律约束 |
| RTT | 「往返时间」 | 网络延迟；美欧 75 ms，美亚太 220 ms |
| LLM-aware LB | 「命中型 LB」 | Cache-aware router 作为一个产品类别 |

## 延伸阅读（Further Reading）

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — 把网络延迟纳入考量的跨区域 KV cache 复用。
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — 可用性故障切换文档。
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — cache-aware router 源码。
