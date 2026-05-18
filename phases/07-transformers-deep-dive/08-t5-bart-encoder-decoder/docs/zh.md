# T5, BART — Encoder-Decoder Models

> 编码器理解。解码器生成。将它们重新放在一起，您就会得到一个为输入-输出任务构建的模型：翻译、总结、重写、转录。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 7 · 05期（全Transformer）、7 · 06期（BERT）、7 · 07期（GPT）
** 时间：** ~45分钟

## The Problem

仅限解码器的GPT和仅限编码器的BERT都为了不同的目标而剥离了2017年的架构。但许多任务自然是输入-输出：

- 翻译：英语→法语。
- 摘要：5，000个代币文章| 200个代币摘要。
- 语音识别：音频令牌→文本令牌。
- 结构化提取：散文→杨森。

对于这些，编码器-解码器是最完美的选择。编码器生成源的密集表示。解码器生成输出，并在每一步交叉关注该表示。训练在输出端是逐班进行的。与GPT相同的损失，仅取决于编码器输出。

两篇论文定义了现代剧本：

1. **T5**（拉菲尔等人2019）。“文本到文本传输Transformer。“每个NLP任务都被重新定义为文本输入、文本输出。单一架构，单一词汇，单一损失。预先训练屏蔽跨度预测（输入中的跨度损坏，在输出中解码它们）。
2. **BART**（Lewis等人2019）。双向和自回归Transformer。“去噪自动编码器：以多种方式损坏输入（洗牌、屏蔽、删除、旋转），要求解码器重建原始输入。

2026年，编码器-解码器格式将取决于输入结构的重要性：

- 低语（语音-文本）。
- Google的翻译堆栈。
- 一些具有不同上下文和编辑结构的代码完成/修复模型。
- Flan-T5和结构化推理任务的变体。

仅解码器赢得了聚光灯，但编码器-解码器从未消失。

## The Concept

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### The forward loop

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

关键的是，编码器对每个输入运行一次。解码器以自回归方式运行，但在每一步都交叉关注 * 相同 * 的编码器输出。缓存编码器输出对于长输入来说是一种免费的加速。

### T5 pretraining — span corruption

选择输入的随机跨度（平均长度3个令牌，总数15%）。用唯一的sentinel替换每个跨度：&#39;<extra_id_0>、&#39;<extra_id_1>等。解码器仅输出带有sentinel前置的损坏跨度：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

比预测整个序列更便宜的信号。在T5纸的消融方面与MLM（BERT）和prefix-LM（UniLM）具有竞争力。

### BART pretraining — multi-noise denoising

BART尝试五种降噪功能：

1. 代币屏蔽。
2. 令牌删除。
3. 文本填充（屏蔽跨度，解码器插入正确长度）。
4. 句子排列。
5. 文档轮换。

结合文本填充+句子排列产生了最好的下游数字。解码器总是重建原始内容。BART的输出是完整序列，而不仅仅是损坏的跨度-因此预训练计算高于T5。

### Inference

与GPT相同的自回归生成。贪婪/ beam / top-p采样适用。Beam搜索（宽度4-5）是翻译和总结的标准，因为输出分布比聊天更窄。

### When to pick each variant in 2026

| 任务 | 编码器-解码器？ | 为什么 |
|------|------------------|-----|
| 翻译 | 是的，通常 | 清晰的源序列;固定的输出分布;波束搜索工作 |
| Speech-to-text | 是的（低语） | 输入形态与输出不同;编码器塑造音频特征 |
| 聊天/推理 | 不，仅限解码器 | 没有持续的“输入”-对话就是序列 |
| 代码完成 | 通常没有 | 仅限解码器，长上下文获胜; Qwen 2.5 Coder等代码模型仅限解码器 |
| 总结 | 要么工作 | BART、PEGASUS击败了早期的仅解码器基线;现代仅解码器的LLM与它们相匹配 |
| 结构化提取 | 要么 | T5是干净的，因为“text → text”吸收了任何输出格式 |

