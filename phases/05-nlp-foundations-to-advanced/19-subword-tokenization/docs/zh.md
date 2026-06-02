# 子词 tokenization —— BPE、WordPiece、Unigram、SentencePiece

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 词级 tokenizer 遇到未登录词就卡壳。字符级 tokenizer 让序列长度爆炸。子词 tokenizer 取了个折中。每一个现代 LLM 都基于它发布。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 01（Text Processing）、Phase 5 · 04（GloVe / FastText / Subword）
**Time:** ~60 minutes

## 问题（The Problem）

你的词表里有 5 万个词。用户输入了 "untokenizable"。你的 tokenizer 返回 `[UNK]`。模型对这个词彻底失去信号。更糟糕的是：你语料里 90 分位的文档包含 40 个稀有词，意味着每篇文档丢掉 40 bit 的信息。

子词 tokenization 解决了这件事。常见词保留为单个 token。稀有词被分解为有意义的片段：`untokenizable` → `un`、`token`、`izable`。训练数据能覆盖一切，因为任何字符串归根结底就是一串字节。

2026 年所有前沿 LLM 都基于三种算法之一（BPE、Unigram、WordPiece）发布，并被三种库之一（tiktoken、SentencePiece、HF Tokenizers）封装。你不可能在不挑一组的前提下发布语言模型。

## 概念（The Concept）

![BPE vs Unigram vs WordPiece, character-by-character](../assets/subword-tokenization.svg)

**BPE（Byte-Pair Encoding，字节对编码）。** 从字符级词表起步。统计每一对相邻符号。把最高频的对合并成一个新 token。重复，直到达到目标词表大小。主流算法：GPT-2/3/4、Llama、Gemma、Qwen2、Mistral。

**字节级 BPE（Byte-level BPE）。** 同样的算法，但作用在原始字节（256 个基础 token）上而不是 Unicode 字符上。保证不会出现 `[UNK]`——任何字节序列都能编码。GPT-2 用 50,257 个 token（256 字节 + 50,000 次合并 + 1 个特殊 token）。

**Unigram。** 从一个巨大的词表起步。给每个 token 分配一个 unigram 概率。迭代地剪掉那些移除后对语料 log-likelihood 影响最小的 token。推理时是概率化的：可以采样不同的分词方式（subword regularization 的数据增强用法）。被 T5、mBART、ALBERT、XLNet、Gemma 使用。

**WordPiece。** 合并那些能最大化训练语料 likelihood 的对，而不是按原始频率。被 BERT、DistilBERT、ELECTRA 使用。

**SentencePiece vs tiktoken。** SentencePiece 是直接在原始 Unicode 文本上*训练*词表（BPE 或 Unigram）的库，把空白编码为 `▁`。tiktoken 是 OpenAI 针对预先构建好的词表的快速*编码器*，它不做训练。

经验法则：

- **训练新词表：** SentencePiece（多语言、无需 pre-tokenization）或 HF Tokenizers。
- **针对 GPT 词表的快速推理：** tiktoken（`cl100k_base`、`o200k_base`）。
- **两者兼顾：** HF Tokenizers——一个库，训练 + 服务。

## 动手实现（Build It）

### 第 1 步：从零实现 BPE

参见 `code/main.py`。主循环：

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

算法编码了三件事。`</w>` 标记词尾，于是 "low"（后缀）和 "lower"（前缀）保持区分。频率加权让高频对在早期胜出。merge list 是有序的——推理按训练顺序应用合并。

### 第 2 步：用学到的 merges 编码

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

朴素实现是 O(n·|merges|)。生产级实现（tiktoken、HF Tokenizers）使用基于优先队列的 merge-rank 查找，达到接近线性的时间。

### 第 3 步：实战 SentencePiece

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # or "unigram"
    character_coverage=0.9995, # lower for CJK (e.g. 0.9995 for English, 0.995 for Japanese)
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

