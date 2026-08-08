# 预训练数据流水线

> 模型是一面镜子。它反射你喂给它的任何数据。喂垃圾，它就完美流畅地反射垃圾。

**类型：** 构建
**语言：** Python
**前置知识：** 第十阶段，第 01-02 课（分词器、构建分词器）
**时间：** ~90 分钟

## 学习目标

- 构建一个流式数据流水线，对 TB 级文本进行分词、分块、打乱和批处理，而无需全部加载到内存
- 实现真实预训练流水线中使用的数据质量过滤器（去重、语言检测、内容过滤）
- 创建固定长度的训练序列，带有正确的注意力掩码和文档边界处理
- 分析流水线吞吐量，确保数据加载器跟得上 GPU 训练速度

## 问题

你有了分词器。现在你需要数据。

不是数据集。不是 CSV 文件。是 TB 级的文本——经过清洗、去重、质量过滤、分词成固定长度序列，并以随机批次快速提供，让你的 8-GPU 集群永远不用等待下一批。

大多数人认为训练大语言模型是关于模型架构。不是。Llama 3 用了 15.6 万亿 token。GPT-3 用了 3000 亿。DeepSeek-V2 用了 8.1 万亿。这三者的架构大致相同：堆叠的 transformer 块，带注意力和前馈层。输出质量的差异 overwhelmingly 来自数据。

DeepMind 的 Chinchilla 论文把这一点精确化了。对于给定的计算预算，模型参数与训练 token 之间存在最优比例。Chinchilla 表明，2022 年的大多数模型都严重训练不足——它们看到的参数量相对于数据量来说太多了。一个 70B 参数模型在 1.4 万亿 token 上训练（Chinchilla 最优）胜过了在 3000 亿 token 上训练的 280B 模型（Gopher）。

你的数据流水线决定了模型是学习语言还是学习噪声。

## 概念

### 数据来源

每个大语言模型都在混合来源上训练。精确的成分对大多数实验室来说是严格保密的，但我们了解足够多来理解类别。

| 来源 | 规模 | 质量 | 使用者 |
|------|------|------|--------|
| Common Crawl | ~250 TB 原始数据 | 低（需要重度过滤） | GPT-3、Llama、大多数开源模型 |
| Wikipedia | ~20 GB | 高 | 每个主要大语言模型 |
| GitHub 代码 | ~1 TB+ | 中（大量重复、死代码） | StarCoder、CodeLlama、DeepSeek-Coder |
| 书籍（BookCorpus、Pile） | ~100 GB | 高 | GPT-2、GPT-3、早期模型 |
| 学术论文（arXiv、S2ORC） | ~100 GB | STEM 领域高 | Llama、Galactica |
| StackOverflow、Reddit | ~100 GB | 中 | Llama、Falcon |
| 精选网页（C4、RefinedWeb） | ~5 TB | 中高（预过滤） | T5、Falcon |

Llama 3 披露了其数据混合：大约 50% 网页数据、25% 代码、13% 书籍和学术论文、8% 数学数据、4% 多语言网页数据。总量是超过 5 TB 原始文本中的 15.6 万亿 token。

比例与总大小同样重要。网页数据太多，模型变成 Reddit 鹦鹉。代码太少，它不会编程。数学太少，它在推理上失败。把这个混合搞对是训练大语言模型最难的部分之一，而且没有公式——需要实验和评估。

### 数据清洗

原始网页数据很脏。典型的 Common Crawl 转储包含：

- HTML 标签和 JavaScript
- 样板页眉、页脚、导航菜单
- 重复页面（精确和近似重复）
- 机器生成的垃圾内容
- 个人身份信息（PII）
- 低质量文本（关键词列表、SEO 垃圾）
- 编码为文本的非文本内容

清洗不是可选的。这是区分生成连贯段落的模型和输出混杂 HTML 标签与产品列表的模型的关键。

```mermaid
graph TD
    A[原始文本] --> B[去除 HTML]
    B --> C[语言检测]
    C --> D[质量过滤]
    D --> E[去重]
    E --> F[去除 PII]
    F --> G[干净文本]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#e94560,color:#fff
```

每一步消除一类噪声：

**去除 HTML：** 移除所有标记。只保留可见文本内容。`trafilatura` 或 `readability` 等库在丢弃导航、广告和样板内容的同时提取文章正文。

**语言检测：** 使用 fastText 的语言识别模型（lid.176.bin）对每个文档进行分类。过滤到你的目标语言。被归类为英语但置信度低于 0.8 的文档很可能不是干净的英语。

**质量过滤：** 这里变得有趣。RefinedWeb（Falcon 背后的数据集）使用基于困惑度的过滤器：在 Wikipedia 上训练一个小语言模型，然后对每个文档打分。高困惑度意味着文档不像 Wikipedia——很可能是垃圾内容、关键词列表或机器生成的内容。困惑度超过阈值的文档被移除。

