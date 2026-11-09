# 负载测试法规管理器API 为什么k6和虫撒谎

> 传统的负载测试器并非用于流媒体响应,可变输出长度,代币水平的指标或GPU和. 两个陷咬了大多数球队. 标签陷: Locust 的代币级别测量在 Python GIL 下运行代币化,这与重量的同时生成请求竞争;代币化后备后备,然后膨胀了报告的代币间延迟 提示-均性陷:循环中的相同提示测试代币分布的一个点;实际流量具有可变长度和多种预先语符匹配. 果公司解决了这个问题`--mean-input-tokens`其他`--stddev-input-tokens`2026年工具映射:专业化法学 (GenAI-Perf,LLMPerf,LLM-Locust,guidelellm) 以实现代币水平的准确性;**k6 v2026.1.0**其他**k6 Operator 1.0 GA (Sept 2025)** 流量知情,通过TestRun/PrivateLoadZoneCRD分布,最适合CI/CD门;Vegeta for Go常率和;只使用LLM-Locust扩展的虫2.43.3流量.负载模式:稳定状态,坡道,尖 (自动测量测试),浸泡 (记忆泄漏).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## 学习目标

- 解释两个反模式 (GIL陷,快速均陷) 使通用负载测试器用于LLMAPI的谎言.
- 选择一个用于特定目的的工具:LLMPerf (基准运行),k6 + 流媒体扩展 (CI门), guidellm (大规模合成),GenAI-Perf (NVIDIA参考).
- 设计四种负载模式 (稳定,坡路,尖峰,浸泡) 并命名每个捕获的故障模式.
- 建立一个现实的快速分布,使用输入代币的平均+stddev而不是固定长度.

## 问题

你在500个同步用户上测试了你的LLM终端点.它成功了.你发货了.在生产中200个实际用户,服务下降了 P99 TTFT爆炸,GPU被固定.

首先,k6 发送了500个相同的提示, 您的请求集和预写缓存使您看起来像正在处理500个同时解码,而实际上您正在处理一个.

对于LLM的负载测试是它自己的学科.

## 概念

### 鱼的陷

龙使用Python并运行GIL下代币化客户端.在高同步下,代币化生成器排队后.报告的代币间延迟包括客户端代币化后备.你认为服务器缓慢;这是测试利用.

修复:LLM-Locust扩展将代码化转移到单独的过程中,或者使用编译语言的带 (k6,LLMPerf使用代码化器.rs).

### 快速统一陷

所有已知负载测试器都允许您配置一个提示.在10,000次循环测试中,每次都会发送相同提示.服务器每次预先端缓存击中接近100%时都会看到相同的预先端,吞吐量看起来很好.

解决方案:从快速分配中获取的样本.`--mean-input-tokens 500 --stddev-input-tokens 150`不同长度,不同内容.

### 四个负载模式

1. **Steady-state**持续30-60分钟的RPS.捕获:基本性能回归.
2. **Ramp**将RPS从0升至目标15分钟以上.捕捞:容量断裂点,热升异常.
3. **Spike**突然3-10倍的转速2分钟后. 捕获:自动测量延迟,排队和冷启动冲击.
4. **Soak**4-8小时稳定状态. 捕获:记忆泄漏,连接池漂移,可观测性溢出.

### 2026工具映射

**LLMPerf** Python,但支持Rust的代码化. 平均/stddev提示. 流量意识. 性能运行的最佳默认.

**NVIDIA GenAI-Perf** NVIDIA 的参考. 使用Triton客户端;全面的计量覆盖. 注意其ITL不包括TTFT;LLMPerf的包括它.两个工具为同一服务器产生不同的TPOT.

**LLM-Locust**虫扩展,修复了GIL陷.熟悉的虫DSL+流量指标.

**guidellm**大规模的合成基准评估.

**k6 v2026.1.0**其他**k6 Operator 1.0 GA (Sept 2025)**其他:
- 其他数据的数据,也包括:
- k6运营商用于Kubernetes本土分布式测试的TestRun/PrivateLoadZone CRD.
- 最适合IC/CD门和SLA测试.

**Vegeta** ,比k6更简单.恒定率HTTP和.不了解LLM,但适合网关/速度限制测试.

**Locust 2.43.3 stock**具有LLMGIL陷.只有LLM-Locust扩展.

### 关口在CI中

运行k6在公关:

- 每个在基线RPS时进行30-50次代.
- 门:P50/P95 TTFT,5xx < 5%,TPOT低于门.
- 打破了破解的基础.

### 现实性快速分配

根据实际的流量样本 (如果您有它们) 或从已发布的分布式 (例如,聊天的ShareGPT提示,代码的HumanEval).将平均 + stddev 输入到LLMPerf.以任何方式避免循环与一个提示.

### 你应该记住的数字

- k6运营商1.0 GA:2025年9月
- 动的数据.
- 典型的LLMPerf运行:同时 X 的100-1000个请求.
- 典型的CI门:每次 PR 发生30-50次.
- 它们是稳定,道,点,浸泡.

```figure
load-pattern-waves
```

## 用它

`code/main.py`模拟一个实实在的快速分布的负载测试,测量有效的TPOT,并展示了均快速陷.

## 运送它

这一课产生了`outputs/skill-load-test-plan.md`鉴于工作负载和SLA,选择工具并设计四种负载模式.

## 运动

1. 跑步`code/main.py` 什么是差距?
2. 写一个CI门的 k6脚本:TTFT P95 < 800 ms在100个同时,运行时间5分钟.
3. 您的浸泡测试显示,内存增长50MB/小时.
4. 杆测试从10 RPS到100 RPS.如果卡宾特+vLLM生产堆已经在位 (阶段17 · 03 + 18),预期恢复时间是多少?
5. 基因-Perf报告TPOT=6ms;LLMPerf报告TPOT=11ms在同一服务器上.解释.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## 进一步阅读

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
