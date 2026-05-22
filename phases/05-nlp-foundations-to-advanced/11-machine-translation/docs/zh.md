# 机器翻译（Machine Translation）

> 翻译是引领自然语言处理研究三十余年、至今仍不断创造价值的任务。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段5·10（注意力机制）、阶段5·04（GloVe、FastText、子词）  
**时间：** 约75分钟  

## 问题

模型读取一种语言的句子，生成另一种语言的句子。句子长度不一，词序不同。某些源词映射到多个目标词，反之亦然。习语拒绝一对一的映射——例如英语的“I miss you”在法语中是“tu me manques”，字面意思是“你对我缺失”。没有任何词级别对齐能应付这种情况。

机器翻译是迫使自然语言处理（NLP）发明编码器-解码器、注意力机制、Transformer，并最终催生整个大语言模型（LLM）范式的任务。每一次进步的出现，都是因为翻译质量可量化，且人类与机器的差距始终难以消除。

本课略过历史，直接讲述2026年可用的工作流程：预训练多语言编码器-解码器（NLLB-200或mBART）、子词分词、束搜索、BLEU与chrF评估，以及仍会在生产环境中未经察觉而暴露的几种典型失败模式。

## 核心概念

![MT流程：分词 → 编码 → 带注意力的解码 → 去分词](../assets/mt-pipeline.svg)

现代机器翻译（MT）是一个在平行文本上训练的Transformer编码器-解码器。编码器以其语言分词方式读取源文本。解码器借助交叉注意力（第10课），利用编码器的输出，一次生成一个子词。解码时使用束搜索以避免贪婪解码的陷阱。输出经过去分词、去大小写处理后，与参考译文进行评分。

三个操作层面的选择决定了实际MT系统的质量。

- **分词器（Tokenizer）。** 在多语言混合语料上训练的SentencePiece BPE。共享跨语言的词汇表是NLLB中实现零样本翻译对的关键。
- **模型大小。** NLLB-200蒸馏版600M可在一台笔记本电脑上运行。NLLB-200 3.3B是已发布的默认生产配置。54.5B则是研究上限。
- **解码（Decoding）。** 一般内容使用束宽4-5。长度惩罚避免输出过短。需要术语一致性时使用约束解码。

## 动手构建

### 第一步：调用预训练MT模型

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

这里有三点需要注意。`src_lang`告诉分词器应用哪种文字系统和切分规则。`forced_bos_token_id`告诉解码器生成哪种语言。这两者都是NLLB特有的做法；mBART和M2M-100有自己的约定，不能互换。

### 第二步：BLEU与chrF

BLEU衡量输出与参考译文之间的n-gram重叠。使用四种n-gram大小（1-4），取几何平均精度，并对过短输出施加简洁惩罚。分值范围为[0, 100]。广泛使用，但解释起来令人沮丧：30分表示“可用”，40分表示“良好”，50分表示“优秀”；小于1分的差异属于噪声。

chrF衡量字符级别的F值。对于形态丰富的语言，char-level F值比BLEU更能捕捉匹配情况，常与BLEU一同报告。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

始终使用`sacrebleu`库。它会标准化分词，确保不同论文之间的分数可比。自行实现BLEU计算是导致错误基准测试的根源。

### 三级评估体系（2026）

现代MT评估使用三种互补的指标族。至少应使用两种进行发布。

- **启发式指标（Heuristic）**（BLEU、chrF）。速度快、基于参考可解释、对同义改写不敏感。用于遗留对比和回归检测。
- **学习型指标（Learned）**（COMET、BLEURT、BERTScore）。基于人工判断训练的神经模型；比较译文与源文及参考译文的语义相似度。自2023年以来，COMET与人类判断的相关性最高，是2026年在重视质量的生产环境中的默认选择。
- **LLM作为裁判（LLM-as-judge）**（无参考）。提示一个大模型，对译文的流畅度、充分性、语气、文化适切性进行评分。在设计了良好评价标准的情况下，GPT-4作为裁判与人类判断的一致性可达约80%。适用于不存在参考译文的开放式内容。

2026年的实际技术栈：使用`sacrebleu`计算BLEU和chrF，使用`unbabel-comet`计算COMET，并使用提示的大语言模型（LLM）作为最终面对人类用户的信号。在信任生产数据之前，先用50-100个人工标注样本对每个指标进行校准。

无参考指标（COMET-QE、BLEURT-QE、LLM-as-judge）允许在没有参考译文的情况下评估翻译质量，这对于参考译文不存在的长尾语言对尤为重要。

### 第三步：生产环境中常见的问题

上述工作流程能在80%的情况下流畅翻译，但剩余20%会静默失败。典型的失败模式包括：

