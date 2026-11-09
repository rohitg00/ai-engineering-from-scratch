# 推理指标  TTFT,TPOT,ITL,Goodput,P99

> 五个指标决定推断部署是否有效. 预填加排列加网络. 虽然工具不同意ITL是否计算第一个代币) 是每个代币的内存绑定解码成本. 终端到终端延迟是TTFT加上TPOT乘以输出长度. 通过率是每秒的代币, 但对于产品来说,重要的是,  满足每个SLO同时的请求的比例. 低功率的高吞吐量意味着你处理的代币永远不会及时到达用户. 2026年Llama-3.1-8B-Instruct on TRT-LLM的参考号码:平均TTFT162ms,平均TPOT7.33ms,平均E2E1.093ms. 总是报道P50,P90,P99 永远不只是恶意. 并且注意测量陷:GenAI-Perf排除了TTFT从ITL计算中,LLMPerf包括它;两个工具对TPOT不同意.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## 学习目标

- 精确定义TTFT,TPOT,ITL,E2E,吞吐量和put,并命名每个测量的组件.
- 解释为什么平均是 LLM 服务的错误统计数据,以及如何读取P50/P90/P99.
- 构建一个SLO多限制 (例如TTFT<500 ms和TPOT<15 ms和E2E<2 s) 并根据它计算出良好的输出.
- 举个两个同期不同意TPOT的基准工具,并解释为什么.

## 问题

如果40%的请求超过2秒,用户会放弃该会议. 通过量本身并不能告诉你产品是否有效.

推理具有多个延迟轴,每个轴都不同. 预填是计算的,并且可以按时间进行量度. 解码是记忆的,并且与批量大小的尺度. 排队延迟是一个运营问题. 网络是物理距离问题. 需要每个数据的分别,需要百分比,需要一个单一的复合值,上面写着"用户得到了他们预期的东西吗?"

## 概念

### 时间到第一个代币

`TTFT = queue_time + network_request + prefill_time`

在Llama-3.3-70B FP8上,H100上的32k提示需要 ~800 ms的纯预填.排队时间是载载下的规划器行为.网络请求是电线时间,包括TLS.TTFT是用户在任何东西回流之前看到的延迟.

### 互通代币间延迟

许多名称用于一个数量.`TPOT`(输出代币的时间),`ITL`标间延迟`decode latency per token`所有相同. 这是连续流通的代币之后的时间.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在同一块Llama-3.3-70B H100堆上,TPOT平均值为7ms.没有块式预填,在邻近序列上长时间预填时,TPOT可以达到50ms.

### 电源延迟

`E2E = TTFT + TPOT * output_tokens + network_response`

对于长输出 (>500代币),E2E是TPOT主导的.对于长输出,E2E是TTFT主导的.报告输出长度条件E2E.

### 吞吐量

`throughput = total_output_tokens / elapsed_time`

总计,告诉你舰队的效率,而不是个人要求的健康.

### 你真正关心的指标

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

要求只有当每个限制都被满足时才是"好"的. 产量是份额. 有些文件和仪表板则以每秒满足每个SLO的请求为率. 将份额乘以转换的请求率. 高产量为60%的产量是失败.低产量为99%的产量是目标.

2026年, goodput 是在MLPerf 推理 v6.0提交和AI平台提供商内部SLA跟踪中使用的指标.

### 为什么恶意是错误的统计数据

率分布是右向的.一个长预填邻居的解码批量可以发送500个代币,TPOT ~7 ms和20个代币,TPOT ~60 ms.平均TPOT为9 ms.P99 TPOT为65 ms.用户经常打到P99,这就是为什么他们离开.

总是报告三倍 (P50,P90,P99). 用户体验,P99是你优化的.

###  拉马-3.1-8B-TRT-LLM指导, 2026

- 平均TTFT: 162 ms
- 平均TPOT:7.33 ms
- 平均E2E: 1,093 ms
- P99 TPOT:根据零碎预填配置,可在10-25ms之间变化.

这些是NVIDIA发布的参考点.它们随着模型尺寸 (70B显示 3-5x),硬件 (H100 vs B200 ~ 3x) 和负载而变化.

### 测量陷

2026年最常用的两个基准工具对TPOT的不同意见:

- **NVIDIA GenAI-Perf**计算的ITL从代币 2开始.
- **LLMPerf** ITL 从代币 1 开始.

对于一个使用TTFT 500 ms和100 个输出代币的请求,`ITL = 700/99 = 7.07 ms`据"LLMPerf"报告`ITL = 1200/100 = 12.00 ms`工具选择改变了数字.

总是说明哪个工具,总是发布定义.

### 构建SLO

2026年为70B聊天模式提供合理的面向消费者的SLO:

- 光电阻 (TTFT P99) <= 800 ms
- 光电 (TPOT P99) <= 25 ms.
- 对于<300代币输出,E2E P99 <= 3 s.
- 产量目标 >=99%.

企业SLO紧缩TTFT (200-400ms) 和放宽E2E. 目的是记录它们,测量所有三个,并作为一个复合物追踪产量.

### 测量方法

- 运行真实流量或实实用合成 (LLMPerf与 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`)
- 目标为基准运行的2倍峰值同步率.
- 运行30-50次,取组合样本的百分比.
- 发布工具名称,工具版本,模型,硬件,同时,快速发行.

```figure
throughput-latency
```

## 用它

`code/main.py`产品的产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少? 产量是多少?

其他[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)机器显示NVIDIA L4上输出代币的时间来自哪里.一个解码步骤读取16.41GB的权重,这需要至少54.7ms的300GB/s,测量步骤需要60.16ms.

## 运送它

这一课产生了`outputs/skill-slo-goodput-gate.md`鉴于工作负载和SLO,它产生了一个CI/CD准备的基准配方,该配方将门部署在产量相反的产量上.

## 运动

1. 跑步`code/main.py`如何改变值,当你将P99TPOT从30ms到15ms紧缩时?
2. 一家卖家引用了"Llama 3.3 70B H100"的15,000个/秒.
3. 为什么碎片预填保护P99TPOT,而不是TPOT?
4. 构建一个消费者SLO为语音助理 (第一代标语是听到的,而不是读到的).
5. 阅读LLMPerf README和GenAI-Perf文件. 确定其他三项指标,其中工具不同意.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## 进一步阅读

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html)TTFT,ITL,TPOT的法典定义.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics)替代定义和测量配方.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics)实用测量实用部署.
- [LLMPerf](https://github.com/ray-project/llmperf)基于光线的开源基准.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md)NVIDIA的基准工具.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/)行业接受的基于产品质量的基准指标.
