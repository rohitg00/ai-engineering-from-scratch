# 语音活动检测与轮次切换 —— Silero、Cobra 和 flush 技巧

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 任何语音 agent 的成败都取决于两个判断：用户现在是不是在说话，以及他们是不是说完了。VAD（voice activity detection，语音活动检测）回答前者。轮次检测（turn-detection，VAD + 静音挂起时间 + 语义结束点模型）回答后者。任何一个判断错了，你的助手要么打断用户，要么就闭不上嘴。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## 问题（The Problem）

语音 agent 在每一个 20 ms 的音频块上要做三个不同的判断：

1. **这一帧是语音吗？** —— VAD。逐帧二分类。
2. **用户开始一段新话语了吗？** —— 起始检测（onset detection）。
3. **用户说完了吗？** —— 结束点检测（end-pointing），即轮次结束。

最朴素的做法（能量阈值）面对任何噪声都会失败 —— 车流、键盘、人群嘈杂声。2026 年的答案是：Silero VAD（开源、深度学习）+ 一个轮次检测模型（语义结束点）+ 一段用 VAD 校准的静音挂起时间。

## 概念（The Concept）

![VAD 级联：energy → Silero → turn-detector → flush 技巧](../assets/vad-turn-taking.svg)

### 三层 VAD 级联（The three-tier VAD cascade）

**第 1 层：能量门。** 最便宜。在 -40 dBFS 处对 RMS 设阈值。能滤掉明显的静音，但只要噪声超过阈值就会触发。

**第 2 层：Silero VAD**（2020-2026，MIT 许可）。100 万参数。在 6000+ 种语言上训练。单 CPU 线程上每个 30 ms 的块大约 1 ms。87.7% TPR @ 5% FPR。开源默认选择。

**第 3 层：语义轮次检测器。** LiveKit 的 turn-detection 模型（2024-2026），或者你自己的小分类器。区分「句中停顿」和「说完了」。它用语言上下文（语调 + 最近几个词），而不只是看静音。

### 关键参数和默认值（Key parameters and their defaults）

- **阈值（threshold）。** Silero 输出一个概率；&gt; 0.5（默认）或 &gt; 0.3（敏感）判为语音。阈值越低 = 首词被截断的情况越少，假阳性越多。
- **最小语音时长。** 拒绝短于 250 ms 的语音 —— 通常是咳嗽或挪椅子的声音。
- **静音挂起（结束点检测）。** VAD 回到 0 后，再等 500-800 ms 才宣布轮次结束。太短 → 打断用户。太长 → 显得迟钝。
- **预录缓冲（pre-roll buffer）。** 在 VAD 触发之前保留 300-500 ms 音频。防止「hey」这类首词被截掉。

### flush 技巧（The flush trick，Kyutai 2025）

流式 STT 模型有一段前瞻延迟（Kyutai STT-1B 是 500 ms，STT-2.6B 是 2.5 s）。通常你得在用户停止说话之后再等这么久才能拿到转写。flush 技巧：当 VAD 检测到说话结束时，**给 STT 发一个 flush 信号，强制它立刻输出**。STT 处理速度大约是 4 倍实时，所以那 500 ms 的缓冲在 ~125 ms 就跑完了。

端到端：125 ms VAD + flush STT = 对话级延迟。

### 2026 VAD 对比（2026 VAD comparison）

| VAD | TPR @ 5% FPR | 延迟 | 许可证 |
|-----|--------------|------|--------|
| WebRTC VAD（Google，2013） | 50.0% | 30 ms | BSD |
| Silero VAD（2020-2026） | 87.7% | ~1 ms | MIT |
| Cobra VAD（Picovoice） | 98.9% | ~1 ms | 商用 |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero 是合适的默认选择。Cobra 是合规 / 精度方向的升级。在 2026 年的生产环境，纯能量 VAD 没有立足之地。

## 动手实现（Build It）

### 第 1 步：能量门（Step 1: the energy gate）

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 第 2 步：Python 里的 Silero VAD（Step 2: Silero VAD in Python）

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### 第 3 步：轮次结束状态机（Step 3: turn-end state machine）

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### 第 4 步：flush 技巧的骨架（Step 4: the flush trick skeleton）

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

要让这套方案生效，STT（Kyutai、Deepgram、AssemblyAI）必须支持 flush。Whisper 流式不支持 —— 它是按块处理的，永远在等下一个 chunk。

## 用起来（Use It）

| 场景 | VAD 选择 |
|------|----------|
| 开源、快速、通用 | Silero VAD |
| 商用呼叫中心 | Cobra VAD |
| 端侧（手机） | Silero VAD ONNX |
| 研究 / 说话人分离 | pyannote segmentation |
| 零依赖兜底 | WebRTC VAD（legacy） |
| 需要高质量轮次结束 | Silero + LiveKit turn-detector 叠加 |

经验法则：除非真的没有别的选择，永远不要在线上用纯能量 VAD。

## 坑（Pitfalls）

- **固定阈值。** 在安静环境管用，在嘈杂环境就废了。要么端侧自校准，要么换 Silero。
- **静音挂起太短。** Agent 在用户句子中间打断他。500-800 ms 是对话语音的甜点区间。
- **挂起太长。** 显得反应迟钝。在目标用户群里做 A/B 测试。
- **没有预录缓冲。** 用户音频前 200-300 ms 丢失。永远要保留一段滚动的 pre-roll。
- **忽略语义结束点。** 「Hmm, let me think...」里有很长的停顿。用户最讨厌在思考途中被打断。用 LiveKit 的 turn-detector 或类似方案。

## 上线部署（Ship It）

存到 `outputs/skill-vad-tuner.md`。为某个工作负载选定 VAD 模型、阈值、挂起时间、pre-roll，以及轮次检测策略。

## 练习（Exercises）

1. **简单。** 跑一下 `code/main.py`。它会模拟一段「语音 + 静音 + 语音 + 咳嗽」序列，测试三层 VAD。
2. **中等。** 装 `silero-vad`，处理一段 5 分钟的录音，调阈值，让首词截断和误触发都最少。报告 precision / recall。
3. **困难。** 做一个迷你 turn-detector：Silero VAD + 一个 3 层 MLP，输入是最近 10 个词的 embedding（用 sentence-transformers）。在你手工标注的轮次结束数据集上训练。F1 比纯 Silero 高 10%。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 它实际是什么 |
|------|----------------|--------------|
| VAD | 「语音检测器」 | 逐帧二分类：这一帧是语音吗？ |
| Turn detection | 「end-pointing」 | VAD + 静音挂起 + 语义结束点。 |
| Silence hangover | 「说话后再等一下」 | 宣布轮次结束之前的等待时间；500-800 ms。 |
| Pre-roll | 「说话前的缓冲」 | 在 VAD 触发之前保留 300-500 ms 音频。 |
| Flush trick | 「Kyutai 的小聪明」 | VAD → flush-STT → 把 500 ms 延迟压到 125 ms。 |
| Semantic endpoint | 「他们真的想停下吗？」 | 看词不只看静音的 ML 分类器。 |
| TPR @ FPR 5% | 「ROC 上的一个点」 | 标准 VAD 基准；Silero 87.7%，WebRTC 50%。 |

## 延伸阅读（Further Reading）

- [Silero VAD](https://github.com/snakers4/silero-vad) —— 开源 VAD 的参考实现。
- [Picovoice Cobra VAD](https://picovoice.ai/products/cobra/) —— 商用精度领头羊。
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) —— 把延迟压到 200 ms 以内的工程技巧。
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) —— 生产环境的语义结束点。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) —— 老牌 baseline。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) —— 说话人分离级别的分段。
