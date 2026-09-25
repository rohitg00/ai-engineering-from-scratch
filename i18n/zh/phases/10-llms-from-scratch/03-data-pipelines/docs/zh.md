# 预训练的数据管道

> 模型是一面镜子。它反映你喂给它的任何数据。喂给它垃圾，它就会以完美的流畅度反映垃圾。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lessons 01-02 (Tokenizers, Building a Tokenizer)
**Time:** ~90 分钟

## 学习目标

- 构建一个流式数据管道，对数 TB 的文本进行分词、切块、打乱和分批，而无需将其全部加载到内存中
- 实现真实预训练管道中使用的数据质量过滤器（去重、语言检测、内容过滤）
- 创建固定长度的训练序列，并正确处理注意力掩码和文档边界
- 分析管道吞吐量，确保 dataloader 跟得上 GPU 训练速度

## 问题所在

你已经有了一个分词器。现在你需要数据。

不是一个数据集。不是一个 CSV 文件。而是数 TB 的文本——经过清洗、去重、质量过滤，分词为固定长度的序列，并以足够快的速度提供随机化的批次，让你的 8-GPU 集群从不等待下一个批次。

大多数人认为训练 LLM 是关于模型架构的。事实并非如此。Llama 3 使用了 15.6 万亿 token。GPT-3 使用了 3000 亿。DeepSeek-V2 使用了 8.1 万亿。三者的架构大致相同：由注意力层和前馈层堆叠而成的 transformer 块。输出质量的差异绝大多数来自数据。

DeepMind 的 Chinchilla 论文将这一点精确化了。对于给定的计算预算，存在一个模型参数量与训练 token 数之间的最优比例。Chinchilla 表明，2022 年的大多数模型都严重训练不足——相对于它们所看到的数据量，它们的参数太多了。一个在 1.4 万亿 token 上训练（Chinchilla 最优）的 70B 参数模型，优于一个在 3000 亿 token 上训练的 280B 模型（Gopher）。

你的数据管道决定了你的模型学到的是语言，还是噪声。

## 概念

### 数据从何而来

每个大语言模型都是在多种来源的混合数据上训练的。确切的构成对大多数实验室来说是严格保密的，但我们对其类别已有足够的了解。

| 来源 | 规模 | 质量 | 使用者 |
|--------|------|---------|---------|
| Common Crawl | ~250 TB 原始数据 | 低（需要大量过滤） | GPT-3, Llama, 大多数开源模型 |
| Wikipedia | ~20 GB | 高 | 每一个主流 LLM |
| GitHub 代码 | ~1 TB+ | 中（大量重复、死代码） | StarCoder, CodeLlama, DeepSeek-Coder |
| 书籍（BookCorpus, Pile） | ~100 GB | 高 | GPT-2, GPT-3, 早期模型 |
| 学术论文（arXiv, S2ORC） | ~100 GB | 对 STEM 高 | Llama, Galactica |
| StackOverflow, Reddit | ~100 GB | 中 | Llama, Falcon |
| 精选网络数据（C4, RefinedWeb） | ~5 TB | 中高（预过滤） | T5, Falcon |

Llama 3 公开了其数据配比：大约 50% 网络数据、25% 代码、13% 书籍和学术论文、8% 数学数据，以及 4% 多语言网络数据。总量为 15.6 万亿 token，来源超过 5 TB 原始文本。

配比与总量同样重要。网络数据太多，模型就会变成一只 Reddit 鹦鹉。代码太少，它就无法编程。数学太少，它就无法推理。把这个配比调对是训练 LLM 中最困难的部分之一，而且没有公式——它需要实验和评估。

### 数据清洗

原始网络数据是肮脏的。一个典型的 Common Crawl 转储包含：

- HTML 标签和 JavaScript
- 模板化的页眉、页脚、导航菜单
- 重复页面（完全重复和近似重复）
- 机器生成的垃圾信息
- 个人身份信息（PII）
- 低质量文本（关键词列表、SEO 垃圾信息）
- 以文本形式编码的非文本内容

清洗这些不是可选项。它决定了一个模型是生成连贯的段落，还是输出夹杂着商品列表的 HTML 标签。

```mermaid
graph TD
    A[Raw Text] --> B[HTML Strip]
    B --> C[Language Detection]
    C --> D[Quality Filter]
    D --> E[Deduplication]
    E --> F[PII Removal]
    F --> G[Clean Text]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#e94560,color:#fff
```

