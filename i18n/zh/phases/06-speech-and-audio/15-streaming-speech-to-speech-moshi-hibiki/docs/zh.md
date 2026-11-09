# 流媒体语音与语音 莫希,希比基和双重对话

> 2024-2026年重新定义了语音AI.莫希发出一个单个模型,可以在200ms延迟同时听和说话.希比基会逐步进行语音翻译.这两个都放弃了ASR → LLM → TTS管道,以实现Mimi代码代码代码的统一全双结构.这是新的参考设计.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题

每个从课11+12构建的语音代理都具有基本的延迟地板约300-500ms:VAD火灾,STT过程,LLM原因,TTS生成.每个阶段都有自己的最低延迟.你可以调和并行,但管道形状限制你.

莫希 (九台,2024-2026) 提出了一个不同的问题:如果没有管道呢?如果一个模型接收了音频并直接,连续地发出音频,文字作为中间的"内在单独话语"而不是所需的阶段呢?

答案是**full-duplex speech-to-speech**理论上的延迟160ms (80ms米米框架 +80ms声响延迟). 实际的延迟200ms在单个L4GPU上. 这就是最好的管道语音代理能实现的一半.

## 概念

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### 莫希建筑

**Inputs.**两条米米编码流,都在12.5Hz × 8编码书:

- 流 1:用户音频 (Mimi编码,不断到达)
- 流2:莫希的声音 (由莫希制作)

**The transformer.**时间变压器处理了两个流和一个文本"内部单独"流.每80ms步骤,它:

1. 消耗最新用户的Mimi代币 (8本代码书).
2. 消耗了最新的Moshi Mimi代币 (8本编码书,如产品).
3. 生成下一个Moshi文本代码 (内部单词).
4. 通过小的深度变压器生成下一个Moshi Mimi代币 (8本代码书).

所有三条流程都运行并行.莫希可以听到用户在说话时;可以打断自己当用户打断;可以反频道 ("mhm") 没有打破其主语句.

**The depth transformer.**在一个框架内,8个代码书不会平行预测.它们具有代码书之间的依赖性.一个小型的2层"深度变压器"在80ms内测序预测它们.这是AR代码 LM的标准因子化 (VALL-E,VibeVoice也使用).

### 为什么内面单词文本有帮助

没有明确的文本,模型必须隐含地模拟语言在声流中.莫希的见解:强迫它与音频一起发射文本代码.文本流基本上是莫希所说的转录.这改善了语义一致性,使更容易更换语言模型头,并免费提供转录.

### 语文:流媒体语文翻译

基比基-零 (Feb 2026) 消除了文字级对齐训练数据的需要. 使用语句级数据 + GRPO强化学习来优化延迟.

首先支持四种语言对;可在1000小时内适应新语言.

### 更多的九泰堆 (2026)

- **Moshi** 双重对话 (首先是法语,英语支持良好)
- **Hibiki / Hibiki-Zero**同时演讲翻译
- **Kyutai STT**流动ASR (500 ms或2.5秒前景)
- **Kyutai Pocket TTS** 100M-param TTS运行在CPU上 (2026年1月)
- **Unmute**将这些数据在公共服务器上结合

在L40SGPU上吞吐量: 64次同时会议,实时3x.

### 芝麻CSM 表哥

芝麻CSM (2025) 使用类似的想法. 一个Llama-3背骨和米米编程头. 但CSM是单向的 (采取文本 + 语文,产生语音) 而不是全双重. 它是市场上最好的"语音存在"TTS; 不和莫希的全双重能力完全相同.

### 2026 年的绩效数字

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## 建立它

### 步骤1:接口

莫希暴露了一个WebSocket服务器,它接收了80毫米的Mimi编码音频,

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

### 步骤2:全双循环

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

两条方向同时运行.  Python 异步或 Rust 期货是标准的运输.

### 步骤3:培训目标 (概念)

每80ms的时间`t`其他:

- 输入:`user_mimi[0..t]`现在`moshi_mimi[0..t-1]`现在`moshi_text[0..t-1]`
- 预测:`moshi_text[t]`现在`moshi_mimi[t, codebook_0..7]`

文字预测在音频之前 (内部单词);音频预测在深度变压器内是代码书序列.

### 步骤4:莫希在哪里赢,在哪里不赢

莫希赢了:

- 在廉价硬件上,Sub-250ms端到端.
- 自然的后通道和中断.
- 没有管道合码.

莫希没有赢得:

- 工具调用 (没有接受培训;你需要单独的LLM途径).
- 长时间推理 (莫希是一个8B式对话模型,而不是克劳德/GPT-4).
- 关于基层主题的事实准确性.
- 大多数生产企业使用案例 (2026年仍使用管道).

## 用它

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## 陷

- **Limited tool calling.**莫希是一个对话模式,而不是代理框架.
- **Specific-voice conditioning.**莫希使用一个训练有素的人物;克隆是一个独立的训练.
- **Language coverage.**汉语+英语是优秀的,其他语言有限.
- **Resource cost.**一个完整的Moshi会话里,有一个GPU插槽,而不是一个便宜的共享租户部署模式.

## 运送它

保存如`outputs/skill-duplex-pipeline.md`选择管道与全双结构来进行语音代理工作,有理由.

## 运动

1. **Easy.**跑步`code/main.py`它象征性地模拟了两流+内格架构.
2. **Medium.**拉出Moshi从HuggingFace,运行服务器,测试一场对话. 从用户结束的语音到Moshi响应的时间.
3. **Hard.**根据20个匹配的测试演示,比较P50延迟与Moshi.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## 进一步阅读

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)报纸.
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345)无线数据的流媒体翻译.
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) CSM规格
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi)安装+服务器.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime)关闭商业同行
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling)罩子下面的STT/TTS框架.
