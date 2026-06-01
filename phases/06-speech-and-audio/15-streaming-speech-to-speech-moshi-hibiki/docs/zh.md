# 15 · 流式语音到语音——Moshi、Hibiki 与全双工对话

> 2024-2026 年重新定义了语音 AI。Moshi 用单个模型同时实现「听」与「说」，延迟仅 200 ms。Hibiki 则逐块完成语音到语音翻译。两者都抛弃了 ASR → LLM → TTS 的流水线，转而采用基于 Mimi 编解码器（Mimi codec）token 的统一全双工架构。这就是新的参考设计。

**类型：** 学习
**语言：** Python
**前置：** 阶段 6 · 13（神经音频编解码器）、阶段 6 · 11（实时音频）、阶段 7 · 05（完整 Transformer）
**时长：** 约 75 分钟

## 问题所在

凡是基于第 11、12 课构建的语音智能体，都有一个根本性的延迟下限，大约在 300-500 ms：VAD 触发、STT 处理、LLM 推理、TTS 生成。每个阶段都有自己的最小延迟。你可以调优、可以并行化，但流水线的形态本身就给你设了上限。

Moshi（Kyutai，2024-2026）提出了一个不同的问题：如果根本没有流水线呢？如果一个模型直接、连续地输入音频、输出音频，而把文本当作一个中间的「内心独白（inner monologue）」而非必经阶段呢？

答案就是**全双工语音到语音（full-duplex speech-to-speech）**。理论延迟 160 ms（80 ms 的 Mimi 帧 + 80 ms 的声学延迟）。在单块 L4 GPU 上的实际延迟为 200 ms。这只有顶级流水线式语音智能体所能达到延迟的一半。

## 核心概念

〔图：Moshi 架构——两路并行的 Mimi 流 + 内心独白文本流〕

### Moshi 架构

**输入。** 两路 Mimi 编解码器流，均为 12.5 Hz × 8 个码本（codebook）：

- 流 1：用户音频（经 Mimi 编码，持续不断地到达）
- 流 2：Moshi 自身的音频（由 Moshi 生成）

**Transformer。** 一个 70 亿参数的时序 Transformer（Temporal Transformer）同时处理这两路流以及一路文本「内心独白」流。在每个 80 ms 的步进中，它会：

1. 消费最新的用户 Mimi token（8 个码本）。
2. 消费最近生成的 Moshi Mimi token（8 个码本，随产随用）。
3. 生成下一个 Moshi 文本 token（内心独白）。
4. 生成下一批 Moshi Mimi token（通过一个小型深度 Transformer 输出 8 个码本）。

三路流——用户音频、Moshi 音频、Moshi 文本——全部并行运行。Moshi 可以一边说话一边听用户讲；当用户打断时它可以自我中断；它还能在不打断主要话语的情况下发出附和音（「嗯」）。

**深度 Transformer。** 在一帧之内，8 个码本并非并行预测——它们之间存在码本间依赖关系。一个小型的 2 层「深度 Transformer（depth transformer）」在 80 ms 内按顺序逐个预测它们。这是自回归（AR）编解码器语言模型的标准分解方式（VALL-E、VibeVoice 也都采用）。

### 内心独白文本为何有帮助

如果没有显式文本，模型就必须在其声学流中隐式地建模语言。Moshi 的洞见是：强制它在输出音频的同时也输出文本 token。这路文本流本质上就是 Moshi 正在说的内容的转录。这能提升语义连贯性，让替换语言模型头（language model head）变得更容易，还顺带免费给你提供了转录文本。

### Hibiki：流式语音到语音翻译

架构相同，但在翻译对上训练。源语言音频输入，目标语言音频持续输出。Hibiki-Zero（2026 年 2 月）省去了对词级对齐训练数据的需求——它使用句级数据 + GRPO 强化学习来优化延迟。

初期支持四个语言对；只需约 1000 小时数据即可适配到新语言。

### 更广义的 Kyutai 技术栈（2026）

- **Moshi** —— 全双工对话（法语优先，英语支持良好）
- **Hibiki / Hibiki-Zero** —— 同声语音翻译
- **Kyutai STT** —— 流式 ASR（500 ms 或 2.5 s 前瞻）
- **Kyutai Pocket TTS** —— 1 亿参数的 TTS，可在 CPU 上运行（2026 年 1 月）
- **Unmute** —— 在公共服务器上把上述组件整合的完整流水线

在 L40S GPU 上的吞吐：以 3 倍实时速度支持 64 路并发会话。

### Sesame CSM——近亲

Sesame CSM（2025）采用了类似的思路——以 Llama-3 为骨干、配一个 Mimi 编解码器头。但 CSM 是单向的（输入上下文 + 文本，输出语音），而非全双工。它是市面上「语音临场感」最好的 TTS；但并不完全等同于 Moshi 的全双工能力。

### 2026 年性能数据

