# 面具语言建模

> 预测下一个字,预测一个缺失的字,一个句子的差异,一个半十年的嵌入式形状.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## 问题

2018年,每一个NLP任务都从零开始训练了自己的模型,使用自己的标签数据.没有预训练的"理解英语"检查点,你可以调整.ELMo (2018) 显示你可以预训练背景嵌入式使用双向LSTM;它帮助但没有通用化.

伯特 (Devlin et al. 2018) 问:如果我们拿一个变压器编码器,训练它在互联网上的每句话,并强迫它预测两个方面缺失的语境中的单词呢?

结果:在18个月内,BERT及其变体 (RoBERTa,ALBERT,ELECTRA) 占据了所有现有的NLP排名榜.到2020年,地球上每一个搜索引擎,内容调节管道和语义搜索系统都拥有BERT.

2026年仅使用编码器的模型仍然是分类,检索和结构化提取的合适工具.它们比解码器更快510x,其嵌入式是每个现代检索堆的骨干.ModernBERT (2024年12月) 通过Flash Attention + RoPE + GeGLU将架构推向8K文本.

## 概念

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### 训练信号

拿一个句子:`the quick brown fox jumps over the lazy dog`现在,我们要去.

随机地出15%的代币:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

训练模型以预测原始代币在隐藏位置. 因为编码器是双向,预测`[MASK]`在位置1可以使用`brown fox jumps`现在,我们在2+位置上做了什么?

### 关于BERT面具的规则

预测选择的15%的代币:

- 80% 则被替换为`[MASK]`现在,我们要去.
- 10% 则被随机代币取代.
- 只有10%的情况保持不变.

为什么不总是`[MASK]`因为`[MASK]`训练模型以预期`[MASK]`假设在100%的面具位置,预训练和细调之间会产生分布转变.10%的随机加上10%的变化保持模型的诚实性.

### 下一句预测 (NSP) ,为什么它被放弃

原始BERT也在NSP上训练:给了两个句子A和B,预测如果B跟随A.RoBERTa (2019) 删除了它并显示NSP受伤,没有帮助.现代编码器跳过它.

### 2026年发生了什么变化:ModernBERT

根据2026年的原始模型,

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

与2018年的堆不同,它是闪光注意力原生.在序列长度8K时,传输速度比DeBERTa-v3更快,GLU比分更好.

### 在2026年仍会选择编码器的使用案例

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## 建立它

### 步骤1:掩盖逻辑

看到`code/main.py`功能`create_mlm_batch`返回输入 ID (面具应用) 和标签 (仅在面具位置, -100其他地方  PyTorch 忽略索引公约).

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

### 步骤2:在一个小的体积上运行MLM预测

训练一个2层编码器+MLM头,用20个字,200个句子的词汇.没有梯度.我们做了前进通过的智力检查. 需要 PyTorch的全面训练.

### 步骤3:比较面具类型

展示三向规则如何使模型可以使用`[MASK]`预测一个未蒙面的句子和一个蒙面的句子. 两者都应该产生合理的符号分布,因为模型在训练中看到了两种模式.

### 步骤4:细调头

换一个玩具感觉数据集上的MLM头部以分类头部. 只有头部,编码器被结. 每个BERT应用程序都遵循这种模式.

## 用它

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`模型`all-MiniLM-L6-v2`它们的编码器是相同的,损失发生了变化.

**Cross-encoder rerankers are also fine-tuned BERT.**双对分类`[CLS] query [SEP] doc [SEP]`查询和文档之间的双向关注正是交叉编码器对双码器的质量优势.

**When not to pick BERT in 2026.**任何生成性.编码器没有任何合理的方式来自动降低生成代币.

## 运送它

看到`outputs/skill-bert-finetuner.md`技能范围为一个新的分类或提取任务进行BERT细调 (背骨选择,头部规格,数据,评估,停止).

## 运动

1. **Easy.**跑步`code/main.py`确认15%是选定的,其中80%是`[MASK]`现在,我们要去.
2. **Medium.**实施全字掩饰:如果一个词被标记成子词,把所有子词都掩盖在一起或没有.测量这是否提高了500句子的MLM准确性.
3. **Hard.**训练一个小的 (2层,d=64) BERT从公共数据集中的1万句子.`[CLS]`比较与匹配的参数中只有解码器的基线.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## 进一步阅读

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805)原始的纸.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692)如何正确训练BERT;杀死NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555)替换代代币检测在匹配计算时超过MLM.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663)现代BERT纸.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py)可нони化编码器参考.