注意：无需 pre-tokenization，空格编码为 `▁`，`character_coverage` 控制稀有字符是被保留还是被映射为 `<unk>` 的激进程度。

### 第 4 步：用 tiktoken 处理 OpenAI 兼容词表

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

只编码不训练。Rust 后端，速度快。和 GPT-4/5 的 tokenization 完全匹配，可用于字节计数、成本估算、context window 预算。

## 2026 年仍在踩的坑（Pitfalls that still ship in 2026）

- **Tokenizer 漂移（drift）。** 在词表 A 上训练，部署时用了词表 B。token ID 对不上，模型输出垃圾。在 CI 里检查 `tokenizer.json` 的哈希。
- **空白歧义。** BPE 处理 "hello" 和 " hello" 产生不同 token。永远显式指定 `add_special_tokens` 和 `add_prefix_space`。
- **多语言训练不足。** 以英文为主的语料训出来的词表，会把非拉丁文字切成多 5-10 倍的 token。在 GPT-3.5 上同样的 prompt，日语/阿拉伯语要贵 5-10 倍。`o200k_base` 部分修正了这点。
- **emoji 被切碎。** 一个 emoji 可能占 5 个 token。做 context 预算时要专门盘点 emoji 的处理。

## 用起来（Use It）

2026 年的技术栈：

| 情境 | 选择 |
|-----------|------|
| 从零训练单语模型 | HF Tokenizers（BPE） |
| 训练多语言模型 | SentencePiece（Unigram、`character_coverage=0.9995`） |
| 提供 OpenAI 兼容 API | tiktoken（GPT-4+ 用 `o200k_base`） |
| 领域专用词表（代码、数学、蛋白质） | 在领域语料上训练自定义 BPE，再与基础词表合并 |
| 边缘推理、小模型 | Unigram（小词表表现更好） |

词表大小是一个 scaling 决策，不是常量。粗略经验：<1B 参数用 32k，1-10B 用 50-100k，多语言 / 前沿模型用 200k+。

## 上线部署（Ship It）

存为 `outputs/skill-bpe-vs-wordpiece.md`：

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

## 练习（Exercises）

1. **简单。** 在 `code/main.py` 的小语料上训练一个 500 次合并的 BPE。编码三个保留词。其中有多少个恰好产出 1 个 token，多少个 >1 个？
2. **中等。** 在 100 个英文 Wikipedia 句子上比较 `cl100k_base`、`o200k_base`，以及你自己用 vocab=32k 训练的 SentencePiece BPE 的 token 数。报告每一个的压缩比。
3. **困难。** 用同一份语料分别训练 BPE、Unigram 和 WordPiece。在一个小的情感分类器上，分别使用三者衡量下游准确率。这个选择能不能让 F1 移动超过 1 个点？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BPE | Byte-Pair Encoding | 贪心合并最高频字符对，直到达到目标词表大小。 |
| Byte-level BPE | 永远不会有 unknown token | 在 256 个原始字节上跑 BPE；GPT-2 / Llama 用这个。 |
| Unigram | 概率化 tokenizer | 从大候选集出发，用 log-likelihood 剪枝；T5、Gemma 在用。 |
| SentencePiece | 那个处理空白的 | 在原始文本上训练 BPE/Unigram 的库；空格编码为 `▁`。 |
| tiktoken | 那个快的 | OpenAI 用 Rust 写的 BPE 编码器，针对预构建词表。不做训练。 |
| Merge list | 那串魔数 | 有序的 `(a, b) → ab` 合并列表；推理按顺序应用。 |
| Character coverage | 多稀有算太稀有？ | tokenizer 必须覆盖训练语料中字符的比例；典型值 ~0.9995。 |

## 延伸阅读（Further Reading）

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) —— BPE 论文。
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) —— Unigram 论文。
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) —— 那个库。
- [Hugging Face — Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) —— 简洁参考。
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) —— cookbook + encoding 列表。
