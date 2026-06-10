# 02 · 从零构建分词器

> 第 01 课给了你一个玩具，这一课给你一件武器。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 10，第 01 课（分词器：BPE、WordPiece、SentencePiece）
**时长：** 约 90 分钟

## 学习目标

- 构建一个生产级的 BPE 分词器，可处理 Unicode、空白符归一化以及特殊词元（special token）
- 实现字节级回退（byte-level fallback），使分词器能编码任意输入（包括 emoji、CJK 字符和代码），而不产生未知词元
- 添加预分词（pre-tokenization）正则模式，在应用 BPE 合并之前先在词边界处切分文本
- 在语料上训练自定义分词器，并在多语言文本上与 tiktoken 对比其压缩率

## 问题所在

你在第 01 课写的 BPE 分词器在英文文本上能正常工作。现在给它一段日文。或者一个 emoji。又或者一段混用了制表符和空格的 Python 代码。

它崩了。

不是因为 BPE 本身有错——而是因为实现不完整。一个生产级分词器要能处理任意编码下的原始字节，要在切分前先归一化 Unicode，要管理那些永远不会被合并的特殊词元，要把预分词与子词切分串联起来，而且要做到足够快，不至于成为处理 15 万亿词元（token）的训练管线的瓶颈。

GPT-2 的分词器有 50,257 个词元。Llama 3 有 128,256 个。GPT-4 大约 100,000 个。这些都不是玩具级别的数字。支撑这些词表的合并表（merge table）是在数百 GB 的文本上训练出来的，而围绕它的那套机制——归一化、预分词、特殊词元注入、对话模板格式化——正是「能处理 hello world」的分词器和「能处理整个互联网」的分词器之间的分水岭。

你将要构建的，正是这套机制。

## 核心概念

### 完整管线

生产级分词器不是单一算法。它是一条由五个阶段组成的管线，每个阶段解决一个不同的问题。

```mermaid
graph LR
    A[Raw Text] --> B[Normalize]
    B --> C[Pre-Tokenize]
    C --> D[BPE Merge]
    D --> E[Special Tokens]
    E --> F[Token IDs]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

每个阶段都有明确的职责：

| 阶段 | 它做什么 | 为什么重要 |
|-------|-------------|----------------|
| 归一化（Normalize） | NFKC Unicode 归一化、可选的小写化、可选的去重音符 | "fi" 连字（U+FB01）会被还原为 "fi"（两个字符）。没有这一步，同一个词会得到不同的词元。 |
| 预分词（Pre-Tokenize） | 在 BPE 之前把文本切成若干块 | 防止 BPE 跨词边界进行合并。"the cat" 永远不该产出一个 "e c" 这样的词元。 |
| BPE 合并（BPE Merge） | 对字节序列应用学到的合并规则 | 核心压缩环节。把原始字节变成子词词元。 |
| 特殊词元（Special Tokens） | 注入 [BOS]、[EOS]、[PAD]、对话模板标记 | 这些词元有固定的 ID，永远不参与 BPE 合并。模型需要它们来表达结构。 |
| ID 映射（ID Mapping） | 把词元字符串转换为整数 ID | 模型看到的是整数，不是字符串。 |

### 字节级 BPE

第 01 课的分词器是在 UTF-8 字节上操作的。这个选择是对的。但我们略过了一件重要的事：当这些字节并不是合法的 UTF-8 时，会发生什么？

字节级 BPE（byte-level BPE）通过把每一个可能的字节值（0-255）都当作合法词元来解决这个问题。你的基础词表恰好是 256 个条目。任何文件——文本、二进制、损坏的——都能被分词，而不会产生未知词元。

GPT-2 加了一个小技巧：把每个字节映射到一个可打印的 Unicode 字符，让词表保持人类可读。在它们的映射里，字节 0x20（空格）会变成字符 "Ġ"。这纯粹是为了好看，算法本身并不在意。

真正的威力在于：字节级 BPE 能处理地球上的每一种语言。中文字符每个占 3 个 UTF-8 字节。日文可能占 3-4 字节。阿拉伯文、天城文、emoji——全都只是字节序列。BPE 算法在这些字节序列中寻找模式的方式，和它在英文 ASCII 字节中寻找模式的方式一模一样。

### 预分词

在 BPE 触碰你的文本之前，你需要先把它切成若干块。这样可以防止合并算法创建出跨越词边界的词元。

GPT-2 用一个正则模式来切分文本：

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

这个模式会在缩写（"don't" 切成 "don" + "'t"）、带可选前导空格的单词、数字、标点和空白处进行切分。前导空格被保留并附着在单词上——所以 "the cat" 会变成 [" the", " cat"]，而不是 ["the", " ", "cat"]。

Llama 使用 SentencePiece，它完全跳过正则。它把原始字节流当作一条长序列，让 BPE 算法自己去找出边界。这种做法更简单，但给了 BPE 更大的自由度去创建跨词词元。

这个选择很关键。GPT-2 的正则会阻止分词器学到「一个词末尾的 the」和「下一个词开头的 the」应当合并。SentencePiece 则允许这种合并，有时能带来更高的压缩率，但词元的可解释性更差。

### 特殊词元

每一个生产级分词器都会为结构性标记保留若干词元 ID：

| 词元 | 用途 | 使用者 |
|-------|---------|---------|
| `[BOS]` / `<s>` | 序列起始 | Llama 3、GPT |
| `[EOS]` / `</s>` | 序列结束 | 所有模型 |
| `[PAD]` | 用于批次对齐的填充 | BERT、T5 |
| `[UNK]` | 未知词元（字节级 BPE 消除了它） | BERT、WordPiece |
| `<\|im_start\|>` | 对话消息边界起始 | ChatGPT、Qwen |
| `<\|im_end\|>` | 对话消息边界结束 | ChatGPT、Qwen |
| `<\|user\|>` | 用户回合标记 | Llama 3 |
| `<\|assistant\|>` | 助手回合标记 | Llama 3 |

特殊词元永远不会被 BPE 切分。它们会在合并算法运行之前被精确匹配出来，替换为各自固定的 ID，而周围的文本照常分词。

### 对话模板

这里是大多数人犯迷糊、大多数实现出错的地方。

当你向对话模型发送消息时，API 接收的是一个消息列表：

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

模型看不到 JSON。它看到的是一条扁平的词元序列。对话模板（chat template）会用特殊词元把消息转换成这条扁平序列。每个模型的做法都不一样：

```
Llama 3:
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are helpful.<|eot_id|><|start_header_id|>user<|end_header_id|>

