# 声反和音频水标  ASVspoof 5,音频密封,波浪验证

> 语音克隆的运输速度比防御更快. 2026 年生产语音系统需要两件事:一个检测器 (AASIST,RawNet2) 将真实与假语音分类,以及一个能够存活压缩和编辑的水印 (AudioSeal).

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## 问题

相关的三种防御:

1. **Anti-spoofing / deepfake detection.**根据音频剪辑,它是合成还是真实的?ASVspoof基准 (ASVspoof 2019 → 2021 → 5) 是黄金标准.
2. **Audio watermarking.**嵌入一个不知晓的信号在生成的音频中,一个探测器可以稍后提取.
3. **Authenticated provenance.**编码音频文件+元数据.C2PA/内容认证倡议.

检测处理不合作的对手.水标处理合规性 人工智能生成的音频应该被识别为这样.两者都需要在2026年.

## 概念

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### 美国国家标准5 2024-2025年基准

根据之前的版本,

- **Crowdsourced data**现实条件.
- **~2000 speakers**其他地方的子.
- **32 attack algorithms.**语音转换+反击扰乱.
- **Two tracks.**反措施 (CM) 独立检测;生物识别系统的伪造强 ASV (SASV).

美国avspoof5最新版本:~7.23%EER.旧avspoof2019LA:0.42%EER.现实世界部署:在野生片段上预计5-10%EER.

### 检测模型家族AASIST和RawNet2

**AASIST**现在的SOTA在ASVspoof 5反措施任务上.

**RawNet2.**曲式前端,超出原始波形+TDNN脊柱. 简单的基线;仍然具有细调的竞争力.

**NeXt-TDNN + SSL features.**2025 变种:ECAPA 式 + WavLM 功能 + 焦点损失. 在 ASVspoof 2019 LA 上达到 0.42% EER.

### 音频密码 2024年水印默认

标签**AudioSeal**基本设计:

- **Localized.**检测每一个的水印,在16 kHz样本分辨率 (1/16000s) 上.
- **Generator + detector jointly trained.**发电机学会嵌入无声信号;探测器通过增强学习找到它.
- **Robust.**能保持MP3/AAC压缩,EQ,速度变化 ±10%,噪音混合 +10 dB SNR.
- **Fast.**探测器的速度是485倍,比WavMark快1000倍.
- **Capacity.**16位实用载荷 (可编码模型ID,生成时间印,用户ID) 可嵌入每个语句.

### 波音标

音频密封前的开放基线,可逆神经网络,32位/秒.

- 同步的速度很慢.
- 通过高斯噪音或MP3压缩可以移除.
- 不是实时友好的.

### 波动验证 (2025年7月)

解决AudioSeal的弱点 具体用于时间操作 (逆转,速度).使用基于FiLM的发电机 +专家混合探测器.在标准攻击上与AudioSeal竞争力;处理时间编辑.

### 敌人利用的差距

根据AudioMarkBench的数据, "在音速转移下,所有水标显示Bit恢复精度低于0.6,表明几乎完全删除. "**Pitch-shift is the universal attack.**无2026水标完全适用于攻击性音调修改.

### 内容真实性倡议

无线电技术 一个显现格式.音频文件包含加密签名的创建工具,作者,日期的元数据.Audobox/无使用它.好来源;如果一个坏演员重新编码和排行元数据,什么都不做.

```figure
v4-audio-watermark
```

## 建立它

### 步骤1:简单的光谱特征探测器 (玩具)

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

合成语音通常具有异常平坦的高频能量. 生产探测器使用AASIST,而不是这. 但直觉是正确的.

### 步骤2: 音频密码嵌入+检测

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

### 评估 EER

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

### 步骤4:生产一体化

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每一代船舶: (1) 水标, (2) 签署的公告, (3) 保持政策的审计记录.

## 用它

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## 陷

- **Watermark without detector ever running.**没有意义,把探测器送进你的信息中心.
- **Detection without calibration.**助手训练了美国的LA过度,现实世界精度下降.
- **Pitch-shift gap.**攻击性音调移除了大多数水印.
- **Metadata strip-and-rehost.**通过重新编码,C2PA可以轻微绕过. 总是加加密 + 感知 (水印) 防御在一起.
- **Liveness as detection.**防止重播攻击,但不是实时克隆.

## 运送它

保存如`outputs/skill-spoof-defender.md`选择检测模型,水印,来源表和语音代码部署的操作操作手册.

## 运动

1. **Easy.**跑步`code/main.py`玩具探测器+玩具水印嵌入/检测到合成音频.
2. **Medium.**安装`audioseal`通过噪音破坏音频,并测量位恢复精度.
3. **Hard.**在 ASVspoof 2019 LA 上调整RawNet2或AASIST.测量EER.在F5-TTS生成的剪辑组上测试看OOD检测如何降低.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## 进一步阅读

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825)目前的基准指数.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264)默认的水标.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) 时间攻击的 MoE 探测器.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) SOTA检测脊柱.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf)强度评估.
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html)来源表格.
