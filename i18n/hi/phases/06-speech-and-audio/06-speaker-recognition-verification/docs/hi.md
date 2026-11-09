# स्पीकर पहचान और सत्यापन

> एएसआर पूछता है "उन्होंने क्या कहा? स्पीकर मान्यता पूछता है "कौन ने कहा? गणित एक ही दिखता है  एम्बेडेड प्लस कॉसिन  लेकिन प्रत्येक उत्पादन निर्णय एक एकल ईईआर संख्या पर निर्भर करता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## समस्या

एक उपयोगकर्ता एक पासवर्ड कहता है। आप जानना चाहते हैंः क्या यह वह व्यक्ति है जो वे दावा करते हैं कि वे हैं (* सत्यापन*, 1:1), या क्या यह आपके नामांकन बैंक में पहला व्यक्ति है (* पहचान*, 1: एन)? या न ही  यह एक अज्ञात वक्ता है (* खुला-सेट*)?

2018 से पहलेः GMM-UBM + i-वेक्टर। उचित EER लेकिन चैनल शिफ्ट (फोन बनाम लैपटॉप) और भावना के लिए नाजुक। 20182022: एक्स-वेक्टर (TDNN रीढ़ की हड्डी कोणीय मार्जिन के साथ प्रशिक्षित) । 2022+: ECAPA-TDNN और WavLM-बड़े एम्बेडमेंट। 2026 तक क्षेत्र में तीन मॉडल और एक मीट्रिक का वर्चस्व है।

मेट्रिक है **EER** समान त्रुटि दर. अपने निर्णय की सीमा निर्धारित करें ताकि गलत स्वीकार दर = गलत अस्वीकार दर. क्रॉसओवर ईईआर है. हर पेपर, हर लीडरबोर्ड, हर खरीद कॉल में उपयोग किया जाता है।

## अवधारणा

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**नामांकनः लक्ष्य स्पीकर का रिकॉर्ड 530 सेकंड; निश्चित आयामी एम्बेडिंग (192-डी ECAPA-TDNN के लिए, 256-डी WavLM-बड़े के लिए) की गणना करें। सत्यापनः परीक्षण अभिव्यक्ति एम्बेडिंग प्राप्त करें; कॉसिन समानता की गणना करें; एक सीमा के साथ तुलना करें।

**ECAPA-TDNN (2020, still dominant 2026).**1D conv ब्लॉक के साथ स्क््रेस-उत्साहन, मल्टी-हेड ध्यान बंडलिंग, इसके बाद 192-डी तक एक रैखिक परत। VoxCeleb 1+2 (2,700 स्पीकर, 1.1M बयान) के साथ प्रशिक्षित है जोड़ा कोण मार्जिन हानि (एएएम-सॉफ्टमैक्स) ।

**WavLM-SV (2022+).**एएएम हानि के साथ एक पूर्व प्रशिक्षित WavLM-बड़ी एसएसएल रीढ़ की हड्डी को ठीक से समायोजित करें। उच्च गुणवत्ता लेकिन धीमी  300+ एमबी बनाम 15 एमबी।

**x-vector (baseline).**TDNN + सांख्यिकीय बंडलिंग. क्लासिक; अभी भी सीपीयू / किनारे पर उपयोगी है.

**AAM-softmax.**अतिरिक्त मार्जिन के साथ मानक सॉफ्टमैक्स `m`कोणीय स्थान मेंः `cos(θ + m)`सही वर्ग के लिए। वर्गों के बीच कोणीय अलगाव बल.`m=0.2`, पैमाने `s=30`. .

### स्कोरिंग

