# BERT —— 掩码语言建模（Masked Language Modeling）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> GPT 预测下一个词，BERT 预测缺失的词。一句话之差——撑起了之后五年里几乎所有 embedding 形态的工作。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## 问题（The Problem）

2018 年，每个 NLP 任务——情感分析、NER、QA、蕴含——都得在自己那点带标签的数据上从零训练一个模型。当时根本没有所谓「预先理解了英文」的预训练 checkpoint 可供你 fine-tune。ELMo（2018）展示了用双向 LSTM 预训练上下文 embedding（嵌入）是可行的，确实有帮助，但泛化能力有限。

BERT（Devlin et al. 2018）抛出了一个问题：如果我们拿一个 transformer encoder，把它丢到互联网上的每一句话里去训练，强迫它根据左右两侧的上下文预测缺失的词，会怎么样？然后在下游任务上只 fine-tune 一个 head 就行。这种参数效率简直是顿悟级别。

结果：18 个月内，BERT 及其变体（RoBERTa、ALBERT、ELECTRA）横扫了所有存在的 NLP 排行榜。到 2020 年，地球上每个搜索引擎、内容审核流水线、语义搜索系统里都跑着一个 BERT。

到了 2026 年，encoder-only 模型在分类、检索、结构化抽取这些任务上仍然是首选——每 token 推理速度比 decoder 快 5–10 倍，它们的 embedding 是现代检索栈的脊梁。ModernBERT（2024 年 12 月）把这套架构推到了 8K context window，配 Flash Attention + RoPE + GeGLU。

## 概念（The Concept）

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### 训练信号（The training signal）

拿一句话：`the quick brown fox jumps over the lazy dog`。

随机 mask 掉 15% 的 token：

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

训练模型在被 mask 的位置上预测原始 token。因为 encoder 是双向的（bidirectional），预测位置 1 上的 `[MASK]` 时可以利用位置 2 之后的 `brown fox jumps`。这正是 GPT 做不到的事。

### BERT 的 mask 规则（The BERT mask rules）

被选中要预测的 15% token 里：

- 80% 替换为 `[MASK]`。
- 10% 替换为一个随机 token。
- 10% 保持不变。

为什么不全用 `[MASK]`？因为 `[MASK]` 在推理（inference）时根本不会出现。如果训练时让模型 100% 期待在被 mask 的位置看到 `[MASK]`，那预训练（pretraining）和微调（fine-tune）之间就会形成 distribution shift（分布偏移）。10% 随机 + 10% 不变是为了让模型保持诚实。

### Next Sentence Prediction (NSP)——以及它为什么被弃用

最初的 BERT 还训练了 NSP 任务：给定两句话 A 和 B，预测 B 是否紧接着 A。RoBERTa（2019）做了 ablation（消融实验），结果表明 NSP 不仅没用，反而有害。现代 encoder 都不做这个了。

### 2026 年的变化：ModernBERT

2024 年的 ModernBERT 论文用 2026 年的「原料」重建了这个模块：

| 组件 | 原版 BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| 位置编码 | 学习式绝对位置 | RoPE |
| 激活函数 | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | 全稠密 | 局部（128）+ 全局交替 |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

而且和 2018 年那套不同，它原生支持 Flash Attention。在序列长度 8K 时，推理比 DeBERTa-v3 快 2–3 倍，GLUE 分还更高。

### 2026 年仍然该选 encoder 的场景

| 任务 | 为什么 encoder 胜过 decoder |
|------|---------------------------|
| 检索 / 语义搜索 embedding | 双向上下文 = 每 token 的 embedding 质量更好 |
| 分类（情感、意图、毒性） | 一次前向传播；没有生成开销 |
| NER / token 级标注 | 每个位置都有输出，天生双向 |
| Zero-shot 蕴含（NLI） | encoder 上加一个分类 head |
| RAG 的 reranker | Cross-encoder 打分，比 LLM reranker 快 10 倍 |

## 动手实现（Build It）

### Step 1：mask 逻辑

