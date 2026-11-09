#  静静   自学推理

> 只有一个小的自我改善循环, 模型会产生一个思想链, 保持那些答案的正确答案, 这就是STAR. 通过V-STaR添加验证器,因此推断时间选择更好. 静静的STAR推出了合理性到每一个标志. 这三种都能. 循环保存了任何偶然的快捷方式,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## 问题

让一个模型学习理性,最简单的方式是收集人类写的理性痕迹.

问:如果模型写出自己的理性,并根据已知答案评分它们呢?

1. 试试一个推理跟答案.
2. 如果最后的答案是正确的,
3. 细节调整了保存的痕迹.
4. 复制.

虽然GSM8K和CommonsenseQA都没有新的人类注释,但循环有内置偏见:任何产生正确答案的逻辑都保留,无论逻辑本身是否是正确的.V-STaR (Hosseini等人,2024) 与学术验证器补丁;Quiet-STaR (Zelikman等人,2024) 将这个想法概括为特定的内部逻辑.

## 概念

### 启动了什么工作

开始从一个有点弱的推理能力的基础模型. 在每个训练问题上,取一个推理加答案. 如果答案匹配标签,保持 (问题,推理,答案) 三倍. 细节调整模型在保持的集. 重复.

模型如果永远无法解决问题,循环就无法学习.**rationalization**对于模型失败的问题,注入正确的答案作为提示,然后重新提示模型产生导致它的合理性.

结果在原始论文 (Zelikman等人, 2022):GPT-J基模型通过重复STaR轮流从5.8%提高到10.7%通过合理化约5个百分点绝对.在 CommonsenseQA上,STaR训练的GPT-J 6B达到72.5%,与精细调整的GPT-3 175B (~73%) 相比.

### 通过DPO训练验证员

霍塞尼等人 (2024) 观察到这些也是数据:每对 (rationale, "这是正确的") 都可以训练验证器.他们使用直接偏好优化对正确和不正确的解决方案构建排名器.在推断时,取样N理性,选择验证器的最佳选择.

报告的特拉值:在GSM8K和MATH上,比以前的自我改进基线上+4至+17个百分点,大部分收益来自使用验证器进行推断时间选择而不是进行额外的发电机细节调整.

### 静态STAR:每代币的内部理性

泽利克曼等人问:如果模型在每个代币位置上学习生成一个短的内部理性,而不仅仅是问题和答案之间呢?静静的STaR训练模型在每个预测代币之前发出隐藏的"想法",然后通过学习的权重将意识预测与基线预测混合.

结果:Mistral 7B在 GSM8K 上从5.9%提高到10.9%, CommonsenseQA 提高了36.3%到47.2%,没有具体任务的细节调整.该模型学会了"什么时候思考"硬代币得到更长的内部理性;简单代币几乎没有.

### 为什么三个人都担心安全

通过错误的推理来达到正确的答案,利用快捷方式,猜测或使用非通用模式,得到积极的加强.在分布式问题上,快捷方式工作.在分布式问题上,它默默地打破.

验证器通过学习对理性进行排名来缓解,但验证器受训在同一标签组上.它可以学习更喜欢格式良好的错误推理,而不是诚实的不确定性.更安全的设计是将STaR类型的数据结合 (a) 过程监督的奖励模型 (奖励中介步骤,而不仅仅是答案) 和 (b) 持续的OOD评估,破坏简单的快捷方式.

### 进行比较

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### 在2026年堆中,

塔尔已经老了. 但这种模式在2025年至2026年, 对于可验证的数学问题 (DeepSeek-R1,Kimi-k1.5,o1) 的RL是STaR的答案条件梯度信号,扩大. 过程奖励模型 (Lightman等人,2023年;OpenAI的"让我们一步一步验证") 是过程监督的替代方案. 编程程序评估器,而不是标签. 达尔文·戈德机器 (课4) 是特工架子本身的STaR.

了解STaR使所有这些点击. 它是最小可行的自我改进循环.

```figure
reflection-loop
```

## 用它

`code/main.py`在玩具算术任务上运行模拟的STaR循环.

- 精度如何超越杆弹.
- 模拟器包括一个"惰"的理性类, 40% 的时间得到了正确的答案,但很糟糕地概括.
- 如何帮助推断,但不能完全剪除训练中引入的快捷方式.

## 运送它

`outputs/skill-star-loop-reviewer.md`在训练之前,它可以帮助你审核一个提出的自学推理管道.

## 运动

1. 运行模拟器. 设置快捷径频率为零,然后为0.4. 虽然两个运行之间的最终精度差异多大,但它们都在训练分布上达到90%以上?

2. 添加一个持续的OOD测试到模拟器中.从不同的分布中绘制问题,并评估在分发中和OOD组中启动的模型.量化差距.

3. 阅读"静静的TAR"论文 (arXiv:2403.09629) 第3节.

4. 比较STaR的保持如果正确的过器与一个由过程监督的替代品,以独立奖励每个合理步骤. 确定标签成本差异和可行的质量差异.

5. 设计一个评估,它会在部署的模型中捕获快捷方式理性. 它不必是完美的它必须打破一个STaR循环强化最简单的快捷方式.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## 进一步阅读

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465)原始的纸.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457)为推断时间选择添加了DPO验证器.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629)每代币的内部理性.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050)过程奖励模型,替代梯度信号.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948)                                                                                                                                                                                                                                                              
