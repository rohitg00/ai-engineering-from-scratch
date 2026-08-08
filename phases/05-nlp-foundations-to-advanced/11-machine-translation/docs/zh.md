# 11 · 机器翻译

> 翻译这项任务为 NLP 研究买单了三十年，至今仍在持续买单。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 5 · 10（注意力机制），阶段 5 · 04（GloVe、FastText、子词）
**时长：** 约 75 分钟

## 问题所在

模型读入一种语言的句子，输出另一种语言的句子。句子长度会变化，语序会变化。有些源语言词对应多个目标语言词，反之亦然。习语拒绝一对一映射。英语「I miss you」在法语里是「tu me manques」——字面意思是「你对我来说是缺失的」。任何词级对齐都无法在这种情况下成立。

机器翻译这项任务，迫使 NLP 发明了编码器-解码器、注意力、Transformer，并最终催生了整个大语言模型（LLM）范式。每一次向前迈进，都是因为翻译质量可被度量，而人与机器之间的差距又顽固难消。

本课跳过历史回顾，直接讲授 2026 年的实用流程：预训练多语言编码器-解码器（NLLB-200 或 mBART）、子词「分词（tokenization）」、「束搜索（beam search）」、BLEU 与 chrF 评估，以及那少数几个至今仍会悄无声息地溜进生产环境的失败模式。

## 核心概念

〔图：MT 流程：分词 → 编码 → 带注意力的解码 → 反分词〕

现代机器翻译是一个在平行文本上训练的 Transformer 编码器-解码器。编码器按源语言自身的分词方式读入源文本。解码器逐个子词地生成目标文本，并通过「交叉注意力（cross-attention）」（第 10 课）利用编码器的输出。解码使用束搜索，以避免贪心解码的陷阱。输出经过反分词、还原真实大小写（detruecase），并对照参考译文打分。

三个工程层面的选择决定了真实世界中机器翻译的质量。

- **分词器。** 在混合语言语料上训练的 SentencePiece BPE。跨语言共享的词表正是 NLLB 实现零样本语言对的关键。
- **模型规模。** NLLB-200 distilled 600M 可以在笔记本电脑上运行。NLLB-200 3.3B 是官方发布的生产默认配置。54.5B 是研究的天花板。
- **解码。** 一般内容用束宽 4-5。用长度惩罚避免输出过短。需要术语一致性时使用「受约束解码（constrained decoding）」。

## 动手构建

### 第 1 步：一次预训练 MT 调用

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

这里有三件事很重要。`src_lang` 告诉分词器该应用哪种文字与切分方式。`forced_bos_token_id` 告诉解码器要生成哪种语言。两者都是 NLLB 特有的技巧；mBART 和 M2M-100 使用各自的约定，彼此不可互换。

### 第 2 步：BLEU 与 chrF

BLEU 度量输出与参考译文之间的 n-gram 重叠。它取四种参考 n-gram 大小（1-4），计算各精度的几何平均，并对过短的输出施加简短惩罚（brevity penalty）。分数落在 [0, 100] 区间。它被广泛使用，但解读起来令人头疼：30 BLEU 是「可用」；40 是「良好」；50 是「卓越」；而小于 1 BLEU 的差异属于噪声。

chrF 度量字符级 F 分数。它对形态丰富的语言更敏感——在这类语言中 BLEU 会低估匹配数。chrF 常与 BLEU 一同报告。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

务必始终使用 `sacrebleu`。它会对分词做归一化，使分数在不同论文之间可比。自己手写 BLEU 计算正是误导性基准结果产生的根源。

### 三层评估体系（2026）

现代机器翻译评估使用三类互补的指标家族。上线时至少采用其中两类。

- **启发式（heuristic）**（BLEU、chrF）。快速、基于参考、可解释，但对改述不敏感。用于与历史结果对比以及检测回归。
- **学习式（learned）**（COMET、BLEURT、BERTScore）。基于人类评判训练的神经模型；比较译文与源文本及参考译文之间的语义相似度。自 2023 年以来，COMET 与机器翻译研究的关联度最高，并且是 2026 年质量优先场景下的生产默认选择。
- **LLM 作为评判（LLM-as-judge）**（无参考）。提示一个大模型对译文的流畅度、忠实度、语气、文化适配性进行打分。当评分细则设计得当时，GPT-4 作为评判与人类判断的一致率约为 80%。用于不存在参考译文的开放式内容。

2026 年的实用技术栈：用 `sacrebleu` 计算 BLEU 和 chrF，用 `unbabel-comet` 计算 COMET，再用一个被提示的 LLM 给出最终面向人类的信号。在生产数据上信任任何一个指标之前，先用 50-100 条人工标注样本对它进行校准。

