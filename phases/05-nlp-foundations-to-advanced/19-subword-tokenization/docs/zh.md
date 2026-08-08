# 19 · 子词分词——BPE、WordPiece、Unigram、SentencePiece

> 词级分词器在遇到未见过的单词时束手无策。字符级分词器又会让序列长度爆炸。子词分词器在二者之间取得平衡。每一个现代大语言模型都建立在它之上。

**类型：** 学习
**语言：** Python
**前置：** Phase 5 · 01（文本处理）、Phase 5 · 04（GloVe / FastText / 子词）
**时长：** 约 60 分钟

## 问题所在

你的词表里有 50,000 个单词。一位用户输入了「untokenizable」。你的分词器返回 `[UNK]`。此刻模型对这个单词毫无信号可言。更糟的是：在你语料库中处于 90 分位的文档含有 40 个稀有词，这意味着每篇文档会丢失 40 比特的信息。

子词分词（subword tokenization）解决了这个问题。常见词依旧保持为单个 token。稀有词则被拆解为有意义的片段：`untokenizable` → `un`、`token`、`izable`。训练数据可以覆盖一切，因为任何字符串归根结底都是一串字节。

2026 年的每一个前沿大语言模型都建立在三种算法之一（BPE、Unigram、WordPiece）之上，并由三种库之一（tiktoken、SentencePiece、HF Tokenizers）封装。不选定其中之一，你就无法上线一个语言模型。

## 核心概念

〔图：BPE、Unigram、WordPiece 三种算法逐字符对比〕

**BPE（字节对编码，Byte-Pair Encoding）。** 从字符级词表起步。统计每一个相邻字符对。把出现频率最高的字符对合并成一个新 token。重复这一过程，直到达到目标词表大小。这是主流算法：GPT-2/3/4、Llama、Gemma、Qwen2、Mistral 都在使用。

**字节级 BPE（Byte-level BPE）。** 同样的算法，但作用于原始字节（256 个基础 token）而非 Unicode 字符。可以保证永远不会出现 `[UNK]` token——任何字节序列都能被编码。GPT-2 使用 50,257 个 token（256 个字节 + 50,000 个合并 + 1 个特殊 token）。

**Unigram。** 从一个超大的词表起步。给每个 token 赋予一个一元（unigram）概率。迭代地剪除那些移除后对语料对数似然增加最小的 token。它在推理时具有概率性：可以对分词方式进行采样（通过子词正则化（subword regularization）实现数据增强时很有用）。T5、mBART、ALBERT、XLNet、Gemma 都在使用。

**WordPiece。** 合并那些能最大化训练语料似然的字符对，而非单纯依据原始频率。BERT、DistilBERT、ELECTRA 都在使用。

**SentencePiece 与 tiktoken 的区别。** SentencePiece 是直接在原始 Unicode 文本上*训练*词表（BPE 或 Unigram）的库，它把空白字符编码为 `▁`。tiktoken 则是 OpenAI 的高速*编码器*，针对预先构建好的词表工作；它本身不做训练。

经验法则：

- **训练一个新词表：** 用 SentencePiece（多语言、无需预分词）或 HF Tokenizers。
- **针对 GPT 词表做快速推理：** 用 tiktoken（cl100k_base、o200k_base）。
- **两者兼顾：** 用 HF Tokenizers——一个库同时搞定训练与服务。

## 动手构建

### 第 1 步：从零实现 BPE

参见 `code/main.py`。核心循环如下：

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

这个算法编码了三个事实。`</w>` 标记词的结尾，因此「low」（作为后缀）和「lower」（作为前缀）能保持区分。频率加权让高频字符对在更早的轮次中胜出。合并列表是有顺序的——推理时会按训练时的顺序应用这些合并。

### 第 2 步：用学到的合并规则进行编码

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

这是朴素的 O(n·|merges|) 实现。生产级实现（tiktoken、HF Tokenizers）使用基于合并优先级（merge-rank）的查表配合优先队列，运行时间接近线性。

### 第 3 步：SentencePiece 的实战用法

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # 或者 "unigram"
    character_coverage=0.9995, # 对 CJK 调低（例如英文用 0.9995，日文用 0.995）
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

注意：无需预分词，空格被编码为 `▁`，`character_coverage` 控制着对稀有字符是积极保留还是映射为 `<unk>` 的力度。

### 第 4 步：用 tiktoken 处理 OpenAI 兼容词表

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

仅做编码。速度快（Rust 后端）。在做字节计数、成本估算、上下文窗口预算规划时，能与 GPT-4/5 的分词结果精确匹配。

