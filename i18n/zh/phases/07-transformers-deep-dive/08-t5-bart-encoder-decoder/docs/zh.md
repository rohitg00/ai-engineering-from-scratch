# 编码器-解码器模型

> 编码器理解.编码器生成.把它们重新组合起来,你就能为输入 →输出任务构建模型:翻译,总结,重写,转录.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## 问题

只有解码器的GPT和只有编码器的BERT每个都为不同的目标而沿着2017年的架构.

- 翻译:英语 → 法语.
- 总结:5000个标记文章 →200个标记总结.
- 语音识别:音频代码 →文字代码.
- 结构化提取:散文 → JSON.

编码器生成出口,在每一步都会交叉地关注该表示.训练在输出侧进行一个接一个.与GPT相同的损失,只是根据编码器输出条件.

现代游戏书的定义是两篇论文:

1. **T5**"文本转移变换器".每一个NLP任务都被重构为文本输入,文本输出.单个架构,单个词汇库,单个损失.预训练在面具跨度预测 (输入中的腐败跨度,输出中解码它们).
2. **BART**"双向和自动回归变压器". 否认自动编码器:通过多种方式 (混动,掩盖,删除,旋转) 破坏输入,请解码器重建原始.

在2026年,编码器-解码器格式将继续存在输入结构的重要位置:

- 语 (语音 →文字).
- 谷歌的翻译堆.
- 一些代码完成/修复模型具有不同的文本和编辑结构.
- 结构性推理任务的Flan-T5和变体.

只有解码器赢得了关注点,但解码器从来没有消失.

## 概念

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### 进而循环

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

重要的是,编码器每输入一次运行.解码器运行自动降低式,但在每一步都会交叉处理 *相同*编码器输出.缓存编码器输出是长输入的免费加快.

###        

选择输入的随机跨度 (平均长度3个代币,总数为15%). 替换每个跨度一个独特的哨兵:`<extra_id_0>`现在`<extra_id_1>`解码器只输出了被破坏的跨度,

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

具有竞争力,与MLM (BERT) 和前LM (UniLM) 在T5纸的缩.

### 多噪音排斥

音系统试验了五种噪音功能:

1. 标志掩盖.
2. 删除代码.
3. 填写文字 (掩盖一个跨度,解码器插入了正确的长度).
4. 换句话变化.
5. 文件转换.

结合文本填写+句子变换产生了最佳下游数字.解码器总是重建原始.BART的输出是完整的序列,而不仅仅是损坏的跨度,因此预训计算高于T5.

### 推理

采用GPT的相同的自动降低性生成. 贪/束/顶部采样应用.束搜索 (45) 是翻译和总结的标准,因为输出分布比聊天更窄.

### 2026年,每种变体何时选择

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

自2022年以来的趋势:仅解码器接管了以前拥有的任务,因为 (a) 通过提示将指示调节的仅解码器LLM将其通用到任何东西, (b) 一个架构比两种更容易, (c) RLHF假设一个解码器. 编码器-解码器在输入方式不同的地方 (演讲,图像) 或光束搜索质量在哪里有意义.

```figure
encoder-decoder
```

## 建立它

看到`code/main.py`我们将T5式的跨度腐败用于玩具体,这是这个课程中最有用的单一部分,因为它显示在每一个编码器-解码器预训练配方.

### 步骤1:跨度腐败

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目标格式是T5公约: `<sent0> span0 <sent1> span1 ...`损坏的输入将未变的代币与守望器代币交换到跨度位置.

### 步骤2:检查回路

鉴于被破坏的输入和目标,重建原始句子.如果你的腐败是可逆的,前进通过是很清楚的.这是一个智力检查真正的训练从来没有这样做,但测试是便宜的,并捕获你的跨度账本中的一个-一个错误.

### 步骤3:BART噪音

五个功能:`token_mask`现在`token_delete`现在`text_infill`现在`sentence_permute`现在`document_rotate`两种组合,然后显示结果.

## 用它

抱脸的参考:

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

任务名称进入输入文本.同样的模型处理数十项任务,因为每个任务都是输入和输出. 2026年,该模式已被指令调节的单独解码器模型普遍化,但T5先编码了它.

## 运送它

看到`outputs/skill-seq2seq-picker.md`技能选择编码器-解码器和解码器-仅用于新任务,因为输入输出结构,延迟和质量目标.

## 运动

1. **Easy.**跑步`code/main.py`检查是否将非传密源代币与解码目标代码连接,复制原始.
2. **Medium.**实施BART的方案`text_infill`噪音:用单个取代随机度`<mask>`解码器必须推断正确的跨度长度加上内容.
3. **Hard.**精细调节`flan-t5-small`在一个微小的英语 →猪拉丁体 (200对). 测量蓝色在一个持久的50对的集. 进行比较与细调`Llama-3.2-1B`根据相同的数据,使用相同的计算.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## 进一步阅读

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683)T5
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461)  
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) 飞行器T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) 语,可谓的2026代码器-解码器.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py)参考实施.