无参考指标（COMET-QE、BLEURT-QE、LLM 作为评判）让你无需参考译文即可评估翻译，这对于不存在参考译文的长尾语言对至关重要。

### 第 3 步：生产环境中会出什么问题

上面那条可用的流程有 80% 的时间能流畅翻译，剩下 20% 则会悄无声息地失败。已命名的失败模式：

- **幻觉（hallucination）。** 模型凭空捏造源文本中没有的内容。常见于不熟悉的领域词汇。症状：输出流畅，却声称源文本未陈述的事实。缓解措施：对领域术语做受约束解码，对受监管内容做人工审核，并监控输出是否远长于输入。
- **跑偏生成（off-target generation）。** 模型翻译成了错误的语言。NLLB 在罕见语言对上对此出奇地容易出错。缓解措施：核对 `forced_bos_token_id`，并始终用语种识别（language-ID）模型对输出做检查。
- **术语漂移（terminology drift）。** 「Sign up」在文档 1 里译成「s'inscrire」，在文档 2 里又译成「créer un compte」。对于 UI 文案和面向用户的字符串，一致性比原始质量更重要。缓解措施：术语表约束解码，或后编辑词典。
- **正式度不匹配（formality mismatch）。** 法语的「tu」与「vous」、日语的敬语层级。模型会挑选训练数据中更常见的那种形式。对于面向客户的内容，这通常是错的。缓解措施：若模型支持，则用正式度标记作为提示前缀；或在仅含正式语体的语料上微调一个小模型。
- **短输入的长度爆炸（length explosion on short input）。** 非常短的输入句往往产出过长的译文，因为当源 token 少于约 5 个时长度惩罚会陡然失效。缓解措施：设置与源长度成比例的硬性最大长度上限。

### 第 4 步：面向领域的微调

预训练模型是通才。法律、医疗或游戏对白翻译，在领域平行数据上微调后会带来可度量的提升。配方并不神秘：

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

几千条高质量平行样本胜过几十万条来自网络抓取的嘈杂样本。训练数据的质量是单一最大的生产杠杆。

## 实际运用

2026 年机器翻译的生产技术栈：

| 使用场景 | 推荐起点 |
|---------|---------------------------|
| 任意语言互译，200 种语言 | `facebook/nllb-200-distilled-600M`（笔记本）或 `nllb-200-3.3B`（生产） |
| 以英语为中心，高质量，50 种语言 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短文本运行，廉价推理，英语-法语/德语/西班牙语 | Helsinki-NLP / Marian 模型 |
| 对延迟敏感的浏览器端 | ONNX 量化的 Marian（约 50 MB） |
| 追求极致质量、愿意付费 | 配合翻译提示词的 GPT-4 / Claude / Gemini |

截至 2026 年，LLM 在若干语言对上的表现已超越专用机器翻译模型，尤其是在习语类内容和长上下文方面。其代价是按 token 计的成本和延迟。当上下文长度、文体一致性，或通过提示实现的领域适配比吞吐量更重要时，选用 LLM。

## 交付上线

保存为 `outputs/skill-mt-evaluator.md`：

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## 练习

1. **简单。** 用 `nllb-200-distilled-600M` 把一段 5 句话的英语文字翻译成法语，再翻译回英语。度量这次往返与原文的接近程度。你应当会看到语义被保留，但用词出现漂移。
2. **中等。** 用 `fasttext lid.176` 或 `langdetect` 对翻译输出实现一个语种识别检查。把它集成进 MT 调用，使跑偏生成在返回之前就被捕获。
3. **困难。** 在你自选的 5,000 对领域语料上微调 `nllb-200-distilled-600M`。在一个保留集（held-out set）上度量微调前后的 BLEU。报告哪类句子有所提升，哪类出现了回退。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| BLEU | 翻译分数 | 带简短惩罚的 n-gram 精度。[0, 100]。 |
| chrF | 字符 F 分数 | 字符级 F 分数。对形态丰富的语言更敏感。 |
| NMT | 神经机器翻译 | 在平行文本上训练的 Transformer 编码器-解码器。2017 年起的默认范式。 |
| NLLB | No Language Left Behind | Meta 的 200 语言机器翻译模型家族。 |
| Constrained decoding | 受控输出 | 强制特定 token 或 n-gram 出现/不出现在输出中。 |
| Hallucination | 凭空捏造的内容 | 模型输出中得不到源文本支持的部分。 |

## 延伸阅读

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) —— NLLB 论文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) —— 为什么 `sacrebleu` 是报告 BLEU 的唯一正确方式。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) —— chrF 论文。
- [Hugging Face MT 指南](https://huggingface.co/docs/transformers/tasks/translation) —— 实用的微调演练。
