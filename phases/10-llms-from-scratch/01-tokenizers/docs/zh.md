# 分词器：BPE、WordPiece、SentencePiece

> 你的大语言模型不读英文。它读整数。分词器决定这些整数是承载意义还是浪费容量。

**类型：** 构建
**语言：** Python
**前置知识：** 第五阶段（NLP 基础）
**时间：** ~90 分钟

## 学习目标

- 从零实现 BPE、WordPiece 和 Unigram 分词算法，并比较它们的合并策略
- 解释词表大小如何影响模型效率：太小会导致序列过长，太大则会浪费嵌入参数
- 分析分词器在不同语言和代码上的产物，识别特定分词器失效的地方
- 使用 tiktoken 和 sentencepiece 库对文本进行分词并检查生成的 token ID

## 问题

你的大语言模型不读英文。它不读任何语言。它读数字。

"Hello, world!" 与 [15496, 11, 995, 0] 之间的差距就是分词器。每个单词、每个空格、每个标点符号都必须先转换成整数，模型才能处理。这种转换并非中立——它将假设固化进模型，且后续无法撤销。

搞错了，模型就会浪费容量去用多个 token 编码常见单词。"unfortunately" 变成四个 token 而不是一个。对于多音节词汇密集的文本，你的 128K 上下文窗口直接缩水 75%。搞对了，同样的上下文窗口能承载两倍的意义。"这个模型代码处理得好"与"这个模型遇到 Python 就卡死"之间的差别，往往就取决于分词器是怎么训练的。

你每次调用 GPT-4 或 Claude 的 API 都是按 token 计费的。模型每生成一个 token 都要消耗算力。表示输出所需的 token 越少，端到端推理就越快。分词不是预处理，它是架构的一部分。

## 概念

### 三种失败的方法（以及一种成功的方法）

将文本转成数字有三种显而易见的做法。其中两种在大规模上行不通。

**词级分词** 按空格和标点切分。"The cat sat" 变成 ["The", "cat", "sat"]。简单。但 "tokenization" 呢？"GPT-4o" 呢？或者德语复合词 "Geschwindigkeitsbegrenzung"？词级分词需要一个巨大的词表才能覆盖每种语言的每个单词。漏掉一个词，你就会得到 dreaded `[UNK]` token——模型在说"我不知道这是什么"。仅英语就有超过一百万种词形。加上代码、URL、科学记数法和另外 100 种语言，你需要无限大的词表。

**字符级分词** 走向另一个极端。"hello" 变成 ["h", "e", "l", "l", "o"]。词表极小（几百个字符）。永远不会出现未知 token。但序列变得极长。一个用 10 个词级 token 表示的句子变成 50 个字符级 token。模型必须学会 "t"、"h"、"e" 凑在一起是 "the"——把注意力容量浪费在人类三岁就学会的东西上。

**子词分词** 找到了甜点。常见词保持完整："the" 是一个 token。罕见词分解成有意义的片段："unhappiness" 变成 ["un", "happi", "ness"]。词表保持在可控范围（30K 到 128K token）。序列保持短小。未知 token 基本消失，因为任何单词都可以用子词片段拼出来。

每个现代大语言模型都使用子词分词。GPT-2、GPT-4、BERT、Llama 3、Claude——全是。问题是用哪种算法。

```mermaid
graph TD
    A["文本: 'unhappiness'"] --> B{"分词策略"}
    B -->|词级| C["['unhappiness']\n如果在词表中则 1 个 token\n否则 [UNK]"]
    B -->|字符级| D["['u','n','h','a','p','p','i','n','e','s','s']\n11 个 token"]
    B -->|子词 BPE| E["['un','happi','ness']\n3 个 token"]

    style C fill:#ff6b6b,color:#fff
    style D fill:#ffa500,color:#fff
    style E fill:#51cf66,color:#fff
```

### BPE：字节对编码