## 到 2026 年仍频繁出现的坑

- **分词器漂移（Tokenizer drift）。** 用词表 A 训练，却部署到词表 B 上。Token ID 不一致，模型输出乱码。在 CI 中校验 `tokenizer.json` 的哈希值。
- **空白字符歧义。** BPE 中「hello」与「 hello」会产生不同的 token。务必显式指定 `add_special_tokens` 和 `add_prefix_space`。
- **多语言训练不足。** 以英文为主的语料会产生这样的词表：它把非拉丁文字拆分成多出 5 到 10 倍的 token。在 GPT-3.5 上，相同的 prompt 用日语/阿拉伯语会贵 5 到 10 倍。o200k_base 部分缓解了这个问题。
- **表情符号被拆分。** 单个表情符号可能占用 5 个 token。做上下文预算时，要专门核查表情符号的处理方式。

## 实际应用

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 从零训练单语言模型 | HF Tokenizers（BPE） |
| 训练多语言模型 | SentencePiece（Unigram，`character_coverage=0.9995`） |
| 提供 OpenAI 兼容 API 服务 | tiktoken（GPT-4 及以上用 `o200k_base`） |
| 领域专用词表（代码、数学、蛋白质） | 在领域语料上训练自定义 BPE，再与基础词表合并 |
| 边缘推理、小模型 | Unigram（较小的词表效果更好） |

词表大小是一个随规模而变的决策，而非一个常量。粗略的经验法则：参数量 <1B 用 32k，1-10B 用 50-100k，多语言/前沿模型用 200k 以上。

## 交付产出

保存为 `outputs/skill-bpe-vs-wordpiece.md`：

```markdown
---
name: tokenizer-picker
description: Pick tokenizer algorithm, vocab size, library for a given corpus and deployment target.
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

Given a corpus (size, languages, domain) and deployment target (training from scratch / fine-tuning / API-compatible inference), output:

1. Algorithm. BPE, Unigram, or WordPiece. One-sentence reason.
2. Library. SentencePiece, HF Tokenizers, or tiktoken. Reason.
3. Vocab size. Rounded to nearest 1k. Reason tied to model size and language coverage.
4. Coverage settings. `character_coverage`, `byte_fallback`, special-token list.
5. Validation plan. Average tokens-per-word on held-out set, OOV rate, compression ratio, round-trip decode equality.

Refuse to train a character-coverage <0.995 tokenizer on corpora with rare-script content. Refuse to ship a vocab without a frozen `tokenizer.json` hash check in CI. Flag any monolingual tokenizer under 16k vocab as likely under-spec.
```

## 练习

1. **简单。** 在 `code/main.py` 的微型语料上训练一个 500 次合并的 BPE。对三个留出（held-out）单词进行编码。其中有多少个恰好产生 1 个 token，多少个产生 >1 个 token？
2. **中等。** 在 100 个英文维基百科句子上，比较 `cl100k_base`、`o200k_base` 以及你自己训练的一个 vocab=32k 的 SentencePiece BPE 三者的 token 数量。报告各自的压缩比。
3. **困难。** 用 BPE、Unigram 和 WordPiece 在同一语料上训练。在一个小型情感分类器上分别使用三者，测量下游准确率。这一选择能否让 F1 指标变动超过 1 个百分点？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| BPE | 字节对编码 | 贪心地合并出现频率最高的字符对，直到达到目标词表大小。 |
| 字节级 BPE | 永远不会有未知 token | 在原始的 256 个字节之上做 BPE；GPT-2 / Llama 使用它。 |
| Unigram | 概率式分词器 | 用对数似然从一个大的候选集中剪枝；T5、Gemma 使用它。 |
| SentencePiece | 处理空白字符的那个 | 在原始文本上训练 BPE/Unigram 的库；空格被编码为 `▁`。 |
| tiktoken | 快的那个 | OpenAI 基于 Rust 的 BPE 编码器，针对预构建词表。不做训练。 |
| 合并列表（Merge list） | 那些魔法数字 | `(a, b) → ab` 合并规则的有序列表；推理时按序应用。 |
| 字符覆盖率（Character coverage） | 稀有到什么程度才算太稀有？ | 分词器必须覆盖的训练语料字符比例；典型值约为 0.9995。 |

## 延伸阅读

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) —— BPE 的奠基论文。
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) —— Unigram 的论文。
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) —— 该库的论文。
- [Hugging Face —— Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) —— 简明参考。
- [OpenAI tiktoken 仓库](https://github.com/openai/tiktoken) —— 实用手册 + 编码列表。
