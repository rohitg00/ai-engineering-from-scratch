# ऑडियो वर्गीकरण  एमएफसीसी पर k-NN से एएसटी और बीएटी तक

> "डॉग लात मारना बनाम सिरिन" से लेकर "यह कौन सी भाषा है" तक सब कुछ ऑडियो वर्गीकरण है। विशेषताएं मिल्स हैं। वास्तुकला हर दशक में बदलती है। मूल्यांकन एयूसी, एफ 1 और प्रति वर्ग याद रखने के लिए रहता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## समस्या

आपको 10 सेकंड का क्लिप मिलता है। आप जानना चाहते हैंः "यह क्या है?" शहरी ध्वनि (सिरिन, ड्रिल, कुत्ता), भाषण आदेश (हाँ / नहीं / रोक), भाषा आईडी (en / es / ar), स्पीकर भावना (क्रोध / तटस्थ), या पर्यावरण ध्वनि (इनडोर / आउटडोर, बाबल) । ये सभी * ऑडियो वर्गीकरण * हैं, और 2026 में बेसलाइन वास्तुकला परिपक्व हैः लॉग-मेल → सीएनएन या ट्रांसफार्मर → सॉफ्टमैक्स।

मुख्य कठिनाई नेटवर्क नहीं है। यह डेटा है। ऑडियो डेटासेट में क्रूर वर्ग असंतुलन, मजबूत डोमेन शिफ्ट (स्वच्छ बनाम शोर), और लेबल शोर (किसने "शहरी बाबल" बनाम "रेस्टोरेंट शोर" का फैसला किया?) है। 80% समस्या क्यूरेशन, वृद्धि और मूल्यांकन है, ट्रांसफार्मर के लिए सीएनएन को आदान-प्रदान नहीं।

## अवधारणा

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**प्रति क्लिप फ्लैट एमएफसीसी, लेबल बैंक के साथ कॉसिन समानता की गणना, शीर्ष के बहुमत वोट वापस। साफ, छोटे डेटा सेट (स्पीच कमांड, ईएससी -50) पर आश्चर्यजनक रूप से मजबूत। कोई जीपीयू के बिना चलता है।

**2D CNN on log-mels (2015-2019).**उपचार `(T, n_mels)`एक छवि के रूप में लॉग मेल लागू करें ResNet-18 या VGG शैली. वैश्विक औसत समय अक्ष पूल. कक्षाओं पर सॉफ्टमैक्स. अभी भी अधिकांश 2026 कागले प्रतियोगिताओं में आधार रेखा.

**Audio Spectrogram Transformer, AST (2021-2024).**लॉग-मेल (जैसे 16×16 पैच) को पैच करें, स्थिति एम्बेड करें, एक ViT में फ़ीड करें। निगरानी वाले सीखने के लिए AudioSet पर अत्याधुनिकता (mAP 0.485) ।

**BEATs and WavLM-base (2024-2026).**लाखों घंटों पर स्व-निरीक्षण पूर्व प्रशिक्षण। आपके द्वारा आवश्यक 1-10% पर्यवेक्षित डेटा के साथ अपने कार्य को ठीक से समायोजित करें। 2026 में यह गैर-भाषण ऑडियो के लिए डिफ़ॉल्ट प्रारंभिक बिंदु है। बीएटीएस-आईटीईआर 3 ऑडियोसेट पर एएसटी को 1-2 एमएपी से हराता है जबकि 1/4 गणना का उपयोग करता है।

**Whisper-encoder as a frozen backbone (2024).**विस्पर के एन्कोडर ले लो, डिकोडर छोड़ दो, एक रैखिक वर्गीकरण संलग्न करें भाषा आईडी पर लगभग-SOTA और शून्य ऑडियो वृद्धि के साथ सरल घटना वर्गीकरण। "फ्री लंच" मूल रेखा।

### वर्ग असंतुलन वास्तविक चुनौती है