每一步都会消除一类噪声：

**HTML 剥离：** 移除所有标记。只保留可见的文本内容。像 `trafilatura` 或 `readability` 这样的库可以提取文章内容，同时丢弃导航、广告和模板内容。

**语言检测：** 使用 fastText 的语言识别模型（lid.176.bin）对每个文档进行分类。过滤出你的目标语言。一个被分类为英语但置信度低于 0.8 的文档，很可能不是干净的英语。

**质量过滤：** 这是有意思的地方。RefinedWeb（Falcon 背后的数据集）使用了基于困惑度的过滤器：在 Wikipedia 上训练一个小型语言模型，然后对每个文档打分。高困惑度意味着该文档不像 Wikipedia——很可能是垃圾信息、关键词列表或机器生成的内容。困惑度超过阈值的文档会被移除。

**去重：** 这是影响最大的单一清洗步骤。Common Crawl 包含海量的重复页面——法律免责声明、cookie 提示、服务条款。在重复数据上训练会浪费计算资源，并可能导致模型记忆并逐字复述特定段落。

**PII 移除：** 姓名、电子邮件地址、电话号码、社会安全号码。对结构化 PII 使用基于正则的检测，对上下文中的姓名使用 NER 模型。

### 使用 MinHash 去重

精确去重很容易：对每个文档进行哈希，移除重复项。但近似重复才是真正的问题。同一篇新闻文章的两个副本，只是周围广告略有不同，就是近似重复。内容有 95% 相同，但逐字节来看它们并不相同。

MinHash + 局部敏感哈希（LSH）可以高效地解决这个问题。

```mermaid
graph LR
    A[Document] --> B[Shingling]
    B --> C[MinHash Signature]
    C --> D[LSH Buckets]
    D --> E[Candidate Pairs]
    E --> F[Jaccard Similarity]
    F --> G[Deduplicated Set]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#e94560,color:#fff
```

其思想是：

1. **Shingling：** 将每个文档转换为一个 n-gram 集合（例如，词或字符的 5-gram）。"the quick brown fox" 使用 3 词 shingle 变为 {"the quick brown", "quick brown fox"}。

2. **MinHash：** 对每个文档的 shingle 集合，计算 k 个哈希值。每个哈希值是在不同的哈希函数下所有 shingle 中的最小哈希。这会创建一个固定大小的“签名”，用于近似任意两个文档之间的 Jaccard 相似度。

3. **LSH：** 根据 MinHash 签名的分带将文档分组到桶中。同一桶中的文档是候选近似重复项。这避免了比较每一对文档——你只比较候选对。

4. **验证：** 对每个候选对，计算精确的 Jaccard 相似度。如果相似度超过阈值（通常为 0.8），则移除其中一个副本。

Llama 团队报告称，通过去重移除了大约 38% 的网络数据。这不是一个小数字。Common Crawl 超过三分之一是重复或近似重复的内容。

### 序列打包

你的模型期望固定长度的输入序列。而你的文档长度可变。有些是 50 个 token。有些是 50,000 个 token。

朴素方法：将每个文档填充到最大序列长度。这会在填充 token 上浪费大量计算，而这些 token 对学习毫无贡献。

更好的方法：将多个文档打包进一个序列中，用序列结束符分隔。一个 2048 token 的序列可能包含三个短文档，它们之间用 [EOS] token 连接。

```mermaid
graph TD
    subgraph Naive Packing
        A1["Doc A (200 tokens)"] --> P1["[PAD] x 1848"]
        A2["Doc B (500 tokens)"] --> P2["[PAD] x 1548"]
        A3["Doc C (100 tokens)"] --> P3["[PAD] x 1948"]
    end

    subgraph Efficient Packing
        B1["Doc A (200) | Doc B (500) | Doc C (100) | Doc D (400) | Doc E (848)"]
    end

    style A1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style A2 fill:#1a1a2e,stroke:#e94560,color:#fff
    style A3 fill:#1a1a2e,stroke:#e94560,color:#fff
    style P1 fill:#333,stroke:#666,color:#999
    style P2 fill:#333,stroke:#666,color:#999
    style P3 fill:#333,stroke:#666,color:#999
    style B1 fill:#1a1a2e,stroke:#16c784,color:#fff
```

