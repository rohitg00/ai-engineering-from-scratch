#  投机解码输入服务器

> 投机解码 一个廉价的草案提出代币,目标模型在一个通行中验证它们 现在是一个准备生产的优化,而不是一个研究技巧. -3在vLLM 0.7 船舶 2.5-3x 吞吐量在实际交通. 鱼 (AWS 2026) 进一步推动了平行投机. 格兰特种培训了规模的征兵负责人. 红帽的投机中心发布了对普通开放模型的调整草案. 讯RT-LLM在NVIDIA上做了先进的测量解码. 2026年生产服务堆是vLLM或SGLang,EagLE家族草案,FP8或INT4量化,HPA在排队等待. 总结石头将为2.5倍以上的基线吞吐量提供两个开放型号,并提供完整的尾延迟报告.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子
**Time:** 30 hours

## 问题

投机解码在2026年成为商品. 3的预稿主管训练目标模型的隐藏状态,预测N代币前进;目标模型通过一次验证. 接受率为60至80%,这意味着端到端的吞吐量2到3倍. 它们是完全可以实现的. 您可以使用SGLang + SpecForge来进行训练. 红帽投机者发布了Llama 3.3 70B,Qwen3-Coder-30B MoE,GPT-OSS-120B的调整草案.

随着流量分布 (ShareGPT与代码与域数据) 变化,接收率变化.拒绝后尾延迟比没有投机更糟. 您必须在多批量量报告p99,而不仅仅是稳定状态代币/秒.每100万代币的成本与人类/OpenAI API是信誉杆.

## 概念

设想解码有两个层次.**draft**3头,ngram或较小的目标一致模型) 每一步提出 k 候选代币.**target**模型验证所有 k 通过一个通行;任何被接受的预写都取代了贪的路径. 接受率取决于草案目标的配线和输入分布.

3在大多数流量上超过了ngram草案.P-EAGLE对更深的草图树进行了并行猜测.交易:拒绝时P99延迟较高,因为验证通过较大.服务配置必须报告批量容量缓存才能表现出这一点.

部署是Kubernetes. vLLM 0.7每 GPU 或子平行片段运行一个复制. HPA 自动量度在排队等待而不是CPU. FP8 (Marlin) 和 INT4 (AWQ) 量子保持 GPU 内存在 H100 / H200 封筒. 端到端报告是吞吐量,接受率,p50/p99在批量 1/8/32,和 $/1M 代币.

## 建筑

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## 堆

- 服务:vLLM 0.7或SGLang 0.4
- 投机方法:Eagle-3预测头,P-Eagle平行投机,ngram倒退
- 项目培训:SpecForge (SGLang) 或Red Hat投机者
- 目标模型:Llama 3.3 70B,Qwen3-Coder-30B MoE,GPT-OSS-120B
- 量化:FP8 (马林),INT4 AWQ
- 部署:Kubernetes + NVIDIA设备插件; HPA 在排队等待量度上
- 标准:ShareGPT,MT-Bench-v2,GSM8K,HumanEval用于域域分布接受度测量
- 参考:供应商基线的TensorRT-LLM投机解码

```figure
cf-spec-decode
```

## 建立它

1. **Target model prep.**选择Llama 3.3 70B.通过Marlin对FP8进行量化.在1xH100 (或2x子平行) 上部署在vLLM 0.7下.

2. **Draft source.**通过 SpecForge 拉出 Red Hat Speculators 的一个符合 EAGLE-3 草案头 (或训练一个).

3. **Baseline numbers.**在投机之前:批量1/8/32,p50/p99延迟,GPU利用率.

4. **Enable EAGLE-3.**转换配置,重复相同的基准,报告速度,接受率,p99尾延迟三角形.

5. **P-EAGLE.**允许平行推测; 测量深层的草木与连续的.

6. **Domain traffic.**通过同一服务器运行ShareGPT与HumanEval与域名特定流量. 测量每次分发的接受率. 确定草稿漂移时.

7. **Second target model.**运行Qwen3-Coder-30B MoE的同一个管道. 草案更复杂 (MoE路由噪音). 报告.

8. **K8s HPA.**部署在K8中,HPA跟踪`queue_wait_ms`装载量增加三倍时,展示规模.

9. **Cost comparison.**在同一评估中计算1万美元代币与人类克劳德·索尼特4.7和OpenAIGPT-5.4

## 用它

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## 运送它

`outputs/skill-inference-server.md`测量服务堆,投机解码,完整的基准报告和K8部署.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## 运动

1. 测量在草案落后一个版本时的接受率下降 (例如,Llama 3.3 -> 3.4漂移).建立监测警报.

2. 实施ngram-fallback:如果EAGLE-3的接受率低于门值,请转向ngram草案. 报告可靠性改善.

3. 运行一个控制的MoE实验:相同的Qwen3-Coder-30B, 输入与输入的路由噪音.

4. 报告获得的模型尺寸/复制品头部空间,以及您是否可以提供未量化Llama 3.3 70B.

5. 测量TensorRT-LLM在同一H100硬件上进行了测量解码.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## 进一步阅读

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai)参考服务堆
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/)平行投机解码纸 + 整合
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) 项目头训练管道
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) 配线的草稿中心
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/)供应商替代品
- [Fireworks.ai serving architecture](https://fireworks.ai/blog)商业参考
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840)方法论文
- [vLLM repository](https://github.com/vllm-project/vllm)代码和基准
