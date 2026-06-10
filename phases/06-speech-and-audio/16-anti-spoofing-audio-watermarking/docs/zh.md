# 16 · 语音反欺骗与音频水印 —— ASVspoof 5、AudioSeal、WaveVerify

> 语音克隆的落地速度远快于防御手段。2026 年的生产级语音系统需要两样东西：一个能区分真实与伪造语音的检测器（AASIST、RawNet2），以及一个能在压缩和编辑后存活的水印（AudioSeal）。要么两者都上线，要么干脆别上线语音克隆。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 6 · 06（说话人识别）、阶段 6 · 08（语音克隆）
**时长：** 约 75 分钟

## 问题所在

三种相互关联的防御手段：

1. **反欺骗 / 深度伪造检测（Anti-spoofing / deepfake detection）。** 给定一段音频，它是合成的还是真实的？ASVspoof 系列基准（ASVspoof 2019 → 2021 → 5）是黄金标准。
2. **音频水印（Audio watermarking）。** 在生成音频中嵌入一个不可感知的信号，检测器随后可以将其提取出来。AudioSeal（Meta）和 WavMark 是开源选项。
3. **可认证溯源（Authenticated provenance）。** 对音频文件及元数据进行密码学签名。C2PA / 内容真实性倡议（Content Authenticity Initiative）。

检测应对的是不配合的对手；水印应对的是合规需求——AI 生成的音频应当能被识别为 AI 生成。2026 年这两者缺一不可。

## 核心概念

〔图：反欺骗、水印与溯源——三层防御〕

### ASVspoof 5 —— 2024-2025 年的基准

相较前几届的最大变化：

- **众包数据（Crowdsourced data）**（而非录音棚级别的干净数据）——贴近真实条件。
- **约 2000 名说话人**（此前约 100 名）。
- **32 种攻击算法。** 文本转语音（TTS）+ 语音转换 + 对抗扰动。
- **两条赛道。** 独立检测的对抗措施（Countermeasure，CM）；面向生物识别系统的抗欺骗说话人验证（Spoofing-robust ASV，SASV）。

ASVspoof 5 上的当前最优水平：约 7.23% 等错误率（EER）。在更早的 ASVspoof 2019 LA 上：0.42% EER。真实部署场景下：在野外采集的音频片段上预计为 5-10% EER。

### AASIST 与 RawNet2 —— 检测模型家族

**AASIST**（2021 年提出，持续更新至 2026 年）。在频谱特征上做图注意力（graph-attention）。ASVspoof 5 对抗措施任务上的当前最优。

**RawNet2。** 在原始波形上做卷积前端 + TDNN 主干。更简单的基线；经过微调后仍具竞争力。

**NeXt-TDNN + 自监督学习（SSL）特征。** 2025 年的变体：ECAPA 风格 + WavLM 特征 + 焦点损失（focal loss）。在 ASVspoof 2019 LA 上达到 0.42% EER。

### AudioSeal —— 2024 年的水印默认选择

Meta 的 **AudioSeal**（2024 年 1 月发布，2024 年 12 月推出 v0.2）。关键设计：

- **定位化（Localized）。** 在 16 kHz 采样分辨率（1/16000 秒）下逐帧检测水印。
- **生成器与检测器联合训练。** 生成器学会嵌入不可听的信号；检测器学会穿透各种增强手段去找到它。
- **鲁棒。** 可在 MP3 / AAC 压缩、均衡器（EQ）、±10% 变速、+10 dB 信噪比（SNR）的噪声混入下存活。
- **快速。** 检测器以 485 倍实时速度运行；比 WavMark 快 1000 倍。
- **容量。** 16 比特载荷（可编码模型 ID、生成时间戳、用户 ID），可嵌入每一段话语中。

### WavMark

AudioSeal 之前的开源基线。可逆神经网络，32 比特/秒。问题：

- 同步暴力搜索速度慢。
- 可被高斯噪声或 MP3 压缩去除。
- 不利于实时处理。

### WaveVerify（2025 年 7 月）

针对 AudioSeal 的弱点——尤其是时序操纵（倒放、变速）。使用基于 FiLM 的生成器 + 专家混合（Mixture-of-Experts，MoE）检测器。在标准攻击上与 AudioSeal 旗鼓相当；并能应对时序编辑。

### 对手利用的漏洞

