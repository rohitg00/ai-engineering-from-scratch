# 机器翻译

> 翻译是一项为 NLP 研究支付了三十年经费的任务，如今仍在持续供血。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 5 · 10(注意力机制)、阶段 5 · 04(GloVe、FastText、子词)
**Time:** 约 75 分钟

## 问题

一个模型读取一种语言的句子，并生成另一种语言的句子。长度会变。词序会变。有些源语言词对应多个目标语言词，反之亦然。习语拒绝一一对应。法语中的 "I miss you" 是 "tu me manques"——字面意思是“你在我这里缺失”。任何词级对齐都无法在这种情况下存活。

机器翻译是迫使 NLP 发明编码器-解码器、注意力、Transformer,并最终催生整个 LLM 范式的任务。每一步进步的到来，都是因为翻译质量可以被度量，而人类与机器之间的差距又顽固地存在。

本课跳过历史，直接讲授 2026 年可用的流水线：预训练多语言编码器-解码器(NLLB-200 或 mBART)、子词分词、束搜索、BLEU 与 chrF 评估，以及至今仍会未被发现就上生产的少数失败模式。

## 概念

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

现代机器翻译是在平行文本上训练的 Transformer 编码器-解码器。编码器按源语言的分词方式读取源文本。解码器通过交叉注意力(第 10 课)利用编码器的输出，逐个生成子词。解码使用束搜索以避免贪心解码的陷阱。输出经过反分词、反大小写还原，并与参考译文进行评分。

三个工程决策决定真实世界的机器翻译质量。

- **分词器。** 在混合语言语料上训练的 SentencePiece BPE。跨语言共享词表是 NLLB 实现零样本语言对的关键。
- **模型规模。** NLLB-200 distilled 600M 可在笔记本上运行。NLLB-200 3.3B 是公开的生产默认选择。54.5B 是研究上限。
- **解码。** 通用内容使用束宽 4–5。使用长度惩罚以避免过短的输出。需要术语一致性时使用受限解码。

```figure
seq2seq-alignment
```

## 动手构建

### 步骤 1:一次预训练机器翻译调用

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

这里有三件事很重要。`src_lang` 告诉分词器应用哪种文字和分词方式。`forced_bos_token_id` 告诉解码器生成哪种语言。两者都是 NLLB 特有的约定；mBART 和 M2M-100 使用各自的约定，不可互换。

### 步骤 2:BLEU 与 chrF

BLEU 衡量输出与参考译文之间的 n-gram 重叠。使用四个参考 n-gram 长度(1–4),对精确率取几何平均，并对过短的输出施加简短惩罚。分数范围是 [0, 100]。使用广泛。但解释起来令人沮丧：30 BLEU 是“可用”；40 是“良好”；50 是“出色”；低于 1 BLEU 的差异属于噪声。

chrF 衡量字符级 F 分数。对形态丰富的语言更敏感，而 BLEU 在这类语言中会低估匹配。通常与 BLEU 一同报告。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

务必使用 `sacrebleu`。它会对分词进行归一化，使分数在不同论文之间可比较。自己动手实现 BLEU 计算，正是误导性基准测试产生的原因。

### 三层评估体系(2026)

现代机器翻译评估使用三个互补的指标族。上线时至少使用其中两个。

- **启发式**(BLEU、chrF)。快速、基于参考、可解释，但对改写不敏感。用于历史对比与回归检测。
- **学习型**(COMET、BLEURT、BERTScore)。在人类判断上训练的神经模型；比较译文与源文及参考译文的语义相似度。自 2023 年以来，COMET 与机器翻译研究的相关性最高，是 2026 年注重质量场景下的生产默认选择。
- **LLM 作为评判者**(无参考)。提示大模型从流畅性、忠实度、语气、文化适宜性等方面为译文打分。当评分标准设计得当时，GPT-4 作为评判者与人类一致率约为 80%。用于不存在参考译文的开放式内容。

2026 年的实用组合：用 `sacrebleu` 计算 BLEU 和 chrF,用 `unbabel-comet` 计算 COMET,再用一个被提示的 LLM 提供最终面向人类的信号。在对生产数据信任任何指标之前，先用 50–100 条人工标注样本对其进行校准。

无参考指标(COMET-QE、BLEURT-QE、LLM 作为评判者)让你在没有参考译文的情况下评估翻译，这对不存在参考译文的长尾语言对至关重要。

