# 多区域 LLM 服务与 KV 缓存局部性

> 轮询负载均衡对缓存式 LLM 推理有实际危害。一个未落在持有其前缀的节点上的请求需要支付完整的 prefill 成本——在长提示词上 P50 大约 800 ms,而缓存命中仅需约 80 ms。2026 年的生产模式是缓存感知路由器(Rust 实现的 vLLM Router、llm-d router),它消费 KV 缓存事件并按前缀哈希匹配路由。近期研究(GORGO)将跨区域网络延迟作为路由目标函数中的显式项。商业化的“跨区域推理”服务(Bedrock cross-region inference、GKE multi-cluster gateways)将推理视为黑盒——它们只处理可用性,不处理 TTFT。JPMorgan 和 Mayo Clinic 在 2024 年 11 月的 us-east-1 故障切换耗时约 22 分钟。容灾(DR)的现实是:32% 的 LLM 容灾失败源于团队备份了权重却遗漏了 tokenizer 文件或量化配置。

**Type:** Learn
**Languages:** Python (标准库,玩具级前缀缓存感知路由器模拟器)
**Prerequisites:** Phase 17 · 04 (vLLM Serving)、Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 分钟

## 学习目标

- 解释轮询负载均衡为何会破坏缓存式推理,并量化 TTFT 损失。
- 绘制缓存感知路由器的图示:输入(KV 缓存事件)、算法(前缀哈希匹配)、决胜条件(GPU 利用率)。
- 说出 LLM 中 32% 容灾失败的驱动因素(缺失 tokenizer 文件/量化配置),并给出一份三文件容灾清单。
- 区分商业跨区域服务(Bedrock CRI、GKE Multi-Cluster Gateway)与 KV 感知路由。

## 问题

你的服务运行在 us-east-1、us-west-2 和 eu-west-1。你在前面放了一个使用轮询的 ALB。生产环境中的前缀缓存命中率跌至 8%。TTFT P50 翻了三倍。你的 vLLM 日志显示每个请求都在支付完整的 prefill 成本。

轮询对无状态服务是最优的。LLM 推理在设计上就是有状态的——KV 缓存编码了模型见过的所有内容。盲目路由就是路由到错误的缓存。

另一方面,你的团队有一套容灾计划。你将模型权重跨区域备份到 S3。一次区域性故障发生;你尝试切换;副本拒绝启动。你忘了 tokenizer.json、量化配置和 RoPE 缩放配置存放在一个你没有同步的独立存储桶中。

多区域 LLM 服务是一个缓存问题、一个路由问题和一个容灾规范问题——而不是负载均衡器问题。

## 概念

### 缓存感知路由

请求带着提示词到达。路由器对前缀(比如说前 512 个 token)做哈希;它询问每个副本“你缓存了这个前缀吗?”。副本在分配和驱逐块时通过 pub/sub 频道发布 KV 缓存事件。路由器选择有匹配的副本;如果无人匹配,则回退到基于 GPU 利用率的决胜机制。

**vLLM Router**(Rust,2026 production-stack):订阅 `kv.cache.block_added` 事件,维护前缀哈希 → 副本的索引,以 O(1) 查找进行路由。无匹配时回退到最小队列深度。

**llm-d router**:同样的模式,Kubernetes 原生。通过 ControlPlane API 发布事件。

**SGLang RadixAttention**(Phase 17 · 06)是副本内部的等价物。跨副本路由严格位于其上游。

### 数字

TTFT P50,2K token 提示词,Llama 3.3 70B FP8,H100:
- 缓存命中(同一副本,前缀驻留):~80 ms。
- 缓存未命中(冷启动 prefill):~800 ms。

10 倍差距。如果你的路由器在跨副本间达到 60–80% 的前缀缓存命中率,你就能在 N 副本容量下逼近单副本性能。如果只达到 10%,你就是天真的水平扩展。

### 跨区域有了新约束——网络延迟

区域间 RTT:
- us-east-1 ↔ us-west-2:~65 ms。
- us-east-1 ↔ eu-west-1:~75 ms。
- us-east-1 ↔ ap-southeast-1:~220 ms。

如果路由将一个来自 us-east-1 的请求送往 ap-southeast-1 的热前缀,节省的 prefill(800 → 80 ms)会被 440 ms 的往返延迟淹没。GORGO(2026 研究)将其显式化——联合最小化 `prefill_time + network_latency`,而不是仅最小化 prefill。通常答案是除超大多 MB 前缀(prefill 占主导)外,保持区域性路由。