注意力掩码必须正确设置。来自文档 A 的 token 不应在同一打包序列内关注来自文档 B 的 token。这需要一个块对角注意力掩码。

长文档会在序列边界处被截断或分块。分割点很重要：在句子中间分割会迫使模型看到不完整的想法。一些管道在可能的情况下将分割对齐到段落或句子边界。

### Chinchilla 缩放定律

对于固定的计算预算 C（以 FLOPs 衡量），最优模型规模 N 和数据集规模 D 满足：

```
N_opt ~ C^0.5
D_opt ~ C^0.5
```

在实践中，这意味着你应该大致等比例地扩展模型规模和数据集规模。参数量多 10 倍的模型需要大约多 10 倍的训练 token 才能达到相同的损失。

| 模型 | 参数量 | 训练 Token | Chinchilla 最优？ |
|-------|-----------|----------------|-------------------|
| GPT-3 | 175B | 300B | 否（训练不足 3-4 倍） |
| Chinchilla | 70B | 1.4T | 是（按设计） |
| Llama 2 | 70B | 2T | 过度训练（有意的） |
| Llama 3 | 70B | 15T | 大幅过度训练 |

Llama 3 刻意违反了 Chinchilla 定律。Meta 发现，在更多数据上进行过度训练——远超计算最优比例——能为推理产生更好的模型。额外的训练成本只需支付一次，而更小的模型在服务端永远更便宜。这有时被称为“推理最优”缩放方法，并且自 2024 年以来已成为行业标准。

```figure
l5-data-pipeline
```

## 动手构建

### 步骤 1：文本清洗

剥离 HTML、规范化空白字符、移除非文本内容。我们将使用公有领域文本（Project Gutenberg）作为我们的小型语料库。

```python
import re

def clean_text(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()

def quality_filter(text, min_words=50, max_ratio_caps=0.3, max_ratio_special=0.1):
    words = text.split()
    if len(words) < min_words:
        return False
    caps_ratio = sum(1 for w in words if w.isupper()) / len(words)
    if caps_ratio > max_ratio_caps:
        return False
    special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
    if special_chars / max(len(text), 1) > max_ratio_special:
        return False
    return True
```

质量过滤器会捕获 SEO 垃圾信息（全大写）、机器生成的噪声（特殊字符比例过高）以及残缺页面（过短）。仅这三项检查就能从网络爬取数据中去除数量惊人的垃圾。

### 步骤 2：MinHash 去重

从零开始实现 MinHash。不需要外部库——只需 `hashlib`。

```python
import hashlib
from collections import defaultdict

def get_shingles(text, k=5):
    words = text.lower().split()
    if len(words) < k:
        return set()
    return {" ".join(words[i:i+k]) for i in range(len(words) - k + 1)}

def minhash_signature(shingles, num_hashes=128):
    signature = []
    for i in range(num_hashes):
        min_hash = float("inf")
        for shingle in shingles:
            h = int(hashlib.sha256(f"{i}:{shingle}".encode()).hexdigest(), 16)
            min_hash = min(min_hash, h)
        signature.append(min_hash)
    return signature

def lsh_buckets(signature, bands=16):
    rows_per_band = len(signature) // bands
    buckets = []
    for b in range(bands):
        start = b * rows_per_band
        band_data = tuple(signature[start:start + rows_per_band])
        bucket_hash = hashlib.md5(str(band_data).encode()).hexdigest()
        buckets.append((b, bucket_hash))
    return buckets

def deduplicate(documents, threshold=0.8, num_hashes=128, bands=16):
    signatures = []
    shingle_sets = []
    for doc in documents:
        shingles = get_shingles(doc)
        shingle_sets.append(shingles)
        signatures.append(minhash_signature(shingles, num_hashes))

    bucket_map = defaultdict(list)
    for doc_idx, sig in enumerate(signatures):
        for band_id, bucket_hash in lsh_buckets(sig, bands):
            bucket_map[(band_id, bucket_hash)].append(doc_idx)

    duplicate_pairs = set()
    for bucket_docs in bucket_map.values():
        if len(bucket_docs) < 2:
            continue
        for i in range(len(bucket_docs)):
            for j in range(i + 1, len(bucket_docs)):
                duplicate_pairs.add((bucket_docs[i], bucket_docs[j]))

    removed = set()
    for i, j in duplicate_pairs:
        if i in removed or j in removed:
            continue
        s1, s2 = shingle_sets[i], shingle_sets[j]
        if not s1 or not s2:
            continue
        jaccard = len(s1 & s2) / len(s1 | s2)
        if jaccard >= threshold:
            removed.add(j)

    return [doc for idx, doc in enumerate(documents) if idx not in removed], len(removed)
```

