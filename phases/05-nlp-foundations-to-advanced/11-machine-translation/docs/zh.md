# 机器翻译（Machine Translation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 翻译这件事，养活了 NLP 研究三十年，今天还在继续养活。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## 问题（The Problem）

模型读入一种语言的句子，输出另一种语言的句子。长度会变。语序会变。源语言里的一个词可能对应目标语言的多个词，反之亦然。习语拒绝一一对应：英语 "I miss you" 在法语里是 "tu me manques"——字面意思是「你对我而言是缺席的」。任何词级对齐在这种情况下都失效。

机器翻译这个任务，逼着 NLP 发明了 encoder-decoder、attention（注意力）、transformer，乃至最终整个 LLM 范式。每一次进步之所以发生，都是因为翻译质量可以测量，而人机之间的差距又顽固地存在。

本课跳过历史回顾，直接讲 2026 年能跑起来的 pipeline（流水线）：预训练好的多语言 encoder-decoder（NLLB-200 或 mBART）、subword tokenization（子词切分）、beam search、BLEU 与 chrF 评估，以及那少数几个至今仍会悄悄漏到生产环境的 failure mode（失败模式）。

## 概念（The Concept）

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

现代 MT 是一个在平行语料上训练的 transformer encoder-decoder。Encoder 用对应语言的 tokenization 读入源句。Decoder 通过 cross-attention（见第 10 课）拿到 encoder 的输出，然后一个 subword 一个 subword 地生成目标语言。解码用 beam search 来避开贪心解码的陷阱。最后输出经过 detokenize、detruecase，再与参考译文对比打分。

真实世界里，三个工程选择决定了 MT 的质量。

- **Tokenizer。** 在多语言混合语料上训练的 SentencePiece BPE。NLLB 之所以能做 zero-shot 语言对，靠的就是各语言共享的词表。
- **模型规模。** NLLB-200 蒸馏版 600M 在笔记本上跑得动；NLLB-200 3.3B 是论文里的生产默认配置；54.5B 是研究上限。
- **解码。** 一般内容用 beam width 4-5。配上 length penalty（长度惩罚）防止输出过短。要保证术语一致性时上 constrained decoding（受约束解码）。

## 动手实现（Build It）

### 第 1 步：调一次预训练 MT

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

这里有三件事要紧。`src_lang` 告诉 tokenizer 用哪种文字和切分方式。`forced_bos_token_id` 告诉 decoder 生成哪种语言。这两个都是 NLLB 专属的小技巧——mBART 和 M2M-100 各有自己的约定，互相不能替换。

### 第 2 步：BLEU 与 chrF

BLEU 衡量输出与参考之间的 n-gram 重叠度。取 1 到 4 这四种 n-gram size，对各自精确率取几何平均，再叠一个 brevity penalty（过短惩罚）。分数在 [0, 100] 之间。这是最常用的指标，也最让人头疼：30 BLEU 算「能用」，40 算「好」，50 算「卓越」，差距小于 1 BLEU 基本是噪声。

chrF 衡量字符级 F-score。对形态丰富的语言更敏感——这类语言在 BLEU 下匹配数容易被低估。所以 chrF 经常和 BLEU 一起报。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

永远用 `sacrebleu`。它会把 tokenization 标准化，分数才能跨论文可比。自己手撸 BLEU 计算正是误导性 benchmark 的来源。

### 三层评估体系（2026 版）

现代 MT 评估用三族互补指标。上线前至少跑两族。

- **启发式（Heuristic）**：BLEU、chrF。快、有参考、可解释，但对改写不敏感。用来做历史对比和回归检测。
- **学习式（Learned）**：COMET、BLEURT、BERTScore。在人类打分上训练出来的神经模型，比较译文与源句、参考之间的语义相似度。COMET 自 2023 年起在 MT 研究中与人类判断的相关性最高，是 2026 年质量优先场景下的生产默认选择。
- **LLM-as-judge（无参考）**：直接 prompt 一个大模型，从流畅度、忠实度、语气、文化适配等维度给译文打分。当 rubric 设计得当时，GPT-4-as-judge 与人类的一致率约 80%。在没有参考译文的开放式内容上用它。

2026 年实战配方：`sacrebleu` 跑 BLEU 与 chrF，`unbabel-comet` 跑 COMET，再用 prompt 过的 LLM 给最终面向人的判断信号。每个指标在投入生产数据之前，都先用 50-100 条人类标注样例 calibrate 一遍。

