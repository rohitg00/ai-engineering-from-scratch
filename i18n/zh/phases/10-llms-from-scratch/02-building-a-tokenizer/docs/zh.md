# 从零开始构建一个标记器

> 第1课给你玩具,这课给你武器.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## 学习目标

- 建立一个处理 Unicode,白色空间规范化和特殊代币的生产级 BPE 代币器
- 实现字节级下降,以便代币器可以在未知的代币的情况下编码任何输入 (包括emoji,CJK和代码)
- 在应用BPE合并之前添加预代币化regex模式,将文字分为词界限
- 训练一个定制代码符号在一个体积上,并评估其压缩比与多语言文本上的代码符号

## 问题

你从01课的BPE标记器使用英语文,现在把日本文写在上面,或者是爱默契,或者是Python代码,

它会破裂.

不是因为BPE是错误的,因为实现是不完整的.一个生产代币器处理任何编码中的原始字节,在分化之前将Unicode正常化,管理永远不会合并的特殊代币,

现在,我们可以看到一个新的代码. 拉马3号有128,256. GPT-4有大约10万个. 这些不是玩具号码. 这些词汇背后的结合表是用数百个千兆字节的文字训练的, 周围的机器 - - 正常化,预代币化,特殊代币注射,聊天模板格式化 - - 是区分一个处理"你好世界"的代币器与一个处理整个互联网的代币器的东西.

你将建造那种机器.

## 概念

### 整个管道

生产代币不是一个算法,而是五个阶段的管道,每个阶段都解决了不同的问题.

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

每个阶段都有一个特定的工作:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### 字节级BPE

课01的代币器运行在UTF-8字节.这是一个正确的呼叫.但我们错过了一些重要的事情:当这些字节不有效的UTF-8时会发生什么?

字节级BPE通过将每一个可能的字节值 (0-255) 作为一个有效的代币来解决这个问题.你的基础词汇库是正确的 256 个条目.任何文件 - 文字,二进制,损坏 - 可以在没有产生未知的代币的情况下代币化.

GPT-2 增加了一个技巧:将每个字节映射到可打印的 Unicode 字符,使词汇保持于人能读取的.字节0x20 (空间) 成为它们的映射中的字符"G".这纯粹是化品.算法不关心.

实际实力:字节级BPE处理地球上的每一种语言.中国字符每字母是3 UTF-8字节.日本字母可以是3-8字节.阿拉伯语,德瓦纳加里,爱莫吉语 - - 所有这些都是字节序列.BPE算法在这些字节序列中找到模式,就像它在英语ASCII字节中找到模式一样.

### 预托克化

在BPE触及你的文本之前,你需要将它分成块. 这阻止了合并算法创建跨越词界限的代币.

通过使用regex模式来分开文本:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

这种模式分为缩写 ("don't"变成"don" + "'t"),有可选的领先空间,数字,分点和白色空间的单词.领先空间被附加到单词 - - 因此"猫"变成 ["the", "cat"],而不是 ["the", "", "cat"].

拉马使用SentencePiece,它完全跳过regex.它将原始字节流作为一个长序列,并让BPE算法弄清楚边界.这更简单,但给BPE更多的自由创建交叉字符.

选择是重要的.GPT-2的regex阻止令牌商学习一个词的结尾和下一个词的开始应该合并.SentencePiece允许,这有时会产生更有效的压缩,但更不易解释的令牌.

### 特殊的代币

每个生产代币商都保留了结构标记的代币ID:

| Token | Purpose | Used By |
|-------|---------|---------|
| `[BOS]` / `<s>` | Beginning of sequence | Llama 3, GPT |
| `[EOS]` / `</s>` | End of sequence | All models |
| `[PAD]` | Padding for batch alignment | BERT, T5 |
| `[UNK]` | Unknown token (byte-level BPE eliminates this) | BERT, WordPiece |
| `<\|im_start\|>` | Chat message boundary start | ChatGPT, Qwen |
| `<\|im_end\|>` | Chat message boundary end | ChatGPT, Qwen |
| `<\|user\|>` | User turn marker | Llama 3 |
| `<\|assistant\|>` | Assistant turn marker | Llama 3 |

特殊代币从来没有被BPE分开.它们在合并算法运行之前就匹配,用固定ID取代,周围的文本通常被代币化.

### 聊天模板

这就是大多数人感到困惑的地方,

当你发送消息给聊天模型时,API接受一个消息列表:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

