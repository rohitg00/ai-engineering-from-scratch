# 从零构建 Tokenizer

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Lesson 01 给了你一个玩具，这一课给你一把武器。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 构建一个生产级别的 BPE tokenizer，处理 Unicode、空白归一化以及 special token
- 实现字节级（byte-level）回退，让 tokenizer 能编码任何输入（包括 emoji、CJK 和代码），不会产生 unknown token
- 加入 pre-tokenization 正则模式，在执行 BPE 合并前先在词边界处切分文本
- 在一个语料上训练自定义 tokenizer，并在多语言文本上对比它和 tiktoken 的压缩比

## 问题（The Problem）

你在 Lesson 01 写的 BPE tokenizer 在英文文本上能跑。现在丢点日文给它。或者 emoji。或者 tab 和空格混用的 Python 代码。

它崩了。

不是因为 BPE 错了——而是因为实现不完整。一个生产级 tokenizer 要能处理任意编码下的原始字节，要在切分前把 Unicode 归一化，要管理那些永远不会被合并的 special token，要把 pre-tokenization 和子词切分串起来，并且这一切都得跑得足够快，不能拖累一个处理 15 万亿 token 的训练流水线。

GPT-2 的 tokenizer 有 50,257 个 token。Llama 3 是 128,256 个。GPT-4 大约 100,000 个。这些都不是玩具数字。这些词表背后的合并表是在数百 GB 文本上训练出来的，而周围那一圈机器——归一化、pre-tokenization、special token 注入、聊天模板格式化——才是把一个只能处理「hello world」的 tokenizer 和能处理整个互联网的 tokenizer 区分开来的东西。

你要构建的就是这套机器。

## 概念（The Concept）

### 完整流水线（The Full Pipeline）

生产级 tokenizer 不是一个算法，而是一条由五个阶段组成的 pipeline（流水线），每个阶段解决一个不同的问题。

