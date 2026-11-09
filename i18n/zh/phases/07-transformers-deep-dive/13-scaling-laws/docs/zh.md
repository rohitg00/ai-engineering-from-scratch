# 规模规则

> 卡普兰论文说:较大的模型,损失较低. 霍夫曼论文说:你没有训练. 计算分为两个桶参数和代币,分歧不明显.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## 问题

训练计算的C FLOP,想要最好的模型,

1. **How many parameters (N)?**较大的模型,更大的容量.
2. **How many training tokens (D)?**更多数据,更好的容量利用.

利率大约为`6 × N × D`你可以把N推上下,或者D推上下.

在2022年前,答案是"按N硬".GPT-3 (2020) 是175B参数,训练在300B代币上.每参数约为1.7代币.卡普兰扩展法支持这一点.

霍夫曼等人 (2022年),训练了一家小型号的模型,叫做奇拉,发现了不同的东西:最佳比例接近**20 tokens per parameter**比 (70B参数,1.4T代币) 在每一个基准上都比GPT-3 (175B,300B代币) 低2.5倍的推断成本.

2026年是智拉的世界,有一个重要的转折.Llama 3 8B 训练用了15万亿代币,每参数的比率为1,875代币.九十四倍超过智拉的最佳. 推理成本比规模使用的模型的训练成本更重要,因此对较小的可部署足迹进行过度训练 (过去的智拉) 是2026年默认的.

## 概念

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### 霍夫曼法

根据"辛奇拉报"的报道,

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$=参数 (非嵌入式).
- $D$训练令牌
- $\alpha \approx 0.34$现在$\beta \approx 0.28$它们的位置是相对的.
- $E \approx 1.69$没有任何可能的损失.
- $A \approx 406$现在$B \approx 411$现在,我们要去.

根据你的规模,两个术语对彼此进行交易.$N$在固定计算 ($C = 6ND$通过" $\alpha$其他$\beta$值为 0.45 左右.$N$对于$D$根据预算,正确的最佳比率缓慢变化.`code/main.py`根据该论文的第一两个适应方法,直接测量最佳值,将两个指标设置为0.5.$D = 20N$在$C = 6ND$指的规则是:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

计算最佳:每参数20个代币.

### 无论如何,为什么过度训练

鱼优化降低了每次训练的损失,但你只要一次支付训练费用,

对于一个每月服务的聊天机器人,推理占据总成本.拉马的方法:训练较小,更长. 8B在15T的代币是深入推理优化的:

- 适合消费者GPU.
- 延迟是70B的微小部分.
- 质量对于大多数任务来说是足够的.

对于推断主导工作负载,正确的比率是每参数接近100500个代币,具体取决于服务量.

### 出现与流

声称:某些能力 (算术,多步推理,思想链接) 突然在某种程度上"出现".

谢弗等人 (2023) 认为这是一个测量器件:新兴指标使用不连续的分数 (准确匹配,门准确性) 隐藏了底层的逻辑的流改善.连续指标 (跨) 显示了流曲线.

根据2026年的统一意见,持续损失的预测是可靠的.基准跳跃通常是得分高的文物.根据持续指标规划预算.

### 2026年图片

规模化法仍然有效,但:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

光优化器 (Kimi Moonlight, 2024) 在匹配数据时显示了对 AdamW 的有效计算增长2x.一些2026 训练运行默认使用 Muon.改变了扩展法中的绝对常数,而不是其形状.

```figure
scaling-laws
```

## 建立它

看到`code/main.py`我们将吉拉损失方程运行,并解决计算最佳问题.$(N, D)$在每一个数个计算预算中.

### 步骤1: 虫的损失

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

剧情$L$作为一个轮$(N, D)$在固定$C = 6ND$找最少的东西.

### 步骤2:计算最佳边界

对于从 `1e17`为了`1e25`找出$(N, D)$减少损失$6ND = C$检查比率$D/N \approx 20$现在,我们要去.

### 步骤3:过度培训成本

计算训练10×较小模型 (1/10的最佳N,10×最佳D) 所支付的额外损失.

### 步骤4:与实际模型进行比较

报名`(N, D)`对于GPT-3,Chinchilla,Llama 3 8B,DeepSeek-V3 (活性参数) 的对,并比较预测与报告损失.

## 用它

你不可能自己训练一个边界模型,但扩展法则告诉你:

1. **Whether your fine-tune has enough data.**如果您的任务特定数据在基本模型的每个参数的20个代币以下,
2. **Whether to pick a bigger base model.**如果您把所有的预算都花在推断上, 宁愿使用更小,更长的训练模型.
3. **Where the returns diminish.**超过1000倍的吉拉最佳, 变量变得噪音.

**The research trajectory in 2026:**

- **Data-constrained regime.**网络拥有有限的高质量的代币 (过后英语510万亿).边界预训练正在接近这个限度.合成数据,多语言,多模式和RLHF尺度的细调是下一个杆.
- **Compute-multiplier tricks.**子优化器,MoE,更好的数据策划 每个都移动了绝对常数,而不是异常.
- **Scaling laws for RL.**早期证据表明,在RL样本中,

## 运送它

看到`outputs/skill-training-budget-estimator.md`技能选择`(N, D, hours, GPU)`根据计算预算,部署限制和目标损失,对新训练运行.

## 运动

1. **Easy.**跑步`code/main.py`打印西拉最佳$(N, D)$计算预算`1e20`现在`1e22`现在`1e24`比较真实模型表.
2. **Medium.**执行霍夫曼的损失函数计算曲线.`log10(C)`确定法律预测我们需要什么时候$>10^{28}$对于下一个0.1的交叉缩减.
3. **Hard.**根据你自己的规模法, 根据同一数据集训练的5个小模型 (100K到10M参数).$\alpha$其他$E$你的表达符与出版的表达符有多好?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## 进一步阅读

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361)第一份规模化法律论文;
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) ,我知道.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004)作为测量器件出现.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)为什么拉马的过度训练是适合工作量.
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) 2x计算乘法.
