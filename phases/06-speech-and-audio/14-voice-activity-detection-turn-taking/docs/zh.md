# 语音活动检测与话轮转换（Voice Activity Detection & Turn-Taking）— Silero、Cobra 与 Flush 技巧

> 每个语音助手都取决于两个决策：用户现在是否在说话？用户是否说完了？VAD 回答第一个问题。话轮检测（VAD + 静默持续时间 + 语义端点模型）回答第二个问题。任何一个出错，你的助手要么打断用户，要么永远不闭嘴。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段 6 · 11（实时音频），阶段 6 · 12（语音助手）
**时间：** 约 45 分钟

## 问题所在

语音助手在每个 20 毫秒的音频块上需要做出三个截然不同的决策：

1.  **这一帧是语音吗？** — VAD。每帧二分类。
2.  **用户是否开始了新的话语？** — 起点检测（onset detection）。
3.  **用户是否说完了？** — 终点检测（end-pointing，话轮结束）。

天真的做法（能量阈值）在噪声环境下完全失效——车辆、键盘、人群嘈杂声。2026 年的答案：Silero VAD（开源、深度学习）+ 话轮检测模型（语义端点检测）+ 基于 VAD 校准的静默持续时间。

## 核心概念

![VAD 级联：能量 → Silero → 话轮检测器 → flush 技巧](../assets/vad-turn-taking.svg)

### 三级 VAD 级联

**第一级：能量门（Tier 1: energy gate）。** 成本最低。设定 RMS 阈值 -40 dBFS。过滤明显的静音，但会触发任何高于阈值的噪声。

**第二级：Silero VAD**（2020-2026，MIT 协议）。100 万参数。在 6000 多种语言上训练。在单 CPU 线程上，每 30 毫秒音频块运行约 1 毫秒。在 5% 误报率（FPR）下，真正率（TPR）为 87.7%。开源默认选择。

**第三级：语义话轮检测器（Tier 3: semantic turn detector）。** LiveKit 的话轮检测模型（2024-2026）或你自己的小型分类器。区分“句中停顿”和“说完”。使用语言上下文（语调 + 最近词语），而非仅依赖静默。

### 关键参数及其默认值

- **阈值（Threshold）。** Silero 输出概率；当概率 > 0.5（默认）或 > 0.3（敏感）时判定为语音。阈值越低，首词截断越少，但误报越多。
- **最短语音时长（Minimum speech duration）。** 拒绝短于 250 毫秒的语音——通常是咳嗽或椅子噪音。
- **静默持续时间（Silence hangover，端点检测）。** VAD 返回 0 后，等待 500-800 毫秒再宣布话轮结束。太短会打断用户，太长会感觉卡顿。
- **预卷缓冲区（Pre-roll buffer）。** 在 VAD 触发前保留 300-500 毫秒的音频。防止“喂”被截断。

### Flush 技巧（Kyutai 2025）

流式语音转文本（STT）模型存在前瞻延迟（Kyutai STT-1B 为 500 毫秒，STT-2.6B 为 2.5 秒）。通常需要在语音结束后等待这么长时间才能得到转录结果。Flush 技巧：当 VAD 检测到语音结束时，**向 STT 发送一个刷新信号（flush signal）**，强制立即输出。STT 的处理速度约为实时音频的 4 倍，因此 500 毫秒的缓冲区大约在 125 毫秒内处理完毕。

端到端：125 毫秒 VAD + flush STT = 对话级延迟。

### 2026 年 VAD 比较

| VAD | 5% FPR 下的 TPR | 延迟 | 许可协议 |
|-----|-----------------|------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 毫秒 | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 毫秒 | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 毫秒 | 商业 |
| pyannote 分割 | 95% | ~10 毫秒 | MIT 类似 |

Silero 是合适的默认选择。Cobra 是合规性/准确性升级选项。仅基于能量的 VAD 在 2026 年的生产环境中没有立足之地。

## 动手构建

### 第一步：能量门

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 第二步：Python 中的 Silero VAD

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

### 第三步：话轮结束状态机

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

### 第四步：Flush 技巧框架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT（Kyutai、Deepgram、AssemblyAI）必须支持 flush 才能生效。Whisper 流式不支持——它是基于块的，始终等待完整块。

## 使用场景

| 情况 | VAD 选择 |
|------|---------|
| 开放、快速、通用 | Silero VAD |
| 商业呼叫中心 | Cobra VAD |
| 设备端（手机） | Silero VAD ONNX |
| 研究 / 说话人日志 | pyannote 分割 |
| 零依赖后备方案 | WebRTC VAD（旧版） |
| 需要高质量话轮结束 | Silero + LiveKit 话轮检测器叠加 |

经验法则：除非实在别无选择，否则绝不要只使用基于能量的 VAD。

## 常见陷阱

- **固定阈值。** 安静环境下有效，噪声环境下失效。要么在设备端校准，要么改用 Silero。
- **静默持续时间过短。** 助手中途打断用户。500-800 毫秒是对话语音的最佳区间。
- **静默持续时间过长。** 感觉卡顿。需与目标用户进行 A/B 测试。
- **没有预卷缓冲区。** 用户音频的前 200-300 毫秒丢失。始终保持滚动预卷缓冲。
- **忽略语义端点检测。** “嗯，让我想想……”包含长停顿。用户讨厌在思考时被打断。使用 LiveKit 的话轮检测器或类似方案。

## 交付成果

保存为 `outputs/skill-vad-tuner.md`。根据工作负载选择 VAD 模型、阈值、静默持续时间、预卷缓冲和话轮检测策略。

## 练习

1.  **简单。** 运行 `code/main.py`。它模拟了一个“语音 + 静默 + 语音 + 咳嗽”序列，并测试三个 VAD 层级。
2.  **中等。** 安装 `silero-vad`，处理一个 5 分钟的录音，调整阈值以最小化首词截断和误触发。报告精确率/召回率。
3.  **困难。** 构建一个小型话轮检测器：Silero VAD + 一个三层 MLP，输入为最后 10 个词的嵌入向量（使用 sentence-transformers）。在人工标注的话轮结束数据集上训练。在 F1 分数上比仅使用 Silero 提高 10%。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|----------|
| VAD | 语音检测器 | 每帧二分类：这是语音吗？ |
| 话轮检测 | 端点检测 | VAD + 静默持续时间 + 语义端点 |
| 静默持续时间 | 语音后等待时间 | 宣布话轮结束前的等待时间；500-800 毫秒 |
| 预卷缓冲 | 语音前缓冲区 | 在 VAD 触发前保留 300-500 毫秒音频 |
| Flush 技巧 | Kyutai 黑科技 | VAD → flush-STT → 125 毫秒，代替 500 毫秒延迟 |
| 语义端点 | “他们是否想停下？” | 查看词语而非仅静默的 ML 分类器 |
| TPR @ FPR 5% | ROC 点 | 标准 VAD 基准；Silero 87.7%，WebRTC 50% |

## 延伸阅读

- [Silero VAD](https://github.com/snakers4/silero-vad) — 参考开源 VAD。
- [Picovoice Cobra VAD](https://picovoice.ai/products/cobra/) — 商业准确率领先者。
- [Kyutai — Unmute + flush 技巧](https://kyutai.org/stt) — 低于 200 毫秒的工程技巧。
- [LiveKit — 话轮检测](https://docs.livekit.io/agents/logic/turns/) — 生产环境中的语义端点检测。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) — 旧版基线。
- [pyannote 分割](https://github.com/pyannote/pyannote-audio) — 说话人日志级别的分割。