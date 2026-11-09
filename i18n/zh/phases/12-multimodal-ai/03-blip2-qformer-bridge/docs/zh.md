# 从CLIP到BLIP-2 Q-Former作为一种模拟桥梁

> CLIP将图像和文字相对应,但不能生成标题,回答问题,或进行对话. 通过跨度注意力来通过结结结 ViT 的特征,然后直接插入结结 LLM 的输入流中, 188万个桥梁参数将ViT-g/14连接到像11BFlan-T5-XXL这样大的结 LLM. 到2026年,每一个基于适配器的VLM都是 MiniGPT-4,InstructBLIP,LLaVA的表弟都是后代. 这一课程阅读了Q-Former的架构,解释了它的两阶段训练,

**Type:** Build
**Languages:** Python, TypeScript (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## 学习目标

- 解释为什么冷视觉编码器和冷的LLM之间的可训练的瓶比成本和稳定性更好.
- 实现一个跨重视区块,其中一个固定的学习性查询集处理外部图像特征.
- 通过BLIP-2的两阶段预训练:表示 (ITC + ITM + ITG) 然后生成 (通过冷解码器损失LM).
- 比较Q-Former与LLaVA中使用的简单的MLP投影机,并讨论当每一个选择赢得时.

## 问题

你有一个冷的ViT,每张图片产生256个补丁代币,每张图片均为14080.你有一个冷的7B LLM,预计将4096的代币嵌入.明显的桥梁从1408到4096 的线性层工作,但将所有256个补丁代币输入到LLM的文本中,每张图片每张代币额外256个.超过32个图像的批量仅仅是视觉模式消耗的8192个代币.

问:你可以将256个代币的图像表示压缩到更少的代币 (例如32个代币),同时保留足够的信息,让LLM能够标题,回答问题,并解释图像?

答案:一个Q-Former. 32个可学习的"查询"向量,它们交叉地处理VIT的补丁代码,产生了LLM所消耗的32代代码视觉总结.总共188万个参数.在触及LLM之前,训练有素进行对比,匹配和生成目标.

## 概念

### 需要学习的问题

模具的核心技巧:而不是让LLM的文字代币关注图像补丁,`Q`查询是模型的参数,它们是在训练中学习,并且用于每个图像的相同32个查询.

经过交叉关注,每个查询都包含了图像的压缩总结"描述主对象","描述背景","数对象",等.查询不真正专注于语义标签;它们学习任何编码导致下游损失下降.

### 建筑

形器是一个小型变压器 (12层,大约100M参数),具有两个路径:

1. 查询路径:32个查询向量通过自我注意 (彼此),然后通过冷的ViT补丁代币进行交叉注意,然后FFN.
2. 文本路径:一个类似BERT的文本编码器与查询路径共享自注意和FFN权重.文本路径被禁用交叉注意.

在训练时间,两个路径都运行.查询和文本通过共享自我注意力相互作用,这意味着查询可以对需要它的工作 (ITM,ITG) 进行文本条件.在VLM交付的推断时间,只有查询流过,产生32个视觉代币.

### 两阶段的培训

双重飞行器-2预训练有两阶段:

阶段1:代表性学习 (没有法学士).
- 图像与文本对比:集成查询代币和文本CLS代币之间的CLIP式对比.
- 图像和文本匹配:二进制分类器 是不是图像和文本对相匹配?硬负采矿.
- 图像基文本生成:因果性LM对文本进行标记,根据查询进行条件. 要求查询编码可生成文本的内容.

只有Q-Former列车,ViT被结,没有LLM涉及.

阶段2:生成学习. 附加一个结的LLM (OPT-2.7B或Flan-T5-XL,等).通过一个小的线性层将32个查询输出投影到LLM的嵌入式. 准备它们进入文本提示. 仅训练线性投影和Q-Former在LC损失上连接提示 +图像 +标题序列.

在第二阶段之后,Q-Former+投影是完整的视觉适配器.在推断时:图像 → ViT → Q-Former →线性项目 →预pendium → text → frozen LLM 发出.

### 参数经济学

造型 (B-Former) 总数为8B,训练有素188M.仅Q-Former为全堆参数的2.4% .训练成本反映了这一点:几天在少数A100s上与周为端到端.

质量:BLIP-2与Flamingo-80B相匹配或超过零射击VQA,同时小50倍.

### 导航BLIP和指令知情的Q-Former

导读BLIP (2023) 通过一个额外的输入:指令文本本身,扩展了Q-Former.在交叉注意力时间,查询现在可以访问图像补丁和指令.查询可以专业化每条指令 ("数车","描述情绪") 而不是学习单个固定总结.基准在完成任务上获益.

### 迷你GPT-4和仅用投影仪的方法

迷你GPT-4 保留了Q-Former,但仅训练出口线性投影,同时结了其他一切.便宜,但成本是质量.

### 为什么LLaVA变得更简单

拉瓦 (2023,课时12.05) 取代了Q-Former,用一个简单的2层MLP,将每个ViT补丁代币投射到LLM空间中. 压缩更糟,但让法师参加了原始补丁. 当时这是有争议的;到2023年底,它是主导的,因为视觉指导数据 (LLaVA-Instruct-150k) 证明MLP可以训练来保存足够的信号. 交易:LLaVA的背景更快地填充,但它自然可以扩展到多个图像和视频.

到2026年,该领域的分化:Q-Former在代币预算重要的地方存活下来 (长视频,许多图像);MLP投影器在每代币原质量优先考虑的地方占主导地位.

### 门的跨越注意力:弗拉明戈,祖先

弗拉明戈 (课 12.04) 在BLIP-2之前使用了相同的跨注意力想法,但在每个结的LLM层上,不是单一的桥梁.BLIP-2显示你可以只压缩到输入层,仍然工作.双胞胎和Idefics结合了两者:交叉输入代币加上可选的门式跨注意力在文本中的几次拍摄.

### 2026年的后代

- 问:前者:BLIP-2,InstructBLIP,MiniGPT-4,以及大多数视频语言模型,
- 感知器重样:弗拉明戈变体 (课 12.04);Idefics家族,,OmniMAE.
- 光器:LLaVA,LLaVA-NeXT,LLaVA-OneVision,Cambrian-1.
- 警池:维拉,帕利盖玛.

重要的问题是,你是否受到代币预算或质量限制.

```figure
modality-projection
```

## 用它

`code/main.py`建立一个像Q-Former这样的交叉注意力:

1. 模拟 256 个图像补丁代币 (dim 128).
2. 立即完成32个可学习的查询 (第128个).
3. 运行分点-产品跨度关注 (查询中的Q,补丁中的K/V).
4. 通过线性层进行LLMdim (512) 项目.
5. 输出32个准备好LLM的视觉代币.

算法是纯 Python (嵌在向量上循环).玩具但正确的形状.注意力重量矩阵打印,这样你可以看到每个查询从哪个补丁中拉出来.

## 运送它

这一课产生了`outputs/skill-modality-bridge-picker.md`鉴于目标VLM配置 (视觉编码器代币数量,LLM环境预算,部署限制,质量目标),它建议为每个桥梁提供简短的理由和参数数数量估计的Q-Former vs MLP vs Perceiver重样样本.

## 运动

1. 执行PyTorch中跨注意力区块. 检查32个查询和256个键/值,注意力重量矩阵为32 x 256 ,每行总和在 softmax之后为1.

2. 在BLIP-2阶段1中,Q-Former同时运行三个输失:ITC,ITM,ITG.用伪代码写出每个人的前进签名.哪个需要文字编码器路径才能活跃?

3. 比较参数数:Q-Former (12层,隐藏 768层) 与2层MLP投影机 (1408 → 4096,两个层).在什么LLM规模上,188MQ-Former成本回报了训练效率?

4. 阅读BLIP-2论文 (arXiv:2301.12597) 的3.2节,说明Q-Former如何初始化.解释为什么从BERT-base初始化 (非随机) 加速了融合.

5. 对于一个10分钟的视频,以1FPS样本为60个框架,计算每个框架代币成本 (Q-Former → 32代币/框架) 与 (MLP投影器 → 576代币/框架).

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention; Flamingo runs it once per image to make fixed latents, then reads them through gated cross-attention at every LLM layer |

## 进一步阅读

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597)核心纸
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086)前任与ITC/ITM/ITG三重组.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651)"前配线" 第一阶段训练的概念祖先.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500)          
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592)仅使用投影仪的方法.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795)学习性-查询性交叉注意力的一般架构.
