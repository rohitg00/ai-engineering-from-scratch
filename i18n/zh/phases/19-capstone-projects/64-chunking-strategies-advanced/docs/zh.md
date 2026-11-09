# 碎策略,相比

> 碎决定你的回升器能出现什么, 错误地划界限, 没有嵌入模型, 没有重排器, 没有LLM可以修复下游的损坏.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 lessons 04 (embeddings), 06 (RAG), 07 (advanced RAG); Phase 19 Track B foundations (lessons 20-29)
**Time:** ~90 minutes

## 学习目标
- 从零开始实施五种分断策略:固定窗口,句子,递归分断,语义集群和结构分类标题.
- 测量以黄金标记的答案范围为止的固定材料体内 recall@k,并解释为什么一个策略在散文上获胜,而另一种策略在技术文件上获胜.
- 阅读一段时间分布,并识别每个策略所注入的失败模式:孤儿句子,中标的切割,仅标题的部分,语义漂移.
- 通过检查三个属性来选择一个新的体积的默认,而不运行基准:文档类型,平均段子长度,以及格式是否具有明确的结构.

## 问题

每个RAG管道都开始切割源文档成足够小的部分,以使嵌入模型适合它们,并且足够大,以使每个部分都具有独立的想法.切割地点的选择不是一个超参数.这是检索器能回归的上限.

问"预算中断门是什么样子"的查询只能成功, 如果固定窗口分区器从周围的环境中切除了门值,嵌入将转移到不同的集群,BM25分数下降,重排查器看到噪音,LLM生成的答案是错误的. 2024年"LongRAG:通过长文本LLM增强回收生成"的论文仅仅是从分量选择中测量了回收回收的绝对转变率为35%. 后续工作在2025年对文本部分标题缩小了差距,但并没有缩小它.

这一课将五种策略放在一边, 运行它们与金标记的答案范围的固定组合,

## 概念

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### 固定窗口

粗力基线.切除每一个N字符.可选地重叠,因此在N位置切断的句子在N位置开始的部分内出现完整.在边界快速,确定性,可怕.用它作为控制,而不是默认.

### 判决

通过Regex或简单的状态机划分句子边界.将一个或多个句子包装成一个部分,达到目标字符预算.停止切割中文字.仍然切割中段和中段.许多早期RAG管道中的默认和没有其他结构的散文的合理选择.

### 复发分

根据"二次新线"的定义,在一个区别中,一个区别是"二次新线" (二次新线,一段),然后是"单一新线",然后是"字符".当部分适合预算时,复制结束.在文件中,有不一致的结构,因为它适应每个地区.

### 语义集群

嵌入每个句子. 集结连接句子,共享一个主题中位数. 切除每当与中位数的运行相似性下降到门. 边界反映了意义,而不是字符. 缓慢构建,依赖嵌入模型,但对在段落内更换主题的文档具有弹性.

### 结构性标记标题

对于包含明确结构的文件 (标记,重构文本,RFC式编号部分),切断标题边界.每个部分成为标题加上下面的所有内容,并将其降至下一个标题,以相同或更高的水平.每个主题的最小部分,但只有在体积形成良好时才可用.

### 如何测量边界选择

标有金色的查询包含源文档内部的答案跨度的确切字符抵消. 碎后,你问: 取器回来的任何一块是否覆盖了黄金跨度? 如果是,那么对此查询的 recall@k 为 1. 如果没有,则是0. 查询组中平均值 对于每个策略进行相同的评估, 扩散显示了您在您的结构中存活的边界政策.

```figure
ci-chunk-boundaries
```

## 建立它

`code/main.py`执行:

