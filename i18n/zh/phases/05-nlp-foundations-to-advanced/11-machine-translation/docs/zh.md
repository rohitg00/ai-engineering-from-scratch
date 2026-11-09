# 机器翻译

> 翻译是为30年来支付了NLP研究的任务,

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## 问题

一个模型在一个语言中读出句子,并在另一个语言中生成句子.长度不同.词序不同.一些源词的地图为多个目标词和相反.语法拒绝单对单地图.法语中的"我想念你"是"tu me manques"字面上"你是我缺少的".没有单词级的排列可以存活下来.

机器翻译是迫使NLP发明编码解码器,注意力,变换器,最终整个LLM范式的任务.每一步都会进步,因为翻译质量是可测量的,人类和机器之间的差距是固执的.

这一课跳过历史课程,并教导2026年的工作管道:预训练的多语言编码器-解码器 (NLLB-200或 mBART),字体代码化,光束搜索,BLEU和 chrF评估,以及数量未被捕的失败模式.

## 概念

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

现代MT是一个以平行文本训练的变压器编码器-解码器.编码器在语言的标记中读取源头.解码器一次生成目标,一次一个字段,通过跨度注意力 (课10) 使用编码器输出.解码使用光束搜索以避免贪的解码陷.输出被解代,被破坏,并与参考进行分数.

实际的MT质量是由三个操作选择来实现的.

- **Tokenizer.**语句Piece BPE 训练基于混合语言的语文. 语言之间的共享词汇是使NLLB中零射对成为可能的.
- **Model size.**电脑上可以安装NLLB-200蒸600M.NLLB-200 3.3B是公布的生产默认标准.54.5B是研究上限.
- **Decoding.**对于一般内容,光束宽度为4-5; 长度罚款以避免输出太短; 需要语法一致时限制解码.

```figure
seq2seq-alignment
```

## 建立它

### 步骤1:预训练式MT调用

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

这里有三个重要的事情.`src_lang`告诉代币器应使用哪个脚本和细分. `forced_bos_token_id`它们都是NLLB特定的技巧; mBART和M2M-100使用自己的规范,它们不能互换.

### 步骤2:蓝色和色

蓝色测量输出和参考之间的 n-gram重叠.四个参考 n-gram尺寸 (1-4),精度的几何平均值,过短输出的短暂处罚. 积分在 [0, 100].通常使用. 解释时令人丧: 30 蓝色是"可用"; 40 是"好"; 50 是"例外"; 1 蓝色的差异是噪音.

chrF测量字符级F分. 对于蓝色字母不足的语言更敏感. 通常与蓝色字母一起报告.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

总是使用`sacrebleu`通过将自己的蓝色计算进行调整,误导性基准会发生.

### 三层次评估层次 (2026)

现代MT评估使用了三个互补的指标组.

- **Heuristic**快速,基于参考,可解释,对抛词无关.用于传统的比较和回归检测.
- **Learned**根据人类判断训练的神经模型;对译文与源和参考的语义相似性进行比较.自2023年以来,COMET与MT研究有着最高的关联,在质量方面是2026年生产默认.
- **LLM-as-judge**提供一个大型模型,以评分翻译的流利性,足够性,语调,文化适用性.GPT-4作为法官与人同意相匹配~80%的时间,当标题设计得很好.在没有引用的情况下,用于开放式内容.

实际的2026堆:`sacrebleu`对于BLEU和chRF,`unbabel-comet`在依靠生产数据之前,将每一个指标与50-100个标记的人类示例进行校准.

没有引用的指标 (COMET-QE,BLEURT-QE,LLM-as-judge) 允许您评估没有引用的翻译,这对于没有引用翻译的长尾语言对象是重要的.

### 步骤3:生产中什么断

上面的工作管道将在80%的时间流动地翻译,剩余20%的时间默默地失败.

- **Hallucination.**模型发明内容不存在源头.在未熟悉的域词汇中很常见. 症状:输出流动,但声称来源没有声明的事实. 缓解:域名术语上的限制解码,监管的内容的人类审查,输出的监测时间远远超过输入.
- **Off-target generation.**模特翻译成错误的语言.NLLB在罕见的语言对象上有惊人的倾向.`forced_bos_token_id`并且总是使用语言ID模型检查输出.
- **Terminology drift.**"登录"成为doc1中的"s'inscribe"和doc2中的"creer un compte".对于UI文本和面向用户的字符串,一致性比原始质量更重要.减轻:词典限制式解码或后编辑词典.
- **Formality mismatch.**简单的"你"与"你"的法语,日本礼貌水平.模型选择了训练中最常见的形式.对于面向客户的内容,这通常是错误的.减轻:提示前,如果模型支持它,或在正式的体验中调整一个小模型.
- **Length explosion on short input.**非常短的输入句子通常产生过长的翻译,因为长度罚款落在源代币低于5个悬崖.减轻:硬最大长度盖相对应于源长度.

### 步骤4:为域进行细节调整

预训练的模型是一般主义者. 法律,医学或游戏对话翻译可以通过对域的并行数据进行微调来得到相当大的好处.

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

几千个高质量的平行例子比几百万个有噪音的网页剪辑比较高.

## 用它

对于MT的2026年生产堆:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

现在,从2026年开始,LLM在几种语言对上超过了专业的MT模型,特别是在语法内容和长文本上.交易是每代币成本和延迟.当环境长度,风格一致性或域名适应性通过提示问题超过吞吐量时选择LLM.

## 运送它

保存如`outputs/skill-mt-evaluator.md`其他:

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

## 运动

1. **Easy.**通过使用 翻译5句的英语段落到法语,然后再转到英语`nllb-200-distilled-600M`测量回路与原始的距离. 你应该看到语义保存与词选择漂移.
2. **Medium.**通过使用 `fasttext lid.176`或`langdetect`集成到MT调用中,以便在返回之前,
3. **Hard.**精细调节`nllb-200-distilled-600M`在您选择的5000对域名体内测量BLEEU在细调之前和后的延长集.报告哪些句子改善了,哪些退缩.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## 进一步阅读

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672)NLLB论文.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/)为什么`sacrebleu`报告 BLEU的唯一正确方式.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/)   纸
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation)实用细调步行.