- **幻觉（Hallucination）。** 模型凭空生成源文中不存在的内容。常见于不熟悉的领域词汇。症状：输出流畅，但声称了源文未提及的事实。缓解措施：对领域术语使用约束解码，对受监管内容进行人工审核，监控输出长度是否显著超过输入长度。
- **脱离目标语言（Off-target generation）。** 模型翻译成了错误的语言。NLLB在稀有语言对上尤其容易出现此问题。缓解措施：验证`forced_bos_token_id`，并在输出后始终使用语言ID模型进行校验。
- **术语漂移（Terminology drift）。** 例如，“Sign up”在文档1中被译为“s'inscrire”，在文档2中被译为“créer un compte”。对于用户界面文本和面向用户的字符串，一致性比原始质量更重要。缓解措施：使用词汇表约束解码或后编辑词典。
- **礼貌程度不匹配（Formality mismatch）。** 法语的“tu”与“vous”，日语的各种敬语等级。模型会选取训练语料中出现更频繁的形式。对于面向客户的文本，这通常不正确。缓解措施：如果模型支持，在提示前缀中加入礼貌程度标记；或在仅包含正式语料的文本上微调一个小模型。
- **短输入导致长度爆炸（Length explosion on short input）。** 非常短的输入句子往往会产生过长的翻译，因为长度惩罚在源词少于5个左右时会急剧失效。缓解措施：设置与源句长度成比例的硬性最大长度上限。

### 第四步：针对特定领域的微调

预训练模型是通才。法律、医学或游戏对话翻译可以通过在领域平行数据上进行微调获得可衡量的提升。微调配方并不复杂：

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

几千个高质量平行样例胜过几十万个含噪网页抓取样本。训练数据的质量是生产环境中最关键的杠杆。

## 使用它

2026年MT生产环境的推荐技术栈：

| 使用场景 | 推荐起点 |
|---------|---------------------------|
| 任意语言对任意语言，200种语言 | `facebook/nllb-200-distilled-600M`（笔记本）或 `nllb-200-3.3B`（生产环境） |
| 以英语为中心，高质量，50种语言 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短文本运行、低成本推理，英语-法语/德语/西班牙语 | Helsinki-NLP / Marian模型 |
| 浏览器端延迟敏感场景 | ONNX量化Marian（约50 MB） |
| 最高质量，愿意付费 | 使用翻译提示的GPT-4 / Claude / Gemini |

截至2026年，LLM在多个语言对上的表现已超过专用MT模型，尤擅长习语内容和长上下文。权衡点是每token的成本和延迟。当上下文长度、风格一致性或通过提示进行领域适配比吞吐量更重要时，应选择LLM。

## 发布它

保存为 `outputs/skill-mt-evaluator.md`：

```markdown
---
name: mt-evaluator
description: 评估机器翻译输出是否可发布。
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

给定源文本和候选译文，输出：

1. 自动评分估计。预期的BLEU和chrF范围。说明是否有参考译文可用。
2. 五点人工可验证检查清单：(a) 内容保留（无幻觉），(b) 语言正确，(c) 语气/礼貌程度匹配，(d) 术语与词汇表（如有提供）一致，(e) 无截断或长度爆炸。
3. 一个特定领域的问题要探查。例如，法律领域：命名实体和法规引证。医学领域：药物名称和剂量。用户界面：占位符变量 `{name}`。
4. 置信度标志。“可发布”/“审阅后发布”/“不可发布”。与步骤2中发现问题的严重程度挂钩。

若输出未通过语言ID检查，则拒绝发布。若无参考译文，除非用户明确选择无参考评分（COMET-QE、BLEURT-QE），否则拒绝评估。任何超过1000 token的内容应标记为可能需要分块翻译。
```

## 练习

1. **简单。** 使用`nllb-200-distilled-600M`将一个5句英文段落翻译成法语再翻译回英文。测量往返翻译与原文的接近程度。你应该会看到语义保留但词汇选择漂移。
2. **中等。** 使用`fasttext lid.176`或`langdetect`在翻译输出上实现语言ID检查。将其集成到MT调用中，以便在返回前捕获脱离目标语言的生成结果。
3. **困难。** 在你选择的5000对领域语料上微调`nllb-200-distilled-600M`。测量微调前后在保留集上的BLEU值。报告哪些类型的句子得到了改善，哪些类型出现了退化。

## 关键术语

| 术语 | 大家常说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| BLEU | 翻译分数 | 带简洁惩罚的n-gram精度。取值范围[0, 100]。 |
| chrF | 字符级F值 | 字符级F值。对形态丰富的语言更敏感。 |
| NMT | 神经机器翻译 | 在平行文本上训练的Transformer编码器-解码器。2017年后的默认范式。 |
| NLLB | 不让任何语言掉队 | Meta的200语言MT模型系列。 |
| 约束解码（Constrained decoding） | 受控输出 | 强制特定token或n-gram在输出中出现/不出现。 |
| 幻觉（Hallucination） | 虚构内容 | 模型输出中源文不支持的内容。 |

## 延伸阅读

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) —— NLLB论文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) —— 为何`sacrebleu`是报告BLEU的唯一正确方式。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) —— chrF论文。
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) —— 实用的微调教程。