#   终端细调管道 (数据向SFT向DPO服务)

> 根据你的数据训练的8B类模型,根据你的偏好进行了DPO排列,量化,投机式解码, 2026 开放堆是Axolotl v0.8,TRL 0.15,代的Unsloth,量化的GPTQ/AWQ/GGUF,配送的VLLM 0.7和EAGLE-3. 终点是可重复运行整个管道 (YAML中,服务端点外) 并根据2026年模型开放框架发布模型卡.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子
**Time:** 35 hours

## 问题

每个认真的人工智能团队在2026年都会保持一个精细调节管道. 不是因为它们运输了一个边界基模型,而是因为下游适应 域 SFT,DPO与标记的偏好,蒸的草稿用于投机解码,使用EAGLE-3 是可测量的胜利现实. 亚克索洛特l v0.8处理多GPU SFT配置. 升值为0.15的DPO和GRPO. 不让你快速使用单GPU代. 通过使用 EAGLE-3 的 vLLM 0.7 能够在质量不损失的情况下推出2~3倍的解码吞吐量. 工具工作;工艺在YAML,数据卫生和评估纪律.

您将通过SFT运行8B到14B基 (Llama 3.1 8B,Qwen3 14B或Gemma 3 12B) 然后通过任务特定数据进行DPO,量化服务,并测量利与lm-评估-杆,RewardBench-2,MT-Bench-v2和MMLU-Pro.您将根据2026模型开放框架制作一个模型卡.问题是可复制性:一个命令重复整个管道端到端.

## 概念

管道有五个阶段.**Data**除 (MinHash/Datatrove),质量过器 (Nemotron-CC类别分类器),PII除,对公共基准污染进行分离卫生检查. **SFT**子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子.**DPO or GRPO**: TRL配置, 1 时代, 偏好对, 无论是标记或模型判断, beta调整. **Quantize**:GPTQ+AWQ+GGUF 实现部署灵活性. **Serve**果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果: 果:

运行量是可交付的:仅SFT对SFT+DPO对SFT+GRPO在三个任务特定基准上.服务量:批量1/8/32,EAGLE-3接受率,$/1M代币.安全评估:Llama Guard4通过率.模型卡:偏见评估,可再生性种子,数据许可.

## 建筑

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## 堆

- 数据:用于减产的数据库,用于质量的Nemotron-CC分类器,用于PII的Presidio
- 基:拉马3.1 8B,Qwen3 14B,或Gemma 3 12B
- 光:Axolotl v0.8 配备ZERO-3,闪光注意3,包装序列
- 偏好调整:DPO或GRPO的TRL0.15;单GPU代的Unsloth
- 量化:GPTQ (马林),AWQ,GGUF通过 llama.cpp
- 服务:vLLM 0.7 含有EAGLE-3投机解码 (或SGLang 0.4 + SpecForge)
- 评价:lm评价,回报-2,MT,v2,MMLU-Pro
- 安全评估:Llama Guard 4,ShieldGemma-2
- 基础设施:Kubernetes + NVIDIA设备插件,HPA在排队等待量度上
- 观察性:W&B用于训练,Langfuse用于推断

```figure
ce-finetune-stages
```

## 建立它

1. **Data pipeline.**运行数据库的原始数据库,应用Nemotron-CC类型的质量分类器,Presidio扫描PII,写列车/分区,用明确的种子.

2. **Contamination check.**对于每次验证分区,计算MinHash与MMLU-Pro,MT-Bench-v2,RewardBench-2测试组. 拒绝任何重叠.

3. **Axolotl SFT.**果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,果,.

4. **TRL DPO / GRPO.**通过SFT检查点,在优先对进行一次DPO (或GROP以数学/代码的可验证奖励).

5. **Quantize.**产生三个量子:GPTQ-INT4-Marlin,AWQ-INT4,GGUF-Q4_K_M,用于 llama.cpp. 记录大小和名义吞吐量.

6. **Serve with speculative decoding.**通过Red Hat Speculators训练的EAGLE-3草案负责人配置. 测量批量1/8/32的接受率和尾延迟. 报告 $/1M代币与人类/OpenAI在同一评估.

7. **Eval matrix.**运行lm-eval-harness,RewardBench-2,MT-Bench-v2,MMLU-Pro,仅基于SFT,SFT+DPO,SFT+GRPO. 制作表.

8. **Safety eval.**发射器的Llama Guard4传输速率.

9. **Model card.**文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件: 文件:

## 用它

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## 运送它

`outputs/skill-finetuning-pipeline.md`单个命令通过SFT运行数据,通过DPO运行数据,通过quant运行数据,通过evalu运行数据,并发出一个模型卡+服务的终端点.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## 运动

1. 运行SFT+DPO vs SFT+GRPO仅针对SFT+DPO,并使用相同的任务指标. 报告哪种优先方法获胜以及多少.

2. 换Llama 3.1 8B为Qwen3 14B. 测量1百万美元的代币,质量相匹配.

3. 测量EAGLE-3域数据接受率与通用ShareGPT. 报告 delta和对延迟预算的含义.

4. 射1%的污染 (泄漏MMLU-Pro答案到训练数据中) 然后再运行评估. 看MMLU-Pro精度跳不现实的. 建立一个检查污染的CI门,

5. 添加LoRA SFT作为完全细调的替代品. 在10倍较低的内存下测量质量差距.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## 进一步阅读

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/)参考SFT/DPO培训员
- [TRL documentation](https://huggingface.co/docs/trl) DPO和GRPO参考实施
- [Unsloth](https://github.com/unslothai/unsloth)单GPU代引用
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) GRPO 方法
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai)参考服务堆
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge)替代投机解码训练师
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): 开放分类标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness)定律评价运行器