- **Cosine**प्रवेश और परीक्षा के बीच की सीमाओं पर आधारित निर्णय।
- **PLDA (Probabilistic LDA).**परियोजना एम्बेडिंग एक लटेंट स्थान में जहां एक ही स्पीकर बनाम अलग-अलग स्पीकर में एक बंद-रूप संभावना अनुपात है। +1020% ईईआर कमी के लिए कोसिन के शीर्ष पर जोड़ा गया। मानक पूर्व-2020; अब केवल बंद सेट सेट सेटअप में उपयोग किया जाता है।
- **Score normalization.** `S-norm`या `AS-norm`: प्रत्येक स्कोर को धोखा देने वाले साधनों और अन्य लोगों के एक समूह के खिलाफ सामान्य बनाना।

### आपको जो संख्याएं पता होनी चाहिए (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### डायरीकरण

"कौन कब बोला" एक बहु-स्पीकर क्लिप में। पाइपलाइनः VAD → खंड → प्रत्येक खंड → क्लस्टर (एग्लोमेरेटिव या स्पेक्ट्रल) → चिकनी सीमाएं एम्बेड करें। आधुनिक स्टैकः `pyannote.audio`3.1, जो एक कॉल के पीछे स्पीकर सेगमेंटेशन + एम्बेडिंग + क्लस्टरिंग को बंडल करता है। 2026 एएमआई पर SOTA DER ~ 15% है (2022 में 23% से नीचे) ।

```figure
sp-eer-crossover
```

## इसे बनाओ

### चरण 1: एमएफसीसी के आंकड़ों से खिलौना एम्बेडिंग

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

सिर्फ अध्यापन के लिए नहीं।`code/main.py`इसको सिंथेटिक स्पीकर डेटा पर अवधारणा के प्रमाण के रूप में उपयोग करता है।

### चरण 2: कॉसिन समानता + सीमा

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### चरण 3: समानता जोड़े से ईईआर

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

रिटर्न (eer, threshold_at_eer) दोनों रिपोर्ट करें।

### चरण 4: स्पीचब्रेन के साथ उत्पादन

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### चरण 5: पियानोट के साथ डायरीज़ करें

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## फंदे

- **Channel mismatch.**VoxCeleb (वेब वीडियो) पर प्रशिक्षित मॉडल ≠ फोन कॉल ऑडियो। हमेशा लक्ष्य चैनल पर मूल्यांकन करें।
- **Short utterances.**ईईआर परीक्षण ऑडियो के 3 सेकंड से नीचे तेजी से गिराता है।
- **Enrollment with noise.**एक शोर भरा नामांकन एंकर को जहर देता है। ≥3 स्वच्छ नमूने और औसत का उपयोग करें।
- **Fixed threshold across conditions.**लक्ष्य डोमेन से एक लंबे समय तक बनाए गए डेवलपर सेट पर हमेशा सीमा समायोजित करें।
- **Cosine on non-normalized embeddings.**L2 पहले सामान्य हो जाए, अन्यथा परिमाण हावी हो जाए।

## इसे भेजें

`outputs/skill-speaker-verifier.md`. चयन मॉडल, नामांकन प्रोटोकॉल, सीमा समायोजन योजना, और धोखाधड़ी सुरक्षा।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. सिंथेटिक "स्पीकर" (विभिन्न टोन प्रोफाइल), 100 जोड़े परीक्षण सूची में शामिल करता है, ईईआर की गणना करता है।
2. **Medium.**30 VoxCeleb1 बयानों पर SpeechBrain ECAPA का उपयोग करें (5 स्पीकर × 6 प्रत्येक) ।
3. **Hard.**पूरा नामांकन → दैनिक → सत्यापन पाइपलाइन के साथ निर्माण `pyannote.audio`. एएमआई डेवलपमेंट सेट पर डीईआर का मूल्यांकन करें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## आगे पढ़ना

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) क्लासिक गहरे सम्मिलित कागज।
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) प्रमुख वास्तुकला 20202026
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) एसवी और डायरीकरण के लिए एसएसएल रीढ़ की हड्डी।
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) उत्पादन डायरीकरण + एम्बेडिंग स्टैक।
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) विभिन्न मॉडलों के लिए वर्तमान ईईआर वर्गीकरण।
