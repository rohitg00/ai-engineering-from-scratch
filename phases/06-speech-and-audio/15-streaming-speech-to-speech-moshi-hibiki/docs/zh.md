# 流式语音到语音 — Moshi、Hibiki 与全双工对话

> 2024–2026 年重塑了语音 AI。Moshi 用一个单一模型实现同时听和说，延迟 200 ms。Hibiki 逐块进行语音到语音翻译。两者都放弃了 ASR → LLM → TTS 流水线，转而采用基于 Mimi 编解码令牌的统一全双工架构。这是新的参考设计。

**类型：** 学习  
**语言：** Python  
**前置知识：** 第 6 阶段 · 13（神经音频编解码器），第 6 阶段 · 11（实时音频），第 7 阶段 · 05（完整 Transformer）  
**预计时间：** ~75 分钟

## 问题所在

从第 11 课和第 12 课构建的任何语音代理都有大约 300-500 ms 的固有时延底线：VAD 触发，STT 处理，LLM 推理，TTS 生成。每个阶段都有其自身的最小延迟。你可以调优和并行化，但流水线的形状限制了上限。

Moshi（Kyutai，2024–2026）提出了一个不同的问题：如果没有流水线会怎样？如果一个模型直接、连续地输入音频并输出音频，将文本作为中间“内心独白”而不是必需阶段？

答案是 **全双工语音到语音**。理论延迟 160 ms（80 ms Mimi 帧 + 80 ms 声学延迟）。在单块 L4 GPU 上实际延迟 200 ms。这是同类最佳流水线语音代理的一半。

## 概念

![Moshi 架构：两条并行 Mimi 流 + 内心独白文本](../assets/moshi-hibiki.svg)

### Moshi 架构

**输入。** 两条 Mimi 编解码流，均为 12.5 Hz × 8 个码本：

- 流 1：用户音频（Mimi 编码，持续到达）
- 流 2：Moshi 自身的音频（由 Moshi 生成）

**Transformer。** 一个 7B 参数的时序 Transformer 同时处理这两个流和一个文本“内心独白”流。在每个 80 ms 步骤中，它：

1. 消耗最新的用户 Mimi 令牌（8 个码本）。
2. 消耗最近的 Moshi Mimi 令牌（8 个码本，按生成顺序）。
3. 生成下一个 Moshi 文本令牌（内心独白）。
4. 生成下一个 Moshi Mimi 令牌（通过一个小型深度 Transformer 生成 8 个码本）。

所有三个流——用户音频、Moshi 音频、Moshi 文本——并行运行。Moshi 可以在说话时听到用户；可以在用户打断时打断自己；可以发出“嗯”之类的回馈而不中断主话语。

**深度 Transformer。** 在一个帧内，8 个码本不是并行预测的——它们之间存在码本间依赖关系。一个小的 2 层“深度 Transformer”在 80 ms 内依次预测它们。这是自回归编解码语言模型的标准分解方式（也用于 VALL-E、VibeVoice）。

### 为什么内心独白文本有帮助

如果没有显式文本，模型必须在其声学流中隐式建模语言。Moshi 的洞察：强制模型在音频旁同时发出文本令牌。文本流本质上是 Moshi 所说内容的转录。这提高了语义连贯性，使得更容易替换语言模型头，并免费提供转录文本。

### Hibiki：流式语音到语音翻译

相同的架构，但使用翻译对进行训练。源语言音频输入，目标语言音频输出，持续进行。Hibiki-Zero（2026 年 2 月）消除了对词级对齐训练数据的需求——使用句子级数据 + GRPO 强化学习优化延迟。

最初支持四种语言对；可通过约 1000 小时数据适配新语言。

### 更广泛的 Kyutai 技术栈（2026 年）

- **Moshi** —— 全双工对话（首先支持法语，英语良好）
- **Hibiki / Hibiki-Zero** —— 同声翻译
- **Kyutai STT** —— 流式 ASR（500 ms 或 2.5 s 前瞻）
- **Kyutai Pocket TTS** —— 1 亿参数 TTS，可在 CPU 上运行（2026 年 1 月）
- **Unmute** —— 将这些组件组合在公共服务器上的完整流水线

在 L40S GPU 上的吞吐量：64 个并发会话，以 3 倍实时运行。

### Sesame CSM —— 近亲

Sesame CSM（2025 年）使用类似思想——基于 Llama-3 骨干网络和 Mimi 编解码头。但 CSM 是单向的（接收上下文 + 文本，输出语音）而不是全双工。它是市场上最好的“语音存在感”TTS；与 Moshi 的全双工能力不完全相同。