### 步骤 3:生产环境中的故障

上述可运行的流水线在 80% 的情况下会流畅地完成翻译，而在其余 20% 的情况下悄无声息地失败。已命名的失败模式：

- **幻觉。** 模型编造源文本中不存在的内容。在不熟悉的领域词汇中常见。症状：输出流畅，却断言源文本没有陈述的事实。缓解措施：对领域术语使用受限解码，对受监管内容进行人工审核，监控输出远长于输入的情况。
- **目标语言偏移。** 模型翻译成了错误的语言。NLLB 在稀有语言对上出人意料地容易出现此问题。缓解措施：验证 `forced_bos_token_id`,并始终在输出上用语言识别模型检查解码结果。
- **术语漂移。** "Sign up" 在文档 1 中被译为 "s'inscrire",在文档 2 中却被译为 "créer un compte"。对 UI 文案和面向用户的字符串而言，一致性比原始质量更重要。缓解措施：术语表受限解码，或译后编辑词典。
- **语体不匹配。** 法语的 "tu" 与 "vous",日语的敬语级别。模型会挑选训练数据中更常见的形式。对面向客户的内容来说，这通常是错的。缓解措施：若模型支持，用带语体标记的前缀提示，或在仅正式语体语料上微调一个小模型。
- **短输入的长度爆炸。** 非常短的输入句子常常产生过长的译文，因为当源文本少于约 5 个 token 时，长度惩罚会急剧失效。缓解措施：设置与源文本长度成比例的硬性最大长度上限。

### 步骤 4:面向领域的微调

预训练模型是通才。法律、医疗或游戏对话翻译从领域平行数据微调中获益明显。配方并不稀奇：

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

几千条高质量平行样本胜过几十万条嘈杂的网络爬取样本。训练数据质量是生产环境中最大的单一杠杆。

## 使用它

2026 年机器翻译的生产技术栈：

| 使用场景 | 推荐起点 |
|---------|---------------------------|
| 任意语言到任意语言，200 种语言 | `facebook/nllb-200-distilled-600M`(笔记本)或 `nllb-200-3.3B`(生产) |
| 以英语为中心、高质量、50 种语言 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短文本、低成本推理、英-法/德/西 | Helsinki-NLP / Marian 模型 |
| 延迟敏感的浏览器端 | ONNX 量化的 Marian(约 50 MB) |
| 最高质量、愿意付费 | 带翻译提示的 GPT-4 / Claude / Gemini |

截至 2026 年，LLM 在若干语言对上已超越专用机器翻译模型，尤其是在习语内容和长上下文上。代价是按 token 计费的成本和延迟。当上下文长度、风格一致性或通过提示进行领域适配比吞吐量更重要时，选择 LLM。

## 上线它

保存为 `outputs/skill-mt-evaluator.md`:

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

1. **简单。** 使用 `nllb-200-distilled-600M` 将一段 5 句的英文段落翻译成法语，再翻回英语。测量往返译文与原文的接近程度。你应该会看到语义得以保留，但用词发生漂移。
2. **中等。** 使用 `fasttext lid.176` 或 `langdetect` 在翻译输出上实现语言识别检查。将其集成到机器翻译调用中，以便在返回结果之前捕获目标语言偏移的生成结果。
3. **困难。** 在你自选的 5,000 对领域语料上微调 `nllb-200-distilled-600M`。在微调前后分别测量留出集上的 BLEU。报告哪些类型的句子有所改进，哪些出现退化。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BLEU | 翻译分数 | 带简短惩罚的 n-gram 精确率。[0, 100]。 |
| chrF | 字符 F 分数 | 字符级 F 分数。对形态丰富的语言更敏感。 |
| NMT | 神经机器翻译 | 在平行文本上训练的 Transformer 编码器-解码器。2017 年以来的默认方案。 |
| NLLB | No Language Left Behind | Meta 的 200 语言机器翻译模型家族。 |
| 受限解码 | 受控输出 | 强制特定 token 或 n-gram 出现/不出现在输出中。 |
| 幻觉 | 编造的内容 | 源文本无法支持的模型输出。 |

## 延伸阅读

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) — NLLB 论文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) — 为什么 `sacrebleu` 是报告 BLEU 的唯一正确方式。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) — chrF 论文。
- [Hugging Face 机器翻译指南](https://huggingface.co/docs/transformers/tasks/translation) — 实用的微调 walkthrough。