# 分词器：BPE、WordPiece、SentencePiece

> 你的 LLM 不读英文。它读的是整数。分词器决定了这些整数是承载意义，还是浪费意义。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 05（NLP 基础）
**Time:** 约 90 分钟

## 学习目标

- 从零实现 BPE、WordPiece 和 Unigram 分词算法，并比较它们的合并策略
- 解释词表大小如何影响模型效率：太小会产生长序列，太大则浪费嵌入参数
- 分析分词在不同语言和代码中的伪影（artifacts），找出特定分词器失效的地方
- 使用 tiktoken 和 sentencepiece 库对文本进行分词，并检查生成的 token ID

## 问题所在

你的 LLM 不读英文。它不读任何语言。它读的是数字。

从 "Hello, world!" 到 [15496, 11, 995, 0] 之间的桥梁就是分词器。每个单词、每个空格、每个标点符号都必须先转换成整数，模型才能处理。这种转换并非中立的。它会把一些假设固化到模型中，事后无法撤销。

如果做错了，你的模型会浪费容量，用多个 token 来编码常见单词。"unfortunately" 会变成四个 token 而不是一个。对于多音节单词密集的文本，你的 128K 上下文窗口直接缩水 75%。如果做对了，同样的上下文窗口能容纳两倍的意义。"这个模型处理代码很好" 和 "这个模型处理 Python 代码就崩溃" 之间的差别，往往就取决于分词器是如何训练的。

你调用 GPT-4 或 Claude 的每一次 API 请求都是按 token 计费的。模型生成的每个 token 都消耗算力。表示一个输出所需的 token 越少，端到端推理就越快。分词不是预处理。它是架构的一部分。

## 核心概念

### 三种失败的方法（和一种成功的方法）

把文本转换为数字有三种显而易见的方式。其中两种无法扩展。

**词级分词**按空格和标点切分。"The cat sat" 变成 ["The", "cat", "sat"]。简单。但 "tokenization" 呢？"GPT-4o" 呢？还有像 "Geschwindigkeitsbegrenzung" 这样的德语复合词呢？词级分词需要巨大的词表来覆盖每种语言中的每个词。漏掉一个词，就会得到可怕的 `[UNK]` token——模型用它表示"我不知道这是什么"。仅英语就有一百多万个词形。再加上代码、URL、科学记数法和另外 100 种语言，你就需要无限大的词表。

**字符级分词**走向另一个极端。"hello" 变成 ["h", "e", "l", "l", "o"]。词表很小（几百个字符）。永远不会出现未知 token。但序列会变得极长。一个词级分词下 10 个 token 的句子会变成 50 个字符级 token。模型必须学会 "t"、"h"、"e" 合在一起表示 "the"——把注意力容量浪费在三岁小孩就能学会的东西上。

**子词分词**找到了最佳平衡点。常见词保持完整："the" 是一个 token。罕见词分解成有意义的片段："unhappiness" 变成 ["un", "happi", "ness"]。词表保持可控（30K 到 128K 个 token）。序列保持简短。未知 token 基本消失，因为任何词都可以由子词片段构建。

每个现代 LLM 都使用子词分词。GPT-2、GPT-4、BERT、Llama 3、Claude——全部如此。问题只在于用哪种算法。

```mermaid
graph TD
    A["Text: 'unhappiness'"] --> B{"Tokenization Strategy"}
    B -->|Word-level| C["['unhappiness']\n1 token if in vocab\n[UNK] if not"]
    B -->|Character-level| D["['u','n','h','a','p','p','i','n','e','s','s']\n11 tokens"]
    B -->|Subword BPE| E["['un','happi','ness']\n3 tokens"]

    style C fill:#ff6b6b,color:#fff
    style D fill:#ffa500,color:#fff
    style E fill:#51cf66,color:#fff
```

### BPE：字节对编码（Byte Pair Encoding）

BPE 是一种被改用于分词的贪心压缩算法。它的思想简单到可以写在一张索引卡片上。