Hello<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Hi there!<|eot_id|>

ChatGPT:
<|im_start|>system
You are helpful.<|im_end|>
<|im_start|>user
Hello<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

模板用错，模型就会输出垃圾。它是在某一种确定的格式上训练出来的。任何偏离——缺少一个换行、调换一个词元、多出一个空格——都会让输入落到训练分布之外。

### 速度

Python 太慢，撑不起生产级分词。

tiktoken（OpenAI）用 Rust 编写，带 Python 绑定。HuggingFace tokenizers 同样是 Rust。SentencePiece 是 C++。相比纯 Python，它们能实现 10-100 倍的提速。

打个比方：要为 Llama 3 预训练分词 15 万亿词元，按每秒 100 万词元（快速的 Python）计算需要 174 天。按每秒 1 亿词元（Rust）计算，只需 1.7 天。

你之所以用 Python 来构建，是为了理解算法。在生产中，你会使用编译型实现，只接触它的 Python 封装层。

## 动手构建

### 第 1 步：字节级编码

地基。把任意字符串转换为字节序列，把每个字节映射到一个可打印字符以便显示，再把整个过程逆转回来。

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

在多语言文本上测试，看看字节数：

```python
texts = [
    ("English", "hello"),
    ("Chinese", "你好"),
    ("Emoji", "🔥"),
    ("Mixed", "hello你好🔥"),
]

for label, text in texts:
    b = bytes_to_tokens(text)
    print(f"{label}: {len(text)} chars -> {len(b)} bytes -> {b}")
```

"hello" 是 5 字节。"你好" 是 6 字节（每字符 3 字节）。火焰 emoji 是 4 字节。字节级分词器不关心它是什么语言。字节就是字节。

### 第 2 步：基于正则的预分词器

用 GPT-2 的正则模式把文本切成若干块。每一块都由 BPE 独立分词。

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\w]+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

`regex` 模块支持 Unicode 属性转义（`\p{L}` 表示字母，`\p{N}` 表示数字）。标准库的 `re` 模块不支持，所以我们退回到 ASCII 字符类。对于生产级的多语言分词器，请安装 `regex`。

试一下：

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

前导空格附着在单词上。缩写在撇号处切分。标点自成一块。BPE 永远不会跨越这些边界去合并词元。

### 第 3 步：在字节序列上做 BPE

