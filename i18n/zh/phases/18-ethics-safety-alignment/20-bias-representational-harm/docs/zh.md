# 在 LLM 中的偏见和代表性损害

> 卡莱戈斯,罗西,巴罗,坦吉姆,金,德恩科特,尤,张,阿赫迈德 (计算语言学2024年, arXiv:2309.00770). 根据2024年基础调查,分辨代表性损害 (刻板印象,删除) 与分配性损害 (资源分配不平等) 并将评估指标归类为嵌入式,基于概率或基于生成的文本. 2024-2025 经验: An et al. (PNAS Nexus,2025年3月) 在GPT-3.5Turbo,GPT-4o,Gemini 1.5Flash,Claude 3.5Sonnet,Llama 3-70B中测量跨界性别 x种族偏见,在自动评估20个入门级工作的简历上. 果实质性 (COLM 2025, arXiv:2508.07111) 引入了基于不确定性的交叉身份公平评估. 尤和安尼阿努2025年将性别神经元识别在MLP层中;阿桑和瓦莱斯2025年使用SAE来揭示临床种族偏见;周等人 头的注意力是为了头.  Meta-critic (arXiv:2508.11067):10年文学不成比例地关注二元性别偏见.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## 学习目标

- 定义代表性与分配损害,并在LLM部署中举一个例子.
- 举个名单,说明Gallegos及其他2024年的三个评估-计量类别,并描述每个计量类别的一个.
- 描述跨区性,以及为什么基于不确定性的WinoIdentity的公平度测量解决单轴偏见评估的缺陷.
- 描述对偏见的三个机械解释性方法 (性别神经元,SAE特征,注意力头操纵).

## 问题

之前的课程涵盖了故意的伤害 (入狱,策划) 和安全治理.偏见是从训练数据分发,快速框架,积累的设计选择中出现的伤害.测量和减少是对抗强度的独特方法挑战.

## 概念

### 代表性与分配性

- **Representational harm.**那些以女性为特色的护士的法律法师,
- **Allocational harm.**黑人申请人简历的评分系统地降低,

模型可以"具有代表性公正性" (产生多种描述),同时也可以"具有分配偏见性" (产生不平等的建议).评估需要衡量两者.

### 评估-计量类别 (Gallegos及其他2024年)

- **Embedding-based.**测试在RLHF前嵌入式中进行了WEAT式测试.测量身份术语和属性术语之间的统计联系.有限:测量了表现,而不是行为.
- **Probability-based.**记录概率: 证实刻板印象与违反刻板印象的完成. 解码器边测量. 捕捉一些行为偏见.
- **Generated-text-based.**经历评分,建议写作,对话. 环境最有效; 复制最难.

### 交叉性

对于"性别"的偏见评价忽略了只针对 (性别,种族) 双对的偏见. 一项研究发现,GPT-4o 处罚黑人女性在简历中分别得分超过黑人男性和白人女性.单轴评价不能捕获这一点.

果识别 (COLM 2025) 引入了基于不确定性的截面公平性.它测量模型对结果的不确定性是否在截面认同双体中不同,而不仅仅是点预测. 这捕获了模型在各组中同样错误的情况,但对一些人来说更不确定,从而产生了不同的下游分配行为.

### 机械方法

2024-2025年可解释性工作将对机械干预产生偏见:

- **Gender neurons (Yu & Ananiadou 2025).**特定的MLP神经元与性别特定的行为相关. 删除这些神经元可以减少性别差距的指标,而能力成本也有限.
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025).**缩自动编码功能将内部表示分解成可解释的维度;可以识别和压制与种族相关的特性.
- **UniBias (Zhou et al. 2024).**专用头显放大身份类敏感性;零化或重权这些头显减少偏见,没有细调.

### 对于"重点批判"

十年文学审查 (arXiv:2508.11067, 2025) 发现该领域对二元性别偏见的关注不成比例.其他轴 残疾,宗教,移民状态,多语言身份得到了更少的关注.

### 在这个阶段的第18阶段

课程20-21正式涵盖偏见和公平性.课程22涵盖隐私.课程23涵盖水标.这些是用户损害层补充早期欺骗/安全层.

```figure
an-bias-two-harms
```

## 用它

`code/main.py`通过简单的共产嵌入,测量身份术语和属性术语之间的距离:可以注入一个偏差并观察测量火;应用一个简单的脱操作并观察部分恢复.

## 运送它

这一课产生了`outputs/skill-bias-eval.md`鉴于模型卡或公平性要求,它审计了三个指标类别 (嵌入,概率,生成文本),跨区性覆盖和任何调整干预的机制的评估.

## 运动

1. 跑步`code/main.py`报告在退化步骤前后的WEAT类偏差分数.解释为什么指标不会降到零.

2. 通过交叉测试扩展探测器: (性别,种族) x (职业生涯,家庭). 报告跨轴偏差分数.

3. 阅读An et al. 2025 (PNAS Nexus). 确定他们报告的两个交叉效应,单轴性别评估将错过.

4. 和安尼阿努在2025年确定性别神经元. 绘制一个伪造实验,将区分"这些神经元导致性别偏见"和"这些神经元与性别偏见相关".

5. 分析人员认为,该领域对二元性别的关注太狭.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Representational harm | "stereotypes / erasure" | Biased portrayal of a group |
| Allocational harm | "unequal decisions" | Biased material outcome for a group |
| WEAT | "the embedding test" | Word Embedding Association Test; co-occurrence-based bias probe |
| Intersectionality | "combined identity effects" | Bias that emerges at the intersection of multiple identity axes |
| Gender neurons | "MLP bias neurons" | Specific neurons whose activations correlate with gender-specific behaviour |
| SAE feature | "interpretable dimension" | Sparse-autoencoder-identified feature; useful for mechanistic bias analysis |
| UniBias | "attention-head debiasing" | Zero-shot debiasing by reweighting attention heads |

## 进一步阅读

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770)法典调查
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343)五个模型的交叉研究
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111)新的基准
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612)零射击脱