从单个字符开始。统计训练语料库中每一对相邻字符的出现次数。把最频繁的一对合并成新 token。重复直到达到目标词表大小。

```figure
tokenizer-bpe
```

下面是 BPE 在一个包含 "lower"、"lowest" 和 "newest" 的小语料库上的运行过程：

```
Corpus (with word frequencies):
  "lower"  x5
  "lowest" x2
  "newest" x6

Step 0 -- Start with characters:
  l o w e r       (x5)
  l o w e s t     (x2)
  n e w e s t     (x6)

Step 1 -- Count adjacent pairs:
  (e,s): 8    (s,t): 8    (l,o): 7    (o,w): 7
  (w,e): 13   (e,r): 5    (n,e): 6    ...

Step 2 -- Merge most frequent pair (w,e) -> "we":
  l o we r        (x5)
  l o we s t      (x2)
  n e we s t      (x6)

Step 3 -- Recount and merge (e,s) -> "es":
  l o we r        (x5)
  l o we s t      (x2)    <- 'es' only forms from 'e'+'s', not 'we'+'s'
  n e we s t      (x6)    <- wait, the 'e' before 'we' and 's' after 'we'

Actually tracking this precisely:
  After "we" merge, remaining pairs:
  (l,o): 7   (o,we): 7   (we,r): 5   (we,s): 8
  (s,t): 8   (n,e): 6    (e,we): 6

Step 3 -- Merge (we,s) -> "wes" or (s,t) -> "st" (tied at 8, pick first):
  Merge (we,s) -> "wes":
  l o we r        (x5)
  l o wes t       (x2)
  n e wes t       (x6)

Step 4 -- Merge (wes,t) -> "west":
  l o we r        (x5)
  l o west        (x2)
  n e west        (x6)

...continue until target vocab size reached.
```

合并表就是分词器。编码新文本时，按合并被学习的顺序依次应用。训练语料库决定了存在哪些合并，而这个选择会永久性地塑造模型所看到的内容。

```mermaid
graph LR
    subgraph Training["BPE Training Loop"]
        direction TB
        T1["Start: character vocabulary"] --> T2["Count all adjacent pairs"]
        T2 --> T3["Merge most frequent pair"]
        T3 --> T4["Add merged token to vocab"]
        T4 --> T5{"Reached target\nvocab size?"}
        T5 -->|No| T2
        T5 -->|Yes| T6["Done: save merge table"]
    end
```

### 字节级 BPE（GPT-2、GPT-3、GPT-4）

标准 BPE 作用于 Unicode 字符。字节级 BPE 作用于原始字节（0-255）。这带来恰好 256 个基础词表，可以处理任何语言或编码，并且永远不会产生未知 token。

GPT-2 引入了这种方法。基础词表覆盖所有可能的字节。BPE 合并在其上构建。OpenAI 的 tiktoken 库实现了字节级 BPE，词表大小如下：

- GPT-2：50,257 个 token
- GPT-3.5/GPT-4：约 100,256 个 token（cl100k_base 编码）
- GPT-4o：200,019 个 token（o200k_base 编码）

### WordPiece（BERT）

WordPiece 看起来与 BPE 相似，但选择合并的方式不同。它不使用原始频率，而是最大化训练数据的似然：

```
BPE merge criterion:      count(A, B)
WordPiece merge criterion: count(AB) / (count(A) * count(B))
```

BPE 问："哪一对出现得最频繁？" WordPiece 问："哪一对共同出现的频率比随机预期更高？" 这个细微的差别会产生不同的词表。WordPiece 偏好共现令人惊讶（而不仅是频繁）的合并。

WordPiece 还使用 "##" 前缀表示延续的子词：

```
"unhappiness" -> ["un", "##happi", "##ness"]
"embedding"   -> ["em", "##bed", "##ding"]
```