### 商业“跨区域推理”在这里帮不上忙

AWS Bedrock cross-region inference 在容量压力下自动将请求路由到其他区域。它优化的是可用性而非 TTFT,并将推理视为黑盒。GKE Multi-Cluster Gateway 也是一样——服务级故障切换,不感知 KV 缓存。

即使使用这些服务,你仍然需要一个应用层的缓存感知路由器。它们处理“us-east-1 起火了”的情况。缓存感知路由处理 TTFT 情况。

### 容灾规范——32% 缺失文件问题

广为引用的 2026 年统计:32% 的 LLM 容灾失败是因为团队备份了权重却遗漏了:

- `tokenizer.json` 或 `tokenizer.model`
- 量化配置(`quantize_config.json`、AWQ scales、GPTQ zero-points)
- 模型特定配置(RoPE 缩放、注意力掩码、聊天模板)
- 引擎配置(`vllm_config.yaml`、采样默认值、LoRA adapter 清单)

解决方案是最低三文件的容灾清单:

1. HF 模型仓库下的所有文件(权重 + 配置 + tokenizer)。
2. 引擎特定的服务配置。
3. 部署清单(K8s YAML、Dockerfile、依赖锁定文件)。

另外:每季度运行一次容灾演练。JPMorgan 的 us-east-1 演练在 2024 年 11 月达到 22 分钟恢复,只因演练手册被反复排练过。

### 数据驻留是正交的

EU 客户的 PHI 不得离开 EU。如果你的缓存感知路由器为了前缀匹配将一个源自巴黎的请求发送到 us-east-1,无论 TTFT 收益如何,你都违反了 GDPR。在为缓存优化之前,先按驻留边界划分路由器。

### 你应该记住的数字

- 缓存命中与未命中的 TTFT 差距:~10 倍(2K 提示词上 80 ms 对 800 ms)。
- 跨区域 RTT 美国到欧洲:~75 ms。
- 容灾失败:32% 缺失 tokenizer/量化配置。
- JPMorgan 2024 年 11 月 us-east-1 故障切换:22 分钟(SLA 为 30 分钟)。

```figure
cache-aware-router
```

## 动手实践

`code/main.py` 在多区域工作负载上模拟三种路由策略(轮询、区域级缓存感知、全局缓存感知)。报告缓存命中率、TTFT P50/P99 以及跨区域账单。

## 发布

本课产出 `outputs/skill-multi-region-router.md`。给定区域、驻留约束和 SLA,设计一个路由方案。

## 练习

1. 运行 `code/main.py`。在 75 ms RTT 下,提示词达到什么长度时跨区域路由会优于仅本地路由?
2. 你的缓存命中率从 70% 降至 12%。诊断三个可能的原因以及能确认每个原因的观测量。
3. 为一个在 vLLM 中服务、带 5 个 LoRA adapter 的 70B AWQ 量化模型设计容灾清单。列出每个文件和配置。
4. 论证 Bedrock cross-region inference 对一个有严格 TTFT SLO 的金融科技公司是否“足够”。引用具体行为。
5. 一个源自巴黎的请求匹配到 us-east-1 中的前缀。你会路由它吗?写出策略。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 缓存感知路由 | “智能 LB” | 按前缀哈希匹配路由到持有 KV 缓存的副本 |
| KV 缓存事件 | “缓存发布订阅” | 副本发布块的添加/驱逐;路由器建立索引 |
| 前缀哈希 | “缓存键” | 前 N 个 token 的哈希,用作路由器查找键 |
| GORGO | “跨区域路由研究” | arXiv 2602.11688;网络延迟作为显式项 |
| 跨区域推理 | “Bedrock CRI” | AWS 产品;可用性故障切换,不感知 TTFT |
| 容灾清单 | “备份列表” | 恢复所需的每个文件——不仅仅是权重 |
| 数据驻留 | “GDPR 边界” | 关于哪个区域可接触用户数据的法律约束 |
| RTT | “往返时间” | 网络延迟;美国到欧洲 75 ms,美国到亚太 220 ms |
| LLM 感知 LB | “缓存命中 LB” | 作为产品类别的缓存感知路由器 |

## 延伸阅读

- [BentoML — 多云与跨区域推理](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — 带网络延迟项的跨区域 KV 缓存复用。
- [TianPan — 多区域 LLM 服务缓存局部性](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — 可用性故障切换文档。
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — 缓存感知路由器源代码。