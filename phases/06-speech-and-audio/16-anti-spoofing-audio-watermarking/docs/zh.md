# 语音反欺骗与音频水印 —— ASVspoof 5、AudioSeal、WaveVerify

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 语音克隆的落地速度远快于防御。2026 年的生产级语音系统需要两样东西：一个检测器（AASIST、RawNet2），用来区分真实语音与伪造语音；以及一个水印（AudioSeal），能在压缩和编辑后依然存活。要么两个都上，要么干脆别上语音克隆。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## 问题（The Problem）

三类相关的防御手段：

1. **反欺骗 / 深度伪造检测（Anti-spoofing / deepfake detection）。** 给定一段音频，它是合成的还是真实的？ASVspoof 系列基准（ASVspoof 2019 → 2021 → 5）是黄金标尺。
2. **音频水印（Audio watermarking）。** 在生成的音频里嵌入一个不可感知的信号，检测器之后能把它提取出来。AudioSeal（Meta）和 WavMark 是开源选项。
3. **认证溯源（Authenticated provenance）。** 给音频文件 + 元数据做密码学签名。代表是 C2PA / Content Authenticity Initiative。

检测应付的是不配合的对手。水印应付的是合规——AI 生成的音频应当可被识别为 AI 生成。2026 年这两者缺一不可。

## 概念（The Concept）

![反欺骗 vs 水印 vs 溯源——三层防御](../assets/spoofing-watermark.svg)

### ASVspoof 5 —— 2024-2025 的基准（ASVspoof 5 — the 2024-2025 benchmark）

相比此前版本最大的变化：

- **众包数据**（不是录音棚干净录音）—— 接近真实场景。
- **约 2000 名说话人**（之前只有 ~100）。
- **32 种攻击算法。** TTS + 语音转换 + 对抗扰动。
- **两条赛道。** 对抗手段（CM, Countermeasure）单独检测；面向生物识别系统的抗欺骗 ASV（SASV, Spoofing-robust ASV）。

ASVspoof 5 上的 SOTA：约 7.23% EER。在更早的 ASVspoof 2019 LA 上：0.42% EER。真实世界部署中：在野外片段上预期 5-10% EER。

### AASIST 与 RawNet2 —— 检测模型家族（AASIST and RawNet2 — detection model families）

**AASIST**（2021 年发布，到 2026 年仍在更新）。在频谱特征上做图 attention（注意力）。当前在 ASVspoof 5 对抗手段任务上的 SOTA。

**RawNet2.** 在原始波形上做卷积前端 + TDNN 主干。更简单的基线；微调后仍有竞争力。

**NeXt-TDNN + SSL 特征。** 2025 年的变体：ECAPA 风格 + WavLM 特征 + focal loss。在 ASVspoof 2019 LA 上达到 0.42% EER。

### AudioSeal —— 2024 年的水印默认选项（AudioSeal — the 2024 watermark default）

Meta 的 **AudioSeal**（2024 年 1 月发布，v0.2 在 2024 年 12 月）。核心设计：

- **局部化（Localized）。** 在 16 kHz 采样分辨率（1/16000 秒）上逐帧检测水印。
- **生成器 + 检测器联合训练。** 生成器学习嵌入听不见的信号；检测器学习在各种增强后依然找到它。
- **鲁棒。** 能扛住 MP3 / AAC 压缩、EQ、±10% 的速度变换、+10 dB SNR 的噪声混入。
- **快。** 检测器以 485× 实时速度运行；比 WavMark 快 1000×。
- **容量。** 16 bit payload（可编码模型 ID、生成时间戳、用户 ID），可嵌入到每段语音里。

### WavMark

AudioSeal 之前的开源基线。可逆神经网络，32 bit/秒。问题：

- 同步用暴力搜索，速度慢。
- 高斯噪声或 MP3 压缩就能去掉。
- 不太适合实时场景。

### WaveVerify（2025 年 7 月）

针对 AudioSeal 的弱点——尤其是时间维度的操纵（反转、变速）。使用基于 FiLM 的生成器 + Mixture-of-Experts 检测器。在标准攻击上与 AudioSeal 持平；能扛住时间维度的编辑。

### 对手利用的缺口（The gap adversaries exploit）