BPE 是一种被重新用于分词的贪心压缩算法。思路简单到可以写在一张名片上。

从单个字符开始。统计训练语料中每一对相邻字符的出现次数。将最频繁的一对合并成一个新 token。重复此过程直到达到目标词表大小。

以下是 BPE 在一个小语料上运行的过程，语料包含单词 "lower"、"lowest" 和 "newest"：

```
语料（带词频）:
  "lower"  x5
  "lowest" x2
  "newest" x6

第 0 步 -- 从字符开始:
  l o w e r       (x5)
  l o w e s t     (x2)
  n e w e s t     (x6)

第 1 步 -- 统计相邻字符对:
  (e,s): 8    (s,t): 8    (l,o): 7    (o,w): 7
  (w,e): 13   (e,r): 5    (n,e): 6    ...

第 2 步 -- 合并最频繁的字符对 (w,e) -> "we":
  l o we r        (x5)
  l o we s t      (x2)
  n e we s t      (x6)

第 3 步 -- 重新统计并合并 (e,s) -> "es":
  l o we r        (x5)
  l o we s t      (x2)    <- 'es' 由 'e'+'s' 组成，不是 'we'+'s'
  n e we s t      (x6)    <- 注意 'we' 前面的 'e' 和后面的 's'

精确追踪:
  在 "we" 合并后，剩余的字符对:
  (l,o): 7   (o,we): 7   (we,r): 5   (we,s): 8
  (s,t): 8   (n,e): 6    (e,we): 6

第 3 步 -- 合并 (we,s) -> "wes" 或 (s,t) -> "st"（并列 8，取第一个）:
  合并 (we,s) -> "wes":
  l o we r        (x5)
  l o wes t       (x2)
  n e wes t       (x6)

第 4 步 -- 合并 (wes,t) -> "west":
  l o we r        (x5)
  l o west        (x2)
  n e west        (x6)

...继续直到达到目标词表大小。
```

合并表就是分词器。要编码新文本，按学习到的顺序依次应用合并。训练语料决定了哪些合并存在，而这个选择永久塑造了模型看到的内容。

```mermaid
graph LR
    subgraph Training["BPE 训练循环"]
        direction TB
        T1["起始: 字符词表"] --> T2["统计所有相邻字符对"]
        T2 --> T3["合并最频繁的字符对"]
        T3 --> T4["将合并后的 token 加入词表"]
        T4 --> T5{"达到目标\n词表大小?"}
        T5 -->|否| T2
        T5 -->|是| T6["完成: 保存合并表"]
    end
```

### 字节级 BPE（GPT-2、GPT-3、GPT-4）

标准 BPE 操作 Unicode 字符。字节级 BPE 操作原始字节（0-255）。这给你一个恰好 256 的基础词表，能处理任何语言或编码，且永远不会产生未知 token。

GPT-2 引入了这种方法。基础词表覆盖所有可能的字节。BPE 合并在此基础上构建。OpenAI 的 tiktoken 库实现了字节级 BPE，词表大小如下：

- GPT-2: 50,257 token
- GPT-3.5/GPT-4: ~100,256 token（cl100k_base 编码）
- GPT-4o: 200,019 token（o200k_base 编码）

### WordPiece（BERT）

WordPiece 看起来与 BPE 相似，但选择合并的方式不同。它不是用原始频率，而是最大化训练数据的似然：

```
BPE 合并标准:      count(A, B)
WordPiece 合并标准: count(AB) / (count(A) * count(B))
```

BPE 问："哪一对出现得最频繁？" WordPiece 问："哪一对一起出现的频率高于随机偶然？" 这个微妙的差别产生了不同的词表。WordPiece 倾向于共现令人惊讶（而非仅仅是频繁）的合并。

WordPiece 还为延续子词使用 "##" 前缀：

```
"unhappiness" -> ["un", "##happi", "##ness"]
"embedding"   -> ["em", "##bed", "##ding"]
```