| 模型 | 延迟 | 用例 | 许可证 |
|-------|---------|----------|---------|
| Moshi | 200 ms（L4） | 全双工英语 / 法语对话 | CC-BY 4.0 |
| Hibiki | 12.5 Hz 帧率 | 法语 ↔ 英语流式翻译 | CC-BY 4.0 |
| Hibiki-Zero | 同上 | 5 个语言对，无需对齐数据 | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | 上下文条件化 TTS | Apache-2.0 |
| GPT-4o Realtime | 约 300 ms | 闭源，OpenAI API | 商用 |
| Gemini 2.5 Live | 约 350 ms | 闭源，Google API | 商用 |

## 动手构建

### 第 1 步：接口

Moshi 暴露一个 WebSocket 服务器，接收 80 ms 一块的 Mimi 编码音频，并返回 80 ms 一块的 Mimi 编码音频。双向。持续不断。

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

### 第 2 步：全双工循环

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

两个方向同时运行。标准传输方式是 Python asyncio 或 Rust futures。

### 第 3 步：训练目标（概念性）

对每个 80 ms 帧 `t`：

- 输入：`user_mimi[0..t]`、`moshi_mimi[0..t-1]`、`moshi_text[0..t-1]`
- 预测：`moshi_text[t]`，然后是 `moshi_mimi[t, codebook_0..7]`

文本先于音频被预测（内心独白）；音频则在深度 Transformer 中按码本顺序逐个预测。

### 第 4 步：Moshi 何处胜出、何处不行

Moshi 的优势：

- 在廉价硬件上实现亚 250 ms 的端到端延迟。
- 自然的附和音与打断。
- 没有流水线胶水代码。

Moshi 不擅长的：

- 工具调用（未针对此训练；你需要单独的 LLM 路径）。
- 长链推理（Moshi 是一个约 80 亿参数级别的对话模型，并非 Claude/GPT-4）。
- 在冷门话题上的事实准确性。
- 大多数生产级企业用例（2026 年仍然使用流水线）。

## 实际运用

| 场景 | 选择 |
|-----------|------|
| 最低延迟的语音陪伴 | Moshi |
| 实时翻译通话 | Hibiki |
| 语音演示 / 研究 | Moshi、CSM |
| 带工具的企业级智能体 | 流水线（第 12 课），而非 Moshi |
| 上下文中的定制音色 TTS | Sesame CSM |
| 任意语言的语音到语音 | GPT-4o Realtime 或 Gemini 2.5 Live（商用） |

## 常见陷阱

- **工具调用有限。** Moshi 是对话模型，不是智能体框架。需要工具时请与流水线结合。
- **特定音色条件化。** Moshi 使用单一的已训练人设；音色克隆需要单独的训练流程。
- **语言覆盖。** 法语 + 英语表现极佳；其他语言有限。Hibiki-Zero 有所帮助，但你仍需要训练数据。
- **资源成本。** 一个完整的 Moshi 会话会占用一个 GPU 槽位；不是那种廉价的共享多租户部署模式。

## 交付成果

保存为 `outputs/skill-duplex-pipeline.md`。为某个语音智能体工作负载在「流水线」与「全双工」架构之间做出选择，并说明理由。

## 练习

1. **简单。** 运行 `code/main.py`。它以符号化的方式模拟了双流 + 内心独白架构。
2. **中等。** 从 HuggingFace 拉取 Moshi，运行服务器，测试一次对话。测量从用户说话结束到 Moshi 开始响应的实际墙钟延迟。
3. **困难。** 拿你第 12 课的流水线智能体，在 20 条匹配的测试话语上对比其 P50 延迟与 Moshi 的延迟。写明在哪些情况下流水线在架构层面上反而胜出。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 全双工（Full-duplex） | 边听边说 | 同一模型上同时活跃着两路音频流。 |
| 内心独白（Inner monologue） | 模型的文本流 | Moshi 在输出音频的同时输出文本 token。 |
| 深度 Transformer（Depth transformer） | 码本间预测器 | 在一个 80 ms 帧内预测 8 个码本的小型 Transformer。 |
| Mimi | Kyutai 的编解码器 | 12.5 Hz × 8 个码本；语义 + 声学；驱动 Moshi。 |
| 流式 S2S（Streaming S2S） | 音频 → 音频，实时 | 逐块翻译/对话，没有流水线阶段。 |
| 附和（Back-channeling） | 「嗯」之类的反应 | Moshi 能在不打断自己回合的情况下发出简短的应答。 |

## 延伸阅读

- [Défossez 等人（2024）。Moshi —— 语音-文本基础模型](https://arxiv.org/html/2410.00037v2) —— 原论文。
- [Kyutai Labs（2026）。Hibiki-Zero](https://arxiv.org/abs/2602.12345) —— 无需对齐数据的流式翻译。
- [Sesame（2025）。跨越语音的恐怖谷](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) —— CSM 规格。
- [Kyutai —— Moshi 仓库](https://github.com/kyutai-labs/moshi) —— 安装 + 服务器。
- [OpenAI —— Realtime API](https://platform.openai.com/docs/guides/realtime) —— 闭源商用同类产品。
- [Kyutai —— Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) —— 底层的 STT/TTS 框架。