来自 AudioMarkBench：「在 pitch shift 下，所有水印的 Bit Recovery Accuracy 都低于 0.6，意味着几乎被完全清除。」**Pitch-shift 是通用攻击。** 2026 年没有任何水印对激进的 pitch 修改完全鲁棒。这就是为什么你在水印之外还需要检测（AASIST）。

### C2PA / Content Authenticity Initiative

这不是一种 ML 技术——而是一种清单格式。音频文件携带关于创建工具、作者、日期的密码学签名元数据。Audobox / Seamless 在用它。对溯源是好事；但如果坏人重新编码并剥掉元数据，它就失效了。

## 动手实现（Build It）

### 第 1 步：一个简单的频谱特征检测器（玩具版）（Step 1: a simple spectral-feature detector (toy)）

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

合成语音在高频段往往有反常地平坦的能量分布。生产级检测器用 AASIST，不用这个。但直觉是相通的。

### 第 2 步：AudioSeal 嵌入 + 检测（Step 2: AudioSeal embed + detect）

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

### 第 3 步：评估 —— EER（Step 3: evaluation — EER）

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

### 第 4 步：生产侧的整合（Step 4: the production integration）

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每次生成都要附带：(1) 水印，(2) 签名清单，(3) 满足留存政策的审计日志。

## 用起来（Use It）

| 用例 | 防御方案 |
|----------|---------|
| 上线 TTS / 语音克隆 | 每条输出都嵌入 AudioSeal（不容商量） |
| 生物识别语音解锁 | AASIST + ECAPA 集成；活体挑战 |
| 呼叫中心欺诈检测 | 对来电做 20% 抽样，跑 AASIST |
| 播客真实性 | 上传时做 C2PA 签名；若是 AI 生成则加 AudioSeal |
| 研究 / 训练检测器 | ASVspoof 5 的 train/dev/eval 集 |

## 易踩的坑（Pitfalls）

- **嵌了水印却从来没跑过检测器。** 毫无意义。把检测器纳入你的 CI。
- **检测没有校准。** 在 ASVspoof LA 上训练的 AASIST 会过拟合；真实世界准确率会掉。请在自己的领域上做校准。
- **Pitch-shift 缺口。** 激进的 pitch shift 能去掉大多数水印。要有一条检测 fallback。
- **元数据剥离再托管。** C2PA 通过重新编码就能轻松绕过。永远要把密码学防御和感知层（水印）防御一起上。
- **把活体当检测。** 让用户念一段随机短语。能防回放攻击，但防不了实时克隆。

## 上线部署（Ship It）

存为 `outputs/skill-spoof-defender.md`。为某个语音生成部署选定检测模型、水印方案、溯源清单和运维手册。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。在合成音频上跑玩具检测器 + 玩具水印的嵌入 / 检测。
2. **中等。** 安装 `audioseal`，在一段 TTS 输出里嵌入 16 bit payload，再解码出来。给音频加噪声，测量 Bit Recovery Accuracy。
3. **困难。** 在 ASVspoof 2019 LA 上微调一个 RawNet2 或 AASIST。测 EER。在一组留出的 F5-TTS 生成片段上测试——观察 OOD 检测如何退化。

## 关键术语（Key Terms）

| 术语 | 大家挂在嘴边的说法 | 它真正的含义 |
|------|-----------------|-----------------------|
| ASVspoof | 那个基准 | 双年挑战赛；2024 年是 ASVspoof 5。 |
| CM (countermeasure) | 检测器 | 分类器：真实语音 vs 合成 / 转换语音。 |
| SASV | 说话人验证 + CM | 集成的生物识别 + 欺骗检测。 |
| AudioSeal | Meta 的水印 | 局部化、16 bit payload，比 WavMark 快 485×。 |
| Bit Recovery Accuracy | 水印的存活率 | 攻击之后 payload 中能恢复出的比特占比。 |
| C2PA | 溯源清单 | 关于创建 / 作者的密码学元数据。 |
| AASIST | 检测器家族 | 基于图 attention 的反欺骗 SOTA。 |

## 延伸阅读（Further Reading）

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) —— 当前的基准。
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) —— 默认水印方案。
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) —— 针对时间攻击的 MoE 检测器。
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) —— SOTA 检测主干。
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) —— 鲁棒性评估。
- [C2PA specification](https://c2pa.org/specifications/specifications/) —— 溯源清单格式。