"##" 前缀表示这个片段延续了前一个 token。BERT 使用词表为 30,522 个 token 的 WordPiece。每个 BERT 变体——DistilBERT，而 RoBERTa 的分词器实际上是 BPE，但 BERT 本身用的是 WordPiece。

### SentencePiece（Llama、T5）

SentencePiece 把输入视为原始的 Unicode 字符流，包括空白字符。没有预分词步骤。没有针对词边界的语言特定规则。这使它真正做到了语言无关——它能处理中文、日语、泰语等空格不分隔单词的语言。

SentencePiece 支持两种算法：
- **BPE 模式**：与标准 BPE 相同的合并逻辑，应用于原始字符序列
- **Unigram 模式**：从一个大词表开始，迭代删除对整体似然影响最小的 token。与 BPE 相反——做减法而非合并。

Llama 2 使用词表为 32,000 个 token 的 SentencePiece BPE。T5 使用词表为 32,000 个 token 的 SentencePiece Unigram。注意：Llama 3 切换到了基于 tiktoken 的字节级 BPE 分词器，词表为 128,256 个 token。

### 词表大小的权衡

这是一个真实且后果可量化的工程决策。

```mermaid
graph LR
    subgraph Small["Small Vocab (32K)\ne.g., BERT, T5"]
        S1["More tokens per text"]
        S2["Longer sequences"]
        S3["Smaller embedding matrix"]
        S4["Better rare-word handling"]
    end
    subgraph Large["Large Vocab (128K+)\ne.g., Llama 3, GPT-4o"]
        L1["Fewer tokens per text"]
        L2["Shorter sequences"]
        L3["Larger embedding matrix"]
        L4["Faster inference"]
    end
```

一些具体数字。对于 128K 词表和 4,096 维嵌入，仅嵌入矩阵就有 128,000 x 4,096 = 5.24 亿个参数。对于 32K 词表，则是 1.31 亿个参数。仅分词器的选择就带来了 4 亿参数的差距。

但更大的词表能更激进地压缩文本。同一段英文，在 32K 词表下可能需要 100 个 token，而在 128K 词表下可能只需 70 个。这意味着生成时前向传播次数减少 30%。对于服务数百万请求的模型来说，这是算力成本的直接降低。

趋势很明确：词表大小在不断增长。GPT-2 用 50,257。GPT-4 用约 100K。Llama 3 用 128K。GPT-4o 用 200K。

| 模型 | 词表大小 | 分词器类型 | 每个英文单词平均 token 数 |
|-------|-----------|----------------|---------------------------|
| BERT | 30,522 | WordPiece | ~1.4 |
| GPT-2 | 50,257 | 字节级 BPE | ~1.3 |
| Llama 2 | 32,000 | SentencePiece BPE | ~1.4 |
| GPT-4 | ~100,256 | 字节级 BPE | ~1.2 |
| Llama 3 | 128,256 | 字节级 BPE（tiktoken） | ~1.1 |
| GPT-4o | 200,019 | 字节级 BPE | ~1.0 |

### 多语言税

主要基于英语训练的分词器对其他语言非常不友好。GPT-2 的分词器处理韩语文本平均每个单词需要 2-3 个 token。中文可能更糟。这意味着韩语用户的上下文窗口实际上只有英语用户的一半——付出同样的价格，却得到更低的信息密度。

这就是 Llama 3 把词表从 32K 扩大到 128K 的原因。为非英语文字分配更多 token，意味着各语言之间的压缩更公平。

```figure
tokenizer-tradeoff
```

## 动手实现

### 步骤 1：字符级分词器

从基础开始。字符级分词器把每个字符映射到它的 Unicode 码点。无需训练。没有未知 token。只是一个直接的映射。

```python
class CharTokenizer:
    def encode(self, text):
        return [ord(c) for c in text]

    def decode(self, tokens):
        return "".join(chr(t) for t in tokens)
```

"hello" 变成 [104, 101, 108, 108, 111]。每个字符都是一个独立的 token。这是我们接下来要改进的基线。

### 步骤 2：从零实现 BPE 分词器