模型不看到JSON. 它看到一个平坦的代币序列.聊天模板将消息转换成那个平坦的序列使用特殊的代币.每个模型都会以不同的方式进行:

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

错误的模板,模型产生垃圾.它是训练在一个准确的格式.任何偏差 - - 缺失的新线,交换的代币,额外的空间 - - 将输入置于训练分布之外.

### 速度

对于生产代码化来说,Python太慢了.

接脸标记器也叫做Rust.SentencePiece是C++.这些标记器可以实现10-100倍的速度.

为了展望:在每秒100万代币 (Rust) 时,需要174天,在每秒15万代币 (Rust) 时,需要1.7天.

在制作中,你会使用编译的实现,只触摸Python包装.

```figure
weight-tying
```

## 建立它

### 步骤1:字节级编码

转换任何字符串为字节序列,将每个字节映射到可打印的字符中,然后逆转过程.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

测试多语言文本,以查看字节数量:

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

"hello"是5字节. "你好"是6字节 (3个字符).火焰的爱默契是4字节.字节级代币符号不关心它是什么语言.字节是字节.

### 步骤2:使用 Regex 的预托克尼化器

通过GPT-2regex模式将文本分成块,每个部分由BPE独立地代码化.

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

其他`regex`模块支持 Unicode 属性逃逸 (`\p{L}`对于信件,`\p{N}`标准图书馆`re`对于生产多语言代币器,安装 `regex`现在,我们要去.

试试吧.

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

首先,一个词的前面没有空间,所以它的部分是`Hello`缩在位上分开,点击成为自己的部分.

### 步骤3: 字节序列上的 BPE

核心算法从课01中,但现在在预先代币的块上独立运行.

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

### 步骤4:特殊的标志处理

特殊的代币需要精确的匹配和固定的身份证.

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

### 步骤5: 完整的标记器类

链接所有东西:正常化,分成特殊代币,预代币化,BPE合并,地图到身份证.

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

### 六步:多语言测试

试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试

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

汉字每字产生3字节. 情感符号产生4字节. 没有一个字符打破代币器. 没有一个字符产生未知的代币. 这就是字节级BPE的功率.

## 用它

### 实际的代币交易者

查看各个语言段落的处理方式.

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

您将看到相同文本的代币数量不同. 128K 词汇的 Llama 3 在合并常见模式方面更具侵略性. 100K 的 GPT-4 在中间. 32K 的 Mistral 生产更多代币,但具有较小的嵌入层.

交易总是相同的:更大的词汇意味着更短的序列,但更多的参数.

## 运送它

这一课产生的提示是建立和调试生产代币.`outputs/prompt-tokenizer-builder.md`现在,我们要去.

## 运动

1. **Easy:**添加一个`get_token_bytes(id)`使用它检查您最常见的合并代币实际上代表什么.
2. **Medium:**实现Llama式预代币器,它分为白色空间和数字,但保持领先空间. 比较其词汇与GPT-2regex方法在同一体.
3. **Hard:**添加一个聊天模板方法,包含列表`{"role": ..., "content": ...}`通过"HuggingFace"实现,测试它.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Byte-level BPE | "Tokenizer that works on bytes" | BPE with a base vocabulary of 256 byte values -- handles any input without unknown tokens |
| Pre-tokenization | "Splitting before BPE" | Regex or rule-based splitting that prevents BPE from merging across word boundaries |
| NFKC normalization | "Unicode cleanup" | Canonical decomposition followed by compatibility composition -- "fi" ligature becomes "fi", fullwidth "A" becomes "A" |
| Chat template | "How messages become tokens" | The exact format for converting a list of role/content messages into a flat token sequence -- model-specific and must match training format |
| Special tokens | "Control tokens" | Reserved token IDs that bypass BPE -- [BOS], [EOS], [PAD], chat markers -- matched exactly before merge |
| Fertility | "Tokens per word" | Ratio of output tokens to input words -- 1.3 for English in GPT-4, 2-3 for Korean, higher means wasted context |
| tiktoken | "OpenAI tokenizer" | Rust BPE implementation with Python bindings -- 10-100x faster than pure Python |
| Merge table | "The vocabulary" | Ordered list of byte-pair merges learned during training -- this IS the tokenizer's learned knowledge |

## 进一步阅读

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- GPT-3.5/4 所使用的性BPE实现
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- 支持BPE,WordPiece,Unigram的结代币库
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- 128K词汇和代币化培训的详细信息
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)--语言认知标记
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- 原始的字节到Unicode映射
