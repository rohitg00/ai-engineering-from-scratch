# 奖励模型和RLHF

> 人类不能写一个奖励函数"好助手响应",但他们可以比较两个响应,选择更好的. 适应一个奖励模型,然后 RL语言模型对比它. 基督徒 2017. 指示GPT 2022. 食谱使GPT-3变成ChatGPT. 2026年它主要被DPO 取代,但心理模型仍然存在.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## 问题

你训练了一个语言模型,以下一个代币预测目标.它写着语法英语.它也说谎,乱,拒绝拒绝.你不能通过更多的预训来解决这个问题.

您想要一个*scalar reward*,上面写着"A的反应比对 X的反应更好".写出奖励函数是不可能的."Helpfulness"不是一个封闭形式的表达式.但人类可以比较两个输出并标记一个偏好.

根据RLHF (Christiano et al. 2017; Ouyang et al. 2022) 将偏好转换为奖励模型,然后通过PPO来优化LM对付该奖励.在三个步骤中:SFT → RM → PPO.这是ChatGPT,Claude,Gemini和其他所有符合LLM在 20232025的配方.

2026年,PPO步骤主要被DPO (Phase 10 · 08) 取代,因为它更便宜,几乎对对对齐调整效果很好.但*奖励模型*仍然是每个Best-of-N样本,每个RL-from-verifiable-rewards管道的基础,以及使用过程奖励模型的每个推理模型的基础.了解RLHF,你将理解整个对齐堆.

## 概念

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**开始从预训练的基础模型. 精细调理人类写的目标行为示范 (遵循指示的反应,有用的答案等). 结果:一个模型 $\pi_{\text{SFT}}$虽然它是对良好的行为有偏见的,但仍然具有无限的行动空间.

**Stage 2: Reward Model training.**

- 收集对答案$(y_+, y_-)$为了得到提示$x$标记为"y_+ 优先于y_-."
- 培养一个奖励模式$R_\phi(x, y)$给更高的分数$y_+$现在,我们要去.
- 损失:**Bradley-Terry pairwise logistic**其他:

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$由于BT是标准的,它是现代RLHF中的主导选择.

- $R_\phi$转变器的背骨相同;单个线性层输出奖励.

**Stage 3: PPO against the RM with KL penalty.**

- 启动可培训的政策$\pi_\theta$其他$\pi_{\text{SFT}}$保持一个结的 * 参考 *$\pi_{\text{ref}} = \pi_{\text{SFT}}$现在,我们要去.
- 答复结束时的奖励$y$其他:

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  克莱特的罚款阻止了$\pi_\theta$由于自主而偏离$\pi_{\text{SFT}}$它是一个*规范性*的地区,而不是一个难以信任的地区.$\beta$通常是0.01-0.05.
- 运行PPO (课程 08) 通过此奖励.优势在代币水平轨迹上计算,但RM仅得分了全部响应.

**Why the KL?**没有它,PPO会很高兴找到奖励黑客策略. 人民币只在在分销完成中训练.$\pi_\theta$机器在RLHF中最重要的单个.

**2026 status:**

- **DPO**(拉法伊洛夫 2023):闭式代数崩 2+3阶段成为一个监督损失对偏好数据.没有RM,没有PPO.对计算的部分的对齐基准的质量相同.
- **GRPO**(DeepSeek 20242025):PPO以组相关基线而不是批评者,奖励来自*验证者* (代码运行 /数学答案匹配) 而不是人类训练的RM. 主导于推理模型.
- **Process reward models (PRMs):**评分部分解决方案 (每个推理步骤),用于RLHF和GRPO变体中的推理.
- **Constitutional AI / RLAIF:**通过一个合并的法定律师来生成偏好,而不是人类.

```figure
reward-model
```

## 建立它

通过使用微小的合成"提示"和"反应"作为字符串.RM是线性得分符号表现.没有真正的LLM 管道的 *形状*是重要的,而不是规模.`code/main.py`现在,我们要去.

### 步骤1:合成优先数据

```python
PROMPTS = ["help me", "answer me", "explain this"]
GOOD_WORDS = {"clear", "specific", "kind", "thorough"}
BAD_WORDS = {"vague", "rude", "wrong", "short"}

def make_pair(rng):
    x = rng.choice(PROMPTS)
    y_good = rng.choice(list(GOOD_WORDS)) + " " + rng.choice(list(GOOD_WORDS))
    y_bad = rng.choice(list(BAD_WORDS)) + " " + rng.choice(list(BAD_WORDS))
    return (x, y_good, y_bad)
```

在真正的RLHF中,这些标签被人类标签所取代.`(prompt, preferred_response, rejected_response)`是相同的.

### 步骤2:布拉德利-特里奖励模型

线性分数:`R(x, y) = w · bag(y)`减轻BT双日记损失:

```python
def rm_train_step(w, x, y_pos, y_neg, lr):
    r_pos = dot(w, bag(y_pos))
    r_neg = dot(w, bag(y_neg))
    p = sigmoid(r_pos - r_neg)
    for tok, cnt in bag(y_pos).items():
        w[tok] += lr * (1 - p) * cnt
    for tok, cnt in bag(y_neg).items():
        w[tok] -= lr * (1 - p) * cnt
```

经过几百次更新,`w`给好词标记赋予正面权重,给坏词赋予负面权重.

### 步骤3:除了人民币外,PPO类似的政策

我们的玩具政策从词汇中产生一个代币.$\log \pi_\theta(\text{token} \mid \text{prompt})$加入KL-to-reference罚款,并使用切割的PPO替代品.

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # ppo-style update on theta, treating reward as the return
    ...
