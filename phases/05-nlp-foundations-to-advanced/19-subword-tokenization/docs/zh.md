# 子词分词 — BPE、WordPiece、Unigram、SentencePiece

> 单词分词器遭遇未见词时会失效。字符分词器则会导致序列长度爆炸。子词分词器在两者之间取得了平衡。每个现代大语言模型都依赖其中一个。

**类型：** 学习  
**语言：** Python  
**前置知识：** 阶段5·01（文本处理），阶段5·04（GloVe / FastText / 子词）  
**时间：** 约60分钟  

## 问题

你的词表有50,000个词。用户输入了"untokenizable"。你的分词器返回`[UNK]`。模型现在对这个词没有任何信号。更糟糕的是：你语料库中第90百分位的文档包含40个罕见词，这意味着每个文档丢失了40比特的信息。

子词分词解决了这个问题。常见词保持单个token。罕见词分解为有意义的片段：`untokenizable` → `un`，`token`，`izable`。训练数据覆盖所有内容，因为任何字符串归根结底都是字节序列。

2026年所有前沿大语言模型都依赖三类算法（BPE、Unigram、WordPiece）之一，封装在三个库（tiktoken、SentencePiece、HF Tokenizers）之一中。你无法在不选择一个的情况下发布语言模型。

## 概念

![BPE vs Unigram vs WordPiece，逐字符对比](../assets/subword-tokenization.svg)

**BPE（字节对编码）。** 从字符级别词表开始。统计每个相邻对的出现次数。将最频繁的对合并成一个新token。重复直到达到目标词表大小。主导算法：GPT-2/3/4、Llama、Gemma、Qwen2、Mistral。

**字节级BPE。** 相同的算法，但基于原始字节（256个基本token）而非Unicode字符。保证零`[UNK]` token——任何字节序列都可编码。GPT-2使用50,257个token（256字节 + 50,000次合并 + 1个特殊token）。

**Unigram。** 从一个巨大的词表开始。为每个token分配一个unigram概率。迭代剪除那些移除后对语料库对数似然增加最小的token。推理时是概率性的：可以对分词结果进行采样（通过子词正则化实现数据增强）。用于T5、mBART、ALBERT、XLNet、Gemma。

**WordPiece。** 合并那些使训练语料库似然最大化而非原始频率最大的对。用于BERT、DistilBERT、ELECTRA。

**SentencePiece 与 tiktoken。** SentencePiece 是*训练*词表的库（BPE或Unigram），直接在原始Unicode文本上操作，将空格编码为`▁`。tiktoken 是OpenAI的快速*编码器*，针对预先构建的词表；它不参与训练。

经验法则：

- **训练新词表：** SentencePiece（多语言，无需预分词）或 HF Tokenizers。
- **针对GPT词表进行快速推理：** tiktoken（cl100k_base、o200k_base）。
- **两者皆可：** HF Tokenizers —— 一个库，训练+服务。

## 动手实现

### 步骤 1：从零实现BPE

请看 `code/main.py`。核心循环：

```python
def train_bpe(corpus, num_merges):
    vocab = {tuple(word) + ("</w>",): count for word, count in corpus.items()}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for symbols, freq in vocab.items():
            for a, b in zip(symbols, symbols[1:]):
                pairs[(a, b)] += freq
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        vocab = apply_merge(vocab, best)
    return merges
```

算法编码了三个事实。`</w>` 标记词尾，使得 "low"（后缀）和 "lower"（前缀）保持区别。频率加权使得高频对先胜出。合并列表是有序的——推理时按照训练顺序应用合并。

### 步骤 2：使用学习到的合并进行编码

```python
def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [a + b] + symbols[i + 2:]
            else:
                i += 1
    return symbols
```

朴素实现复杂度为 O(n·|merges|)。生产实现（tiktoken、HF Tokenizers）使用合并等级查找和优先队列，运行时间接近线性。

### 步骤 3：实际使用 SentencePiece

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # 或 "unigram"
    character_coverage=0.9995, # 对于CJK语言可以更低（例如英语0.9995，日语0.995）
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

注意：无需预分词，空格编码为`▁`，`character_coverage` 控制保留罕见字符与映射为`<unk>`的激进程度。

### 步骤 4：针对OpenAI兼容词表使用 tiktoken

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

