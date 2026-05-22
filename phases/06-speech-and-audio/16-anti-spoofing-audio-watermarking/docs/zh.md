# 语音反欺骗与音频水印 — ASVspoof 5、AudioSeal、WaveVerify

> 语音克隆的部署速度超过了防御手段。2026年的生产级语音系统需要两样东西：一个分类器（AASIST、RawNet2）来区分真假语音，以及一个能在压缩和编辑后幸存的水印（AudioSeal）。两者都必须交付，否则不要发布语音克隆功能。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段6 · 06（说话人识别）、阶段6 · 08（语音克隆）
**耗时：** 约75分钟

## 问题

三种相互关联的防御手段：

1. **反欺骗 / 深度伪造检测。** 给定一段音频片段，它是合成的还是真实的？ASVspoof基准（ASVspoof 2019 → 2021 → 5）是黄金标准。
2. **音频水印。** 在生成的音频中嵌入一个不可感知的信号，后续可由检测器提取。AudioSeal（Meta）和WavMark是可选的开源方案。
3. **可验证来源。** 对音频文件 + 元数据进行加密签名。C2PA / 内容真实性倡议（Content Authenticity Initiative）。

检测应对不合作的对手。水印应对合规要求——AI生成的音频应能被识别为AI生成。2026年两者都是必需的。

## 概念

![反欺骗 vs 水印 vs 来源验证——三层防御](../assets/spoofing-watermark.svg)

### ASVspoof 5 —— 2024-2025 基准

与之前版本最大的变化：

- **众包数据**（非录音室洁净数据）—— 真实环境条件。
- **约2000名说话人**（之前约100名）。
- **32种攻击算法。** TTS + 语音转换 + 对抗性扰动。
- **两条赛道。** 对策（Countermeasure, CM）独立检测；鲁棒性说话人验证（Spoofing-robust ASV, SASV）用于生物识别系统。

ASVspoof 5上的最佳表现：~7.23%等错误率（EER）。在更早的ASVspoof 2019 LA上：0.42% EER。实际部署：在野外片段上预期5-10% EER。

### AASIST 和 RawNet2 —— 检测模型家族

**AASIST**（2021年，持续更新至2026年）。基于谱特征的图注意力机制。当前ASVspoof 5对策任务的最佳表现（SOTA）。

**RawNet2。** 基于原始波形的卷积前端 + TDNN主干。更简单的基线；微调后仍具竞争力。

**NeXt-TDNN + SSL特征。** 2025年变体：ECAPA风格 + WavLM特征 + 焦点损失（focal loss）。在ASVspoof 2019 LA上达到0.42% EER。

### AudioSeal —— 2024年水印的默认选择

Meta的**AudioSeal**（2024年1月，v0.2于2024年12月）。关键设计：

- **局部性。** 以16 kHz采样分辨率（1/16000秒）逐帧检测水印。
- **生成器+检测器联合训练。** 生成器学习嵌入不可听信号；检测器学习通过数据增强找到它。
- **鲁棒性。** 能抵抗MP3/AAC压缩、均衡器、速度变化±10%、噪声混合+10 dB信噪比（SNR）。
- **速度。** 检测器运行速度是实时的485倍；比WavMark快1000倍。
- **容量。** 16比特载荷（可编码模型ID、生成时间戳、用户ID）可嵌入每个话语。

### WavMark

AudioSeal之前的开源基线。可逆神经网络，32比特/秒。问题：

- 同步暴力破解速度慢。
- 高斯噪声或MP3压缩可将其移除。
- 不利于实时处理。

### WaveVerify（2025年7月）

解决了AudioSeal的弱点——特别是时间域操作（反转、变速）。使用基于FiLM的生成器 + 混合专家（Mixture-of-Experts）检测器。在标准攻击上与AudioSeal竞争力相当；能处理时间域编辑。

### 对手利用的缺口