```

### 步骤4:监控KL

轨道平均值$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$如果它过去,`~5-10`政策已经远离了 $\pi_{\text{SFT}}$两个$\beta$现在,如果这个问题是很低的, (请提高它,以撤回政策),或者奖励黑客开始了.

### 步骤5:使用TRL的生产配方

一旦你明白了玩具的管道, 这里就像一个真正的图书馆用户写的循环.[TRL](https://huggingface.co/docs/trl)是参考实施`RewardTrainer`对于第二阶段和`PPOTrainer`对于第三阶段,

```python
# Stage 2: reward model from pairwise preferences
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# dataset rows: {"prompt", "chosen", "rejected"} — Bradley-Terry format
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# Stage 3: PPO against the RM with KL penalty to the SFT reference
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

policy = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")
ref    = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")  # frozen

ppo = PPOTrainer(
    config=PPOConfig(learning_rate=1.41e-5, batch_size=64, init_kl_coef=0.05,
                     target_kl=6.0, adap_kl_ctrl=True),
    model=policy, ref_model=ref, tokenizer=tok,
)

for batch in dataloader:
    responses = ppo.generate(batch["query_ids"], max_new_tokens=128)
    rewards   = rm(torch.cat([batch["query_ids"], responses], dim=-1)).logits[:, 0]
    stats     = ppo.step(batch["query_ids"], responses, rewards)
    # stats includes: mean_kl, clip_frac, value_loss — the three PPO diagnostics
```

图书馆为你做了三件事.`adap_kl_ctrl=True`执行适应β时间表:如果观察到的KL超过`target_kl`参考模型是按照惯例结的, 您不能意外地与`policy`价值率与政策的基础 (`AutoModelForCausalLMWithValueHead`由于TRL的数据显示,`policy/kl`其他`value/loss`单独的.

## 陷

- **Over-optimization / reward hacking.**子是不完美的.$\pi_\theta$发现高分但不佳的对立性完成. 症状:奖励无限上升,而人类评价分水平高或下降. 修正:早点停止,提高 $\beta$增加了训练数据.
- **Length hacking.**训练在有用的反应上,RM通常隐含地奖励长度.政策学习填补响应.补救:长度正常化的奖励,或RLAIF与长度意识的RM.
- **Too-small RM.**只有一个小的RM才能准确地评分出口.
- **KL tuning.**太低 β →漂移和奖励黑客.太高 β →政策几乎没有改变.标准技巧是*适应性* β 针对每步的固定 KL.
- **Preference-data noise.**通过训练RM使用协议过数据或使用BT温度进行校准.
- **Off-policy problems.**监测剪辑分数,如第08课.

## 用它

2026年RLHF是层次的:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

在2026年,生产配线管道将用于RM密集型或安全关键的步骤,仅用于DPO.

## 运送它

保存如`outputs/skill-rlhf-architect.md`其他:

```markdown
---
name: rlhf-architect
description: Design an RLHF / DPO / GRPO alignment pipeline for a language model, including RM, KL, and data strategy.
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

Given a base LM, a target behavior (alignment / reasoning / refusal / agent), and a preference or verifier budget, output:

1. Stage. SFT? RM? DPO? GRPO? With justification.
2. Preference or verifier source. Humans, AI feedback, rule-based, unit-test-pass, or reward distillation.
3. KL strategy. Fixed β, adaptive β, or DPO (implicit KL).
4. Diagnostics. Mean KL, reward stability, over-optimization guard (holdout human eval).
5. Safety gate. Red-team set, refusal rate, safety RM separate from helpfulness RM.

Refuse to ship RLHF-PPO without a KL monitor. Refuse to use an RM smaller than the target policy. Refuse length-only rewards. Flag any pipeline that does not hold back a blind human-eval set as lacking over-optimization protection.
```

## 运动

1. **Easy.**训练布拉德利-特里奖励模型`code/main.py`在500个合成优先对上,对100个被持久对上,测量对准.应超过90%.
2. **Medium.**使用玩具PPO-RLHF循环运行$\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$对于每一个,图片的RM分数与KL参考更新.
3. **Hard.**根据相同的偏好数据实施DPO (闭式形式偏好概率损失),并在计算中使用的RLHF-PPO管道和最终RM分数中进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RLHF | "Alignment RL" | Three-stage SFT + RM + PPO pipeline (Christiano 2017, Ouyang 2022). |
| Reward Model (RM) | "The scoring net" | Learned scalar function fit to pairwise preferences via Bradley-Terry. |
| Bradley-Terry | "Pairwise logistic loss" | $P(y_+ \succ y_-) = \sigma(R(y_+) - R(y_-))$; the standard RM objective. |
| KL penalty | "Stay near the reference" | $\beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$ in the reward; the anti-reward-hacking regularizer. |
| Reward hacking | "Goodhart's law" | Policy exploits RM flaws; symptoms: reward up, human eval flat. |
| RLAIF | "AI-labeled preferences" | RLHF where labels come from another LM instead of humans. |
| PRM | "Process Reward Model" | Scores partial reasoning steps; used in reasoning pipelines. |
| Constitutional AI | "Anthropic's method" | AI-generated preferences guided by explicit rules. |

## 进一步阅读

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741)是RLHF创始人.
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) ChatGPT背后的食谱.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325)之前的RLHF进行总结.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290)                           
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073)                  
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862)HH纸.
- [Hugging Face TRL library](https://huggingface.co/docs/trl)生产`RewardTrainer`其他`PPOTrainer`阅读训练人员来源,了解适应性KL和值值.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)通过三阶段管道的可行通行图表.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl)图书馆;`examples/`对于Llama,Mistral和Qwen,它有了端到端的RLHF脚本.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf)奖励假设观点;对于考虑奖励黑客的基本前提.
