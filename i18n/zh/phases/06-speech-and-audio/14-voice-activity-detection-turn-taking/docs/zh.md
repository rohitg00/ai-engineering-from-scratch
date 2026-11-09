# 声活动检测和转移 西勒罗,科布拉和流动技巧

> 每个语音代理都根据两个决定生活或死亡:用户现在在说话,他们已经完成了吗?VAD回答第一个.转发检测 (VAD +沉默-置 +语义终点模型) 回答第二个.要么错误,你的助理要么关闭用户,要么永远不关闭嘴.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## 问题

语音代理每20毫米分钟就会做出三个不同的决定:

1. **Is this frame speech?**VAD,双式,每一个框架.
2. **Has the user started a new utterance?** 发病的检测.
3. **Has the user finished?**终点指向 (转向).

简单的答案 (能量门) 在任何噪音,键盘,人群语上都失败了. 2026 答案:Silero VAD (开放,深入学习) + 转向检测模型 (语义终点指标) + VAD校准的沉默.

## 概念

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### 排列三的VAD

**Tier 1: energy gate.**最便宜的,门RMS在 -40 dBFS. 过明显的沉默,但在门以上的任何噪音上,

**Tier 2: Silero VAD**运行在一个CPU线程上每30ms块的1ms. 87.7%的TPR在5%的FPR.开源默认.

**Tier 3: semantic turn detector.**动Kit的轮回检测模型 (2024-2026) 或您自己的小分类器. 区分"语句中暂停"和"做完谈话". 使用语言背景 (语法 + 最近的词),而不仅仅是沉默.

### 关键参数及其默认设置

- **Threshold.**希勒罗输出一个概率;将语音分为&gt;0.5 (默认) 或&gt;0.3 (敏感).较低的门 = 减少第一词剪辑,更多的虚假积极.
- **Minimum speech duration.**拒绝超过250 ms的语音 通常咳或椅子噪音.
- **Silence hangover (end-pointing).**在VAD返回0后,等待500-800ms,然后宣布转换结束.太短 →打断用户.太长 →感觉缓慢.
- **Pre-roll buffer.**在VAD发射之前保持300-500ms的音频,防止""被剪切.

### 鱼的技巧 (九台2025年)

流媒体STT模型的前进延迟 (Kyutai STT-1B的500ms,STT-2.6B的2.5s). 通常你会等待这么长时间后的演讲结束.**send a flush signal to the STT**通过4×实时处理,所以500ms缓冲器在125ms内完成.

终端到终端:125 ms VAD + 流动STT = 对话延迟.

### 2026 年的VAD比较

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

果是正确的默认. 科布拉是合规性/精度升级. 仅能VAD在2026年生产没有地方.

```figure
sp-vad-cascade
```

## 建立它

### 步骤1:能源门

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 步骤 2: 在 Python 中使用 Silero VAD

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

### 步骤3:转端状态机

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

### 步骤4: 鱼技巧骨架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

为了实现这一目标,STT (Kyutai,Deepgram,AssemblyAI) 必须支持flush.

## 用它

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

指规则:除非你真的没有其他选择,否则,永远不要运送纯能动的VAD.

## 陷

- **Fixed threshold.**机器在安静状态下工作,噪音时失败.
- **Too-short silence hangover.**代理打断句子中. 500-800ms是谈话的最好地方.
- **Too-long hangover.**对于目标用户来说,A/B测试.
- **No pre-roll buffer.**首先,用户的音频输出200-300ms,总是保持滚动前滚动.
- **Ignoring semantic endpointing.**"让我思考"...包含长时间的暂停.用户讨厌被停留在思考中.使用LiveKit的转换探测器或类似.

## 运送它

保存如`outputs/skill-vad-tuner.md`选择VAD模型,门,,预滚和转变检测策略.

## 运动

1. **Easy.**跑步`code/main.py`它模拟了语音+沉默+语音+咳序列,并测试了三个VAD级别.
2. **Medium.**安装`silero-vad`通过5分钟的录音,调整门以尽量减少第一字剪辑和错误触发.
3. **Hard.**建立一个小型转换检测器:Silero VAD + 在最后10个字的嵌入式上进行3层MLP (使用句子转换器).使用手动标记的转换端数据集训练.仅打败Silero-F110%

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## 进一步阅读

- [Silero VAD](https://github.com/snakers4/silero-vad) 参考开放的VAD.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/)商业精度领先者.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt)200ms下级工程技巧.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/)生产中的语义终点.
- [WebRTC VAD](https://webrtc.googlesource.com/src/)遗产基线.
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio)日记级分类.
