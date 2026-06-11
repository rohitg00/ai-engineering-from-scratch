# BERT -掩蔽语言建模

> GPT预测下一个单词。BERT预测缺少一个单词。一句不同的话--以及五年的一切嵌入--塑造了。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 05（全Transformer）、阶段5 · 02（文本表示）
** 时间：** ~45分钟

## 问题

2018年，每个NLP任务--情绪、NER、QA、蕴含--都在自己的标签数据上从头开始训练自己的模型。没有预先培训过的“理解英语”检查站可以进行微调。ELMo（2018）表明可以使用双向LSTM预训练上下文嵌入;它有所帮助，但并未普遍化。

BERT（Devlin等人，2018）问道：如果我们采用一个Transformer编码器，对互联网上的每个句子进行训练，并迫使它根据双方的上下文预测缺失的单词，会怎样？然后您对下游任务进行微调。参数效率是一个启示。

结果：18个月内，BERT及其变体（RoBERTa、ALBERT、ELECTRA）统治了现有的所有NLP排行榜。到2020年，地球上的每个搜索引擎、内容审核管道和语义搜索系统内部都有一个BERT。

到2026年，纯编码器模型仍然是分类、检索和结构化提取的正确工具--它们每个令牌的运行速度比解码器快5-10倍，而且它们的嵌入是每个现代检索堆栈的支柱。ModernBERT（2024年12月）通过Flash Attention + RoPE + GeGLU将架构推向了8 K环境。

## 概念

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### 训练信号

举一句话：“敏捷的棕色狐狸跳过了懒惰的狗”。

随机屏蔽15%的代币：

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

训练模型以预测掩蔽位置的原始代币。由于编码器是双向的，因此预测位置1处的“[MASK]”可以在位置2+处使用“棕色狐狸跳跃”。这是GPT做不到的事情。

### BERT面具规则

在选择进行预测的15%代币中：

- 80%被“[MASK]”取代。
- 10%被随机代币替换。
- 10%保持不变。

为什么不总是“[MASK]”？因为“[MASK]”在推理时永远不会出现。训练模型以在100%的掩蔽位置上预期“[MASK]”将在预训练和微调之间产生分布转变。10%随机+10%不变使模型保持诚实。

### 下一句预测（NSP）-及其被放弃的原因

原始BERT还对NSP进行训练：给定两个句子A和B，预测B是否跟随A。RoBERTa（2019）将其消融，并显示NSP受伤，而不是得到帮助。现代编码器跳过它。

### 2026年发生了什么变化：ModernBERT

2024年ModernBERT论文用2026年的原始数据重建了该街区：

| 组件 | 原版BERT（2018） | 现代BERT（2024） |
|-----------|----------------------|-------------------|
| 位置 | 学到的绝对 | 绳 |
| 激活 | 格卢 | GeGLU |
| 正常化 | 层规范 | 预范数RMS范数 |
| 关注 | 完全致密 | 交替本地（128）+全球 |
| 上下文长度 | 512 | 8192 |
| 分词器 | 文字片段 | BPE |

与2018年堆栈不同，它是Flash Attention原生的。序列长度为8 K的推理速度比DeBERTa-v3快2-3倍，GLUE评分更好。

### 2026年仍选择编码器的用例

| 任务 | 为什么编码器胜过解码器 |
|------|---------------------------|
| 检索/语义搜索嵌入 | 双向上下文=每个令牌更好的嵌入质量 |
| 分类（情感、意图、毒性） | 一次向前传球;无代费用 |
| NER /代币标签 | 按位置输出，原生双向 |
| 零镜头必然性（NLI） | 编码器顶部的分类器头 |
| RAG的重播 | 交叉编码器评分，比LLM rerankers快10倍 |

## 建设党

### 第1步：屏蔽逻辑

请参阅' code/main.py '。函数“Create_mlm_batch”获取令牌ID列表、vocab大小和屏蔽概率。返回输入ID（应用了屏蔽）和标签（仅在屏蔽位置，其他地方为-100- PyTorch的忽略索引约定）。

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### 第2步：在一个小的数据库上运行传销预测