来自AudioMarkBench：“在音高偏移下，所有水印的比特恢复准确率（Bit Recovery Accuracy）低于0.6，表明几乎完全移除。” **音高偏移是通用攻击。** 截至2026年，没有任何水印对激进的音高修改完全鲁棒。这就是为什么你需要检测（AASIST）与水印并存。

### C2PA / 内容真实性倡议

不是机器学习技术——而是一种清单格式。音频文件携带关于创作工具、作者、日期的加密签名元数据。Audobox / Seamless 使用它。对来源验证很有用；但如果恶意攻击者重新编码并剥离元数据，则毫无作用。

## 构建

### 步骤1：一个简单的谱特征检测器（示例）

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

合成语音通常具有异常平坦的高频能量。生产级检测器使用AASIST，而非此方法。但直觉上成立。

### 步骤2：AudioSeal 嵌入 + 检测

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
# result: [0, 1] 之间的浮点数 — 水印存在的概率
# decoded_payload: 16比特；与嵌入的载荷比对
```

### 步骤3：评估 — EER

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

### 步骤4：生产集成

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每次生成都交付：(1) 水印，(2) 签名清单，(3) 符合保留策略的审计日志。

## 使用

| 用例 | 防御手段 |
|------|---------|
| 发布 TTS / 语音克隆 | 每个输出嵌入 AudioSeal（不可协商） |
| 生物识别语音解锁 | AASIST + ECAPA 集成；活体检测挑战 |
| 呼叫中心欺诈检测 | 对20%的来电样本运行 AASIST |
| 播客真实性 | 上传时进行 C2PA 签名，若为AI生成则加 AudioSeal |
| 研究 / 训练检测器 | ASVspoof 5 训练集/开发集/评估集 |

## 陷阱

- **有水印但从不运行检测器。** 毫无意义。在持续集成中部署检测器。
- **检测未校准。** 在 ASVspoof LA 上训练的 AASIST 过拟合；实际精度下降。针对你的领域进行校准。
- **音高偏移缺口。** 激进的音高偏移会移除大多数水印。准备检测作为后备。
- **元数据剥离并重新托管。** 通过重新编码可以轻松绕过 C2PA。始终同时部署加密 + 感知（水印）防御。
- **用活体检测代替检测。** 要求用户说一个随机短语。可防止重放攻击，但无法阻止实时克隆。

## 发布

保存为 `outputs/skill-spoof-defender.md`。为一个语音生成部署选择检测模型、水印、来源验证清单以及操作手册。

## 练习

1. **简单。** 运行 `code/main.py`。在合成音频上测试示例检测器 + 示例水印嵌入/检测。
2. **中等。** 安装 `audioseal`，在 TTS 输出中嵌入16比特载荷，然后重新解码。向音频加入噪声并测量比特恢复准确率（Bit Recovery Accuracy）。
3. **困难。** 在 ASVspoof 2019 LA 上微调 RawNet2 或 AASIST。测量 EER。在保留的 F5-TTS 生成片段上测试——观察检测性能如何因分布外数据而下降。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|---------|---------|
| ASVspoof | 基准 | 两年一度的挑战；2024年为ASVspoof 5。 |
| CM（对策） | 检测器 | 分类器：真实语音 vs 合成/转换语音。 |
| SASV | 说话人验证+CM | 集成生物识别与欺骗检测。 |
| AudioSeal | Meta水印 | 局部性，16比特载荷，比WavMark快485倍。 |
| 比特恢复准确率（Bit Recovery Accuracy） | 水印存活率 | 攻击后恢复的载荷比特比例。 |
| C2PA | 来源验证清单 | 关于创作/作者身份的加密元数据。 |
| AASIST | 检测器家族 | 基于图注意力的反欺骗最佳表现（SOTA）。 |

## 延伸阅读

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) — 当前基准。
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) — 水印默认方案。
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) — 针对时间域攻击的混合专家检测器。
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) — 最佳表现检测主干。
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) — 鲁棒性评估。
- [C2PA specification](https://c2pa.org/specifications/specifications/) — 来源验证清单格式。