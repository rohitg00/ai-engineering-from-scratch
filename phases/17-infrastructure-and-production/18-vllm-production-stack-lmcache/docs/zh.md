# vLLM Production Stack 与 LMCache KV 卸载

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> vLLM 的 production-stack 是参考级 Kubernetes 部署方案——把路由器、引擎和可观测性串起来一套交付。LMCache 是 KV 卸载层，把 KV cache 从 GPU 显存里抽出来，跨查询、跨引擎复用（先 CPU DRAM，再到磁盘 / Ceph）。vLLM 0.11.0 的 KV Offloading Connector（2026 年 1 月）通过 Connector API（v0.9.0+）让这一过程异步化、可插拔。卸载延迟对用户不可见。即便没有共享前缀，LMCache 也有价值——当 GPU 用尽 KV 槽位时，被 preempt（抢占）的请求可以从 CPU 恢复，而不必重新跑一遍 prefill。在 16x H100（80GB HBM）跨 4 台 a3-highgpu-4g 上的公开基准显示：当 KV cache 超出 HBM 时，原生 CPU 卸载和 LMCache 都能大幅提升吞吐；KV 占用很低时，所有配置都接近 baseline，仅有少量额外开销。

**Type:** Learn
**Languages:** Python (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 画出 vLLM production-stack 的各层：router、engine、KV 卸载、可观测性。
- 解释 KV Offloading Connector API（v0.9.0+），以及 0.11.0 的异步路径如何隐藏卸载延迟。
- 量化 LMCache CPU-DRAM 在什么场景下有用（KV > HBM）vs 何时反而是开销（KV 小到能塞进 HBM）。
- 在给定部署约束下，在 vLLM 原生 CPU 卸载 与 LMCache connector 之间做选择。

## 问题（The Problem）

你的 vLLM 服务监控显示：并发一上来，GPU 的 HBM 就 100% 满载，并伴随 preemption 事件。请求被驱逐、重新入队，同一个 2K-token prompt 一分钟之内被你重新 prefill 了四次。GPU 算力被花在重复 prefill 上；goodput 远低于裸 throughput（吞吐）。

加更多 GPU，成本是线性增长；加更多 HBM，物理上不可能。但 CPU DRAM 便宜——单 socket 就能上 512 GB+，延迟比 HBM 差几个数量级，但对「短期还会再用到」的 KV cache 来说够用。

LMCache 把 KV cache 抽到 CPU DRAM 里：被 preempt 的请求能快速恢复，跨引擎共享相同前缀的也不用每个引擎都重新 prefill 一遍。

## 概念（The Concept）

### vLLM production-stack

`github.com/vllm-project/production-stack` 是参考级 Kubernetes 部署：

- **Router** —— 缓存感知（Phase 17 · 11）。消费 KV 事件。
- **Engines** —— vLLM worker。每张 GPU 一个，或者每个 TP/PP 组一个。
- **KV cache 卸载** —— LMCache 部署，或原生 connector。
- **可观测性** —— Prometheus 抓取、Grafana 仪表盘、OTel trace。
- **控制面** —— 服务发现、配置、滚动更新。

以 Helm chart + operator 形式发布。

### KV Offloading Connector API（v0.9.0+）

vLLM 0.9.0 引入了 Connector API，给 KV cache 后端做了一个可插拔的接口。引擎把 block 卸载给 connector；connector 决定存到哪儿（RAM、磁盘、对象存储、LMCache）。请求要某个 block 时，connector 再把它加载回来。

vLLM 0.11.0（2026 年 1 月）加入了异步卸载路径——卸载可以在后台进行，常见情况下引擎不会被它阻塞。端到端延迟和吞吐仍然取决于负载形态、KV cache 命中率和系统压力；vLLM 自己的发版说明就明确指出：在命中率低时，自定义 kernel 卸载可能反而拖累吞吐，而异步调度和 speculative decoding 之间存在已知的相互影响问题。

### 原生 CPU 卸载 vs LMCache

**vLLM 原生 CPU 卸载**：引擎本地。把 KV block 存在 host RAM 里。实现简单、没有网络跳数。不跨引擎。

**LMCache connector**：集群级。把 block 存在共享的 LMCache server 里（CPU DRAM + Ceph/S3 分层）。任何引擎都能访问这些 block。已发布 16x H100 基准。

单引擎 HBM 紧张时，选原生；多引擎共享前缀（RAG 共享 system prompt、多租户共享模板）时，选 LMCache。

### 基准表现

16x H100（80 GB HBM）跨 4 台 a3-highgpu-4g 的测试结果：

- KV 占用低（短 prompt、低并发）：所有配置都贴近 baseline，LMCache 多 ~3-5% 开销。
- 中等占用：LMCache 开始在跨引擎前缀复用上发挥作用。
- KV 超出 HBM：原生 CPU 卸载和 LMCache 都能大幅提升吞吐；LMCache 提升更多，因为可以跨引擎共享。

### LMCache 真正起决定作用的场景

- 多租户服务，且 system prompt 在租户之间共享。
- RAG，文档片段在不同查询里重复出现。
- 同一 base 模型上的微调变体（LoRA）——base 模型的 KV 复用能省掉重复工作。
- preemption 频繁的负载：从 CPU 恢复比重新 prefill 便宜。

### 不要打开它的场景

- HBM 压力很小——你只会白付开销。
- 短上下文（<1K tokens）——传输时间 > 重新 prefill。
- 单租户单 prompt 的负载——根本没有可复用的东西。

### 与 disaggregated serving 的整合

Phase 17 · 17 的 disaggregated serving 与 LMCache 是叠加增益：prefill 池往 decode 池传 KV 时，没用上的会落到 LMCache 里；后续查询直接从 LMCache 取。Phase 17 · 11 的缓存感知 router 可以把请求路由到「本地或 LMCache 共享的 cache」匹配的那个引擎。

### 你应该记住的数字

- vLLM 0.9.0：Connector API 落地。
- vLLM 0.11.0（2026 年 1 月）：异步卸载路径；端到端延迟影响取决于负载、KV 命中率与系统压力（不是绝对保证）。
- 16x H100 基准：KV 占用超过 HBM 时，LMCache 才有收益。
- HBM 压力小：3-5% 开销，无收益。

## 用起来（Use It）

`code/main.py` 模拟了一个 preemption 频繁的负载，对比开启与不开启 LMCache 的差别。报告：避免了多少次重新 prefill、吞吐提升多少、以及打平的 HBM 利用率阈值。

## 上线部署（Ship It）

本课产出 `outputs/skill-vllm-stack-decider.md`。给定负载形态和 vLLM 部署形态，决定用原生卸载、LMCache，还是都不用。

## 练习（Exercises）

1. 跑一下 `code/main.py`。在多大的 HBM 利用率下，LMCache 开始有正收益？
2. 一个租户的 6K-token system prompt 在 200 次/小时的查询里共享。算一下每个租户预期能从 LMCache 省下多少。
3. LMCache server 是单点故障。设计一套 HA 方案（多副本、回退到原生）。
4. LMCache 把数据存到机械盘上的 Ceph。对于一个 70B FP8 模型 4K-token 的 KV（500 MB），读取时间 vs 重新 prefill 各是多少？
5. 论证一下 vLLM 0.11.0 的异步路径是不是「免费」的——开销到底藏在哪里？

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 实际是什么 |
|------|----------------|------------------------|
| Production-stack | 「参考部署」 | vLLM 的 Kubernetes Helm chart + operator |
| Connector API | 「KV 后端接口」 | vLLM 0.9.0+ 可插拔的 KV 存储接口 |
| 原生 CPU 卸载 | 「引擎本地溢出」 | 把 KV 存到同一引擎的 host RAM 里 |
| LMCache | 「集群级 KV cache」 | 跨引擎的 KV cache server，建在 CPU DRAM + 磁盘上 |
| 0.11.0 异步 | 「非阻塞卸载」 | 卸载隐藏在引擎执行流之后 |
| Preemption | 「驱逐腾位置」 | HBM 满了之后的 KV cache 调动 |
| Prefix reuse | 「同一个 system prompt」 | 多个查询共享开头部分；缓存命中 |
| Ceph 层 | 「磁盘层」 | cache 层级里位于 DRAM 之下的持久化存储 |

## 延伸阅读（Further Reading）

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) —— Helm chart + operator。
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) —— Connector 实现。
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) —— 异步路径细节。