"##" 前缀告诉你这个片段延续前一个 token。BERT 使用 30,522 token 的 WordPiece 词表。每个 BERT 变体——DistilBERT、RoBERTa（其分词器实际上是 BPE，但 BERT 本身是 WordPiece）。

### SentencePiece（Llama、T5）

SentencePiece 将输入视为原始 Unicode 字符流，包括空白字符。没有预分词步骤。没有关于词边界的语言特定规则。这使它真正语言无关——适用于中文、日文、泰文以及其他不以空格分词的语言。

SentencePiece 支持两种算法：
- **BPE 模式**：与标准 BPE 相同的合并逻辑，应用于原始字符序列
- **Unigram 模式**：从一个巨大的词表开始，迭代移除对整体似然影响最小的 token。与 BPE 相反——是剪枝而非合并。

Llama 2 使用 32,000 token 的 SentencePiece BPE。T5 使用 32,000 token 的 SentencePiece Unigram。注意：Llama 3 切换到基于 tiktoken 的字节级 BPE 分词器，词表为 128,256 token。

### 词表大小的权衡

这是一个有实际可衡量后果的工程决策。

```mermaid
graph LR
    subgraph Small["小词表 (32K)\n例如 BERT、T5"]
        S1["每段文本更多 token"]
        S2["更长序列"]
        S3["更小的嵌入矩阵"]
        S4["更好的罕见词处理"]
    end
    subgraph Large["大词表 (128K+)\n例如 Llama 3、GPT-4o"]
        L1["每段文本更少 token"]
        L2["更短序列"]
        L3["更大的嵌入矩阵"]
        L4["更快推理"]
    end
```

具体数字。对于 128K 词表和 4,096 维嵌入，仅嵌入矩阵就有 128,000 × 4,096 = 5.24 亿参数。对于 32K 词表，是 1.31 亿参数。仅分词器选择就带来 4 亿参数的差异。

但更大的词表更积极地压缩文本。同一段英文用 32K 词表可能需要 100 token，用 128K 词表可能只要 70 token。这意味着生成时前向传播减少 30%。对于服务数百万请求的模型，这是算力成本的直接降低。

趋势很明显：词表大小在增长。GPT-2 用 50,257。GPT-4 用 ~100K。Llama 3 用 128K。GPT-4o 用 200K。

| 模型 | 词表大小 | 分词器类型 | 每个英文单词平均 token 数 |
|------|---------|-----------|------------------------|
| BERT | 30,522 | WordPiece | ~1.4 |
| GPT-2 | 50,257 | 字节级 BPE | ~1.3 |
| Llama 2 | 32,000 | SentencePiece BPE | ~1.4 |
| GPT-4 | ~100,256 | 字节级 BPE | ~1.2 |
| Llama 3 | 128,256 | 字节级 BPE (tiktoken) | ~1.1 |
| GPT-4o | 200,019 | 字节级 BPE | ~1.0 |

### 多语言税

主要用英语训练的分词器对其他语言很残酷。韩语文本在 GPT-2 的分词器中平均每个单词 2-3 token。中文可能更糟。这意味着韩国用户实际上拥有的上下文窗口只有英语用户的一半——付同样的价格，信息密度却更低。

这就是 Llama 3 将词表从 32K 扩大到 128K 的原因。更多 token 分配给非英文文字意味着跨语言的更公平压缩。

## 构建

### 第 1 步：字符级分词器

从基础开始。字符级分词器将每个字符映射到其 Unicode 码点。无需训练。没有未知 token。直接映射。

```python
class CharTokenizer:
    def encode(self, text):
        return [ord(c) for c in text]

    def decode(self, tokens):
        return "".join(chr(t) for t in tokens)
```

"hello" 变成 [104, 101, 108, 108, 111]。每个字符是一个 token。这是我们改进的基线。

### 第 2 步：从零实现 BPE 分词器

真正的实现。我们在原始字节上训练（像 GPT-2），统计字符对，合并最频繁的，并按顺序记录每次合并。合并表就是分词器。

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