真正的实现。我们在原始字节上训练（与 GPT-2 一样），统计字符对，合并最频繁的一对，并按顺序记录每一次合并。合并表就是分词器。

```python
from collections import Counter

class BPETokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {}

    def _get_pairs(self, tokens):
        pairs = Counter()
        for i in range(len(tokens) - 1):
            pairs[(tokens[i], tokens[i + 1])] += 1
        return pairs

    def _merge_pair(self, tokens, pair, new_token):
        merged = []
        i = 0
        while i < len(tokens):
            if i < len(tokens) - 1 and tokens[i] == pair[0] and tokens[i + 1] == pair[1]:
                merged.append(new_token)
                i += 2
            else:
                merged.append(tokens[i])
                i += 1
        return merged

    def train(self, text, num_merges):
        tokens = list(text.encode("utf-8"))
        self.vocab = {i: bytes([i]) for i in range(256)}

        for i in range(num_merges):
            pairs = self._get_pairs(tokens)
            if not pairs:
                break
            best_pair = max(pairs, key=pairs.get)
            new_token = 256 + i
            tokens = self._merge_pair(tokens, best_pair, new_token)
            self.merges[best_pair] = new_token
            self.vocab[new_token] = self.vocab[best_pair[0]] + self.vocab[best_pair[1]]

        return self

    def encode(self, text):
        tokens = list(text.encode("utf-8"))
        for pair, new_token in self.merges.items():
            tokens = self._merge_pair(tokens, pair, new_token)
        return tokens

    def decode(self, tokens):
        byte_sequence = b"".join(self.vocab[t] for t in tokens)
        return byte_sequence.decode("utf-8", errors="replace")
```

训练循环是 BPE 的核心：统计字符对，合并胜出者，重复。每次合并都会减少总 token 数。经过 `num_merges` 轮后，词表从 256（基础字节）增长到 256 + num_merges。

编码时按合并被学习的精确顺序依次应用。这一点很重要。如果合并 1 创建了 "th"，合并 5 创建了 "the"，那么编码必须先应用合并 1，这样 "the" 才能在合并 5 中由 "th" + "e" 形成。

解码是逆过程：在词表中查找每个 token ID，拼接字节，再解码为 UTF-8。

### 步骤 3：编码与解码的往返测试

```python
corpus = (
    "The cat sat on the mat. The cat ate the rat. "
    "The dog sat on the log. The dog ate the frog. "
    "Natural language processing is the study of how computers "
    "understand and generate human language. "
    "Tokenization is the first step in any NLP pipeline."
)

tokenizer = BPETokenizer()
tokenizer.train(corpus, num_merges=40)

test_sentences = [
    "The cat sat on the mat.",
    "Natural language processing",
    "tokenization pipeline",
    "unhappiness",
]

for sentence in test_sentences:
    encoded = tokenizer.encode(sentence)
    decoded = tokenizer.decode(encoded)
    raw_bytes = len(sentence.encode("utf-8"))
    ratio = len(encoded) / raw_bytes
    print(f"'{sentence}'")
    print(f"  Tokens: {len(encoded)} (from {raw_bytes} bytes) -- ratio: {ratio:.2f}")
    print(f"  Roundtrip: {'PASS' if decoded == sentence else 'FAIL'}")
```

压缩比告诉你分词器的有效程度。0.50 的压缩比表示分词器把文本压缩到了原始字节数一半的 token 数。越低越好。在训练语料库上，压缩比会很好。在分布外的文本上，比如 "unhappiness"（语料库中没有出现），压缩比会更差——分词器对未见过的模式会退回到字符级编码。

### 步骤 4：与 tiktoken 对比

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

texts = [
    "The cat sat on the mat.",
    "unhappiness",
    "Hello, world!",
    "def fibonacci(n): return n if n < 2 else fibonacci(n-1) + fibonacci(n-2)",
    "Geschwindigkeitsbegrenzung",
]

