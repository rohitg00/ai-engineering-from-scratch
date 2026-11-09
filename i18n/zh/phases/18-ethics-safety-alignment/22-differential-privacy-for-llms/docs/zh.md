# 法律法师的不同隐私

> 噪音注射梯度更新仍然提供正式的 (epsilon, delta) 保障. 计算,内存和实用性方面的总费用很大;参数效率的DP细调 (LoRA + DP-SGD) 是常见的2025配置 (ACM 2025). 两种证据存在紧张局势:基于加拿大的成员结论 (Duan等人,2024) 报告对语言模型的有限成功;培训数据提取 (Carlini等人,2021年;Nasr等人,2025年) 恢复了大量的字面记忆. 决议 (arXiv:2503.06808,2025年3月): 差距在测量的插入加拿大与"最可提取"数据中. 新的鱼设计使得无影模型的损失基MIA成为可能,并产生了基于现实数据的LLM培训的第一次非微观DP审计,具有现实DP保证. 其他方法:PMixED (arXiv:2403.15638) 通过接下来的代码分布专家的混合,在推断时进行私人预测;DP合成数据生成 (Google Research 2024). 攻击:通过LLM反 信任评分泄漏的差异性隐私逆转.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## 学习目标

- 定义 (epsilon, delta) - 差异性隐私,并说明DP-SGD配方.
- 解释2024-2025年的紧张局势:加拿大鱼MIA与训练数据提取的情况是不同的.
- 描述PMixED以及为什么推断时间私人预测是DP培训的替代品.
- 通过LLM反攻击来描述差异性隐私逆转.

## 问题

卡利尼等人2021年显示,生产语言模型在需求上复制了文字体训练文本.DP是正式的防御:训练,使输出对任何单一训练例子都不敏感.2024-2025年的证据表明DP-SGD是必要的,但部署的 ε值可能不匹配威胁模型.

## 概念

### 区别隐私

一个随机算法$M$是$(\varepsilon, \delta)$-DP如果在一个例子和任何事件中不同的两个数据集$S$其他:

```math
P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta.
```

解释:输出分布足够接近 (以 ε 参数化),以免可靠地推断任何单个人的贡献,除非是可能 δ.

### 其他类型

标准食谱:
1. 试一批小品.
2. 计算每例梯度.
3. 按每例梯度切换到值C.
4. 总算剪缩梯度,并用 std 添加高斯噪音$\sigma \cdot C$现在,我们要去.
5. 通过噪音的数量更新参数.

隐私成本由会计师 (时刻会计师,Rényi DP会计师) 追踪. 在LLM文献中报告的 ε值因威胁模型,数据敏感性和实用性目标而大大不同;没有普遍"安全"默认 ε. 在某些LLM培训设置中,已发表的例子大约为 ε ≈ 110,但这些是说明性不建议的默认设置. 低 ε 通常需要更多的噪音,可以增加使用效率损失.

### 洛拉+DP-SGD

边界模型的完整DP-SGD是禁止的.LoRA (Hu et al. 2022) 限制梯度更新到小型适配器,减少每个例子梯度存储.LoRA + DP-SGD是2025年常见的配置.DP保证适配器;基模型保持固定.

### 2024-2025年紧张局势

两条证据:

- **Canary MIA (Duan et al. 2024).**通过编写一个语言模型,可以将独特的类插入训练数据中,测量会员身份传输攻击者是否能够识别它们. 报告语言模型的成功有限. 建议MIA是困难的.
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).**通过一个前,测量模型是否从训练中恢复文字文本.报告了大量的记忆.建议MIA在相关意义上是简单的.

2025年3月的决议 (arXiv:2503.06808):两种测量不同.MIA问"插入的鱼类上是e的例子吗?"鱼类提取问题"我可以从D中恢复什么?""最可提取的"例子是对隐私的重要;鱼类低于报告,因为它们没有优化以获得提取.

基于损失的MIA,没有影子模型. 基于现实数据的LP证券的LLM的第一次非微观DP审计.

### 其他类型的培训

- **PMixED (arXiv:2403.15638).**预测时间: 专家对下一个代码的分布进行混合; 每个专家都会看到训练数据的碎片; 聚合增加了DP的噪音. 完全避免DP训练.
- **DP synthetic data generation (Google Research 2024).**通过DP-SGD进行LoRA细调,采样合成数据,训练下游分类器对合成数据.

两者都以不同的威胁模式为代价,避免了全面的 DP 培训的实用成本.

### 通过LLM反方式的差异性隐私反

现在,我们需要一个新的方法来帮助我们,我们需要一个新的方法来帮助我们.

防守:不要暴露秘密,或者在暴露之前切断/量化它们.这是 (ε, δ) -DP训练之外的额外要求.

### 在这个阶段的第18阶段

课程20-21是偏见/公平.课程22是隐私.课程23是通过水标的来源.课程27涵盖监管数据来源层.

```figure
an-dp-clip-noise
```

## 用它

`code/main.py`模拟在玩具二进制分类数据集上DP-SGD.你可以扫描噪音乘法 σ和剪切标准 C,跟踪 (ε, δ) 预算和准确性成本.一个"加拿大攻击"插入了一个独特的训练示例,并测量日志损失测试是否可以在DP之前和之后检测它.

## 运送它

这一课产生了`outputs/skill-dp-audit.md`鉴于对语言模型部署的DP索赔,它审计: (ε, δ) 值,所使用的会计师,MIA评估协议以及是否评估了信任暴露向量.

## 运动

1. 跑步`code/main.py`扫描$\sigma \in \lbrace 0.5, 1.0, 2.0 \rbrace$报告 (ε, δ) 精度交易. 确定公用事业崩的点.

2. 测量在 DP-SGD前后的检测率$\sigma = 1.0$现在,我们要去.

3. 阅读Nasr et al. 2025关于训练数据提取.为什么在中度 ε下,提取成功不会崩?这意味着MIA作为评估的什么?

4. 设计一个使用PMixED (arXiv:2403.15638) 的部署,完全在推断时间运行.PMixED解决的威胁模型是什么,而DP-SGD没有?

5. 通过LLM反攻击绘制DP反转图,设计一种限制信任评分泄漏的反措施,并估计其部署成本.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## 进一步阅读

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133)标准的DP培训算法
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805)法典提取纸
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841)有限成功的MIA
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808)电压的解压
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638)推断时间私人预测
