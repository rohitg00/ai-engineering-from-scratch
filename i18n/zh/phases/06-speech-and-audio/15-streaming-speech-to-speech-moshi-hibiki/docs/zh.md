# 流式语音到语音 — Moshi、Hibiki 与全双工对话

> 2024-2026 年重新定义了语音 AI。Moshi 推出了一个单一模型，可以同时听和说，延迟仅 200 ms。Hibiki 逐块进行语音到语音翻译。两者都抛弃了 ASR → LLM → TTS 的流水线，改用基于 Mimi 编解码器 token 的统一全双工架构。这是新的参考设计。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 13(神经音频编解码器)、Phase 6 · 11(实时音频)、Phase 7 · 05(完整 Transformer)
**Time:** 约 75 分钟

## 问题所在

由第 11 课和第 12 课构建的每一个语音智能体都有一个约 300-500 ms 的根本性延迟下限：VAD 触发、STT 处理、LLM 推理、TTS 生成。每个阶段都有其自身的最小延迟。你可以调优和并行化，但流水线的形态限制了你的上限。

Moshi(Kyutai,2024-2026)提出了一个不同的问题：如果没有流水线会怎样？如果一个模型直接、持续地将音频输入并输出音频，而文本只是作为中间的“内心独白”而非必需的环节，会怎样？

答案是**全双工语音到语音**。理论延迟 160 ms(80 ms Mimi 帧 + 80 ms 声学延迟)。实际延迟在单块 L4 GPU 上为 200 ms。这是一流的流水线式语音智能体所能达到的一半。

## 核心概念

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### Moshi 架构

**输入。** 两个 Mimi 编解码器流，均为 12.5 Hz × 8 个 codebook:

- 流 1:用户音频(Mimi 编码，持续到达)
- 流 2:Moshi 自身的音频(由 Moshi 生成)

**Transformer。** 一个 7B 参数的 Temporal Transformer 处理这两个流以及一个文本“内心独白”流。在每 80 ms 一步中，它：

1. 消费最新的用户 Mimi token(8 个 codebook)。
2. 消费最近的 Moshi Mimi token(8 个 codebook,按生成顺序)。
3. 生成下一个 Moshi 文本 token(内心独白)。
4. 生成下一组 Moshi Mimi token(通过一个小型 Depth Transformer 生成 8 个 codebook)。

所有三个流——用户音频、Moshi 音频、Moshi 文本——并行运行。Moshi 可以在说话的同时听用户说话；可以在用户打断时打断自己；可以在不中断主要话语的情况下进行附和(“嗯哼”)。

**深度 transformer。** 在一帧内，8 个 codebook 并非并行预测——它们存在 inter-codebook 依赖关系。一个仅有 2 层的小型“深度 transformer”在 80 ms 内按顺序预测它们。这是 AR 编解码器语言模型的标准分解方式(VALL-E、VibeVoice 也使用此方法)。

### 为什么内心独白文本有帮助

如果没有显式文本，模型必须在声学流中隐式地建模语言。Moshi 的洞察是：强制它在输出音频的同时输出文本 token。文本流本质上就是 Moshi 所说内容的转写。这提高了语义连贯性，使替换语言模型头变得更容易，还免费为你提供了转写文本。

### Hibiki:流式语音到语音翻译

相同的架构，用翻译配对数据训练。源音频输入，目标语言音频输出，持续进行。Hibiki-Zero(2026 年 2 月)消除了对词级对齐训练数据的需求——使用句子级数据 + GRPO 强化学习进行延迟优化。

最初支持四个语言对；可通过约 1000 小时数据适配新语言。

### 更广泛的 Kyutai 技术栈(2026)

- **Moshi** — 全双工对话(法语优先，英语支持良好)
- **Hibiki / Hibiki-Zero** — 同声传译
- **Kyutai STT** — 流式 ASR(500 ms 或 2.5 s 前瞻)
- **Kyutai Pocket TTS** — 100M 参数的 TTS 可在 CPU 上运行(2026 年 1 月)
- **Unmute** — 在公共服务器上组合这些组件的完整流水线

L40S GPU 上的吞吐量：3 倍实时速度下支持 64 个并发会话。

### Sesame CSM — 表亲

Sesame CSM(2025)采用了类似的想法——以 Llama-3 为骨干，搭配 Mimi 编解码器头。但 CSM 是单向的(接收上下文 + 文本，生成语音)，而非全双工。它是市面上最好的“语音临场感” TTS;但与 Moshi 的全双工能力并不完全相同。

### 2026 年性能数据