第 01 课的核心算法，但现在改为对预分词后的各块独立操作。

```python
from collections import Counter

def get_byte_pairs(chunks):
    pairs = Counter()
    for chunk in chunks:
        byte_seq = list(chunk.encode("utf-8"))
        for i in range(len(byte_seq) - 1):
            pairs[(byte_seq[i], byte_seq[i + 1])] += 1
    return pairs

def apply_merge(byte_seq, pair, new_id):
    merged = []
    i = 0
    while i < len(byte_seq):
        if i < len(byte_seq) - 1 and byte_seq[i] == pair[0] and byte_seq[i + 1] == pair[1]:
            merged.append(new_id)
            i += 2
        else:
            merged.append(byte_seq[i])
            i += 1
    return merged
```

### 第 4 步：特殊词元处理

特殊词元需要精确匹配和固定 ID。它们完全绕过 BPE。

```python
class SpecialTokenHandler:
    def __init__(self):
        self.special_tokens = {}
        self.pattern = None

    def add_token(self, token_str, token_id):
        self.special_tokens[token_str] = token_id
        escaped = [re.escape(t) for t in sorted(self.special_tokens.keys(), key=len, reverse=True)]
        self.pattern = re.compile("|".join(escaped))

    def split_with_specials(self, text):
        if not self.pattern:
            return [(text, False)]
        parts = []
        last_end = 0
        for match in self.pattern.finditer(text):
            if match.start() > last_end:
                parts.append((text[last_end:match.start()], False))
            parts.append((match.group(), True))
            last_end = match.end()
        if last_end < len(text):
            parts.append((text[last_end:], False))
        return parts
```

### 第 5 步：完整的分词器类

把所有环节串起来：归一化、按特殊词元切分、预分词、BPE 合并、映射到 ID。

```python
import unicodedata

class ProductionTokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.special_handler = SpecialTokenHandler()
        self.next_id = 256

    def normalize(self, text):
        return unicodedata.normalize("NFKC", text)

    def train(self, text, num_merges):
        text = self.normalize(text)
        chunks = pre_tokenize(text)
        chunk_bytes = [list(chunk.encode("utf-8")) for chunk in chunks]

        for i in range(num_merges):
            pairs = Counter()
            for seq in chunk_bytes:
                for j in range(len(seq) - 1):
                    pairs[(seq[j], seq[j + 1])] += 1
            if not pairs:
                break
            best = max(pairs, key=pairs.get)
            new_id = self.next_id
            self.next_id += 1
            self.merges[best] = new_id
            self.vocab[new_id] = self.vocab[best[0]] + self.vocab[best[1]]
            chunk_bytes = [apply_merge(seq, best, new_id) for seq in chunk_bytes]

    def add_special_token(self, token_str):
        token_id = self.next_id
        self.next_id += 1
        self.special_handler.add_token(token_str, token_id)
        self.vocab[token_id] = token_str.encode("utf-8")
        return token_id

    def encode(self, text):
        text = self.normalize(text)
        parts = self.special_handler.split_with_specials(text)
        all_ids = []
        for part_text, is_special in parts:
            if is_special:
                all_ids.append(self.special_handler.special_tokens[part_text])
            else:
                for chunk in pre_tokenize(part_text):
                    byte_seq = list(chunk.encode("utf-8"))
                    for pair, new_id in self.merges.items():
                        byte_seq = apply_merge(byte_seq, pair, new_id)
                    all_ids.extend(byte_seq)
        return all_ids

    def decode(self, ids):
        byte_parts = []
        for token_id in ids:
            if token_id in self.vocab:
                byte_parts.append(self.vocab[token_id])
        return b"".join(byte_parts).decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)
```

### 第 6 步：多语言测试

真正的考验。把英文、中文、emoji 和代码一起丢给它。

```python
corpus = (
    "The quick brown fox jumps over the lazy dog. "
    "The quick brown fox runs through the forest. "
    "Machine learning models process natural language. "
    "Deep learning transforms how we build software. "
    "def train(model, data): return model.fit(data) "
    "def predict(model, x): return model(x) "
)

tok = ProductionTokenizer()
tok.train(corpus, num_merges=50)

bos = tok.add_special_token("<|begin|>")
eos = tok.add_special_token("<|end|>")

test_texts = [
    "The quick brown fox.",
    "你好世界",
    "Hello 🌍 World",
    "def foo(x): return x + 1",
    f"<|begin|>Hello<|end|>",
]

for text in test_texts:
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    print(f"Input:   {text}")
    print(f"Tokens:  {len(ids)} ids")
    print(f"Decoded: {decoded}")
    print()
```