```mermaid
graph LR
    A[原始文本] --> B[归一化]
    B --> C[预 tokenize]
    C --> D[BPE 合并]
    D --> E[特殊 token]
    E --> F[Token ID]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

每个阶段各司其职：

| 阶段 | 做什么 | 为什么重要 |
|-------|-------------|----------------|
| Normalize | NFKC Unicode 归一化，可选小写化、可选去重音 | 「ﬁ」连字（U+FB01）会变成「fi」（两个字符）。不做归一化，同一个词会拿到不同的 token。 |
| Pre-Tokenize | 在 BPE 之前把文本切成块 | 防止 BPE 跨词边界合并。「the cat」永远不该产出一个「e c」的 token。 |
| BPE Merge | 把学到的合并规则应用到字节序列上 | 核心压缩。把原始字节变成子词 token。 |
| Special Tokens | 注入 [BOS]、[EOS]、[PAD]、聊天模板标记 | 这些 token 有固定的 ID，永远不参与 BPE 合并。模型靠它们来理解结构。 |
| ID Mapping | 把 token 字符串转成整数 ID | 模型看到的是整数，不是字符串。 |

### 字节级 BPE（Byte-Level BPE）

Lesson 01 的 tokenizer 是在 UTF-8 字节上跑的。这一步走对了。但我们跳过了一件重要的事：当那些字节不是合法的 UTF-8 时怎么办？

字节级 BPE 把每一个可能的字节值（0–255）都当作一个合法 token 来解决这个问题。你的基础词表正好 256 项。任何文件——文本、二进制、损坏的——都可以被 tokenize，不会产生 unknown token。

GPT-2 还加了一个小技巧：把每个字节映射到一个可打印的 Unicode 字符，这样词表保持人类可读。在它的映射里，字节 0x20（空格）变成字符「Ġ」。这纯粹是为了好看，算法本身并不关心。

真正的威力是：字节级 BPE 能处理地球上的所有语言。中文每个字 3 个 UTF-8 字节，日文 3–4 字节，阿拉伯文、天城文、emoji——都只是字节序列。BPE 算法在这些字节序列里找模式的方式，跟在英文 ASCII 字节里找模式完全一样。

### 预切分（Pre-Tokenization）

在 BPE 碰你的文本之前，你要先把它切成块。这能防止合并算法生成跨越词边界的 token。

GPT-2 用一个正则模式来切分文本：

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

这个模式按缩写（「don't」切成「don」+「't」）、可选前导空格的单词、数字、标点和空白来切分。前导空格是跟着单词走的——所以「the cat」会变成 [" the", " cat"]，而不是 ["the", " ", "cat"]。

Llama 用的是 SentencePiece，它完全不走正则。它把原始字节流当作一长串序列，让 BPE 算法自己琢磨边界。这更简单，但给了 BPE 更多自由去造跨词的 token。

这个选择有讲究。GPT-2 的正则会阻止 tokenizer 学到「一个词末尾的 the」和「下一个词开头的 the」应该合并。SentencePiece 允许这样，有时压缩更高效，但 token 的可解释性更差。

### Special Token（Special Tokens）

每个生产级 tokenizer 都会保留一些 token ID 作为结构标记：

| Token | 用途 | 谁在用 |
|-------|---------|---------|
| `[BOS]` / `<s>` | 序列开始 | Llama 3、GPT |
| `[EOS]` / `</s>` | 序列结束 | 所有模型 |
| `[PAD]` | 用于 batch 对齐的 padding | BERT、T5 |
| `[UNK]` | unknown token（字节级 BPE 已经不需要它） | BERT、WordPiece |
| `<\|im_start\|>` | 聊天消息边界开始 | ChatGPT、Qwen |
| `<\|im_end\|>` | 聊天消息边界结束 | ChatGPT、Qwen |
| `<\|user\|>` | 用户回合标记 | Llama 3 |
| `<\|assistant\|>` | assistant 回合标记 | Llama 3 |

Special token 永远不会被 BPE 切开。在合并算法跑起来之前，它们就会被精确匹配并替换成固定的 ID，周围的文本再正常 tokenize。

### 聊天模板（Chat Templates）

这是大多数人会搞糊涂、大多数实现会出错的地方。

你给一个 chat 模型发消息时，API 接受的是一个消息列表：

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

模型并不会看到 JSON。它看到的是一串扁平的 token 序列。聊天模板的作用就是用 special token 把消息列表转换成那串扁平序列。每个模型做法都不一样：

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

模板写错，模型就胡言乱语。它是在某一个精确格式上训练出来的。任何偏差——少一个换行、调换一个 token、多一个空格——都会让输入跑出训练分布之外。

### 速度（Speed）

Python 在生产级 tokenization 里太慢了。

tiktoken（OpenAI）是用 Rust 写的、带 Python 绑定。HuggingFace tokenizers 也是 Rust。SentencePiece 是 C++。它们相对纯 Python 都有 10–100 倍的提速。

来个直观的比较：给 Llama 3 预训练 tokenize 15 万亿 token，按每秒 100 万 token（快速 Python）算要 174 天；按每秒 1 亿 token（Rust）算要 1.7 天。

你用 Python 来构建是为了理解算法。在生产环境里，你会用一个编译好的实现，只在 Python 包装层做交互。

## 动手实现（Build It）

### 第 1 步：字节级编码（Step 1: Byte-Level Encoding）

地基。把任意字符串转成字节序列，把每个字节映射成一个可打印字符用于显示，再把过程反过来。

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

在多语言文本上测试一下，看看字节数：

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

「hello」是 5 字节。「你好」是 6 字节（每个字 3 字节）。火焰 emoji 是 4 字节。字节级 tokenizer 不在乎是什么语言。字节就是字节。

### 第 2 步：用正则做 pre-tokenizer（Step 2: Pre-Tokenizer with Regex）

用 GPT-2 的正则模式把文本切成块。每一块由 BPE 独立 tokenize。

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

`regex` 模块支持 Unicode 属性转义（`\p{L}` 匹配字母、`\p{N}` 匹配数字）。标准库的 `re` 不支持，所以我们退回到 ASCII 字符类。生产级多语言 tokenizer 务必装 `regex`。

试一下：

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

前导空格跟着单词走。缩写在撇号处切开。标点自成一块。BPE 永远不会跨这些边界合并 token。

### 第 3 步：在字节序列上跑 BPE（Step 3: BPE on Byte Sequences）

Lesson 01 里的核心算法，但现在是在预切分后的块上独立运行。

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

### 第 4 步：处理 special token（Step 4: Special Token Handling）

Special token 需要精确匹配和固定 ID，完全绕过 BPE。

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

### 第 5 步：完整的 Tokenizer 类（Step 5: Full Tokenizer Class）

把所有东西串起来：归一化、按 special token 切分、pre-tokenize、BPE 合并、映射到 ID。

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

### 第 6 步：多语言测试（Step 6: Multilingual Test）

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

中文每个字产出 3 字节，emoji 产出 4 字节。这些都不会让 tokenizer 崩，也都不会产生 unknown token。这就是字节级 BPE 的威力。

## 用起来（Use It）

### 对比真正的 tokenizer（Comparing Real Tokenizers）

加载 Llama 3、GPT-4 和 Mistral 的真实 tokenizer。看看它们各自怎么处理同一段多语言文字。

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

同一段文本，你会看到不同的 token 数。Llama 3 词表 128K，对常见模式合并得更激进。GPT-4 词表 100K，居中。Mistral 词表 32K，会产出更多 token，但 embedding 层更小。

权衡永远是同一个：词表越大，序列越短，但参数也越多。

## 上线部署（Ship It）

这一课会产出一个用于构建和调试生产级 tokenizer 的 prompt。见 `outputs/prompt-tokenizer-builder.md`。

## 练习（Exercises）

1. **Easy：** 加一个 `get_token_bytes(id)` 方法，能展示任意 token ID 的原始字节。用它来检查你最常见的合并 token 实际代表什么。
2. **Medium：** 实现 Llama 风格的 pre-tokenizer：按空白和数字切分，但保留前导空格。在同一个语料上比较它和 GPT-2 正则方式所学到的词表。
3. **Hard：** 加一个聊天模板方法，输入一个 `{"role": ..., "content": ...}` 消息列表，按 Llama 3 chat 格式产出正确的 token 序列。和 HuggingFace 的实现对比验证。

## 关键术语（Key Terms）

| 术语 | 大家是怎么说的 | 它实际是什么 |
|------|----------------|----------------------|
| Byte-level BPE | 「在字节上跑的 tokenizer」 | 基础词表是 256 个字节值的 BPE——任何输入都能处理，没有 unknown token |
| Pre-tokenization | 「BPE 之前的切分」 | 基于正则或规则的切分，防止 BPE 跨词边界合并 |
| NFKC normalization | 「Unicode 清洗」 | 规范分解后再做兼容组合——「ﬁ」连字变「fi」，全角「Ａ」变「A」 |
| Chat template | 「消息怎么变成 token」 | 把 role/content 消息列表转成扁平 token 序列的精确格式——每个模型不一样，必须匹配训练格式 |
| Special tokens | 「控制 token」 | 绕过 BPE 的保留 token ID——[BOS]、[EOS]、[PAD]、聊天标记——在合并前精确匹配 |
| Fertility | 「每词 token 数」 | 输出 token 数和输入词数的比——GPT-4 英文是 1.3，韩文是 2–3，越高越浪费 context |
| tiktoken | 「OpenAI 的 tokenizer」 | 带 Python 绑定的 Rust BPE 实现——比纯 Python 快 10–100 倍 |
| Merge table | 「词表」 | 训练时学到的有序字节对合并列表——这就 *是* tokenizer 学到的知识 |

## 延伸阅读（Further Reading）

- [OpenAI tiktoken source](https://github.com/openai/tiktoken) —— GPT-3.5/4 用的 Rust BPE 实现
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers) —— 支持 BPE、WordPiece、Unigram 的 Rust tokenizer 库
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783) —— 128K 词表和 tokenizer 训练细节
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226) —— 语言无关的 tokenization
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py) —— 原始的 byte-to-Unicode 映射