训练循环是 BPE 的核心：统计字符对，合并赢家，重复。每次合并减少总 token 数。经过 `num_merges` 轮后，词表从 256（基础字节）增长到 256 + num_merges。

编码按学习到的精确顺序应用合并。这很重要。如果第 1 次合并创建了 "th"，第 5 次合并创建了 "the"，编码必须先应用第 1 次合并，这样 "the" 才能由第 5 次合并中的 "th" + "e" 组成。

解码是逆过程：在词表中查找每个 token ID，拼接字节，解码为 UTF-8。

### 第 3 步：编码解码往返测试

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
    print(f"  Token: {len(encoded)} (来自 {raw_bytes} 字节) -- 比率: {ratio:.2f}")
    print(f"  往返: {'通过' if decoded == sentence else '失败'}")
```

压缩比率告诉你分词器的效率。比率为 0.50 意味着分词器将文本压缩到原始字节数一半的 token。越低越好。在训练语料上，比率会很好。在分布外文本如 "unhappiness"（未出现在语料中）上，比率会更差——分词器对未见过的模式退回到字符级编码。

### 第 4 步：与 tiktoken 对比

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
    print(f"  我们的 BPE:   {len(our_tokens)} token")
    print(f"  tiktoken:  {len(tiktoken_tokens)} token -> {tiktoken_pieces}")
```

tiktoken 使用完全相同的算法，但在数百 GB 文本上训练了 100,000 次合并。算法相同。差别在于训练数据和合并次数。你的分词器在一段文字上训练了 40 次合并，无法与 tiktoken 在巨大语料上的 100K 合并竞争。但机制是一样的。

### 第 5 步：词表分析

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

    print(f"词表大小: {len(tokenizer.vocab)}")
    print(f"所有文本的总 token 数: {total_tokens}")
    print(f"总字符数: {total_chars}")
    print(f"平均每字符 token 数: {total_tokens / total_chars:.2f}")

    print(f"\n最常用的 token:")
    for token_id, count in token_usage.most_common(10):
        token_bytes = tokenizer.vocab[token_id]
        display = token_bytes.decode("utf-8", errors="replace")
        print(f"  Token {token_id:4d}: '{display}' (使用 {count} 次)")

    unused = [t for t in tokenizer.vocab if t not in token_usage]
    print(f"\n未使用的 token: {len(unused)} / {len(tokenizer.vocab)}")
```

这揭示了词表中的 Zipf 分布。少数 token 占主导（空格、"the"、"e"）。大多数 token 很少使用。生产分词器针对这种分布优化——常见模式获得短 token ID，罕见模式获得更长的表示。

## 使用

你的从零实现 BPE 已经可以工作了。现在看看生产工具长什么样。

### tiktoken（OpenAI）

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

text = "Tokenizers convert text to integers"
tokens = enc.encode(text)
print(f"Token: {tokens}")
print(f"片段: {[enc.decode([t]) for t in tokens]}")
print(f"往返: {enc.decode(tokens)}")
```

tiktoken 用 Rust 编写，带 Python 绑定。每秒编码数百万 token。同样的 BPE 算法，工业级实现。

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
print(f"Token: {output.tokens}")
print(f"ID: {output.ids}")
```

Hugging Face tokenizers 库底层也是 Rust。它在几秒钟内就能在 GB 级语料上训练 BPE。训练自己的模型时就用这个。

### 加载 Llama 的分词器

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

text = "Tokenizers are the unsung heroes of LLMs"
tokens = tokenizer.encode(text)
print(f"Token ID: {tokens}")
print(f"Token: {tokenizer.convert_ids_to_tokens(tokens)}")
print(f"词表大小: {tokenizer.vocab_size}")

multilingual = ["Hello world", "Hola mundo", "Bonjour le monde"]
for text in multilingual:
    ids = tokenizer.encode(text)
    print(f"'{text}' -> {len(ids)} token")
```

