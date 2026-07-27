# 机器翻译

> 翻译是为 NLP 研究买单三十年并持续买单的任务。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 10（Attention 机制），阶段 5 · 04（GloVe、FastText、子词）
**时间：** ~75 分钟

## 问题

模型读取一种语言的句子，产生另一种语言的句子。长度变化。词序变化。有些源词映射到多个目标词，反之亦然。习语拒绝一对一映射。"I miss you" 在法语中是 "tu me manques"——字面意思是"你缺乏于我"。没有词级对齐能幸存下来。

机器翻译是迫使 NLP 发明编码器-解码器、attention、transformer 以及最终整个 LLM 范式的任务。每一步前进的到来都是因为翻译质量是可测量的，且人与机器之间的差距固执地存在。

本课跳过历史课，教授 2026 年的工作流程：预训练多语言编码器-解码器（NLLB-200 或 mBART）、子词 tokenization、beam search、BLEU 和 chrF 评估，以及仍然未被发现就投入生产的少数失败模式。

## 概念

现代 MT 是一个在平行文本上训练的 transformer 编码器-解码器。编码器用其语言的 tokenization 读取源。解码器通过 cross-attention（第 10 课）使用编码器的输出，一次生成一个子词。解码使用 beam search 以避免贪婪解码陷阱。输出被 detokenize、detruecase，并与参考译文评分。

三个操作选择驱动真实世界的 MT 质量。

- **Tokenizer。** 在混合语言语料库上训练的 SentencePiece BPE。跨语言共享词汇表是 NLLB 中实现零样本语种对的原因。
- **模型大小。** NLLB-200 distilled 600M 适合笔记本电脑。NLLB-200 3.3B 是发布的生产默认值。54.5B 是研究天花板。
- **解码。** 波束宽度 4-5 用于通用内容。长度惩罚以避免输出过短。需要术语一致性时使用约束解码。

```figure
seq2seq-alignment
```

## 开始构建

### 第 1 步：调用预训练 MT

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

```
Les chats courent.
```

这里有三件事很重要。`src_lang` 告诉 tokenizer 使用哪种文字和切分方式。`forced_bos_token_id` 告诉解码器生成哪种语言。两者都是 NLLB 特有的技巧；mBART 和 M2M-100 使用自己的约定，它们不可互换。

### 第 2 步：BLEU 和 chrF

BLEU 衡量输出与参考之间的 n-gram 重叠。四个参考 n-gram 大小（1-4），精确率的几何平均，对过短输出的简短惩罚。分数在 [0, 100] 范围内。常用。难以解释：30 BLEU 是"可用"；40 是"好"；50 是"优秀"；低于 1 BLEU 的差异是噪声。

chrF 衡量字符级 F-score。对形态丰富的语言更敏感，在这些语言中 BLEU 低估了匹配。通常与 BLEU 一起报告。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

始终使用 `sacrebleu`。它标准化了 tokenization，使分数在论文之间可比较。自己实现 BLEU 计算是产生误导性基准的原因。

### 三级评估体系（2026）

现代 MT 评估使用三个互补的指标家族。至少交付其中两个。

- **启发式**（BLEU、chrF）。快速、基于参考、可解释、对释义不敏感。用于遗留比较和回归检测。
- **学习式**（COMET、BLEURT、BERTScore）。基于人类判断训练的神经模型；比较翻译与源和参考的语义相似度。自 2023 年以来，COMET 与 MT 研究的关联度最高，是 2026 年质量重要时的生产默认选择。
- **LLM 作为评委**（无参考）。提示大模型对翻译的流畅度、充分性、语气、文化适当性打分。当评估标准设计良好时，GPT-4 作为评委与人类一致率达到约 80%。用于不存在参考的开放内容。

实际 2026 技术栈：`sacrebleu` 用于 BLEU 和 chrF，`unbabel-comet` 用于 COMET，以及一个提示 LLM 用于最终面向人类信号。在信任生产数据之前，先用 50-100 个人工标注样本校准每个指标。

无参考指标（COMET-QE、BLEURT-QE、LLM 作为评委）允许你在没有参考的情况下评估翻译，这对于不存在参考译文的长尾语言对很重要。

