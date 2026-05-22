# 从头构建一个分词器

> 第一课给了你一个玩具。这一课给你一件武器。

**类型：** 构建  
**语言：** Python  
**前置条件：** 阶段 10，第 01 课（分词器：BPE、WordPiece、SentencePiece）  
**时间：** 约 90 分钟

## 学习目标

- 构建一个生产级 BPE 分词器，能处理 Unicode、空白符归一化和特殊标记
- 实现字节级回退，使分词器能编码任何输入（包括 emoji、中日韩文字和代码）而不产生未知标记
- 添加预分词正则表达式模式，在应用 BPE 合并前按词边界拆分文本
- 在语料库上训练自定义分词器，并与 tiktoken 在多语言文本上对比压缩率

## 问题

你在第 01 课中构建的 BPE 分词器可以处理英文文本。现在用它处理日语、emoji、或者混用制表符和空格的 Python 代码。

它崩溃了。

不是因为 BPE 错了——而是因为实现不完整。一个生产级分词器要处理任意编码中的原始字节，在拆分前归一化 Unicode，管理永不参与合并的特殊标记，将预分词与子词拆分串联起来，并且所有这些操作都要足够快，以免成为处理 15 万亿 token 训练管线的瓶颈。

GPT‑2 的分词器有 50,257 个 token。Llama 3 有 128,256 个。GPT‑4 大约有 100,000 个。这些都不是玩具级别的数字。这些词汇表背后的合并表是在数百 GB 的文本上训练出来的，而周围的机制——归一化、预分词、特殊标记注入、对话模板格式化——正是区分一个只能处理 “hello world” 的分词器与一个能处理整个互联网的分词器的关键。

你要构建的就是这个机制。

## 概念

### 完整管线

一个生产级分词器不是单一的算法。它是一条由五个阶段组成的管线，每个阶段解决不同的问题。