for text in texts:
    our_tokens = tokenizer.encode(text)
    tiktoken_tokens = enc.encode(text)
    tiktoken_pieces = [enc.decode([t]) for t in tiktoken_tokens]
    print(f"'{text}'")
    print(f"  Our BPE:   {len(our_tokens)} tokens")
    print(f"  tiktoken:  {len(tiktoken_tokens)} tokens -> {tiktoken_pieces}")
```

tiktoken 使用完全相同的算法，但它是在数百 GB 的文本上用 100,000 次合并训练出来的。算法一模一样。区别在于训练数据和合并次数。你用一段文本和 40 次合并训练的分词器，无法与 tiktoken 在海量语料上的 10 万次合并竞争。但机制是一样的。

### 步骤 5：词表分析

```python
def analyze_vocabulary(tokenizer, test_texts):
    total_tokens = 0
    total_chars = 0
    token_usage = Counter()

    for text in test_texts:
        encoded = tokenizer.encode(text)
        total_tokens += len(encoded)
        total_chars += len(text)
        for t in encoded:
            token_usage[t] += 1

    print(f"Vocabulary size: {len(tokenizer.vocab)}")
    print(f"Total tokens across all texts: {total_tokens}")
    print(f"Total characters: {total_chars}")
    print(f"Avg tokens per character: {total_tokens / total_chars:.2f}")

    print(f"\nMost used tokens:")
    for token_id, count in token_usage.most_common(10):
        token_bytes = tokenizer.vocab[token_id]
        display = token_bytes.decode("utf-8", errors="replace")
        print(f"  Token {token_id:4d}: '{display}' (used {count} times)")

    unused = [t for t in tokenizer.vocab if t not in token_usage]
    print(f"\nUnused tokens: {len(unused)} out of {len(tokenizer.vocab)}")
```

这会揭示你词表中的 Zipf 分布。少数 token 占主导（空格、"the"、"e"）。大多数 token 很少被使用。生产级分词器就是针对这种分布优化的——常见模式获得较短的 token ID，罕见模式获得较长的表示。

## 使用生产级工具

你的手写 BPE 已经能工作了。现在看看生产级工具是什么样的。

### tiktoken（OpenAI）

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

text = "Tokenizers convert text to integers"
tokens = enc.encode(text)
print(f"Tokens: {tokens}")
print(f"Pieces: {[enc.decode([t]) for t in tokens]}")
print(f"Roundtrip: {enc.decode(tokens)}")
```

tiktoken 用 Rust 编写，带有 Python 绑定。它每秒可以编码数百万个 token。同样的 BPE 算法，工业级实现。

### Hugging Face tokenizers

```python
from tokenizers import Tokenizer
from tokenizers.models import BPE
from tokenizers.trainers import BpeTrainer
from tokenizers.pre_tokenizers import ByteLevel

tokenizer = Tokenizer(BPE())
tokenizer.pre_tokenizer = ByteLevel()

trainer = BpeTrainer(vocab_size=1000, special_tokens=["<pad>", "<eos>", "<unk>"])
tokenizer.train(["corpus.txt"], trainer)

output = tokenizer.encode("The cat sat on the mat.")
print(f"Tokens: {output.tokens}")
print(f"IDs: {output.ids}")
```

Hugging Face 的 tokenizers 库底层同样是 Rust。它能在几秒钟内在 GB 级语料上训练 BPE。这就是你训练自己的模型时要用的工具。

### 加载 Llama 的分词器

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

text = "Tokenizers are the unsung heroes of LLMs"
tokens = tokenizer.encode(text)
print(f"Token IDs: {tokens}")
print(f"Tokens: {tokenizer.convert_ids_to_tokens(tokens)}")
print(f"Vocab size: {tokenizer.vocab_size}")

multilingual = ["Hello world", "Hola mundo", "Bonjour le monde"]
for text in multilingual:
    ids = tokenizer.encode(text)
    print(f"'{text}' -> {len(ids)} tokens")