`num_hashes=128` 和 `bands=16` 参数控制精确率-召回率的权衡。更多哈希提供更准确的相似度估计。更多分带提高召回率（捕获更多重复项），代价是更多误报。这些值对于典型的网络文本效果良好。

### 步骤 3：分词并打包序列

取清洗并去重后的文本，进行分词，并打包为固定长度的训练序列。

```python
def tokenize_corpus(documents, tokenizer):
    all_tokens = []
    for doc in documents:
        tokens = tokenizer.encode(doc)
        all_tokens.extend(tokens)
        all_tokens.append(tokenizer.eos_id)
    return all_tokens

def pack_sequences(token_ids, seq_length, pad_id=0):
    sequences = []
    attention_masks = []
    for i in range(0, len(token_ids), seq_length):
        seq = token_ids[i:i + seq_length]
        mask = [1] * len(seq)
        if len(seq) < seq_length:
            pad_count = seq_length - len(seq)
            seq = seq + [pad_id] * pad_count
            mask = mask + [0] * pad_count
        sequences.append(seq)
        attention_masks.append(mask)
    return sequences, attention_masks
```

### 步骤 4：用于训练的 DataLoader

生成打包序列的随机批次。这就是训练循环所消费的内容。

```python
import random

class PreTrainingDataLoader:
    def __init__(self, sequences, attention_masks, batch_size, shuffle=True):
        self.sequences = sequences
        self.attention_masks = attention_masks
        self.batch_size = batch_size
        self.shuffle = shuffle

    def __len__(self):
        return (len(self.sequences) + self.batch_size - 1) // self.batch_size

    def __iter__(self):
        indices = list(range(len(self.sequences)))
        if self.shuffle:
            random.shuffle(indices)
        for start in range(0, len(indices), self.batch_size):
            batch_idx = indices[start:start + self.batch_size]
            batch_seqs = [self.sequences[i] for i in batch_idx]
            batch_masks = [self.attention_masks[i] for i in batch_idx]
            yield batch_seqs, batch_masks
```

### 步骤 5：数据集统计

计算那些重要的数字：总 token 数、唯一 token 数、压缩比、文档长度分布。

```python
from collections import Counter

def compute_statistics(documents, token_ids, sequences, tokenizer_vocab_size):
    total_chars = sum(len(d) for d in documents)
    total_tokens = len(token_ids)
    unique_tokens = len(set(token_ids))
    compression_ratio = total_chars / total_tokens

    doc_lengths = [len(d.split()) for d in documents]
    avg_doc_length = sum(doc_lengths) / max(len(doc_lengths), 1)
    max_doc_length = max(doc_lengths) if doc_lengths else 0
    min_doc_length = min(doc_lengths) if doc_lengths else 0

    token_counts = Counter(token_ids)
    top_tokens = token_counts.most_common(10)

    non_pad_tokens = sum(sum(1 for t in seq if t != 0) for seq in sequences)
    total_positions = sum(len(seq) for seq in sequences)
    utilization = non_pad_tokens / max(total_positions, 1)

    stats = {
        "total_documents": len(documents),
        "total_characters": total_chars,
        "total_tokens": total_tokens,
        "unique_tokens": unique_tokens,
        "vocab_utilization": unique_tokens / tokenizer_vocab_size,
        "compression_ratio": compression_ratio,
        "avg_doc_length_words": avg_doc_length,
        "max_doc_length_words": max_doc_length,
        "min_doc_length_words": min_doc_length,
        "num_sequences": len(sequences),
        "sequence_utilization": utilization,
        "top_10_tokens": top_tokens,
    }
    return stats
```

压缩比告诉你分词器在该语料库上的效率。英文文本通常压缩到每个 token 约 3-4 个字符。如果你看到每个 token 只有 1.5 个字符，你的分词器切分得过于激进。如果你看到 8 以上，它学到了非常偏向特定领域的合并。

序列利用率告诉你打包序列中有多少是真实数据，多少是填充。低于 90% 意味着你的打包效率低下——你正在填充 token 上浪费计算资源。