无参考指标（COMET-QE、BLEURT-QE、LLM-as-judge）让你在没有参考译文的情况下也能评估——这对那些根本没有参考译文的长尾语言对很关键。

### 第 3 步：生产环境会出什么问题

上面那条 pipeline 有 80% 的时间会翻得很顺，剩下 20% 会悄悄翻车。下面是有名字的几种 failure mode：

- **Hallucination（幻觉）。** 模型凭空造出源句里没有的内容。常见于陌生领域词汇。症状是：输出读起来很流畅，但声称了一些源句里根本没说的事实。缓解办法：对领域术语做 constrained decoding、对受监管内容加人工 review、监控输出长度远超输入的样例。
- **Off-target generation（跑偏到别的语言）。** 模型把内容翻译到了错误的语言。NLLB 在罕见语言对上意外地容易犯这个错。缓解办法：核对 `forced_bos_token_id`，并且在解码后总是用一个 language-ID 模型验证输出语言。
- **术语漂移（Terminology drift）。** "Sign up" 在文档 1 里译成 "s'inscrire"，在文档 2 里又译成 "créer un compte"。对 UI 文案和面向用户的字符串，一致性比原始翻译质量更重要。缓解办法：基于术语表的 constrained decoding，或者后置一份对照字典做 post-edit。
- **Formality mismatch（敬语错位）。** 法语的 "tu" 与 "vous"、日语的礼貌等级。模型会选训练数据里更常见的那种。对面向客户的内容，这通常是错的。缓解办法：如果模型支持，加 formality token 作为 prompt 前缀；或者用纯正式语料微调一个小模型。
- **短输入下的长度爆炸（Length explosion on short input）。** 非常短的输入常常产出超长的译文，因为 length penalty 在源句不到约 5 个 token 时会断崖式失效。缓解办法：按源句长度比例设置硬性 max-length 上限。

### 第 4 步：针对领域微调

预训练模型是通才。法律、医疗、游戏对白翻译，在领域平行语料上微调后能获得可测量的提升。配方并不玄学：

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

几千条高质量的平行样例，胜过几十万条噪声满满的网爬数据。训练数据质量是生产环境里单一最大的杠杆。

## 用起来（Use It）

2026 年 MT 的生产技术栈：

| 用途 | 推荐起点 |
|---------|---------------------------|
| 任意到任意、200 种语言 | `facebook/nllb-200-distilled-600M`（笔记本）或 `nllb-200-3.3B`（生产） |
| 英语为中心、高质量、50 种语言 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短跑、便宜推理、英语-法/德/西 | Helsinki-NLP / Marian 系列 |
| 浏览器端、对延迟敏感 | ONNX 量化后的 Marian（约 50 MB） |
| 最高质量、愿意付费 | GPT-4 / Claude / Gemini 配上翻译 prompt |

到 2026 年，LLM 在若干语言对上的表现已经超过专门的 MT 模型，尤其是在习语类内容和长上下文场景。代价是每 token 的成本和延迟。当上下文长度、风格一致性、或基于 prompt 的领域适配比吞吐量更重要时，选 LLM。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy。** 用 `nllb-200-distilled-600M` 把一段 5 句话的英语段落翻成法语，再翻回英语。测量 round-trip 后与原文的接近程度。你应当看到语义大体保留，但用词会漂移。
2. **Medium。** 用 `fasttext lid.176` 或 `langdetect` 给翻译输出加一个 language-ID 检查。把它接到 MT 调用里，让 off-target generation 在返回前就被拦下。
3. **Hard。** 用你自选的、5,000 对的领域平行语料微调 `nllb-200-distilled-600M`。在留出集上测量微调前后的 BLEU。报告哪类句子提升了、哪类反而退化了。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | 翻译评分 | 带过短惩罚的 n-gram 精确率，[0, 100]。 |
| chrF | 字符 F-score | 字符级 F-score。对形态丰富的语言更敏感。 |
| NMT | Neural MT | 在平行语料上训练的 transformer encoder-decoder。2017 年起的默认范式。 |
| NLLB | No Language Left Behind | Meta 的 200 语言 MT 模型家族。 |
| Constrained decoding | 受控输出 | 强制让特定 token 或 n-gram 出现 / 不出现在输出里。 |
| Hallucination | 凭空捏造 | 输出中没有源句支撑的内容。 |

## 延伸阅读（Further Reading）

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) — NLLB 论文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) — 为什么 `sacrebleu` 是报告 BLEU 的唯一正确方式。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) — chrF 论文。
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) — 实操微调指南。