ESC-50: 50 वर्ग, 40 क्लिप प्रत्येक  संतुलित, आसान। UrbanSound8K: 10 वर्ग, असंतुलित 10:1। AudioSet: 632 वर्गों के साथ 100,000:1 लंबी पूंछ। तकनीक जो काम करती हैः

- प्रशिक्षण के दौरान संतुलित नमूनाकरण (मूल्यांकन में नहीं)
- मिश्रणः दो क्लिप (और उनके लेबल) को विस्तार के रूप में रैखिक रूप से इंटरपोलेट करें।
- स्पेकआगमेंटः यादृच्छिक समय और आवृत्ति बैंड को कवर करें. सरल; महत्वपूर्ण।

### मूल्यांकन

- बहु-वर्ग विशेष (भाषण आदेश): शीर्ष-1 सटीकता, शीर्ष-5 सटीकता।
- बहु-वर्ग बहु-लेबल (AudioSet, UrbanSound-style): औसत औसत सटीकता (mAP) ।
- भारी असंतुलितः प्रति वर्ग रिकॉल + मैक्रो F1.

2026 संख्या आपको पता होनी चाहिएः

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## इसे बनाओ

### चरण 1: फीट्यूरिज़ करें

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### चरण 2: निश्चित लंबाई का सारांश

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

सरल लेकिन मजबूतः समय के माध्यम से औसत + भिन्नता 13 कोफ़ एमएफसीसी के लिए 26 आयाम फिक्स्ड एम्बेडिंग देती है। यह तुरंत चलता है। 2017 में ESC-50 पर अत्याधुनिक एनएन बेसलाइनों को हराया।

### चरण 3: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### चरण 4: लॉग-मेल पर सीएनएन में अपग्रेड

पायटॉर्च में:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

3M पैरामीटर. एक ही RTX 4090 के साथ ESC-50 पर ~ 10 मिनट में ट्रेनें। 80% + सटीकता।

### चरण 5: पूर्व प्रशिक्षित ऑडियो ट्रांसफार्मर (एएसटी दिखाया गया) को ठीक से समायोजित करें

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

उदाहरण को Hub से AST ठीक-ठाक. बीएटीएस, 2026 डिफ़ॉल्ट, Hugging Face Hub पर नहीं है: डाउनलोड एक चेकपॉइंट से [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)और इसे उस रेपो के साथ लोड `BEATs`और `BEATsConfig`वर्ग; सूक्ष्म-ट्यूनिंग लूप एक ही आकार रखता है।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

निर्णय नियम: **start with a frozen backbone, not a fresh model**बीट के सिर को ठीक से समायोजित करने से आपको घंटों में 95% सोटा मिलता है, हफ्तों में नहीं।

## इसे भेजें

`outputs/skill-classifier-designer.md`. किसी दिए गए ऑडियो वर्गीकरण कार्य के लिए वास्तुकला, वृद्धि, वर्ग संतुलन रणनीति और मूल्यांकन मीट्रिक चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. यह एक 4 वर्ग सिंथेटिक डेटासेट (विभिन्न पिच पर शुद्ध स्वर) पर k-NN MFCC बेसलाइन को प्रशिक्षित करता है।
2. **Medium.**प्रतिस्थापन`summarize`क्या 4 क्षणों का पूल एक ही सिंथेटिक डेटासेट पर mean + var से मिलता है?
3. **Hard.**उपयोग करना`torchaudio`, ESC-50 फोल्ड पर 2D सीएनएन को प्रशिक्षित करें। 5 गुना क्रॉस-वैलिडेशन सटीकता रिपोर्ट करें। स्पेस एगमेंट (टाइम मास्क = 20, आवृत्ति मास्क = 10) जोड़ें और डेल्टा रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## आगे पढ़ना

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) 2021 से रिकॉर्ड वास्तुकला2024 तक।
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) 2024+ डिफ़ॉल्ट।
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) प्रमुख ऑडियो वृद्धि।
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) 50 वर्गों का बेंचमार्क जो जीवित रहता है।
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) 632 वर्ग यूट्यूब टैक्सोनामी; अभी भी स्वर्ण मानक।