### 第 3 步：生产环境中出什么问题

上述工作流程在 80% 的情况下能流畅翻译，其余 20% 会静默失败。命名的失败模式：

- **幻觉。** 模型发明了源中不存在的内容。在陌生领域词汇中常见。症状：输出流畅但声称了源中没有陈述的事实。缓解措施：在领域术语上使用约束解码，对受监管内容进行人工审查，监控比输入长得多的输出。
- **离目标生成。** 模型翻译成错误的语言。NLLB 在罕见语言对上出奇地容易出现这个问题。缓解措施：验证 `forced_bos_token_id`，并始终在输出上使用语言 ID 模型检查。
- **术语漂移。** "Sign up" 在文档 1 中变成 "s'inscrire"，在文档 2 中变成 "créer un compte"。对于 UI 文本和面向用户的字符串，一致性比原始质量更重要。缓解措施：词汇表约束解码或后编辑词典。
- **正式度不匹配。** 法语的 "tu" vs "vous"，日语的礼貌级别。模型会选择训练中更常见的形式。对于面向客户的内容，这通常是错误的。缓解措施：如果模型支持，使用正式度 token 作为提示前缀，或在纯正式语料上微调小模型。
- **短输入导致的长度爆炸。** 非常短的输入句子通常会产生过长的翻译，因为长度惩罚在源 token 数低于约 5 时急剧下降。缓解措施：设置与源长度成比例的硬最大长度限制。

### 第 4 步：为领域微调

预训练模型是全才。法律、医学或游戏对话翻译通过在领域平行数据上微调获得可衡量的提升。配方并不特殊：

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L accusé a plaidé coupable."},
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

几千个高质量平行样本胜过几十万个嘈杂的网页抓取样本。训练数据的质量是单一最大的生产杠杆。

## 使用现成工具

2026 年 MT 生产技术栈：

| 用例 | 推荐起点 |
|---------|---------------------------|
| 任意到任意，200 种语言 | `facebook/nllb-200-distilled-600M`（笔记本电脑）或 `nllb-200-3.3B`（生产） |
| 以英语为中心，高质量，50 种语言 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短运行，低成本推理，英-法/德/西 | Helsinki-NLP / Marian 模型 |
| 延迟关键的浏览器端 | ONNX 量化 Marian（约 50 MB） |
| 最高质量，愿意付费 | 使用翻译提示的 GPT-4 / Claude / Gemini |

截至 2026 年，LLM 在几个语言对上现在优于专用 MT 模型，特别是在习语内容和长上下文方面。权衡是每 token 成本和延迟。当上下文长度、风格一致性或通过提示进行领域适应比吞吐量更重要时，选择 LLM。

## 交付

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

1. **简单。** 使用 `nllb-200-distilled-600M` 将一段 5 句英语段落翻译成法语并回译成英语。测量回译与原文的接近程度。你应该看到语义保持但用词漂移。
2. **中等。** 使用 `fasttext lid.176` 或 `langdetect` 在翻译输出上实现语言 ID 检查。将其集成到 MT 调用中，以便在返回之前捕获离目标生成。
3. **困难。** 在你选择的 5,000 对领域语料库上微调 `nllb-200-distilled-600M`。在微调前后测量留出集上的 BLEU。报告哪些类型的句子改进，哪些退步。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| BLEU | 翻译分数 | 带简短惩罚的 n-gram 精确率。[0, 100]。 |
| chrF | 字符 F-score | 字符级 F-score。对形态丰富的语言更敏感。 |
| NMT | 神经机器翻译 | 在平行文本上训练的 transformer 编码器-解码器。2017+ 默认。 |
| NLLB | No Language Left Behind | Meta 的 200 语言 MT 模型家族。 |
| Constrained decoding | 受控输出 | 强制特定 token 或 n-gram 在输出中出现/不出现。 |
| Hallucination | 捏造内容 | 模型输出不支持源中的内容。 |

## 延伸阅读

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) —— NLLB 论文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) —— 为什么 `sacrebleu` 是报告 BLEU 的唯一正确方式。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) —— chrF 论文。
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) —— 实用的微调教程。
