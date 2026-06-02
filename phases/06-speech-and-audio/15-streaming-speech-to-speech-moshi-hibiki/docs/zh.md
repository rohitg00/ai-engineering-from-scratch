# 流式语音到语音 —— Moshi、Hibiki 与全双工对话

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2024-2026 年重新定义了语音 AI。Moshi 用一个模型同时听和说，延迟 200 ms。Hibiki 把语音到语音翻译做成逐 chunk 流式。两者都抛弃了 ASR → LLM → TTS 流水线，转而用一个建立在 Mimi codec token 之上的统一全双工架构。这就是新的参考设计。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题（The Problem）

按 Lesson 11 + 12 那种思路搭出来的语音 agent，都有一个 300-500 ms 左右的延迟下限：VAD 触发、STT 处理、LLM 推理、TTS 生成。每一级都有自己的最低延迟。你可以调参、可以并行，但流水线的形态本身就把上限锁死了。

Moshi（Kyutai，2024-2026）问的是另一个问题：如果根本没有流水线呢？如果一个模型直接把音频吃进去、把音频吐出来，连续不断，文本只作为「内心独白」（inner monologue）的中间表示，而不是必经的一站，会怎样？

答案是 **全双工语音到语音（full-duplex speech-to-speech）**。理论延迟 160 ms（80 ms 的 Mimi 帧 + 80 ms 的声学延迟）。在单张 L4 GPU 上的实测延迟 200 ms。差不多是同级别流水线语音 agent 的一半。

## 概念（The Concept）

![Moshi 架构：两条平行的 Mimi 流 + 内心独白文本](../assets/moshi-hibiki.svg)

### Moshi 架构（The Moshi architecture）

**输入。** 两条 Mimi codec 流，都是 12.5 Hz × 8 个 codebook：

- 流 1：用户音频（Mimi 编码后，持续到达）
- 流 2：Moshi 自己的音频（由 Moshi 生成）

**Transformer。** 一个 7B 参数的 Temporal Transformer 同时处理两条音频流加一条文本「内心独白」流。在每个 80 ms 步上，它会：

1. 吃掉最新的用户 Mimi token（8 个 codebook）。
2. 吃掉最近的 Moshi Mimi token（8 个 codebook，刚生成出来的）。
3. 生成下一个 Moshi 文本 token（内心独白）。
4. 通过一个小的 Depth Transformer 生成下一组 Moshi Mimi token（8 个 codebook）。

三条流 —— 用户音频、Moshi 音频、Moshi 文本 —— 是并行跑的。Moshi 可以一边说一边听用户；用户打断时它能打断自己；可以做 back-channel（「嗯嗯」）而不打断主话。

**Depth transformer。** 一帧之内，8 个 codebook 不是并行预测的 —— 它们之间有 codebook 间依赖。一个小的 2 层「depth transformer」在 80 ms 内顺序预测它们。这是 AR codec LM 的标准分解方式（VALL-E、VibeVoice 也用这个）。

### 为什么内心独白文本有用（Why inner-monologue text helps）

如果不显式给文本，模型就得在声学流里隐式建模语言。Moshi 的洞察是：强迫它在音频之外同时吐出文本 token。这条文本流本质上就是 Moshi 正在说的话的转写。这能改善语义连贯性、方便替换语言模型头，还顺手送你一份转写。

### Hibiki：流式语音到语音翻译（Hibiki: streaming speech-to-speech translation）

同样的架构，用翻译对训练。源语言音频进，目标语言音频出，连续不断。Hibiki-Zero（2026 年 2 月）干掉了对词级对齐训练数据的依赖 —— 只用句级数据 + GRPO 强化学习来做延迟优化。

最初支持四个语言对；适配新语言大约需要 1000 小时数据。

### 更大的 Kyutai 技术栈（The broader Kyutai stack，2026）

- **Moshi** —— 全双工对话（法语优先，英语支持也很好）
- **Hibiki / Hibiki-Zero** —— 同声传译
- **Kyutai STT** —— 流式 ASR（500 ms 或 2.5 s look-ahead）
- **Kyutai Pocket TTS** —— 100M 参数的 TTS，能在 CPU 上跑（2026 年 1 月）
- **Unmute** —— 把上面这些组合起来，跑在公开服务器上的完整流水线

L40S GPU 上的吞吐：64 路并发会话，3× 实时速度。

### Sesame CSM —— 表亲（Sesame CSM — the cousin）

Sesame CSM（2025）用了类似的思路 —— Llama-3 主干配 Mimi codec 头。但 CSM 是单向的（吃 context + 文本，吐语音），不是全双工。它是市面上「voice presence」最好的 TTS；但跟 Moshi 的全双工能力不是一回事。

### 2026 性能数据（2026 performance numbers）

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

## 动手实现（Build It）

### 第 1 步：接口（Step 1: the interface）

Moshi 暴露一个 WebSocket 服务器，吃 80 ms 的 Mimi 编码音频块、吐 80 ms 的 Mimi 编码音频块。双向。持续不断。

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

### 第 2 步：全双工循环（Step 2: the full-duplex loop）

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

两个方向同时跑。Python asyncio 或 Rust futures 是标准传输方式。

### 第 3 步：训练目标（概念性）（Step 3: the training objective (conceptual)）

对于每个 80 ms 帧 `t`：

- 输入：`user_mimi[0..t]`、`moshi_mimi[0..t-1]`、`moshi_text[0..t-1]`
- 预测：`moshi_text[t]`，然后是 `moshi_mimi[t, codebook_0..7]`

文本先于音频预测（内心独白）；音频在 depth transformer 内部按 codebook 顺序预测。

### 第 4 步：Moshi 赢在哪、不赢在哪（Step 4: where Moshi wins and where it doesn't）

Moshi 赢：

- 廉价硬件上端到端低于 250 ms。
- 自然的 back-channel 和打断。
- 没有流水线胶水代码。

Moshi 不赢：

- Tool calling（没为这个训练；你得另起一条 LLM 路径）。
- 长链路推理（Moshi 是个 8B 量级的对话模型，不是 Claude/GPT-4）。
- 小众话题上的事实准确性。
- 大多数生产级企业用例（2026 年仍然在用流水线）。

## 用起来（Use It）

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## 坑（Pitfalls）

- **Tool calling 受限。** Moshi 是对话模型，不是 agent 框架。要工具调用就跟流水线组合用。
- **特定声音条件化。** Moshi 用的是单一训练好的人格；声音克隆是另一轮训练。
- **语言覆盖。** 法语 + 英语效果出色；其他语言有限。Hibiki-Zero 有帮助，但你还是需要训练数据。
- **资源开销。** 一路完整的 Moshi 会话占住一个 GPU 槽位；不是便宜的多租户共享部署模式。

## 上线部署（Ship It）

存为 `outputs/skill-duplex-pipeline.md`。给某个语音 agent 工作负载选择流水线还是全双工架构，并写明理由。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。它用符号方式模拟双流 + 内心独白架构。
2. **中等。** 从 HuggingFace 拉下来 Moshi，跑起服务器，测一段对话。测一下从用户停止说话到 Moshi 开始回应的实际延迟。
3. **困难。** 拿你 Lesson 12 的流水线 agent，跟 Moshi 在 20 条匹配的测试话语上对比 P50 延迟。写下流水线在哪些场景下架构上仍然胜出。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## 延伸阅读（Further Reading）

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2) —— 论文原文。
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) —— 无对齐数据的流式翻译。
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) —— CSM 规格说明。
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) —— 安装 + 服务器。
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) —— 闭源商业对应物。
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) —— 底下的 STT/TTS 框架。
