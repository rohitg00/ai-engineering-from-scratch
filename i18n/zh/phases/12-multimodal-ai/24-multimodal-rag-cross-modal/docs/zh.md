# 多模特RAG和跨模特检索

> 视觉原生文件RAG是一个片. 制作多模式RAG更广泛,用于旅行规划 ("找到我一顿安静的素食式早餐与自然光"),医疗分类 ("什么伤害匹配这个照片 + 这些笔记"),电子商务 ("类似于这个自拍的服装,我的尺寸"),以及现场服务 ("诊断这个引擎声音加上部分照片"). 两项调查,包括: 编码了以下问题:跨模式检索,检索融合,生成定位,多模式评估. 这一课程将阅读调查,并设计生产管道.

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator), TypeScript
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## 学习目标

- 设计跨模式检索:文字 →图像,图像 →文字,音频 →视频等
- 比较三种融合策略:分数融合,基于注意力的融合,MoE融合.
- 解释一代的基础:当来源是各种方式的混合时,"引用你的来源"是什么样子.
- 举个2025年的三项可行多模式RAG调查及其子问题分类.

## 问题

单模式RAG是一个解决的模式:嵌入查询,嵌入块,检索,东西进入LLM.多模式RAG需要:

1. 复杂的检索头 (每个模式需要嵌入在兼容空间中).
2. 通过各种方式,检索结果的融合.
3. 基于各种方式的来源.
4. 评估指标涵盖跨模式信号.

调查结果都以相同的类别来分析.

## 概念

### 跨模式检索

获取B模式的文件,以A模式的查询.三个模式:

1. 共同嵌入空间.Clip 和 CLAP 在共享空间中生成文字+图像/文字+音频嵌入. 模式中的可西因相似性直接工作.仅限于 CLIP 训练的对.

2. 文本编码器+图像编码器+一个小的翻译模块,在空间之间绘制图像. 古普塔等人的Sen2Sen和其他2024设计. 灵活但增加了复杂性.

3. 作为编码器,使用VLM的隐藏状态作为检索表示.任何模式VLM支持的运行.更高质量,更昂贵.

选择:Clip/SigLIP 2用于文字+图像;CLAP用于文字+音频;VLM隐藏状态用于跨模式在边界质量.

### 融合战略

您获取了10个结果:5张图像,3条文本段,2条音频段.

积分融合 (最便宜).每个模式都有自己的回收器,每个返回积分. 在模式中正常化积分,然后总和. 简单,经常有效.

聚焦,聚焦所有检索的物品,让一个小的注意力网络重量它们.

模拟化. 网路向特定模式专家通关. 不同的查询类型的路线不同. 视觉问题重量图像更高.

产品默认:分数融合,对查询的主导模式有轻微的偏见. 如果 A/B 显示您的域名明显获胜,则升级到 MoE.

### 产物定位

合同集团应指出哪个收获的项目驱动了每个索赔.

- 文本来源:标准引用`[1]`现在,我们要去.
- 图片来源:`[img 3]`简短的标题.
- 音频:`[audio 2 at 0:34]`现在,我们要去.

训练发电机使用基础知识数据:训练目标中的每个索引都标记着源索引.

### 2025年调查

关于"多模式RAG"的类别:包括取回,融合,生成.

专注于子任务基准和故障模式. 对于评估设计有用.

等人 (arXiv:2503.18016):以视觉为中心的调查.

阅读这三个都给你提供了2025年春季的最新技术.

###                                                                                                                                                                                                                                                               

MuRAG (Chen等, 2022) 是第一个多模拟RAG.从多模拟 KB中检索了图像+文字,生成了答案.在VLM波之前显示了可行性.现代系统 (REACT,VisRAG,M3DocRAG) 基于它.

### 制作旅行规划器的例子

问: "给我一个安静的素食式早餐,

管道:

1. 解散查询. "quiet" → 音频/评论关键词; "vegan brunch" → 菜单项; "自然光" → 图像功能.
2. 按模式取回:
   - 评论内容: "素食主义者午餐,安静的氛围".
   - 餐厅照片中的图像检索: "自然光,空气".
   - 环境音频录像:低分贝,没有音乐.
3. 每个餐厅都有复合的分数.
4. 顶级餐厅 → 具有所有证据的VLM发电机 → 引用的答案.

每种模式都增加了单独的短信错过的信号.

### 机械多模性RAG

复式:如果第一次检索没有返回高自信的答案,LLM重新构成并再次检索.从第14阶段的代理RAG模式适用于这里.

- 检索初始的前十 → LLM要求"太噪音,过器为 <40 dB" →重新检索.
- 检索图像 → LLM 看到一个有菜单 →检索菜单文本 →答案.

增加复杂性,但处理单次检索无法的查询.

### 评估

跨模式评估还未成熟.

- 按方式召回.
- 混合的高-K精度.
- 人类判断的终端到终端满意度.
- 具体任务 (预订完成,购买完成).

没有标准基准涵盖所有方法.大多数论文评估了特定领域的任务.

```figure
contrastive-matrix
```

## 用它

`code/main.py`其他:

- 通过三种假装检索器 (文字,图像,音频) 运行共享餐厅.
- 结合可配置的权重的模式分数.
- 发出最后答案的引文.
- 如果信心低,则重新表达查询的简单代理循环.

## 运送它

这一课产生了`outputs/skill-multimodal-rag-designer.md`根据产品规格,具有多模式查询流程,设计取回器,融合,生成器和评估.

## 运动

1. 提出医疗选多模式RAG:查询 =伤势照片 + 文字症状.从哪个 KB中获取哪些方法?

2. 合是一个简单的权重总和. 它有哪种失败模式,

3. 阅读Abootorabi等类别 (第三节).

4. 设计出一个为旅行规划器多模拟RAG的评估规格. 哪些指标涵盖图像回忆,音频回忆和复合正确性?

5. 代理多跳转RAG每次回来旅行都有延迟税.在哪个查询难度上,准确度增加可以证明延迟?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | Text query retrieves images; image query retrieves text; requires a shared space or translator |
| Score fusion | "Combine scores" | Weighted sum of per-modality retrieval scores; simplest fusion |
| MoE fusion | "Modality-routed experts" | Gating network picks which modality's scores to trust per query |
| Grounded generation | "Cite your sources" | Each claim in the answer tagged with the source index |
| MuRAG | "First multimodal RAG" | 2022 paper that established the multimodal RAG pattern |
| Agentic multi-hop | "Reformulate and retry" | LLM re-queries retrievers when first-pass confidence is low |

## 进一步阅读

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