```

Llama 3 的 128K 词表对非英文文本的压缩效果明显优于 GPT-2 的 50K 词表。你可以自己验证——用多种语言编码同一句话，然后数一数 token 数量。

## 交付成果

本课程产出 `outputs/prompt-tokenizer-analyzer.md`——一个可复用的提示词，用于分析任意文本与模型组合的分词效率。输入一段文本样本，它会告诉你哪个模型的分词器处理得最好。

## 练习

1. 修改 BPE 分词器，使其在每次合并步骤时打印词表。观察 "t" + "h" 如何变成 "th"，然后 "th" + "e" 如何变成 "the"。追踪常见英文单词是如何被逐块组装起来的。

2. 为 BPE 分词器添加特殊 token（`<pad>`、`<eos>`、`<unk>`）。将它们的 ID 分别设为 0、1、2，并相应地平移所有其他 token。实现一个预分词步骤，在运行 BPE 之前按空白字符切分。

3. 实现 WordPiece 的合并准则（用似然比代替频率）。用相同的语料库和相同的合并次数分别训练 BPE 和 WordPiece。比较产生的词表——哪一个能产生更有语言学意义的子词？

4. 构建一个多语言分词器效率基准。选取英语、西班牙语、中文、韩语和阿拉伯语各 10 个句子。用 tiktoken（cl100k_base）对每个句子分词，并测量平均每字符 token 数。量化每种语言的"多语言税"。

5. 在更大的语料库上训练你的 BPE 分词器（下载一篇维基百科文章）。调整合并次数，使压缩比在该文本上达到 tiktoken 的 10% 以内。这会迫使你理解语料库大小、合并次数和压缩质量之间的关系。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Token | "一个单词" | 模型词表中的一个单位——可以是字符、子词、单词或多词片段 |
| BPE | "某种压缩的东西" | 字节对编码（Byte Pair Encoding）——迭代合并最频繁的相邻 token 对，直到达到目标词表大小 |
| WordPiece | "BERT 的分词器" | 类似 BPE，但合并时最大化似然比 count(AB)/(count(A)*count(B)) 而非原始频率 |
| SentencePiece | "一个分词器库" | 一种语言无关的分词器，直接作用于原始 Unicode 而无需预分词，支持 BPE 和 Unigram 算法 |
| 词表大小 | "它认识多少词" | 唯一 token 的总数：GPT-2 有 50,257，BERT 有 30,522，Llama 3 有 128,256 |
| Fertility | "不是分词器术语" | 每个单词的平均 token 数——衡量分词器在各语言上的效率（1.0 是完美的，3.0 意味着模型要多付出三倍的工作量） |
| 字节级 BPE | "GPT 的分词器" | 作用于原始字节（0-255）而非 Unicode 字符的 BPE，保证任何输入都不会产生未知 token |
| 合并表 | "分词器文件" | 训练期间学到的字符对合并的有序列表——这就是分词器本身，且顺序至关重要 |
| 预分词 | "按空格切分" | 在子词分词之前应用的规则：空白切分、数字分离、标点处理 |
| 压缩比 | "分词器的效率" | 产生的 token 数除以输入字节数——越低表示压缩越好、推理越快 |

## 延伸阅读

- [Sennrich et al., 2016 -- "Neural Machine Translation of Rare Words with Subword Units"](https://arxiv.org/abs/1508.07909)——将 BPE 引入 NLP 的论文，把一个 1994 年的压缩算法变成了现代分词的基石
- [Kudo & Richardson, 2018 -- "SentencePiece: A simple and language independent subword tokenizer"](https://arxiv.org/abs/1808.06226)——语言无关的分词方法，使多语言模型变得可行
- [OpenAI tiktoken repository](https://github.com/openai/tiktoken)——用 Rust 实现并带有 Python 绑定的生产级 BPE 实现，被 GPT-3.5/4/4o 使用
- [Hugging Face Tokenizers documentation](https://huggingface.co/docs/tokenizers)——具备 Rust 性能的生产级分词器训练工具