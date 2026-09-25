# 子词分词 — BPE、WordPiece、Unigram、SentencePiece

> 词级分词器遇到未见过的词就会失效。字符级分词器会使序列长度爆炸。子词分词器在两者之间取得平衡。每个现代 LLM 都基于其中一种方案。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 5 · 04 (GloVe / FastText / Subword)
**Time:** ~60 分钟

## 问题所在

你的词表有 50,000 个词。用户输入了 "untokenizable"。你的分词器返回 `[UNK]`。模型现在对这个词没有任何信号。更糟的是：语料库中第 90 百分位的文档包含 40 个稀有词，这意味着每个文档会丢失 40 个词的信息。

子词分词解决了这个问题。常见词保持为单个 token。稀有词分解为有意义的片段：`untokenizable` → `un`, `token`, `izable`。训练数据覆盖一切，因为任何字符串归根结底都是字节序列。

2026 年所有前沿 LLM 都基于三种算法之一（BPE、Unigram、WordPiece），封装在三个库之一中（tiktoken、SentencePiece、HF Tokenizers）。不选一个就无法发布语言模型。

## 核心概念

![BPE vs Unigram vs WordPiece, character-by-character](../assets/subword-tokenization.svg)

**BPE（Byte-Pair Encoding）。** 从字符级词表开始。统计所有相邻字符对。将最高频的字符对合并为新 token。重复此过程直到达到目标词表大小。主流算法：GPT-2/3/4、Llama、Gemma、Qwen2、Mistral。

**字节级 BPE。** 相同的算法，但在原始字节（256 个基础 token）上而非 Unicode 字符上运行。保证零 `[UNK]` token —— 任何字节序列都可编码。GPT-2 使用 50,257 个 token（256 字节 + 50,000 次合并 + 1 个特殊 token）。

**Unigram。** 从一个巨大的词表开始。为每个 token 分配一个 unigram 概率。迭代地剪除那些删除后对语料库对数似然影响最小的 token。推理时是概率性的：可以采样多种分词结果（通过子词正则化进行数据增强时很有用）。使用者：T5、mBART、ALBERT、XLNet、Gemma。

**WordPiece。** 合并那些能最大化训练语料库似然而非原始频率的字符对。使用者：BERT、DistilBERT、ELECTRA。

**SentencePiece vs tiktoken。** SentencePiece 是直接在原始 Unicode 文本上*训练*词表（BPE 或 Unigram）的库，并将空白编码为 `▁`。tiktoken 是 OpenAI 针对*预构建词表*的快速*编码器*；它不进行训练。

经验法则：

- **训练新词表：** SentencePiece（多语言、无需预分词）或 HF Tokenizers。
- **针对 GPT 词表快速推理：** tiktoken（cl100k_base、o200k_base）。
- **两者兼顾：** HF Tokenizers —— 一个库，训练 + 服务。

```figure
bpe-merge
```

## 动手实现

### 步骤 1：从零实现 BPE

参见 `code/main.py`。循环如下：

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

该算法编码了三个事实。`</w>` 标记词尾，使 "low"（后缀）和 "lower"（前缀）保持区分。频率加权使高频字符对在早期胜出。合并列表是有序的 —— 推理时按训练顺序应用合并。

### 步骤 2：使用学到的合并进行编码

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

朴素实现是 O(n·|merges|)。生产级实现（tiktoken、HF Tokenizers）使用基于优先队列的合并排名查找，运行时间接近线性。

### 步骤 3：SentencePiece 实践

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

注意：无需预分词，空格被编码为 `▁`，`character_coverage` 控制稀有字符被保留还是映射到 `<unk>` 的激进程度。

### 步骤 4：tiktoken 用于 OpenAI 兼容词表

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

仅编码。快速（Rust 后端）。与 GPT-4/5 分词完全一致，适用于字节计数、成本估算和上下文窗口预算。

## 2026 年仍然存在的陷阱

- **分词器漂移。** 用词表 A 训练，用词表 B 部署。Token ID 不同；模型输出乱码。在 CI 中检查 `tokenizer.json` 哈希。
- **空白歧义。** BPE 的 "hello" 与 " hello" 会产生不同的 token。始终显式指定 `add_special_tokens` 和 `add_prefix_space`。
- **多语言训练不足。** 以英语为主的语料库产生的词表会把非拉丁文字切成 5-10 倍多的 token。在 GPT-3.5 上，同样的日语/阿拉伯语提示要多花 5-10 倍的费用。o200k_base 部分修复了这个问题。
- **Emoji 拆分。** 单个 emoji 可能占用 5 个 token。在做上下文预算时要检查 emoji 的处理方式。

## 如何使用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 从零训练单语模型 | HF Tokenizers (BPE) |
| 训练多语模型 | SentencePiece (Unigram, `character_coverage=0.9995`) |
| 提供 OpenAI 兼容 API 服务 | tiktoken (`o200k_base` for GPT-4+) |
| 领域专用词表（代码、数学、蛋白质） | 在领域语料库上训练自定义 BPE，再与基础词表合并 |
| 边缘推理、小模型 | Unigram（更小的词表效果更好） |

词表大小是一个扩展性决策，不是常数。粗略经验法则：<1B 参数用 32k，1-10B 用 50-100k，多语言/前沿模型用 200k+。

## 发布

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

1. **简单。** 在 `code/main.py` 的小型语料库上训练一个 500 次合并的 BPE。编码三个留出词。多少个恰好产生 1 个 token，多少个超过 1 个？
2. **中等。** 在 100 句英文维基百科句子上比较 `cl100k_base`、`o200k_base` 和你训练的 vocab=32k 的 SentencePiece BPE 的 token 数量。报告各自的压缩率。
3. **困难。** 在同一语料库上训练 BPE、Unigram 和 WordPiece。在一个小型情感分类器上测量各自使用时的下游准确率。这一选择是否会使 F1 移动超过 1 个点？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BPE | Byte-Pair Encoding | 贪心地合并最高频字符对，直到达到目标词表大小。 |
| Byte-level BPE | 永远没有未知 token | 在 256 个原始字节上运行 BPE；GPT-2 / Llama 采用此方案。 |
| Unigram | 概率性分词器 | 使用对数似然从大候选集中剪除；T5、Gemma 使用。 |
| SentencePiece | 处理空格的那个 | 在原始文本上训练 BPE/Unigram 的库；空格编码为 `▁`。 |
| tiktoken | 最快的那个 | OpenAI 基于 Rust 的 BPE 编码器，针对预构建词表。不支持训练。 |
| Merge list | 那些神奇的数字 | `(a, b) → ab` 合并的有序列表；推理时按顺序应用。 |
| Character coverage | 多稀有算太稀有？ | 分词器必须覆盖的训练语料库字符比例；通常 ~0.9995。 |

## 延伸阅读

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — BPE 论文。
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) — Unigram 论文。
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) — 该库的论文。
- [Hugging Face — Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) — 简明参考。
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) — cookbook + 编码列表。