- `fixed_window(text, size, overlap)`- 基本线.
- `sentence_chunks(text, target)`- - 简单的句子包装.
- `recursive_split(text, separators, target)`- 层次回归.
- `semantic_chunks(text, similarity_threshold)`- 基于中心位的集群,在确定性模拟嵌入的顶部.
- `structural_markdown(text)`- 标题意识的分区器.
- `mock_embed(text, dim)`- 基于哈希的嵌入,所以循环运行离线.
- `DenseIndex`- 类似于19期B轨道混合物检索课程中使用的形状.
- `eval_recall(strategy, corpus, queries, k)`- - 比较循环.
- `main()`运行每个策略在固定器件体内,打印一个回调@k表.

运行它:

```bash
python3 code/main.py
npx tsx code/main.ts
```

输出表是一个小表,每个策略有一个行,每个k一个列.句子在结构式固定上输掉.结构性划分在划分固定上获胜.回复性保持在混合固定上,因为回复性适应.在没有有用的结构线索的情况下,语义聚合在散文固定上获胜.

## 失败模式表不会隐藏

**Orphan sentences.**语句包装产生错过主题句子的部分. 嵌入后指向错误的集群.

**Mid-symbol cuts.**固定窗口内代码或YAML将识别符分为两半.

**Header-only chunks.**结构性值发出一个部分,只包含`## Title`过这些或附上下一个部分的第一段.

**Semantic drift.**语义集群在一个主题上均时,下切割.一个5000字符的部分将许多具体答案包装成一个分散的嵌入.将语义与硬字符盖合在一起.

**Stale embeddings.**语义集群使用嵌入模型.如果你改变模型,你也会改变块. 按单元模型与检索模型分开,或者重新构建索引.

## 选择默认值而没有运行基准值

三个属性决定了新的体积的默认分数.

| Property | Value | Default |
|----------|-------|---------|
| Document type | Prose with no structure | Recursive split, target 800 |
| Document type | Markdown / RFC / API docs | Structural markdown |
| Document type | Code | AST-aware (out of scope; see Phase 19 lesson 02) |
| Paragraph length | Long, single topic | Sentence, target 500 |
| Paragraph length | Short, mixed topics | Semantic, threshold 0.6 |

只有一个战略的基础.

## 用它

生产模式:

- 在运送新管道之前,运行评估;不要相信您的图书馆默认的策略.
- 每当你改变嵌入模型或体组混合时,再运行评估;获胜者是体组依赖的.
- 保持每个部分的元数据中战略名称,以便您可以稍后归因回归.

## 运送它

在第69课中,F轨道端到端RAG系统使用了这里选定的克作为其第一阶段.在第68课中,评估带写出 recall@k 从相同的形状`eval_recall`选择一个胜利的策略,然后把它推进.

## 运动

1. 添加第六个策略:使用代币窗口`tiktoken`根据相同的装置的固定窗口进行比较.
2. 给表格重新运行,解释为什么除了结构性划分之外的每个策略都失去了回忆.
3. 取代确定性嵌入式与您的项目真正提供商的嵌入式.测量语义集群回忆 delta.报告战略之间的差距是否扩大或缩小.
4. 添加一个`summary`单片段的字段:一个句子的中心形容. 再次运行评估,并附加总结到单片体内. 测量召回升.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Recall@k | "Did we get the right chunk?" | Fraction of queries where any of the top-k chunks overlaps the gold answer span |
| Chunk overlap | "Sliding window" | Re-include the last N characters of the previous chunk in the next chunk |
| Structural splitter | "Header-aware chunks" | Cut at H1/H2/H3 boundaries; the heading text is part of the chunk |
| Semantic chunker | "Topic-aware chunks" | Embed sentences, cluster by centroid similarity, cut on drift |
| Centroid drift | "Topic shift" | Cosine similarity between the running mean and the next sentence drops past a threshold |

## 进一步阅读

- [LongRAG: Enhancing Retrieval-Augmented Generation with Long-context LLMs (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, Chunking strategies for production RAG](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- 第十一阶段第六课 - RAG基本面
- 阶段11课07 - 高级RAG
- 第19阶段课程65:混合采集,
- 第19阶段课程68 - 评估杆,以评分生产中的战略选择
