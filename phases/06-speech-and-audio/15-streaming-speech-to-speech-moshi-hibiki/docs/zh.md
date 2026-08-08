# 流媒体语音对语音- Moshi、Hibiki和Full Duplex对话

> 2024-2026年重新定义语音人工智能。Moshi推出了一款能够以200 ms延迟同时收听和讲话的单一型号。Hibiki逐块进行语音到语音翻译。两者都放弃了SVR、LLM、DTS管道，转而采用Mimi编解码器令牌上的统一的全速架构。这是新的参考设计。

** 类型：** 学习
** 语言：** Python
** 预设：** Phase 6 · 13（神经音频编解码器）、Phase 6 · 11（实时音频）、Phase 7 · 05（全Transformer）
** 时间：** ~75分钟

## 问题

根据第11 + 12课构建的每个语音代理的基本延迟下限约为300-500 ms：VAR触发、STT过程、LLM原因、TTC生成。每个阶段都有自己的最小延迟。您可以调整和平行化，但管道形状会限制您。

Moshi（Kyutai，2024-2026）提出了一个不同的问题：如果没有管道怎么办？如果一个模型直接、连续地接收音频并发出音频，并将文本作为中间的“内心独白”而不是所需的阶段，该怎么办？

答案是 ** 全速语音到语音 **。理论延迟160 ms（80 ms Mimi帧+ 80 ms声学延迟）。单个L4图形处理器上的实际延迟为200 ms。这是一流的流水线语音代理所实现的一半。

## 概念

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### 莫希建筑

** 输入。**两个Mimi编解码器流，均为12.5 Hz x 8码本：

- 流1：用户音频（Mimi编码，不断到达）
- 流2：Moshi自己的音频（由Moshi生成）

** Transformer。** 7 B参数Temporal Transformer处理流和文本“内部独白”流。每80 ms步，它：

1. 消耗最新用户Mimi代币（8个代码本）。
2. 使用最新的Moshi Mimi代币（8个代码本，已制作）。
3. 生成下一个Moshi文本标记（内部独白）。
4. 生成下一个Moshi Mimi代币（通过小型深度Transformer生成8个代码本）。

所有三个流--用户音频、Moshi音频、Moshi文本--并行运行。Moshi可以在说话时听到用户的声音;可以在用户中断时中断自己;可以反向传输（“mhm”）而不中断其主要话语。

** 深度Transformer。**在一个帧内，8个码本不是并行预测的-它们具有码本间依赖性。一个小型的2层“深度Transformer”在80 ms内顺序预测它们。这是AR编解码器LM的标准因子分解（也被WAL-E、VibeVoice使用）。

### 为什么内心独白文本有帮助

如果没有显式文本，模型必须隐式地建模其声学流中的语言。Moshi的见解：迫使它与音频一起发出文本标记。文本流本质上是莫希所说的文字记录。这提高了语义连贯性，使更换语言模型头部变得更容易，并免费为您提供成绩单。

### Hibiki：流语音到语音翻译

相同的架构，在翻译对上训练。连续输入源音频，输出目标语言音频。Hibiki-Zero（2026年2月）消除了对单词级对齐训练数据的需要-使用队列级数据+ GRPO强化学习进行延迟优化。

最初支持四种语言对;可以在1000小时内适应新语言。

### 更广泛的京都堆栈（2026）

- **Moshi** -复式对话（法语优先，英语支持良好）
- **Hibiki / Hibiki-Zero** -同声传译
- **Kyutai STT** -流媒体SVR（500 ms或2.5 s前瞻）
- **Kyutai袖珍TTC ** -100 M-param TTC在中央处理器上运行（2026年1月）
- ** 取消静音 ** -在公共服务器上结合这些内容的完整管道

在L40 S图形处理器上放置：64个并发会话，3倍实时。

### 芝麻CSM -表弟

Sesame CSM（2025）使用了类似的想法-带有Mimi编解码器头的Llama-3主干。但CSM是单向的（接受上下文+文本，产生语音）而不是全速的。这是市场上最好的“语音存在”TTC;与Moshi的全速能力不太相同。

### 2026年业绩数据

| 模型 | 延迟 | 用例 | 许可证 |
|-------|---------|----------|---------|
| Moshi | 200 ms（L4） | 全日制英语/法语对话 | CC-BY 4.0 |
| Hibiki | 12.5赫兹帧速率 | 法语参与英语流媒体翻译 | CC-BY 4.0 |
| 日比基零 | 相同 | 5种语言对，没有对齐的数据 | CC-BY 4.0 |
| 芝麻CSM-1B | 200 ms TTFA | 上下文条件的TTC | Apache-2.0 |
| GPT-4 o实时 | ~300 ms | 关闭的OpenAI API | 商业 |
| 双子座2.5直播 | ~350 ms | 已关闭，Google API | 商业 |

