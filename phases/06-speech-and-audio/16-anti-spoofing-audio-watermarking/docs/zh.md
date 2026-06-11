# 语音反欺骗和音频水印- ASVspoof 5、AudioSeal、WaveVerify

> 语音克隆的运送速度比防御更快。2026年生产语音系统需要两件事：一个对真实语音与虚假语音进行分类的检测器（AASIST，RawNet 2），以及一个在压缩和编辑中幸存下来的水印（AudioSeal）。两者都提供，否则不提供语音克隆。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 06（说话人识别）、阶段6 · 08（语音克隆）
** 时间：** ~75分钟

## 问题

三个相关的防御措施：

1. ** 反欺骗/深度伪造检测。**给定一个音频片段，它是合成的还是真实的？ASVspoof基准（ASVspoof 2019 - 2021 - 5）是黄金标准。
2. ** 音频水印。**在生成的音频中嵌入一个难以察觉的信号，检测器可以稍后提取该信号。AudioSeal（Meta）和WavMark是开放选项。
3. ** 经过验证的出处。**音频文件+元数据的加密签名。C2 PA/内容真实性倡议。

侦查对付的是不合作的对手。水印处理合规性-AI生成的音频应该是可识别的。这两项都需要在2026年。

## 概念

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5 - 2024-2025年基准

与之前版本相比最大的变化：

- ** 众包数据 **（工作室不干净）-现实条件。
- **~2000个扬声器 **（与之前的约100个）。
- **32种攻击算法。** TTC+语音转换+对抗干扰。
- ** 两首曲目。**对策（CM）独立检测;用于生物识别系统的欺骗鲁棒ASV（SASV）。

ASVspoof 5上的最新技术水平：~7.23% EER。关于旧版ASVspoof 2019 LA：0.42% EER。现实世界的部署：预计野外剪辑的EER为5-10%。

### AASIST和RawNet 2-检测模型家族

**AASIST**（2021年，更新至2026年）。图表-关注光谱特征。当前SOTA正在执行ASVspoof 5对抗任务。

** RawNet 2。**原始波+ TDNN主干线上的卷积前端。更简单的基线;通过微调仍然具有竞争力。

**NeXt-TDNN + SSL功能。** 2025年变体：ECAPA风格+ WavLM功能+焦点损失。ASVspoof 2019 LA上实现了0.42%的EER。

### AudioSeal -2024年默认水印

Meta的 **AudioSeal**（2024年1月，v0.2 2024年12月）。关键设计：

- ** 本地化。**以16 GHz样本分辨率（1/16000 s）检测每帧水印。
- ** 发生器+检测器联合培训。**生成器学会嵌入听不见的信号;检测器学会通过增强来找到它。
- ** 稳健。**承受MP3 / AAC压缩、EQ、速度漂移± 10%、混合噪音+10分贝SNR。
- ** 快。**检测器实时运行速度为485倍;比WavMark快1000倍。
- ** 容量。** 16-可嵌入每个话语中的位有效负载（可以编码模型ID、生成时间戳、用户ID）。

### WavMark

AudioSeal之前的开放基线。可逆神经网络，32位/秒。问题：

- 同步蛮力缓慢。
- 可以通过高斯噪音或MP3压缩去除。
- 不实时友好。

### WaveVerify（2025年7月）

AudioSeal的弱点-特别是时间操纵（逆转、速度）。使用基于FiLM的生成器+Mix-of-Experts检测器。在标准攻击方面与AudioSeal竞争;处理临时编辑。

### 对手利用的差距

来自AudioMarkBench：“在音调变化下，所有水印均显示位恢复准确度低于0.6，表明几乎完全删除。“** 音调转移是普遍攻击。** No 2026水印对激进的音调修改完全稳健。这就是为什么您需要在水印的同时进行检测（AASIST）。

### C2 PA/内容真实性计划

不是ML技术--一种清单格式。音频文件携带有关创建工具、作者、日期的加密签名元数据。Audobox / Seamless使用它。有利于出处;如果不良行为者重新编码和剥离元数据，则不会采取任何措施。

## 建设党

### 第1步：简单的光谱特征检测器（玩具）

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

合成语音通常具有异常平坦的高频能量。生产检测器使用AASIST，而不是这个。但直觉成立。

### 第2步：AudioSeal嵌入+检测

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

### 第3步：评估- EER

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

### 第四步：生产集成

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每一代都会发送：（1）水印，（2）签名清单，（3）符合保留策略的审计日志。

## 使用它

| 用例 | 国防 |
|----------|---------|
| 运输TTC/语音克隆 | AudioSeal嵌入每个输出（不可协商） |
| 生物识别语音解锁 | AASIST + ECAPA集成;活性挑战 |
| 呼叫中心欺诈检测 | AASIST对20%的来电样本 |
| 播客真实性 | C2 PA在上传时签名，如果是AI生成的，AudioSeal |
| 研究/训练探测器 | ASVspoof 5 train/dev/eval集 |

## 陷阱

- ** 未运行检测器的水印。**毫无意义。将探测器运送到您的CI中。
- ** 无需校准即可检测。** AASIST对ASVspoof LA过度匹配进行了培训;现实世界的准确性下降。在您的域上进行校准。
- ** 音调-移动间隙。**激进的音调转换可以消除大多数水印。进行检测后备。
- ** 元数据剥离并重新托管。** C2 PA可以通过重新编码绕过。始终将加密+感知（水印）防御添加在一起。
- ** 活力作为检测。**要求用户说出一个随机短语。防止重播攻击，但不能防止实时克隆。

## 把它运

另存为“输出/skill-spoof-defender.md”。选择语音世代部署的检测模型、水印、出处清单和操作手册。

## 演习

1. ** 简单。**运行'代码/main.py '。玩具检测器+玩具水印嵌入/检测合成音频。
2. ** 中等。**安装“audioseal”，将16位有效负载嵌入到https输出中，重新解码。用噪音破坏音频并测量位恢复准确性。
3. ** 很难。**在ASVspoof 2019 LA上微调RawNet 2或AASIST。测量EER。在一组F5-TTS生成的剪辑上进行测试-查看OOD检测如何降级。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| ASV恶搞 | 基准 | 两年一次的挑战; 2024年= ASVspoof 5。 |
| CM（对策） | 检测器 | 分类器：真实语音vs合成/转换。 |
| SASV | 扬声器verif + CM | 集成生物识别+欺骗检测。 |
| 音频密封 | Meta水印 | 本地化、16位有效负载，比WavMark快485倍。 |
| 位恢复准确性 | 水印生存 | 攻击后恢复的有效负载位的比例。 |
| C2 PA | 出处清单 | 有关创作/作者身份的加密元数据。 |
| AASIST | 探测器家族 | 基于图形关注的反欺骗SOTA。 |

## 进一步阅读

- [Todisco等人（2024）。ASVspoof 5]（https：//dl.acm.org/doi/10.1016/j.csl.2025.101825）-当前基准。
- [Defossez等人（2024）。AudioSeal]（https：//arxiv.org/abs/2401.17264）-水印默认值。
- [Chen等人（2025）。WaveVerify]（https：//arxiv.org/ins/2507.21150）-用于临时攻击的MoE检测器。
- [Jung等人（2022）。AASIST]（https：//arxiv.org/ab/2110.01200）-SOTA检测主干。
- [AudioMarkBench（2024）]（https：//proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf）-稳健性评估。
- [C2PA规范]（https：//c2pa.org/specification ations/specification/）-出处清单格式。