见 `code/main.py`。函数 `create_mlm_batch` 接收一个 token ID 列表、词表大小、mask 概率，返回 input ID（已经 mask 处理过）和 labels（仅在被 mask 的位置上有值，其他位置填 -100——PyTorch 的 ignore index 约定）。

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Step 2：在一个迷你语料上跑 MLM 预测

在 20 词词表、200 句话的语料上训练一个 2 层 encoder + MLM head。不算梯度——我们只做前向传播的 sanity check。完整训练需要 PyTorch。

### Step 3：对比三种 mask 类型

展示这套三分规则如何让模型在没有 `[MASK]` 的情况下也能用。在没 mask 的句子和有 mask 的句子上分别做预测。两种情况下 token 分布都应该合理，因为模型在训练里两种模式都见过。

### Step 4：fine-tune head

把 MLM head 换成一个分类 head，训练在一个玩具情感数据集上。只训练 head；encoder 冻结。这是每个 BERT 应用都遵循的范式。

## 用起来（Use It）

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding 模型就是 fine-tune 过的 BERT。** 像 `all-MiniLM-L6-v2` 这种 `sentence-transformers` 模型，本质上是用对比损失（contrastive loss）训练的 BERT。encoder 没变，变的只是 loss。

**Cross-encoder reranker 也是 fine-tune 过的 BERT。** 在 `[CLS] query [SEP] doc [SEP]` 上做配对分类。query 和 doc 之间的双向 attention 正是 cross-encoder 在质量上压过 bi-encoder 的关键。

**2026 年什么时候不该选 BERT。** 任何生成式任务。encoder 没有合理的方式 autoregressive 地产生 token。还有：参数小于 1B 的场景里，一个小型 decoder 能用更高的灵活性匹配同等质量（Phi-3-Mini、Qwen2-1.5B）。

## 上线部署（Ship It）

见 `outputs/skill-bert-finetuner.md`。这个 skill 为新的分类或抽取任务限定一次 BERT fine-tune 的范围（backbone 选择、head 规格、数据、评估、停止条件）。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`，把 10,000 个 token 上的 mask 分布打印出来。确认大约 15% 被选中，其中大约 80% 变成了 `[MASK]`。
2. **中等。** 实现 whole-word masking：如果一个词被切成多个子词，要么一起 mask 全部子词，要么一个都不 mask。在一个 500 句的语料上测一下这是否能提升 MLM 准确率。
3. **困难。** 在某个公开数据集的 10,000 句话上训练一个迷你（2 层、d=64）BERT。基于 `[CLS]` token fine-tune SST-2 情感任务。在参数量匹配的前提下，和一个 decoder-only baseline（基线）对比——谁赢？

## 关键术语（Key Terms）

| 术语 | 大家通常这么说 | 实际含义 |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | 训练信号：随机把 15% 的 token 替换成 `[MASK]`，预测原始 token。 |
| Bidirectional | "两边都看" | encoder 的 attention 没有 causal mask——每个位置都能看到所有其他位置。 |
| `[CLS]` | "pooler token" | 加在每个序列最前面的特殊 token；它的最终 embedding 用作整句的表示。 |
| `[SEP]` | "段分隔符" | 分隔成对的序列（比如 query/doc、句子 A/B）。 |
| NSP | "Next sentence prediction" | BERT 的第二个预训练任务；RoBERTa 证明它没用，2019 年后被弃用。 |
| Fine-tuning | "适配到任务" | 把 encoder 大部分冻结；在上面训练一个小 head 去做下游任务。 |
| Cross-encoder | "一种 reranker" | 一个把 query 和 doc 都作为输入、输出相关性分数的 BERT。 |
| ModernBERT | "2024 翻新版" | 用 RoPE、RMSNorm、GeGLU、局部/全局交替 attention、8K context 重建的 encoder。 |

## 延伸阅读（Further Reading）

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) —— 原始论文。
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) —— 怎样把 BERT 训练对；干掉了 NSP。
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) —— 在等量算力下，replaced-token detection 胜过 MLM。
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) —— ModernBERT 论文。
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) —— 标准 encoder 参考实现。
