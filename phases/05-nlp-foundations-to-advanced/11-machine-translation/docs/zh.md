# Machine Translation

> 三十年来，翻译是NLP研究的一项任务，现在仍在继续付费。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 10（注意力机制）、阶段5 · 04（GloVe、Fasttext、Subword）
** 时间：** ~75分钟

## The Problem

模型读取一种语言的句子并生成另一种语言的句子。长度各不相同。词序各不相同。一些源词映射到多个目标词，反之亦然。习语拒绝一对一映射。“I miss you”在法语中是“tu me manques”--字面意思是“你对我来说是缺乏的。“没有单词级对齐可以幸免。

机器翻译是迫使NLP发明编码器-解码器、注意力、转换器，并最终发明整个LLM范式的任务。前进的每一步都是因为翻译质量是可衡量的，而且人类和机器之间的差距是顽固的。

本课跳过了历史课，教授了2026年的工作管道：预训练的多语言编码器-解码器（NLLB-200或mBART）、子字标记化、束搜索、BLEU和chrF评估，以及少数未捕获仍交付生产的故障模式。

## The Concept

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

现代MT是一个基于并行文本训练的Transformer编码器-解码器。编码器以其语言的标记化读取源代码。解码器通过交叉注意使用编码器的输出，一次生成一个子字的目标（第10课）。解码使用束搜索来避免贪婪解码陷阱。输出将被去标记化、去修饰化并根据引用评分。

三种操作选择推动了现实世界的MT质量。

- ** 代币器。** SentencePiece BPE在混合语言库上训练。跨语言共享词汇是NLLB中零镜头对的实现。
- ** 型号尺寸。** NLLB-200蒸馏600 M适合笔记本电脑。NLLB-200 3.3B是已发布的生产默认值。54.5B是研究上限。
- ** 解码。**一般内容的梁宽4-5。长度惩罚以避免输出太短。当您需要术语一致性时，限制解码。

## Build It

### Step 1: a pretrained MT call

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

这里有三件事很重要。`src_lang`告诉标记器要应用哪个脚本和分段。`forced_bos_token_id`告诉解码器要生成哪种语言。两者都是NLLB特定的技巧; mBART和M2M-100使用它们自己的约定，并且它们不可互换。

### Step 2: BLEU and chrF

BLEU测量输出和引用之间的n元重叠。四个参考n元大小（1-4）、精确度的几何平均值、太短输出的简洁性惩罚。分数为[0，100]。常用的。令人沮丧的解释：30 BLEU是“可用”; 40是“良好”; 50是“例外”; 1 BLEU以下的差异是噪音。

chrF衡量角色级F分数。对BLEU低估匹配项的形态丰富语言更敏感。通常与BLEU一起报告。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

始终使用“sacrebleu”。它使标记化正常化，以便各论文的分数具有可比性。滚动您自己的BLEU计算就是误导性基准的发生方式。

### The three-tier evaluation hierarchy (2026)

现代MT评估使用三个互补的指标族。船上至少有两个。

- ** 启发式 **（BLEU，chrF）。快速、基于引用、可解释、对转述不敏感。用于遗留比较和回归检测。
- ** 学到了 **（COMET、BLEURT、BERTScore）。根据人类判断训练的神经模型;比较翻译与源和参考文献的语义相似性。自2023年以来，COMET与MT研究的关联度最高，并且是2026年质量重要的生产默认产品。
- ** 法学硕士担任法官 **（无需参考）。提示一个大型模型对翻译的流畅性，充分性，语气，文化适当性进行评分。GPT-4-as-judge在规则设计良好的情况下，在80%的情况下与人类一致。用于不存在引用的开放式内容。

实用2026堆栈：'sacrebleu'用于BLEU和chrF，'unbabel-comet'用于COMET，以及提示LLM用于最终面向人类的信号。在将每个指标应用于生产数据之前，先根据50-100个人工标记的示例进行校准。

无参考指标（COMET-QE、BLEURT-QE、LLM as-Judge）可让您在没有参考的情况下评估翻译，这对于不存在参考翻译的长尾语言对很重要。

### Step 3: what breaks in production

上面的工作管道将在80%的情况下流畅地翻译，而在剩余的20%的情况下默默地失败。命名故障模式：