```mermaid
graph LR
    A[原始文本] --> B[归一化]
    B --> C[预分词]
    C --> D[BPE 合并]
    D --> E[特殊标记]
    E --> F[Token ID]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

每个阶段都有特定的任务：

| 阶段 | 作用 | 为什么重要 |
|------|------|------------|
| 归一化 | NFKC Unicode，可选小写化、可选去重音 | "ﬁ" 连字（U+FB01）变成 "fi"（两个字符）。没有这个，同一个词会得到不同的 token。 |
| 预分词 | 在 BPE 之前将文本拆分成块 | 防止 BPE 跨越词边界合并。"the cat" 绝不应产生 token "e c"。 |
| BPE 合并 | 将学到的合并规则应用于字节序列 | 核心压缩。将原始字节转化为子词 token。 |
| 特殊标记 | 注入 [BOS]、[EOS]、[PAD]、对话模板标记 | 这些 token 有固定 ID。它们从不参与 BPE 合并。模型需要它们来体现结构。 |
| ID 映射 | 将 token 字符串转换为整数 ID | 模型看到的是整数，不是字符串。 |

### 字节级 BPE

第 01 课的分词器操作于 UTF‑8 字节。那是对的。但我们漏掉了重要的一点：当这些字节不是有效的 UTF‑8 时会发生什么？

字节级 BPE 通过将每个可能的字节值（0‑255）视为有效 token 来解决这个问题。你的基础词汇表正好是 256 个条目。任何文件——文本、二进制、损坏的——都能被分词而不产生未知 token。

GPT‑2 加了一个技巧：将每个字节映射到一个可打印的 Unicode 字符，使词汇表保持人类可读。字节 0x20（空格）在他们的映射中变成字符 "Ġ"。这纯粹是外观上的。算法并不关心。

真正的力量：字节级 BPE 可以处理地球上的每一种语言。中文字符每个 3 个 UTF‑8 字节。日语每个 3‑4 字节。阿拉伯语、天城文、emoji——都只是字节序列。BPE 算法在这些字节序列中发现模式的方式与它在英文 ASCII 字节中发现模式的方式完全相同。

### 预分词

在 BPE 触及你的文本之前，你需要将其拆分成块。这防止了合并算法创建跨越词边界的 token。

GPT‑2 使用一个正则表达式模式来拆分文本：

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

这个模式在缩略词（"don't" 变成 "don" + "'t"）、带有可选前导空格的单词、数字、标点符号和空白处拆分。前导空格保持附着在单词上——所以 "the cat" 变成 [" the", " cat"]，而不是 ["the", " ", "cat"]。

Llama 使用 SentencePiece，它完全跳过正则表达式。它将原始字节流视为一个长序列，让 BPE 算法自己找出边界。这更简单，但给 BPE 更多自由度来创建跨词 token。

选择很重要。GPT‑2 的正则表达式防止分词器学习到某个词的末尾 "the" 与下一个词的开头 "the" 应该合并。SentencePiece 允许这样做，有时会得到更高效的压缩，但 token 的可解释性较差。

### 特殊标记

每个生产级分词器都会为结构标记保留 token ID：

| Token | 用途 | 使用方 |
|-------|------|--------|
| `[BOS]` / `<s>` | 序列开始 | Llama 3, GPT |
| `[EOS]` / `</s>` | 序列结束 | 所有模型 |
| `[PAD]` | 批对齐填充 | BERT, T5 |
| `[UNK]` | 未知 token（字节级 BPE 消除了它） | BERT, WordPiece |
| `<|im_start|>` | 对话消息边界开始 | ChatGPT, Qwen |
| `<|im_end|>` | 对话消息边界结束 | ChatGPT, Qwen |
| `<|user|>` | 用户轮次标记 | Llama 3 |
| `<|assistant|>` | 助手轮次标记 | Llama 3 |

特殊标记从不被 BPE 拆分。它们在合并算法运行之前被精确匹配，替换为固定 ID，然后周围的文本正常分词。

### 对话模板

这是大多数人感到困惑、大多数实现出错的地方。

当你向对话模型发送消息时，API 接受一个消息列表：

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

模型看不到 JSON。它看到的是一个扁平的 token 序列。对话模板使用特殊标记将消息转换为那个扁平的序列。每个模型做法不同：

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

模板用错，模型就会输出垃圾。它是在一个确切的格式上训练的。任何偏离——缺少换行、交换了 token、多了一个空格——都会使输入偏离训练分布。

### 速度

对于生产级分词，Python 太慢了。

tiktoken（OpenAI）是用 Rust 编写的，带 Python 绑定。HuggingFace tokenizers 也是 Rust。SentencePiece 是 C++。它们比纯 Python 快 10‑100 倍。

换个角度：为 Llama 3 预训练分词 15 万亿个 token，按每秒 100 万 token（快速的 Python）算，需要 174 天。按每秒 1 亿 token（Rust）算，只需要 1.7 天。

你用 Python 构建是为了理解算法。在生产中，你会使用编译后的实现，只接触 Python 包装器。

## 构建它

### 第 1 步：字节级编码

基础。将任何字符串转换为字节序列，将每个字节映射到可打印字符以便显示，并反转这个过程。

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

在多语言文本上测试，观察字节数：

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

"hello" 是 5 个字节。"你好" 是 6 个字节（每字符 3 个）。火焰 emoji 是 4 个字节。字节级分词器不在乎它是什么语言。字节就是字节。

### 第 2 步：带正则表达式的预分词器

使用 GPT‑2 正则表达式模式将文本拆分成块。每个块由 BPE 独立分词。

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

`regex` 模块支持 Unicode 属性转义（`\p{L}` 表示字母，`\p{N}` 表示数字）。标准库的 `re` 不支持，所以我们回退到 ASCII 字符类。对于生产级多语言分词器，安装 `regex`。

试试看：

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

前导空格保持附着在单词上。缩略词在撇号处拆分。标点符号成为单独的块。BPE 永远不会跨越这些边界合并 token。

### 第 3 步：字节序列上的 BPE

第 01 课的核心算法，但现在独立地操作预分词后的块。

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

### 第 4 步：特殊标记处理

特殊标记需要精确匹配和固定 ID。它们完全绕过 BPE。

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

### 第 5 步：完整分词器类

将一切串联起来：归一化，在特殊标记处拆分，预分词，BPE 合并，映射到 ID。

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

真正的测试。用英文、中文、emoji 和代码来测试。

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

中文字符每个产生 3 个字节。emoji 产生 4 个字节。它们都不会使分词器崩溃。都不产生未知 token。这就是字节级 BPE 的力量。

## 使用它

### 比较真实的分词器

加载 Llama 3、GPT‑4 和 Mistral 的实际分词器。看看它们各自如何处理同一多语言段落。

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding