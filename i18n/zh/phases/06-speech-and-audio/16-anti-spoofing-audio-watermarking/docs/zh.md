# 语音反欺骗与音频水印 — ASVspoof 5、AudioSeal、WaveVerify

> 语音克隆的普及速度超过了防御手段的部署速度。2026 年的生产级语音系统需要两样东西：一个用于区分真实与伪造语音的检测器(AASIST、RawNet2),以及一个能在压缩和编辑后存活的水印(AudioSeal)。两者齐备,否则不要上线语音克隆功能。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 06(Speaker Recognition)、Phase 6 · 08(Voice Cloning)
**Time:** ~75 分钟

## 问题所在

三种相关的防御手段:

1. **反欺骗 / deepfake 检测。** 给定一段音频,判断它是合成的还是真实的。ASVspoof 基准测试(ASVspoof 2019 → 2021 → 5)是该领域的金标准。
2. **音频水印。** 在生成的音频中嵌入一种不可感知的信号,检测器可在之后提取出来。AudioSeal(Meta)和 WavMark 是开源方案。
3. **可认证的来源溯源。** 对音频文件与元数据进行加密签名。即 C2PA / Content Authenticity Initiative。

检测应对的是不配合的攻击者。水印应对的是合规需求 —— AI 生成的音频应当能被识别为其身份。2026 年,两者缺一不可。

## 核心概念

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5 — 2024-2025 年的基准

相较以往版本的最大变化:

- **众包数据**(非录音室级干净音频)—— 更贴近真实条件。
- **约 2000 名说话人**(此前约 100 名)。
- **32 种攻击算法。** 包括 TTS、语音转换以及对抗性扰动。
- **两条赛道。** Countermeasure(CM)独立检测;面向生物识别系统的 Spoofing-robust ASV(SASV)。

ASVspoof 5 上的当前最佳结果:约 7.23% EER。在更早的 ASVspoof 2019 LA 上:0.42% EER。实际部署中:对真实场景的音频片段,预期 EER 为 5-10%。

### AASIST 与 RawNet2 — 检测模型家族

**AASIST**(2021 年,持续更新至 2026 年)。基于频谱特征的图注意力机制。当前 ASVspoof 5 countermeasure 任务的 SOTA。

**RawNet2。** 在原始波形上的卷积前端 + TDNN 主干。更简单的基线;经过微调后仍具竞争力。

**NeXt-TDNN + SSL 特征。** 2025 年的变体:ECAPA 风格结构 + WavLM 特征 + focal loss。在 ASVspoof 2019 LA 上达到 0.42% EER。

### AudioSeal — 2024 年以来的默认水印方案

Meta 的 **AudioSeal**(2024 年 1 月,v0.2 于 2024 年 12 月)。关键设计:

- **局部化。** 以 16 kHz 采样分辨率(1/16000 秒)逐帧检测水印。
- **生成器与检测器联合训练。** 生成器学习嵌入不可感知的信号;检测器通过数据增强学习将其找出。
- **鲁棒。** 可在 MP3 / AAC 压缩、均衡、±10% 变速、+10 dB SNR 噪声混合后存活。
- **快速。** 检测器运行速度为 485 倍实时;比 WavMark 快 1000 倍。
- **容量。** 每条语音中可嵌入 16 位有效载荷(可编码模型 ID、生成时间戳、用户 ID)。

### WavMark

AudioSeal 出现之前的开源基线。可逆神经网络,32 位/秒。问题:

- 暴力同步搜索速度慢。
- 可被高斯噪声或 MP3 压缩去除。
- 不适合实时场景。

### WaveVerify(2025 年 7 月)

针对 AudioSeal 的弱点 —— 特别是时域操作(反转、变速)。采用基于 FiLM 的生成器 + Mixture-of-Experts 检测器。在标准攻击下与 AudioSeal 相当;并能应对时域编辑。

### 攻击者利用的缺口

来自 AudioMarkBench:“在音高变换下,所有水印的 Bit Recovery Accuracy 均低于 0.6,表明水印几乎被完全去除。” **音高变换是通用攻击手段。** 2026 年没有任何水印能完全抵御激进音高修改。这就是为什么你需要在水印之外配合检测(AASIST)。

### C2PA / Content Authenticity Initiative

不是一种 ML 技术 —— 而是一种清单(manifest)格式。音频文件携带经过加密签名的元数据,记录创建工具、作者、日期。Audobox / Seamless 使用它。适合溯源;但若恶意行为者重新编码并剥离元数据,则毫无作用。

```figure
v4-audio-watermark
```

## 动手构建

### 步骤 1:一个简单的频谱特征检测器(玩具级)

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

合成语音的高频能量往往异常平坦。生产级检测器使用的是 AASIST,而非此方法。但其中的直觉是成立的。

### 步骤 2:AudioSeal 嵌入与检测

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### 步骤 3:评估 — EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### 步骤 4:生产集成

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每次生成输出均包含:(1)水印,(2)签名清单,(3)符合保留策略的审计日志。

## 应用场景

| 使用场景 | 防御手段 |
|----------|---------|
| 上线 TTS / 语音克隆 | 对每个输出进行 AudioSeal 嵌入(不可妥协) |
| 生物识别语音解锁 | AASIST + ECAPA 集成;活跃性挑战 |
| 呼叫中心欺诈检测 | 对 20% 来电抽样运行 AASIST |
| 播客真实性验证 | 上传时进行 C2PA 签名;若为 AI 生成则加 AudioSeal |
| 研究 / 训练检测器 | ASVspoof 5 train/dev/eval 数据集 |

## 常见陷阱

- **部署水印但从不运行检测器。** 毫无意义。把检测器纳入你的 CI。
- **检测缺乏校准。** 在 ASVspoof LA 上训练的 AASIST 会过拟合;真实场景准确率下降。要在你的领域数据上校准。
- **音高变换缺口。** 激进的音高变换可去除大多数水印。需备有检测兜底方案。
- **剥离元数据后重新分发。** C2PA 可被重新编码轻易绕过。务必将加密防御与感知防御(水印)结合使用。
- **以活跃性验证代替检测。** 要求用户念一句随机短语。可防止重放攻击,但无法应对实时克隆。

## 上线交付

保存为 `outputs/skill-spoof-defender.md`。为语音生成部署选定检测模型、水印、来源清单及运维预案。

## 练习

1. **简单。** 运行 `code/main.py`。在合成音频上进行玩具级检测器与玩具级水印的嵌入/检测。
2. **中等。** 安装 `audioseal`,在 TTS 输出中嵌入 16 位有效载荷,再进行解码。用噪声破坏音频并测量 Bit Recovery Accuracy。
3. **困难。** 在 ASVspoof 2019 LA 上微调 RawNet2 或 AASIST。测量 EER。在一组留出的 F5-TTS 生成片段上测试 —— 观察 OOD 检测性能如何退化。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| ASVspoof | 那个基准 | 两年一度的挑战赛;2024 年 = ASVspoof 5。 |
| CM(countermeasure) | 检测器 | 分类器:真实语音 vs 合成 / 转换语音。 |
| SASV | 说话人验证 + CM | 生物识别与欺骗检测的集成方案。 |
| AudioSeal | Meta 的水印 | 局部化、16 位有效载荷、比 WavMark 快 485 倍。 |
| Bit Recovery Accuracy | 水印存活率 | 攻击后成功恢复的有效载荷比特比例。 |
| C2PA | 来源清单 | 关于创建 / 归属的加密签名元数据。 |
| AASIST | 检测器家族 | 基于图注意力的反欺骗 SOTA。 |

## 延伸阅读

- [Todisco 等人(2024)。ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) — 当前的基准。
- [Defossez 等人(2024)。AudioSeal](https://arxiv.org/abs/2401.17264) — 默认水印方案。
- [Chen 等人(2025)。WaveVerify](https://arxiv.org/abs/2507.21150) — 面向时域攻击的 MoE 检测器。
- [Jung 等人(2022)。AASIST](https://arxiv.org/abs/2110.01200) — SOTA 检测主干。
- [AudioMarkBench(2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) — 鲁棒性评估。
- [C2PA 规范](https://c2pa.org/specifications/specifications/) — 来源清单格式。