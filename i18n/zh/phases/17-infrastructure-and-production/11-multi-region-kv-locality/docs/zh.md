# 多区域LLM服务和KV缓存位置

> 轮负载平衡对缓存的LLM推断具有积极的危害. 没有登陆其前的节点的请求支付了全额预填成本 大约800 ms在P50上长时间提示与 ~ 80 ms在缓存中击. 2026年,生产模式是一个缓存知性路由器 (vLLM Router in Rust, llm-d路由器) 消耗KV缓存事件和路由在前-hash匹配. 最近的研究 (GORGO) 使跨地区网络延迟成为路由目标中明确的术语. 商业"跨区域推理" (Bedrock跨区域推理,GKE多集群网关) 提供,以不透明的方式处理推理,而不是处理TTFT. 摩根大通和梅奥诊所在2024年11月在22分钟内进行了东部-1的失败. 实际情况: 32%的LLM DR失败是因为团队备份了权重,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## 学习目标

- 解释为什么轮负载平衡破解缓存推断,并量化TTFT罚款.
- 图表一个缓存知情的路由器:输入 (KV缓存事件),算法 (前置-hash匹配),断器 (GPU利用).
- 指定LLM (缺失代码文件/量化配置) 的 32% DR失败驱动程序,并指定一个三文件的DR检查列表.
- 区分跨地区商业服务 (Bedrock CRI,GKE多集群网关) 与KV意识的路由.

## 问题

你的服务运行在美国东-1,美国西-2,欧西-1. 你把ALB前面和轮. 预先预先缓存击中率下降到8%. TTFT P50三倍. 你的vLLM日志显示每个请求都支付完整的预先填充成本.

圆机是无国籍服务的最佳方法.LLM推理是设计的状态KV缓存编码了模型所看到的一切.路由盲是向错误的缓存.

您的团队有一个DR计划.您将模型重量备份到S3跨区域. 区域中断发生;您尝试过失;复制拒绝启动.您忘记了tokenizer.json,量化配置和RoPE扩展配置在您没有同步的单独桶中.

多区域LLM服务是一个缓存问题,一个路由问题,一个DR卫生问题,而不是负载平衡问题.

## 概念

### 缓存知性路由

请求带着提示.路由器将前 Hash (例如,第512个代币);它问每个复制符号"你有没有这个前存储吗?"复制符号在一个 pub/sub频道上发布KV缓存事件,因为它们分配和驱逐区块.路由器选择了复制符号与匹配,如果没有人,则会通过基于 GPU 实用式的打器.

**vLLM Router**产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品: 产品:`kv.cache.block_added`节目,保持一个前-hash →复制索引, 路线$O(1)$没有匹配时,它会到最低的排队深度.

**llm-d router**通过ControlPlane API发布事件.

**SGLang RadixAttention**交叉反路由是严格上游的.

### 数字

通过2K标记提示,Llama 3.3 70B FP8,H100:
- 缓存击中 (相同的复制,预写本): ~80 ms.
- 缓存错误 (冷预填): ~ 800 ms.

如果你的路由器在复制中达到60至80%的预写缓存,你将近乎在N复制容量上实现单次复制性能.如果它达到10%,你将近乎简单的扩展.

### 跨区域具有新的限制 网络延迟

区域间RTT:
- 美国东部-1 美国西部-2: ~65 ms.
- 美国东部-1 欧西部-1:75 ms
- 东北-1 南东-1: ~220 ms.

如果路由从 us-east-1 带到 ap-southeast-1 的热先सर्ग,则保存的预填 (800 → 80 ms,因此 720 ms) 缩小到约 500 ms 一旦支付了 ~ 220 ms RTT,如果偏远地区排队请求或已经驱逐了先सर्ग,则边缘会消失.`prefill_time + network_latency`经常答案是继续区域路由, 除了在大量的多MB预写,

### 商业"跨地区推断"在这里没有帮助

亚华斯贝德罗克跨区域推理在容量压力时自动将请求传送到其他地区.它优化可用性,而不是TTFT,并将推理视为不透明.GKE多集群网关是相同的服务级故障,没有KV缓存的意识.

它们可以处理"东部-1正在火灾"的情况. 缓存的路由处理TTFT的情况.

### 医疗卫生 32%的文件缺失问题

据2026年公布的统计数据显示, 32% 的LLM DR失败是因为团队支持重量,

- `tokenizer.json`或`tokenizer.model`
- 定量化配置 (`quantize_config.json`值,AWQ尺度,GPTQ零点)
- 模型特定配置 (RoPE扩展,注意力面具,聊天模板)
- 发动机配置 (`vllm_config.yaml`采样默认,LoRA适配器表现)

修复是三个文件的最低DR宣言:

1. 所有文件都在HF模型 repo (权重+配置+代币化器) 下.
2. 机器特定服务配置.
3. 部署说明书 (K8s YAML,Dockerfile,依赖锁).

另外,每季度都进行一次 DR 演习. 摩根大通东部-1 演习在2024年11月恢复了22分钟,

### 数据居住位置是直角的

如果您的缓存知性路由器向 us-east-1发送来自巴黎的请求,您违反了GDPR,无论 TTFT获益如何. 在优化缓存之前按居住界限分区路由器.

### 你应该记住的数字

- 缓存击中与错失的TTFT差距: ~ 10x (2K提示时80ms与800ms).
- 区域间RTT美国-欧盟: ~75 ms.
-  DR 失败: 32% 失去了代币/量子配置.
- 摩根大通东部-1失败时间:2024年11月22分钟 (30分钟SLA).

```figure
cache-aware-router
```

## 用它

`code/main.py`在多区域工作负载上模拟三个路由策略 (Round-robin, cache-aware区域, cache-aware全球).报告缓存击中率,TTFT P50/P99,跨区域账单.

## 运送它

这一课产生了`outputs/skill-multi-region-router.md`考虑到地区,居住限制和SLA,制定路由计划.

## 运动

1. 跑步`code/main.py`根据75ms的RTT,跨地区路由速度比仅在本地路由速度高于多少?
2. 预测器的击中率从70%降至12%. 诊断出三个可能的原因和可观察的证据.
3. 设计一个DR表格,为vLLM中提供的70B AWQ量化模型设计,具有5个LoRA适配器.列出每个文件和配置.
4. 论证贝德罗克跨地区推断是否"足够"对于具有严格的TTFTSLO的金融科技公司.
5. 关于巴黎的请求与美国东部的前相匹配.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## 进一步阅读

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1)跨地区 KV缓存重复使用,网络延迟期限.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)可用性故障转移文件.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack)缓存知性路由器源.