仅编码。快速（Rust后端）。与GPT-4/5分词完全匹配，用于字节计数、成本估算、上下文窗口预算。

## 2026年仍然存在的陷阱

- **分词器漂移。** 在词表A上训练，部署时使用词表B。Token ID不同；模型输出乱码。在CI中检查`tokenizer.json`哈希。
- **空格歧义。** BPE下"hello"和" hello"产生不同的token。始终显式指定`add_special_tokens`和`add_prefix_space`。
- **多语言训练不足。** 英语为主的语料库产生的词表会将非拉丁语系脚本分裂成5-10倍的token。同样的提示在GPT-3.5日语/阿拉伯语中成本高出5-10倍。o200k_base部分修复了这个问题。
- **表情符号分割。** 单个表情符号可能占用5个token。在预算上下文时检查表情符号处理。

## 使用场景

2026年的技术栈：

| 情况 | 选择 |
|-----------|------|
| 从头训练单语言模型 | HF Tokenizers (BPE) |
| 训练多语言模型 | SentencePiece (Unigram, `character_coverage=0.9995`) |
| 服务OpenAI兼容API | tiktoken (`o200k_base` for GPT-4+) |
| 领域特定词表（代码、数学、蛋白质） | 在领域语料上训练自定义BPE，与基础词表合并 |
| 边缘推理、小模型 | Unigram（较小的词表效果更好） |

词表大小是一个扩展决策，而非固定常量。粗略启发式：<1B参数用32k，1-10B参数用50-100k，多语言/前沿模型用200k+。

## 交付

保存为 `outputs/skill-tokenizer-picker.md`：

```markdown
---
name: tokenizer-picker
description: 针对给定语料库和部署目标，选择分词器算法、词表大小和库。
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

给定一个语料库（大小、语言、领域）和部署目标（从头训练 / 微调 / API兼容推理），输出：

1. 算法。BPE、Unigram 或 WordPiece。一句理由。
2. 库。SentencePiece、HF Tokenizers 或 tiktoken。理由。
3. 词表大小。四舍五入到最接近的千位数。理由与模型大小和语言覆盖率相关。
4. 覆盖率设置。`character_coverage`、`byte_fallback`、特殊token列表。
5. 验证计划。保留集上的平均token数/词、OOV率、压缩比、往返解码一致性。

拒绝训练覆盖率 <0.995 且包含罕见文字内容的语料库的分词器。拒绝在没有冻结 `tokenizer.json` 哈希检查的CI中交付词表。标记任何低于16k词表的单语言分词器为可能欠规格。
```

## 练习

1. **简单。** 在 `code/main.py` 的小语料库上训练一个500次合并的BPE。对三个保留词进行编码。有多少恰好生成1个token vs 大于1个token？
2. **中等。** 比较100个英语维基百科句子在 `cl100k_base`、`o200k_base` 和你训练的词表大小为32k的SentencePiece BPE下的token数量。报告每个的压缩比。
3. **困难。** 使用BPE、Unigram和WordPiece训练同一个语料库。在小型情感分类器上测量使用每种方法时的下游准确率。选择是否会使F1分数移动超过1个点？

## 核心术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BPE | 字节对编码 | 贪心地合并最频繁的字符对，直到达到目标词表大小。 |
| 字节级BPE | 从不会有未知token | 基于原始256字节的BPE；GPT-2 / Llama使用此方式。 |
| Unigram | 概率分词器 | 使用对数似然从大候选集合中剪枝；T5、Gemma使用。 |
| SentencePiece | 那个处理空格的 | 在原始文本上训练BPE/Unigram的库；空格编码为`▁`。 |
| tiktoken | 那个快的 | OpenAI基于Rust的BPE编码器，用于预先构建的词表。不训练。 |
| 合并列表 | 那些魔法数字 | 有序的 `(a, b) → ab` 合并列表；推理时按顺序应用。 |
| 字符覆盖率 | 多罕见才算太罕见？ | 分词器必须覆盖的训练语料库中字符的比例；典型值约0.9995。 |

## 延伸阅读

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) —— BPE论文。
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) —— Unigram论文。
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) —— 库论文。
- [Hugging Face — Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) —— 简明参考。
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) —— 示例代码 + 编码列表。