Llama 3 的 128K 词表显著优于 GPT-2 的 50K 词表压缩非英文文本。你可以自己验证——用多种语言编码同一句子并统计 token 数。

## 交付

本课产出 `outputs/prompt-tokenizer-analyzer.md`——一个可复用的提示词，用于分析任何文本和模型组合的分词效率。输入一段文本样本，它会告诉你哪个模型的分词器处理得最好。

## 练习

1. 修改 BPE 分词器，在每次合并步骤打印词表。观察 "t" + "h" 如何变成 "th"，然后 "th" + "e" 如何变成 "the"。追踪常见英文单词是如何一块一块组装起来的。

2. 为 BPE 分词器添加特殊 token（`<pad>`、`<eos>`、`<unk>`）。将它们分配为 ID 0、1、2，并相应偏移所有其他 token。实现一个在运行 BPE 之前按空白分割的预分词步骤。

3. 实现 WordPiece 合并标准（似然比而非频率）。在相同语料上用相同合并次数训练 BPE 和 WordPiece。比较生成的词表——哪个产生更多语言学上有意义的子词？

4. 构建一个多语言分词器效率基准。取英语、西班牙语、中文、韩语和阿拉伯语各 10 个句子。用 tiktoken（cl100k_base）对每个句子分词，测量平均每字符 token 数。量化每种语言的"多语言税"。

5. 在更大的语料上训练你的 BPE 分词器（下载一篇维基百科文章）。调整合并次数，使压缩比率在同一段文本上达到 tiktoken 的 10% 以内。这迫使你理解语料大小、合并次数和压缩质量之间的关系。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Token | "一个词" | 模型词表中的一个单位——可能是字符、子词、单词或多词块 |
| BPE | "某种压缩的东西" | 字节对编码——迭代合并最频繁的相邻 token 对，直到达到目标词表大小 |
| WordPiece | "BERT 的分词器" | 类似 BPE，但合并最大化似然比 count(AB)/(count(A)*count(B)) 而非原始频率 |
| SentencePiece | "一个分词器库" | 一种语言无关的分词器，在原始 Unicode 上操作而不预分词，支持 BPE 和 Unigram 算法 |
| 词表大小 | "它认识多少单词" | 唯一 token 的总数：GPT-2 有 50,257，BERT 有 30,522，Llama 3 有 128,256 |
| 生育率 | "不是分词术语" | 每个单词的平均 token 数——衡量跨语言分词器效率的指标（1.0 是完美，3.0 意味着模型工作量大三倍） |
| 字节级 BPE | "GPT 的分词器" | 在原始字节（0-255）而非 Unicode 字符上操作的 BPE，保证任何输入都不会有未知 token |
| 合并表 | "分词器文件" | 训练期间学习到的字符对合并的有序列表——这就是分词器，顺序很重要 |
| 预分词 | "按空格分割" | 在子词分词前应用的规则：空白分割、数字分离、标点处理 |
| 压缩比率 | "分词器效率如何" | 产生的 token 除以输入字节——越低表示压缩越好、推理越快 |

## 延伸阅读

- [Sennrich et al., 2016 -- "Neural Machine Translation of Rare Words with Subword Units"](https://arxiv.org/abs/1508.07909) —— 将 1994 年的压缩算法引入 NLP 并成为现代分词基础的论文
- [Kudo & Richardson, 2018 -- "SentencePiece: A simple and language independent subword tokenizer"](https://arxiv.org/abs/1808.06226) —— 使多语言模型成为可能的语言无关分词
- [OpenAI tiktoken repository](https://github.com/openai/tiktoken) —— 用 Rust 实现的生产级 BPE，带 Python 绑定，GPT-3.5/4/4o 使用
- [Hugging Face Tokenizers documentation](https://huggingface.co/docs/tokenizers) —— 用 Rust 性能实现的生产级分词器训练