**去重：** 单一最具影响力的清洗步骤。Common Crawl 包含大量重复页面——法律免责声明、Cookie 通知、服务条款。在重复内容上训练浪费算力，还可能导致模型逐字记忆并复述特定段落。

**去除 PII：** 姓名、电子邮件地址、电话号码、社保号码。对结构化 PII 使用基于正则的检测，对上下文中的姓名使用 NER 模型。

### 用 MinHash 去重

精确去重很简单：对每个文档哈希，移除重复项。但近似重复才是真正的问题。两篇相同新闻文章的副本，周围广告略有不同，就是近似重复。内容 95% 相同，但逐字节比较不同。

MinHash + 局部敏感哈希（LSH）高效地解决了这个问题。

```mermaid
graph LR
    A[文档] --> B[Shingling]
    B --> C[MinHash 签名]
    C --> D[LSH 桶]
    D --> E[候选对]
    E --> F[Jaccard 相似度]
    F --> G[去重后的集合]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#e94560,color:#fff
```

思路：

1. **Shingling：** 将每个文档转换为 n-gram 集合（例如，词或字符的 5-gram）。"the quick brown fox" 用 3 词 shingles 变成 {"the quick brown", "quick brown fox"}。

2. **MinHash：** 对每个文档的 shingle 集合，计算 k 个哈希值。每个哈希值是在不同哈希函数下所有 shingles 的最小哈希。这创建了一个固定大小的"签名"，近似任意两个文档之间的 Jaccard 相似度。

3. **LSH：** 根据 MinHash 签名的波段将文档分组到桶中。同一桶中的文档是候选近似重复。这避免了比较每一对——只比较候选。

4. **验证：** 对每个候选对，计算精确 Jaccard 相似度。如果相似度超过阈值（通常为 0.8），移除一个副本。

Llama 团队报告通过去重移除了约 38% 的网页数据。这不是小数字。超过三分之一的 Common Crawl 是重复或近似重复内容。

### 序列打包

你的模型期望固定长度的输入序列。你的文档长度可变。有些 50 token，有些 50,000 token。

朴素方法：将每个文档填充到最大序列长度。这在填充 token 上浪费巨大算力，它们对学习毫无贡献。

更好方法：将多个文档打包到单个序列中，用序列结束 token 分隔。一个 2048-token 序列可能包含三个短文档，用 [EOS] token 连接。

```mermaid
graph TD
    subgraph 朴素打包
        A1["文档 A (200 token)"] --> P1["[PAD] x 1848"]
        A2["文档 B (500 token)"] --> P2["[PAD] x 1548"]
        A3["文档 C (100 token)"] --> P3["[PAD] x 1948"]
    end

    subgraph 高效打包
        B1["文档 A (200) | 文档 B (500) | 文档 C (100) | 文档 D (400) | 文档 E (848)"]
    end

    style A1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style A2 fill:#1a1a2e,stroke:#e94560,color:#fff
    style A3 fill:#1a1a2e,stroke:#e94560,color:#fff
    style P1 fill:#333,stroke:#666,color:#999
    style P2 fill:#333,stroke:#666,color:#999
    style P3 fill:#333,stroke:#666,color:#999
    style B1 fill:#1a1a2e,stroke:#16c784,color:#fff
```

注意力掩码必须正确设置。文档 A 的 token 不应关注同一打包序列中文档 B 的 token。这需要一个块对角注意力掩码。

长文档在序列边界处被截断或分块。分割点很重要：在句子中间分割迫使模型看到不完整的想法。有些流水线尽可能将分割对齐到段落或句子边界。

### Chinchilla 缩放定律

对于固定计算预算 C（以 FLOP 衡量），最优模型大小 N 和数据集大小 D 遵循：

```
N_opt ~ C^0.5
D_opt ~ C^0.5
```

实践中，这意味着你应该大致同等地缩放模型大小和数据集大小。参数多 10 倍的模型需要大约多 10 倍的训练 token 才能达到相同损失。

| 模型 | 参数量 | 训练 Token | Chinchilla 最优？ |
|------|--------|-----------|-----------------|
| GPT-3 | 175B | 300B | 否（训练不足 3-4 倍） |
| Chinchilla | 70B | 1.4T | 是（按设计） |
| Llama 2 | 70B | 2T | 过度训练（有意） |
| Llama 3 | 70B | 15T | 严重过度训练 |

Llama 3 故意违反 Chinchilla 定律。Meta 发现，在更多数据上过度训练——远超计算最优比例——能产生更好的推理模型。额外的训练成本只付一次，但更小的模型永远更便宜地服务。这有时被称为"推理最优"缩放方法，自 2024 年以来已成为行业标准。

## 构建

### 第 1 步：文本清洗

去除 HTML，归一化空白，移除非文本内容。我们将使用公共领域文本（Project Gutenberg）作为小语料库。