自2022年以来的趋势：仅解码器接管编码器-解码器曾经拥有的任务，因为（a）经过描述调谐的仅解码器LLM通过提示推广到任何内容，（b）一种架构比两种架构更容易扩展，（c）RL HF假设解码器。编码器-解码器保留输入方式不同的地方（语音、图像）或束搜索质量重要的地方。

## Build It

请参阅' code/main.py '。我们为玩具库实现T5风格的跨度腐败--这是本课中最有用的一部分，因为它出现在此后的每个编码器-解码器预训练食谱中。

### Step 1: span corruption

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目标格式是T5惯例：&#39; <sent0>span 0 <sent1>span 1.&#39;。损坏的输入将未改变的令牌与跨度位置的哨兵令牌交织。

### Step 2: verify round-trip

给定已损坏的输入和目标，重建原始句子。如果你的腐败是可逆的，那么向前的传递就明确了。这是一次理智检查--真正的培训从来不会做到这一点，但测试很便宜，并且会在您的范围簿记中发现一个错误。

### Step 3: BART noising

五个功能：' token_mat '、' token_select '、' text_infill '、'、'、'、'。合成其中两个并显示结果。

## Use It

HuggingFace参考：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5技巧：任务名称进入输入文本。相同的模型可以处理数十个任务，因为每个任务都是文本输入、文本输出。2026年，这种模式被描述调整的纯解码器模型推广，但T5首先将其编入法典。

## Ship It

请参阅“输出/skill-seq2seq-picker.md”。在给定输入输出结构、延迟和质量目标的情况下，该技能在编码器-解码器和仅解码器之间进行选择。

## Exercises

1. ** 简单。**运行“code/main.py”，将跨度损坏应用于30个令牌的句子，验证将非哨兵源令牌与解码的目标跨度连接是否再现了原始的句子。
2. ** 中等。**实现BART的&#39; text_infill &#39; noise：用单个&#39;令牌替换随机跨度<mask>，解码器必须推断正确的跨度长度加上内容。展示一个例子。
3. ** 很难。**在一个小小的英语-猪-拉丁语文集上微调“flan-t5-small”（200对）。在50对套件上测量BLEU。与使用相同计算对相同数据进行微调“Llama-3.2-1B”进行比较。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 编码器-解码器 | “Seq 2 seq Transformer” | 两个堆栈：用于输入的双向编码器，用于输出的具有交叉注意力的因果解码器。 |
| 交叉注意力 | “消息来源与目标对话” | 解码器的Q ×编码器的K/V。编码器信息进入解码器的唯一位置。 |
| 跨越腐败 | “T5的训练前技巧” | 用哨兵令牌替换随机跨度;解码器输出跨度。 |
| 降噪目标 | “BART的游戏” | 对输入应用噪音函数，训练解码器重建干净序列。 |
| 哨兵代币 | “‘<extra_id_N>占位符’” | 标记已损坏的特殊令牌跨越源，并在目标中重新标记它们。 |
| Flan | “指令调整的T5” | T5对超过1，800个任务进行了微调;使编码器-解码器在描述跟踪方面具有竞争力。 |
| 波束搜索 | “解码策略” | 在每个步骤中保留前k部分序列;翻译/总结的标准。 |
| 老师强迫 | “训练时间输入” | 在训练期间，将真实的先前输出令牌（而不是采样的令牌）反馈给解码器。 |

## Further Reading

- [Raffel et al.（2019）.使用统一的文本到文本Transformer探索迁移学习的局限性]（https：//arxiv.org/ab/1910.10683）- T5。
- [刘易斯等人（2019）。BART：消除自然语言生成、翻译和理解的序列到序列预训练]（https：//arxiv.org/ab/1910.13461）-BART。
- [Chung等人（2022）。缩放指令-Finetuned语言模型]（https：//arxiv.org/ab/2210.11416）- Flan-T5。
- [雷德福等人（2022）。通过大规模弱监督实现稳健语音识别]（https：//arxiv.org/ab/2212.04356）- Whisper，2026年经典编码器-解码器。
- [HuggingFace ' modeling_t5.py ']（https：//github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py）-参考实现。