| 模型 | 延迟 | 用例 | 许可证 |
|-------|---------|----------|---------|
| Moshi | 200 ms(L4) | 全双工英语/法语对话 | CC-BY 4.0 |
| Hibiki | 12.5 Hz 帧率 | 法语 ↔ 英语流式翻译 | CC-BY 4.0 |
| Hibiki-Zero | 相同 | 5 个语言对，无需对齐数据 | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | 上下文条件 TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | 封闭，OpenAI API | 商业 |
| Gemini 2.5 Live | ~350 ms | 封闭，Google API | 商业 |

```figure
sp-fullduplex
```

## 动手构建

### 步骤 1:接口

Moshi 提供了一个 WebSocket 服务器，接收 80 ms 的 Mimi 编码音频块，并返回 80 ms 的 Mimi 编码音频块。双向。持续进行。

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

### 步骤 2:全双工循环

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

两个方向同时运行。Python asyncio 或 Rust futures 是标准的传输方式。

### 步骤 3:训练目标(概念性)

对于每个 80 ms 帧 `t`:

- 输入：`user_mimi[0..t]`、`moshi_mimi[0..t-1]`、`moshi_text[0..t-1]`
- 预测：先 `moshi_text[t]`,然后 `moshi_mimi[t, codebook_0..7]`

文本在音频之前预测(内心独白)；音频在深度 transformer 内按 codebook 顺序预测。

### 步骤 4:Moshi 的优势与不足

Moshi 的优势：

- 在廉价硬件上实现低于 250 ms 的端到端延迟。
- 自然的附和与打断。
- 无需流水线胶水代码。

Moshi 的不足：

- 工具调用(未为此训练；你需要单独的 LLM 路径)。
- 长推理(Moshi 是一个约 8B 的对话模型，不是 Claude/GPT-4)。
- 小众主题的事实准确性。
- 大多数生产级企业用例(2026 年仍使用流水线)。

## 如何选用

| 场景 | 选择 |
|-----------|------|
| 最低延迟语音陪伴 | Moshi |
| 实时翻译通话 | Hibiki |
| 语音演示 / 研究 | Moshi、CSM |
| 带工具的企业智能体 | 流水线(第 12 课)，而非 Moshi |
| 上下文中的定制语音 TTS | Sesame CSM |
| 语音到语音，任意语言 | GPT-4o Realtime 或 Gemini 2.5 Live(商业) |

## 陷阱

- **工具调用能力有限。** Moshi 是对话模型，不是智能体框架。需要工具时与流水线结合使用。
- **特定语音条件化。** Moshi 使用单一的训练人格；克隆需要单独的训练运行。
- **语言覆盖。** 法语 + 英语表现出色；其他语言有限。Hibiki-Zero 有所帮助，但你仍然需要训练数据。
- **资源成本。** 一个完整的 Moshi 会话占用一个 GPU 槽位；不是廉价的共享多租户部署模式。

## 发布实践

保存为 `outputs/skill-duplex-pipeline.md`。针对某个语音智能体工作负载，在流水线与全双工架构之间做出选择，并说明理由。

## 练习

1. **简单。** 运行 `code/main.py`。它以符号方式模拟双流 + 内心独白架构。
2. **中等。** 从 HuggingFace 拉取 Moshi,运行服务器，测试一次对话。测量从用户语音结束到 Moshi 响应开始的实际耗时延迟。
3. **困难。** 拿出你的第 12 课流水线智能体，在 20 条匹配的测试语句上与 Moshi 比较 P50 延迟。撰写分析：在什么情况下流水线在架构上仍然胜出。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 全双工 | 同时听和说 | 两个音频流在同一模型上同时活跃。 |
| 内心独白 | 模型的文本流 | Moshi 在输出音频的同时输出文本 token。 |
| 深度 transformer | Inter-codebook 预测器 | 在一个 80 ms 帧内预测 8 个 codebook 的小型 transformer。 |
| Mimi | Kyutai 的编解码器 | 12.5 Hz × 8 个 codebook;语义+声学；驱动 Moshi。 |
| 流式 S2S | 音频 → 音频实时 | 逐块的翻译/对话，没有流水线阶段。 |
| 附和 | “嗯哼”式反应 | Moshi 可以在不中断自己发言的情况下发出简短确认。 |

## 延伸阅读

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2) — 论文。
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) — 无需对齐数据的流式翻译。
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) — CSM 规范。
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) — 安装 + 服务器。
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) — 封闭的商业同类产品。
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) — 底层的 STT/TTS 框架。