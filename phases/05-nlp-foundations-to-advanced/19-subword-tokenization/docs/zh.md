# 子词代币化- BPE、WordPiece、Unigram、SentencePiece

> 单词符号化者被看不见的单词噎住。字符标记器扩大了序列长度。子词标记器缩小了差异。每个现代LLM都搭载一艘。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段5 · 01（文本处理）、阶段5 · 04（GloVe / Fasttext / Subword）
** 时间：** ~60分钟

## 问题

您的词汇量有50，000个单词。用户输入“untokenizable”。您的标记化器返回“[UTE]'。该模型现在没有有关该词的信号。更糟糕的是：你的数据库中第90百分位的文档有40个稀有单词，这意味着每个文档丢弃了40位信息。

子词标记化解决了这个问题。常见词保持单一符号。罕见的单词分解为有意义的部分：“untokenizable”-“un”、“token”、“izable”。训练数据涵盖了一切，因为任何字符串最终都是一个字节序列。

2026年的每个前沿LLM都采用三种算法（BPE、Unigram、WordPiece）之一，并包裹在三个库（tiktoken、SentencePiece、HF Tokenizer）之一中。如果不选择语言模型，您就无法交付语言模型。

## 概念

![BPE vs Unigram vs WordPiece, character-by-character](../assets/subword-tokenization.svg)

**BPE（字节对编码）。**从字符级词汇开始。计算每对相邻的一对。将最频繁的对合并到新令牌中。重复此操作，直到达到目标词汇量。主导算法：GPT-2/3/4、Llama、Gemma、Qwen 2、Mistral。

** 字节级BPE。**相同的算法，但使用原始字节（256个基本令牌）而不是Unicode字符。保证零“[UTE]'令牌-任何字节序列编码。GPT-2使用50，257个令牌（256字节+50，000个合并+ 1个特殊）。

**Unigram。**从大量的词汇开始。为每个令牌分配一个单字概率。迭代地修剪删除最少增加数据库日志可能性的标记。推断概率：可以对标记化进行采样（对于通过子字正规化增强数据很有用）。由T5、mBART、ALBERT、XLNet、Gemma使用。

**WordPiece.**最大化训练语料库而不是原始频率的可能性的合并对。由BERT、DistilBERT、ELECTRA使用。

**SentencePiece vs tiktoken。** SentencePiece是一个直接在原始Unicode文本上 * 训练 * 词汇表（BPE或Unigram）的库，将空白编码为“”。tiktoken是OpenAI针对预构建词汇表的快速 * 编码器 *;它不会训练。

经验法则：

- ** 训练新词汇：** SentencePiece（多语言，无预标记化）或HF Tokenizer。
- ** 对GPT vocab的快速推断：** tiktoken（cl100k_base，o200k_base）。
- ** 两者：** HF Tokenizer-一个库，培训+服务。

## 建设党

### 第1步：从头开始BPE

请参阅' code/main.py '。循环：

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

该算法编码的三个事实。&#39;</w>标记单词结束，因此“低”（后缀）和“低”（后缀）保持不同。频率加权使高频对提前获胜。合并列表是有序的-推断以训练顺序应用合并。

### 第2步：使用学习到的合并进行编码

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

天真O（n·|合并|).生产实现（tiktoken、HF Tokenizer）使用合并排名查找和优先级队列，并在近线性时间内运行。

### 第3步：实践中的句子片段

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

注意事项：不需要预标记化，空格编码为``，`character_coverage`控制保留稀有字符与映射到``的积极<unk>程度。

### 第4步：用于OpenAI兼容的语音卡的tiktoken

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

仅编码。快速（Rust后台）。与GPT-4/5标记化完全匹配，用于字节计数、成本估计、上下文窗口预算。

## 2026年仍存在的陷阱

- ** 代币器漂移。**训练词汇A，针对词汇B进行部署。令牌ID不同;模型输出垃圾。检查CI中的' tokenizer.json '哈希。
- ** 空白歧义。** BPE“hello”与“hello”产生不同的令牌。始终显式指定“add_special_tokens”和“add_prefix_Space”。
- ** 多语言培训不足。**大量英语的库生成的词汇表将非拉丁脚本拆分为5- 10倍以上的代币。在GPT-3.5上，相同的提示在日语/阿拉伯语中的花费要高出5- 10倍。o200 k_base部分修复了这个问题。
- ** 子分裂。**一个表情符号可以容纳5个代币。预算上下文时的检查点表情符号处理。

## 使用它

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| Training a monolingual model from scratch | HF令牌器（BPE） |
| 训练多语言模型 | SentencePiece（Unigram，' char_cover =0.9995 '） |
| 提供与OpenAI兼容的API | tiktoken（GPT-4+的“o200k_base”） |
| 特定领域的词汇（代码、数学、蛋白质） | 在领域文集上训练自定义BPE，与基础词汇合并 |
| 边缘推断，小模型 | Unigram（较小的词汇表效果更好） |

词汇量是一个缩放决定，而不是一个常数。粗略的启发式：32 k用于<1B的参数，50- 100 k用于1- 10 B，200 k+用于多语言/边界。

## 把它运

另存为“输出/skill-tokenizer-picker.md”：

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

## 演习

1. ** 简单。**在' code/main.py '的微型数据库上训练500个合并BPE。编码三个悬而未决的单词。有多少人恰好生产了1个代币与>1个代币？
2. ** 中等。**比较“cl100k_base”、“o200k_base”和您用vocab= 32 k训练的SentencePiece BPE之间的100个英语维基百科句子的代币计数。报告每个的压缩比。
3. ** 很难。**使用BPE、Unigram和WordPiece训练相同的文集。在小型情感分类器上使用每种情绪分类器时测量下游准确性。该选择是否使指针移动超过1个点F1？

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| BPE | 字节对编码 | 贪婪地合并最频繁的字符对，直到目标词汇大小达到。 |
| 字节级BPE | 从来没有未知代币 | 原始256字节上的BPE; GPT-2 / Llama使用此。 |
| Unigram | 概率标记器 | 使用log似然从大候选集中提取李子;由T5、Gemma使用。 |
| 句子片段 | 空白的那个 | 在原始文本上训练BPE/Unigram的库;空间编码为“”。 |
| 公司简介 | 最快的那个 | OpenAI的Rust支持BPE编码器，用于预构建语音信箱。没有培训。 |
| 合并列表 | 幻数 | '（a，b）'的有序列表合并;推理按顺序适用。 |
| 角色覆盖 | 有多罕见才算太罕见？ | 标记器必须覆盖的训练语料库中的字符比例; ~0.9995典型值。 |

## 进一步阅读

- [Sennrich，Haddow，Birch. Neural Machine Translation of Rare Words with Subword Units]（https：//arxiv.org/abs/1508.07909）-BPE论文。
- [Kudo（2018）。使用Unigram语言模型的子字正规化]（https：//arxiv.org/ab/1804.10959）-Unigram论文。
- [Kudo，理查森（2018）。SentencePiece：一个简单且独立于语言的子词tokenizer]（https：//arxiv.org/ab/1808.06226）-库。
- [Hugging Face -tokenizer总结]（https：//huggingface.co/docs/transformers/tokenizer_summary）-简明参考。
- [OpenAI tiktoken repo]（https：//github.com/openai/tiktoken）- cookbook + encoding list.