## 建设党

### 第1步：界面

Moshi公开了一个Webocket服务器，该服务器获取80 ms的Mimi编码音频块，并返回80 ms的Mimi编码音频块。两种方式。不断.

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### 第2步：全速循环

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

两个方向同时运行。Python cio或Rust期货是标准运输。

### 第3步：培训目标（概念性）

对于每80 ms帧‘t’：

- 输入：' user_mimi[0.. t]'，' moshi_mimi[0.. t-1]'，' moshi_text[0.. t-1]'
- 预测：`moshi_text[t]`，然后`moshi_mimi[t，codebook_0.. 7]`

文本在音频之前预测（内部独白）;音频在深度Transformer内按码本顺序预测。

### 第4步：莫希在哪里获胜，在哪里失败

莫希获胜：

- 在廉价硬件上实现低于250 ms的端到端。
- 自然的秘密渠道和干扰。
- 没有管道粘合代码。

莫希没有获胜：

- 工具调用（未经培训;您需要单独的LLM路径）。
- 冗长的推理（Moshi是8B式对话模型，而不是Claude/GPT-4）。
- 利基主题的事实准确性。
- 大多数生产企业用例（2026年仍使用管道）。

## 使用它

| 情况 | 接 |
|-----------|------|
| 最低延迟语音伴侣 | Moshi |
| 实时翻译电话 | Hibiki |
| 语音演示/研究 | Moshi，CSM |
| 带工具的企业代理 | 管道（第12课），而不是莫希 |
| 上下文中的自定义语音TTC | 芝麻CSM |
| 语音对语音，任何语言 | GPT-4 o实时或Gemini 2.5实时（商业） |

## 陷阱

- ** 工具调用有限。** Moshi是一个对话模型，而不是一个代理框架。与工具管道结合。
- ** 特定的声音条件反射。** Moshi使用一个经过训练的角色;克隆是一个单独的训练运行。
- ** 语言覆盖。**法语+英语很好;其他有限。Hibiki-Zero有所帮助，但您仍然需要训练数据。
- ** 资源成本。**完整的Moshi会话包含一个图形处理器插槽;而不是廉价的共享租户部署模式。

## 把它运

另存为“输出/skill-duplex-pipeline.md”。对于语音代理工作负载来说，选择管道与双环架构是有道理的。

## 演习

1. ** 简单。**运行'代码/main.py '。它象征性地模拟了两流+内心独白的架构。
2. ** 中等。**从HuggingFace中提取Moshi，运行服务器，测试一次对话。测量从用户语音结束到Moshi响应开始的时钟延迟。
3. ** 很难。**使用您的第12课管道代理，在20个匹配的测试话语上比较P50延迟与Moshi的延迟。无论如何，无论如何，管道何时在架构上获胜。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 全双工 | 一听即说 | 同一型号上同时活动两个音频流。 |
| 内心独白 | 模型的文本流 | Moshi在音频输出的同时发射文本标记。 |
| 深度Transformer | 码本间预测器 | 小型Transformer，可在一个80 ms帧内预测8个码本。 |
| 咪咪 | Kyutai编解码器 | 12.5 Hz x 8码本;语义+声学;动力Moshi。 |
| 流媒体S2 S | 音频→音频直播 | 逐块翻译/对话，没有管道阶段。 |
| 背后渠道 | “嗯”的反应 | 莫希可以在不打断转身的情况下发出小小的认可。 |

## 进一步阅读

- [Défossez等人（2024）。Moshi -语音文本基础模型]（https：//arxiv.org/html/2410.00037v2）-论文。
- [Kyutai Labs（2026）。Hibiki-Zero]（https：//arxiv.org/abs/2602.12345）-没有对齐数据的流传输翻译。
- [芝麻（2025）。穿越声音的恐怖山谷]（https：//www.sesame.com/research/crossing_the_uncanny_valley_of_voice）- CSM规范。
- [Kyutai - Moshi repo]（https：//github.com/kyutai-labs/moshi）- install + server.
- [OpenAI - Realtime API]（https：//platform.openai.com/docs/guides/realtime）-封闭的商业同行。
- [Kyutai - Delayed Streams Modeling]（https：//github.com/kyutai-labs/delayed-streams-modeling）-STT/TTS框架。