来自 AudioMarkBench：「在变调（pitch shift）下，所有水印的比特恢复准确率（Bit Recovery Accuracy）均低于 0.6，表明水印几乎被完全移除。」**变调是通用攻击手段。** 2026 年没有任何水印能完全抵御激进的变调操作。这正是为什么你需要在水印之外辅以检测（AASIST）。

### C2PA / 内容真实性倡议

它不是一种机器学习技术，而是一种清单（manifest）格式。音频文件携带经过密码学签名的元数据，记录创建工具、作者、日期。Audiobox / Seamless 使用了它。它适合用于溯源；但如果有恶意者重新编码并剥离元数据，它便毫无作用。

## 动手构建

### 第 1 步：一个简单的频谱特征检测器（玩具版）

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

合成语音常在高频部分具有异常平坦的能量分布。生产级检测器用的是 AASIST，而非这套方案。但其中的直觉是成立的。

### 第 2 步：AudioSeal 嵌入 + 检测

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
# result: [0, 1] 区间的浮点数 —— 水印存在的概率
# decoded_payload: 16 比特；与嵌入的载荷进行比对
```

### 第 3 步：评估 —— EER

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

### 第 4 步：生产级集成

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每一次生成都附带：(1) 水印，(2) 签名清单，(3) 符合留存策略的审计日志。

## 实际运用

| 使用场景 | 防御措施 |
|----------|---------|
| 上线 TTS / 语音克隆 | 在每个输出上嵌入 AudioSeal（不可妥协） |
| 生物识别语音解锁 | AASIST + ECAPA 集成；活体挑战 |
| 呼叫中心欺诈检测 | 对 20% 抽样的来电运行 AASIST |
| 播客真实性 | 上传时进行 C2PA 签名，若为 AI 生成则加 AudioSeal |
| 研究 / 训练检测器 | ASVspoof 5 的 train/dev/eval 数据集 |

## 常见陷阱

- **有水印却从不运行检测器。** 毫无意义。请把检测器集成进你的 CI。
- **检测但不做校准。** 在 ASVspoof LA 上训练的 AASIST 会过拟合；真实世界准确率会下降。请在你的领域上做校准。
- **变调漏洞。** 激进的变调会移除大多数水印。要有检测作为兜底。
- **剥离元数据后重新托管。** C2PA 通过重新编码即可被轻易绕过。务必同时叠加密码学防御与感知（水印）防御。
- **把活体检测当作检测。** 让用户说出一个随机短语。这能防重放攻击，但防不住实时克隆。

## 上线交付

保存为 `outputs/skill-spoof-defender.md`。为一次语音生成部署挑选检测模型、水印方案、溯源清单以及运维手册。

## 练习

1. **简单。** 运行 `code/main.py`。在合成音频上跑玩具检测器 + 玩具水印的嵌入/检测。
2. **中等。** 安装 `audioseal`，在一段 TTS 输出中嵌入 16 比特载荷，再解码出来。用噪声破坏音频并测量比特恢复准确率（Bit Recovery Accuracy）。
3. **困难。** 在 ASVspoof 2019 LA 上微调一个 RawNet2 或 AASIST，测量 EER。在一组留出的 F5-TTS 生成片段上测试——观察分布外（OOD）检测如何退化。

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| ASVspoof | 那个基准 | 两年一届的挑战赛；2024 年即 ASVspoof 5。 |
| CM（对抗措施） | 检测器 | 分类器：真实语音 vs 合成/转换语音。 |
| SASV | 说话人验证 + CM | 一体化的生物识别 + 欺骗检测。 |
| AudioSeal | Meta 的水印 | 定位化、16 比特载荷、比 WavMark 快 485 倍。 |
| 比特恢复准确率 | 水印存活率 | 攻击后能恢复的载荷比特占比。 |
| C2PA | 溯源清单 | 关于创建/作者归属的密码学元数据。 |
| AASIST | 检测器家族 | 基于图注意力的反欺骗当前最优方案。 |

## 延伸阅读

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) —— 当前的基准。
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) —— 水印的默认选择。
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) —— 应对时序攻击的 MoE 检测器。
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) —— 当前最优的检测主干。
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) —— 鲁棒性评估。
- [C2PA specification](https://c2pa.org/specifications/specifications/) —— 溯源清单格式。