训练2层编码器+传销头掌握20个单词、200个句子的词汇量。没有梯度-我们进行正向传递健全检查。全面培训需要PyTorch。

### 第3步：比较口罩类型

展示三向规则如何在没有“[MASK]”的情况下保持模型可用。预测非蒙面句子和蒙面句子。两者都应该产生合理的代币分布，因为模型在训练中看到了这两种模式。

### 4.微调头部

用玩具情感数据集中的分类头替换传销头。只有头部训练;编码器被冻结。这是每个BERT应用程序遵循的模式。

## 使用它

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

** 嵌入模型经过微调BERT。**“all-MiniLM-L 6-v2”等“业务转换器”模型是用对比损失训练的BERT。编码器是一样的。损失发生了变化。

** 交叉编码器重新排名器也经过微调BERT。**对'[LIS]查询[SEN]文件[SEN]'的分类成对。查询和文档之间的双向关注正是交叉编码器比双编码器具有质量优势的原因。

** 2026年何时不选择BERT。**任何生成的东西。编码器没有合理的方法来自回归产生代币。此外：1B参数以下的任何内容，小型解码器可以以更大的灵活性匹配质量（Phi-3-Mini、Qwen 2 -1.5B）。

## 把它运

请参阅“输出/skill-bert-finetuner.md”。该技能为新的分类或提取任务进行BERT微调（主干选择、头部规格、数据、评估、停止）。

## 演习

1. ** 简单。**运行“code/main.py”并打印10，000个代币的口罩分布。确认选择了~15%，其中~80%成为“[MASK]”。
2. ** 中等。**实施全词掩蔽：如果一个词被标记为子词，请一起掩蔽所有子词或不掩蔽所有子词。衡量这是否提高了500句句子的数据库上的传销准确性。
3. ** 很难。**在公共数据集中的10，000个句子上训练一个小型（2层，d=64）BERT。微调CST-2情绪的“[LIS]”代币。与匹配参数处仅限解码器的基线进行比较-哪个获胜？

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 传销 | “蒙面语言建模” | 训练信号：随机用“[MASK]”替换15%的标记，预测原始标记。 |
| 双向 | “看起来是双向的” | 编码器的注意力没有因果面具--每个位置都会看到每个其他位置。 |
| '[LIS]' | “地位代币” | 每个序列都预先有一个特殊的标记;其最终嵌入用作业务级表示。 |
| '[SEN]' | “段分隔符” | 分隔成对序列（例如查询/文档、句子A/B）。 |
| NSP | “下一句预测” | BERT的第二个预训练任务;在RoBERTA中被证明是无用的，在2019年之后下降。 |
| 微调 | “适应任务” | 保持编码器基本冻结;在顶部训练一个小脑袋以完成下游任务。 |
| 交叉编码器 | “重新排名者” | 将查询和文档作为输入的BERT输出相关性分数。 |
| 现代BERT | “2024年刷新” | 使用RoPE、RMSNorm、GeGLU、交替本地/全球关注、8 K上下文重建编码器。 |

## 进一步阅读

- [Devlin等人（2018）。BERT：用于语言理解的深度双向变形器预训练]（https：//arxiv.org/ab/1810.04805）-原创论文。
- [Liu等人（2019）。RoBERTa：一种稳健优化的BERT预训练方法]（https：//arxiv.org/ab/1907.11692）-如何正确训练BERT;杀死NSP。
- [克拉克等人（2020）。莱茨拉：预训练文本编码器作为鉴别器而不是生成器]（https：//arxiv.org/ab/2003.10555）-匹配令牌检测在匹配计算中击败了MLM。
- [华纳等人（2024）。更智能、更好、更快、更长：现代双向编码器]（https：//arxiv.org/ab/2412.13663）- ModernBERT论文。
- [HuggingFace ' modeling_bert.py ']（https：//github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py）-规范编码器参考。