中文字符每个产出 3 字节。emoji 产出 4 字节。它们都不会让分词器崩溃，也都不会产生未知词元。这就是字节级 BPE 的威力。

## 实战应用

### 对比真实的分词器

加载 Llama 3、GPT-4 和 Mistral 的真实分词器，看看它们各自如何处理同一段多语言文字。

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding("cl100k_base")

test_paragraph = "Machine learning is powerful. 机器学习很强大。 L'apprentissage automatique est puissant. 🤖💪"

tokens = gpt4_enc.encode(test_paragraph)
pieces = [gpt4_enc.decode([t]) for t in tokens]
print(f"GPT-4 ({len(tokens)} tokens): {pieces}")
```

```python
from transformers import AutoTokenizer

llama_tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
mistral_tok = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

for name, tok in [("Llama 3", llama_tok), ("Mistral", mistral_tok)]:
    tokens = tok.encode(test_paragraph)
    pieces = tok.convert_ids_to_tokens(tokens)
    print(f"{name} ({len(tokens)} tokens): {pieces[:20]}...")
```

你会看到同一段文字得到不同的词元数。Llama 3 拥有 128K 词表，在合并常见模式上更激进。GPT-4 的 100K 词表居中。Mistral 的 32K 词表产出更多词元，但嵌入层（embedding layer）更小。

这个权衡始终如一：更大的词表意味着更短的序列，但更多的参数。

## 交付落地

本课产出一个用于构建和调试生产级分词器的提示词。参见 `outputs/prompt-tokenizer-builder.md`。

## 练习

1. **简单：** 添加一个 `get_token_bytes(id)` 方法，展示任意词元 ID 对应的原始字节。用它来检视你最常见的合并词元究竟代表了什么。
2. **中等：** 实现 Llama 风格的预分词器，它在空白和数字处切分，但保留前导空格。在同一语料上将它的词表与 GPT-2 正则方案的词表进行对比。
3. **困难：** 添加一个对话模板方法，它接收一个 `{"role": ..., "content": ...}` 消息列表，并产出符合 Llama 3 对话格式的正确词元序列。用 HuggingFace 的实现来对照测试它。

## 关键术语

| 术语 | 人们怎么说 | 它真正的含义 |
|------|----------------|----------------------|
| 字节级 BPE（Byte-level BPE） | 「在字节上工作的分词器」 | 以 256 个字节值为基础词表的 BPE——能处理任意输入而不产生未知词元 |
| 预分词（Pre-tokenization） | 「BPE 之前的切分」 | 基于正则或规则的切分，防止 BPE 跨词边界合并 |
| NFKC 归一化（NFKC normalization） | 「Unicode 清洗」 | 先做规范分解，再做兼容性组合——"fi" 连字变成 "fi"，全角 "Ａ" 变成 "A" |
| 对话模板（Chat template） | 「消息如何变成词元」 | 把 role/content 消息列表转换为扁平词元序列的精确格式——与模型相关，且必须匹配训练格式 |
| 特殊词元（Special tokens） | 「控制词元」 | 绕过 BPE 的保留词元 ID——[BOS]、[EOS]、[PAD]、对话标记——在合并前被精确匹配 |
| 繁殖率（Fertility） | 「每个词的词元数」 | 输出词元数与输入词数之比——GPT-4 中英文为 1.3，韩文为 2-3，越高意味着越浪费上下文 |
| tiktoken | 「OpenAI 的分词器」 | 带 Python 绑定的 Rust BPE 实现——比纯 Python 快 10-100 倍 |
| 合并表（Merge table） | 「那个词表」 | 训练过程中学到的字节对合并的有序列表——这就是分词器学到的知识本身 |

## 延伸阅读

- [OpenAI tiktoken 源码](https://github.com/openai/tiktoken) —— GPT-3.5/4 使用的 Rust BPE 实现
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers) —— 支持 BPE、WordPiece、Unigram 的 Rust 分词库
- [Llama 3 论文（Meta，2024）](https://arxiv.org/abs/2407.21783) —— 关于 128K 词表与分词器训练的细节
- [SentencePiece（Kudo & Richardson，2018）](https://arxiv.org/abs/1808.06226) —— 语言无关的分词
- [GPT-2 分词器源码](https://github.com/openai/gpt-2/blob/master/src/encoder.py) —— 最初的字节到 Unicode 映射