## 使用它

### 与 HuggingFace Datasets 对比

通过 HuggingFace 的 datasets 库加载相同的语料库，并对比管道速度。

```python
from datasets import load_dataset
from transformers import AutoTokenizer

ds = load_dataset("wikitext", "wikitext-2-raw-v1", split="train")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")

import time

start = time.time()
tokenized = ds.map(
    lambda x: tokenizer(x["text"], truncation=True, max_length=2048),
    batched=True,
    num_proc=4,
)
hf_time = time.time() - start
total_tokens = sum(len(t) for t in tokenized["input_ids"])
print(f"HuggingFace: {total_tokens:,} tokens in {hf_time:.2f}s ({total_tokens/hf_time:,.0f} tokens/sec)")
```

HuggingFace 管道底层使用 Rust 分词器，并在 4 个核心上进行并行处理。你的纯 Python 管道会慢 10-50 倍。这个差距就是生产团队使用编译型分词器的原因。算法是相同的。实现语言才是差异所在。

## 上线

本课程产出用于验证和调试 LLM 训练管道中数据质量的 prompt。参见 `outputs/prompt-data-quality-checker.md`。

## 练习

1. **简单：** 使用简单的启发式方法（字符集分析）为清洗管道添加语言检测。过滤出仅英文的文档，并测量有多少文档被移除。
2. **中等：** 在 MinHash 近似去重之外，使用 SHA-256 哈希实现精确去重。在一个网络爬取的语料库上对比每种方法捕获的重复数量。
3. **困难：** 构建一个基于困惑度的质量过滤器。在 Wikipedia 文本上训练一个小型 bigram 语言模型，按困惑度对每个文档打分，并移除得分最低的 20%。对比在过滤与未过滤数据上训练时的模型输出质量。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Common Crawl | "互联网" | 一个每月爬取网络内容的非营利组织——约 250TB 原始数据，是大多数 LLM 训练数据的起点 |
| MinHash | "某种哈希技巧" | 一种使用固定大小签名估计集合间 Jaccard 相似度的技术——使大规模近似重复检测成为可能 |
| LSH | "局部敏感哈希" | 一种将相似项分组到同一桶中的方法——将成对比较从 O(n^2) 降低到近线性 |
| 序列打包 | "拼接文档" | 将多个文档装入固定长度序列并配以正确的注意力掩码——消除填充浪费 |
| Chinchilla 缩放 | "用更多数据训练" | 对于固定的计算预算，最优性能要求模型规模和训练 token 大致等比例扩展 |
| Fertility | "每词 token 数" | 每个单词的平均 token 数——GPT-4 中英语为 1.3，非拉丁文字更高 |
| 数据配比 | "选择训练数据" | 代码 vs 文本 vs 数学 vs 多语言数据的比例——没有公式，需要实验 |
| 困惑度过滤器 | "质量打分" | 使用一个小型语言模型对文档打分——高困惑度意味着文本与干净的参考数据不同 |
| 去重 | "移除副本" | 消除完全重复和近似重复的文档——通常可移除 30-40% 的原始网络数据 |
| 注意力掩码 | "关注哪些 token" | 一种二值掩码，防止在打包序列中跨越文档边界的注意力 |

## 延伸阅读

- [Hoffmann et al., 2022 -- Training Compute-Optimal Large Language Models (Chinchilla)](https://arxiv.org/abs/2203.15556) -- 改变了我们对数据规模认知的论文
- [Penedo et al., 2023 -- The RefinedWeb Dataset for Falcon LLM](https://arxiv.org/abs/2306.01116) -- 如何将 Common Crawl 过滤为高质量数据
- [Touvron et al., 2023 -- Llama 2: Open Foundation and Fine-Tuned Chat Models](https://arxiv.org/abs/2307.09288) -- Llama 2 的数据管道细节
- [Lee et al., 2022 -- Deduplicating Training Data Makes Language Models Better](https://arxiv.org/abs/2107.06499) -- 为什么去重比你想象的更重要
- [Broder, 1997 -- On the Resemblance and Containment of Documents](https://ieeexplore.ieee.org/document/666900) -- MinHash 的原始论文
- [Meta, 2024 -- Llama 3 Technical Report](https://arxiv.org/abs/2407.21783) -- 15.6T token、数据配比、过滤管道