- ** 幻觉。**模型发明了源代码中不存在的内容。常见于陌生领域词汇。症状：输出流畅，但声称消息来源没有陈述的事实。缓解措施：限制对领域术语的解码、对受监管内容的人工审查、对输出的监控时间比输入的时间长得多。
- ** 脱靶一代。**模型翻译成错误的语言。令人惊讶的是，NLLB在罕见的语言对上容易出现这种情况。缓解措施：验证“force_bos_token_id”，并始终通过对输出进行语言ID模型检查来解码。
- ** 术语漂移。**“注册”在文档1中变成“s ' inscire”，在文档2中变成“créer un compte”。对于UI文本和面向用户的字符串来说，一致性比原始质量更重要。缓解措施：术语限制解码或后编辑词典。
- ** 形式不匹配。**法语“tu”与“vous”，日语礼貌水平。该模型选择了训练中更常见的形式。对于面向客户的内容来说，这通常是错误的。缓解措施：如果模型支持，则提示添加正式标记，或者在纯正式的文集上微调小模型。
- ** 短输入时的长度爆炸。**非常短的输入句子通常会产生过长的翻译，因为长度惩罚会从~5个源标记以下跌落。缓解措施：硬最大长度上限与源长度成正比。

### Step 4: fine-tuning for a domain

预训练模型是多面手。法律、医学或游戏对话翻译可从对领域并行数据的微调中获得可观的好处。食谱并不奇特：

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

几千个高质量的并行示例胜过几十万个嘈杂的网络抓取示例。培训数据的质量是最大的生产杠杆。

## Use It

MT 2026年生产堆栈：

| 用例 | 推荐起点 |
|---------|---------------------------|
| 任意对任意，200种语言 | “Facebook/nllb-200-蒸馏-600 M”（笔记本电脑）或“nllb-200-3.3B”（生产） |
| 以英语为中心，高质量，50种语言 | “Facebook/mbart-large-50-many-to-many-mmt” |
| 短期运行，廉价推断，英语-法语/德语/西班牙语 | 赫尔辛基-NLP/玛丽安模型 |
| 延迟严格的浏览器端 | ONNX量化Marian（~50 MB） |
| 最高质量，愿意付费 | GPT-4 / Claude / Gemini，带翻译提示 |

截至2026年，LLM在几种语言对上的表现优于专业MT模型，特别是在惯用内容和长上下文方面。权衡的是每个代币的成本和延迟。当上下文长度、风格一致性或通过提示进行的领域适应比吞吐量更重要时，选择LLM。

## Ship It

另存为“输出/skill-mt-evaluator.md”：

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

## Exercises

1. ** 简单。**使用“nllb-200-stival-600 M”将5句英语段落翻译成法语并翻译回英语。测量往返行程与原始行程的接近程度。您应该看到语义保留和词选择漂移。
2. ** 中等。**使用“fasttext lid.176”或“langDetect”对翻译输出实施语言ID检查。集成到MT呼叫中，以便在返回之前抓住偏离目标的一代。
3. ** 很难。**在您选择的5，000对域语料库上微调`nllb-200-distilled-600 M`。在微调之前和之后，测量BLEU。报告哪种句子有所改善，哪种有所退步。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| Bleu | 翻译分数 | N-gram精确度，但简洁性较差。[0，100]。 |
| chrF | 角色F分数 | 幼儿级别F评分。对形态丰富的语言更敏感。 |
| NMT | 神经MT | 在并行文本上训练的Transformer编码器-解码器。2017年+默认。 |
| NLLB | 不让语言掉队 | Meta的200种语言MT模型家族。 |
| 约束译码 | 受控输出 | 强制特定令牌或n元语法出现/不出现在输出中。 |
| 幻觉 | 发明内容 | 源不支持的模型输出。 |

## Further Reading

- [Costa-jussà等人（2022）。不让语言掉队：扩展以人为本的机器翻译]（https：//arxiv.org/ab/2207.04672）-NLLB论文。
- [Post（2018）。呼吁清晰报告BLEU分数]（https：//aclanthology.org/W18-6319/）-为什么“sacrebleu”是报告BLEU的唯一正确方式。
- [波波维奇（2015）。chrF：用于自动MT评估的字符n-gram F-score]（https：//aclanthology.org/W15-3049/）-chrF论文。
- [Hugging Face MT指南]（https：//huggingface.co/docs/transformers/tasks/translation）-实用的微调演练。