```python
import re

def clean_text(text):
    text = re.sub(r"<[^>]+", "", text)
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

质量过滤器捕获 SEO 垃圾（全大写）、机器生成的噪声（高特殊字符比例）和存根页面（太短）。仅这三项检查就能从网页爬取中移除惊人的垃圾量。

### 第 2 步：MinHash 去重

从零实现 MinHash。不需要外部库——只用 `hashlib`。

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

`num_hashes=128` 和 `bands=16` 参数控制精确度-召回率权衡。更多哈希给出更准确的相似度估计。更多波段增加召回率（捕获更多重复）但代价是更多误报。这些值对典型网页文本效果很好。

### 第 3 步：分词并打包序列

获取清洗、去重后的文本，分词，并打包成固定长度序列用于训练。

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

### 第 4 步：训练用 DataLoader

产出随机化批次的打包序列。这是训练循环消费的内容。

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

### 第 5 步：数据集统计

计算重要的数字：总 token 数、唯一 token 数、压缩比率、文档长度分布。

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

压缩比率告诉你分词器在这个语料上的效率。英文文本通常压缩到每个 token 约 3-4 个字符。如果看到每个 token 1.5 个字符，你的分词器分割太激进。如果看到 8+，它学会了非常特定领域的合并。

序列利用率告诉你打包序列中有多少是真实数据而非填充。低于 90% 意味着打包效率低下——你在填充 token 上浪费算力。

## 使用

### 与 HuggingFace Datasets 对比

通过 HuggingFace 的 datasets 库加载相同语料，并比较流水线速度。

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
print(f"HuggingFace: {total_tokens:,} token in {hf_time:.2f}s ({total_tokens/hf_time:,.0f} token/sec)")
```

HuggingFace 流水线底层使用 Rust 分词器，并跨 4 核并行处理。你的纯 Python 流水线会慢 10-50 倍。这就是生产团队使用编译分词器的原因。算法相同。实现语言是差异所在。

## 交付

本课产出一个用于验证和调试大语言模型训练流水线中数据质量的提示词。见 `outputs/prompt-data-quality-checker.md`。

## 练习

1. **简单：** 使用简单启发式（字符集分析）为清洗流水线添加语言检测。仅过滤到英语文档，并测量移除了多少文档。
2. **中等：** 使用 SHA-256 哈希实现精确去重，与 MinHash 近似去重并行。在网页爬取语料上比较每种方法捕获的重复数量。
3. **困难：** 构建基于困惑度的质量过滤器。在 Wikipedia 文本上训练一个小型二元语言模型，按困惑度对每个文档打分，并移除底部 20%。比较在过滤与未过滤数据上训练时模型输出质量。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Common Crawl | "互联网" | 一家每月爬取网页的非营利机构——~250TB 原始数据，大多数大语言模型训练数据的起点 |
| MinHash | "某种哈希技巧" | 使用固定大小签名估计集合间 Jaccard 相似度的技术——实现大规模近似重复检测 |
| LSH | "局部敏感哈希" | 将相似项分组到同一桶的方法——将成对比较从 O(n²) 降低到接近线性 |
| 序列打包 | "拼接文档" | 将多个文档放入固定长度序列并带有正确注意力掩码——消除填充浪费 |
| Chinchilla 缩放 | "用更多数据训练" | 对于固定计算预算，最优性能需要大致同等地缩放模型大小和训练 token |
| 生育率 | "每词 token 数" | 每个单词的平均 token 数——GPT-4 英文为 1.3，非拉丁文字更高 |
| 数据混合 | "选择训练数据" | 代码 vs 文本 vs 数学 vs 多语言数据的比例——没有公式，需要实验 |
| 困惑度过滤 | "质量评分" | 使用小型语言模型对文档打分——高困惑度意味着文本不像干净的参考数据 |
| 去重 | "移除副本" | 消除精确和近似重复文档——通常移除 30-40% 的原始网页数据 |
| 注意力掩码 | "哪些 token 可以看" | 防止打包序列中文档间注意力的二进制掩码 |

## 延伸阅读

- [Hoffmann et al., 2022 -- Training Compute-Optimal Large Language Models (Chinchilla)](https://arxiv.org/abs/2203.15556) —— 改变我们对数据规模看法的论文
- [Penedo et al., 2023 -- The RefinedWeb Dataset for Falcon LLM](https://arxiv.org/abs/2306.01116) —— 如何将 Common Crawl 过滤到高质量
- [Touvron et al., 2023 -- Llama 2: Open Foundation and Fine-Tuned Chat Models](https://arxiv.org/abs/2307.09288) —— Llama 2 的数据流水线详情
- [Lee et al., 2022 -- Deduplicating Training Data Makes Language Models Better](https://arxiv.org/abs/2107.06499) —— 为什么去重比你想象的更重要
- [Broder, 1997 -- On the Resemblance and Containment of Documents](https://ieeexplore.ieee.org/document/666900) —— 原始 MinHash 论文
- [Meta, 2024 -- Llama 3 Technical Report](https://arxiv.org/abs/2407.21783) —— 15.6T token、数据混合比例、过滤流水线