### 2026 年性能数据

| 模型 | 延迟 | 使用场景 | 许可协议 |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | 全双工英语 / 法语对话 | CC-BY 4.0 |
| Hibiki | 12.5 Hz 帧率 | 法语 ↔ 英语流式翻译 | CC-BY 4.0 |
| Hibiki-Zero | 相同 | 5 种语言对，无需对齐数据 | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | 上下文条件化 TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | 闭源，OpenAI API | 商业 |
| Gemini 2.5 Live | ~350 ms | 闭源，Google API | 商业 |

## 构建它

### 步骤 1：接口

Moshi 暴露了一个 WebSocket 服务器，接收 80 ms 的 Mimi 编码音频块，并返回 80 ms 的 Mimi 编码音频块。双向，持续进行。

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

### 步骤 2：全双工循环

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

两个方向同时运行。Python asyncio 或 Rust futures 是标准传输方式。

### 步骤 3：训练目标（概念性）

对于每个 80 ms 帧 `t`：

- 输入：`user_mimi[0..t]`, `moshi_mimi[0..t-1]`, `moshi_text[0..t-1]`
- 预测：`moshi_text[t]`，然后 `moshi_mimi[t, codebook_0..7]`

文本在音频之前预测（内心独白）；音频在深度 Transformer 中按码本顺序预测。

### 步骤 4：Moshi 的优势与不足

Moshi 的优势：

- 在廉价硬件上实现低于 250 ms 的端到端延迟。
- 自然的回馈和打断。
- 无需流水线胶水代码。

Moshi 的不足：

- 工具调用（未为此训练；你需要单独的 LLM 路径）。
- 长距离推理（Moshi 是一个约 8B 的对话模型，不是 Claude/GPT-4）。
- 在专业主题上的事实准确性。
- 大多数生产级企业用例（2026 年仍使用流水线）。

## 使用它

| 场景 | 选择 |
|-----------|------|
| 最低延迟语音助手 | Moshi |
| 实时翻译通话 | Hibiki |
| 语音演示 / 研究 | Moshi, CSM |
| 带工具的企业代理 | 流水线（第 12 课），而非 Moshi |
| 上下文中的定制语音 TTS | Sesame CSM |
| 任意语言的语音到语音 | GPT-4o Realtime 或 Gemini 2.5 Live（商业） |

## 注意事项

- **有限工具调用。** Moshi 是对话模型，不是代理框架。对于工具调用，需结合流水线。
- **特定语音调节。** Moshi 使用单一训练人设；克隆需要单独的训练运行。
- **语言覆盖。** 英语 + 法语表现优秀；其他语言有限。Hibiki-Zero 有帮助，但仍需训练数据。
- **资源成本。** 一个完整的 Moshi 会话占用一个 GPU 槽位；不是便宜的共享租户部署模式。

## 交付

保存为 `outputs/skill-duplex-pipeline.md`。为语音代理工作负载选择流水线或全双工架构，并给出理由。

## 练习

1. **简单。** 运行 `code/main.py`。它象征性地模拟了双流 + 内心独白架构。
2. **中等。** 从 HuggingFace 拉取 Moshi，运行服务器，测试一次对话。测量从用户语音结束到 Moshi 开始响应的实际时钟延迟。
3. **困难。** 获取你的第 12 课流水线代理，并将其与 Moshi 在 20 个匹配测试话语上的 P50 延迟进行比较。写出在哪些情况下流水线架构仍然胜出。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| 全双工（Full-duplex） | 同时听和说 | 同一模型上同时激活两个音频流。 |
| 内心独白（Inner monologue） | 模型的文本流 | Moshi 在其音频输出旁发出文本令牌。 |
| 深度 Transformer（Depth transformer） | 码本间预测器 | 在一个 80 ms 帧内预测 8 个码本的小型 Transformer。 |
| Mimi | Kyutai 的编解码器 | 12.5 Hz × 8 个码本；语义+声学；为 Moshi 提供动力。 |
| 流式 S2S（Streaming S2S） | 实时音频到音频 | 逐块翻译/对话，无流水线阶段。 |
| 回馈（Back-channeling） | “嗯”反应 | Moshi 可以发出小的确认而不打断自己的话轮。 |

## 延伸阅读

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2) —— 论文。
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) —— 无需对齐数据的流式翻译。
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) —— CSM 规范。
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) —— 安装 + 服务器。
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) —— 闭源商业同行。
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) —— 底层的 STT/TTS 框架。