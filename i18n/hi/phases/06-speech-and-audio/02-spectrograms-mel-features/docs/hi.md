# स्पेक्ट्रोग्राम, मेल स्केल और ऑडियो फीचर्स

> न्यूरल नेट कच्चे तरंगों को अच्छी तरह से नहीं खपत करते हैं। वे स्पेक्ट्रोग्राम का उपभोग करते हैं। वे मेल स्पेक्ट्रोग्राम का भी बेहतर उपभोग करते हैं। 2026 में प्रत्येक एएसआर, टीटीएस और ऑडियो वर्गीकरणकर्ता इस एकल पूर्व प्रसंस्करण विकल्प से जीवित या मर जाता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## समस्या

10 सेकंड 16 kHz क्लिप लें. यह 160,000 फ्लोट है, सभी में.`[-1, 1]`कच्चे तरंग के रूप में जानकारी होती है लेकिन एक रूप में मॉडल आसानी से निकालना नहीं कर सकता है। 100 एमएस के अंतर से बोले गए दो समान ध्वन्यात्मक में पूरी तरह से अलग कच्चे नमूने होते हैं।

एक स्पेक्ट्रोग्राम इसे ठीक करता है। यह समय के विवरण को ढक देता है जहां मानव धारणा इसे अनदेखा करती है (माइक्रोसेकंड जिट) और संरचना को संरक्षित करती है जहां धारणा मौजूद है (जो आवृत्तियां ~ 1025 ms की समय खिड़कियों पर ऊर्जावान हैं) ।

मेल स्पेक्ट्रोग्राम आगे बढ़ते हैं। मनुष्य पिच लॉगरिथमिक रूप से महसूस करते हैंः 100 हर्ट्ज बनाम 200 हर्ट्ज ध्वनि "एक ही दूरी के बीच" 1000 हर्ट्ज बनाम 2000 हर्ट्ज के रूप में होती है। मेल पैमाने आवृत्ति अक्ष को मेल करने के लिए विकृत करता है। मेल-स्केल स्पेक्ट्रोग्राम 2010 से 2026 तक भाषण एमएल में सबसे महत्वपूर्ण विशेषता है।

## अवधारणा

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**तरंग के रूप को ओवरलैप फ्रेम में काटें (सामान्यतः 25 एमएस विंडो, 10 एमएस हॉप = 400 नमूने / 16 किलोग्राम के साथ 16 किलोग्राम) । प्रत्येक फ्रेम को विंडो फ़ंक्शन द्वारा गुणा करें (हैन डिफ़ॉल्ट है; थोड़ा अलग ट्रेडऑफ हैमिंग) । प्रत्येक फ्रेम को FFT। आकार के मैट्रिक्स में परिमाण स्पेक्ट्र को ढेर करें ।`(n_frames, n_freq_bins)`यह आपका स्पेक्ट्रोग्राम है।

**Log-magnitude.**कच्चे आयामों में 5-6 आयामों की सीमा होती है।`log(|X| + 1e-6)`या `20 * log10(|X|)`प्रत्येक उत्पादन पाइपलाइन में लॉग-मग्निटुडे का उपयोग किया जाता है, कच्चे पैमाने नहीं।

**Mel scale.**आवृत्ति `f`मेल के लिए हर्ट्ज़ मानचित्रों में `m`द्वारा $m = 2595 \cdot \log_{10}(1 + f / 700)$. मैपिंग लगभग 1 kHz से नीचे रैखिक और लगभग लॉगरिथमिक है। 08 kHz को कवर करने वाले 80 mel bin मानक ASR इनपुट है।

**Mel filterbank.**एक सेट त्रिकोणात्मक फिल्टर जो मेल पैमाने पर समान रूप से अलग हैं। प्रत्येक फिल्टर आसन्न एफएफटी डिब्बों का एक भारित योग है। फिल्टरबैंक मैट्रिक्स द्वारा एसटीएफटी परिमाण को गुणा करने से एक मत्मुल में मेल स्पेक्ट्रोग्राम मिलता है।

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`. विस्पर की इनपुट, पैराकीट की इनपुट, सीमलेस एम 4 टी की इनपुट, यूनिवर्सल 2026 ऑडियो फ्रंटेंड.

**MFCCs.**लॉग-मेल स्पेक्ट्रोग्राम लें, एक डीसीटी (प्रकार II) लागू करें, पहले 13 गुणांक रखें। सुविधाओं को अनियमित करें और आगे संपीड़ित करें। लगभग 2015 तक हावी सुविधा जब सीएनएन / ट्रांसफार्मर कच्चे लॉग-मेल पर पकड़े गए। अभी भी स्पीकर मान्यता (एक्स-वेक्टर, ईसीएपीए) में उपयोग किया जाता है।

**Resolution trade.**अधिक FFT = बेहतर आवृत्ति संकल्प लेकिन खराब समय संकल्प। 25 ms / 10 ms ऑडियो-एमएल डिफ़ॉल्ट है; संगीत के लिए 50 ms / 12.5 ms; क्षणिक पता लगाने के लिए 5 ms / 2 ms (ड्रम हिट, प्लॉसिव) ।

```figure
spectrogram-window
```

## इसे बनाओ

### चरण 1: तरंग के रूप को फ्रेम करें

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

एक 10 सेकंड 16 kHz क्लिप के साथ `frame_len=400, hop=160`998 फ्रेम देता है।

### चरण 2: हैन विंडो

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

FFT से पहले तत्व-बुद्धिमान गुणा करें। शून्य-अंत बिंदुओं पर ट्रंकिंग के कारण होने वाले स्पेक्ट्रल लीक को हटा देता है।

### चरण 3: STFT परिमाण

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

उत्पादन उपयोग `torch.stft`या `librosa.stft`(एफएफटी-समर्थित, वेक्टरिज़्ड) यहां लूप शैक्षिक है; यह संक्षिप्त क्लिप पर चलता है `code/main.py`. .

### चरण 4: मेल फिल्टरबैंक

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 mels 08 kHz के साथ`n_fft=400`एक देता है `(80, 201)`मैट्रिक्स. गुणा करें `(n_frames, 201)`प्राप्त करने के लिए ट्रांसपोस द्वारा STFT परिमाण `(n_frames, 80)`मेल स्पेक्ट्रोग्राम।

### चरण 5: लॉग-मेल

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

आम विकल्प: `librosa.power_to_db`(संदर्भ-सामान्यकृत डीबी), `10 * log10(power + eps)`. विस्पर एक अधिक संलग्न क्लिप + सामान्यीकरण दिनचर्या का उपयोग करता है (वीस्पर के `log_mel_spectrogram`) ।

### चरण 6: एमएफसीसी

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

प्रत्येक लॉग-मेल फ्रेम पर डीसीटी लागू करें, पहले 13 गुणांक रखें। यह आपका एमएफसीसी मैट्रिक्स है। पहला गुणांक आमतौर पर गिरा दिया जाता है (यह समग्र ऊर्जा को कोड करता है) ।

## इसका प्रयोग करें

2026 स्टैकः

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

अंगूठे का नियम: **if you are not working on music, start with 80 log-mels.**सबूत का बोझ किसी भी विचलन पर है।

## 2026 में भी फंसे हुए जाल

- **Mel count mismatch.**80 मील के साथ प्रशिक्षण, 128 मील के साथ निष्कर्ष। मौन विफलता. दोनों छोरों पर विशेषता आकार लॉग.
- **Sample-rate mismatch upstream.**22.05 kHz पर गणना की गई Mels 16 kHz से अलग दिखती हैं। SR * पहले * विशेषता तय करें।
- **dB vs log.**विस्पर लॉग-मेल की अपेक्षा करता है, डीबी-मेल नहीं. कुछ एचएफ पाइपलाइनों को ऑटो-डिटेक्ट किया जाएगा; आपका कस्टम कोड नहीं करेगा.
- **Normalization drift.**प्रशिक्षण के दौरान प्रति-उत्तर सामान्यीकरण, निष्कर्ष के दौरान वैश्विक सामान्यीकरण उत्पादन बग जो WER दोगुना करता है।
- **Leakage from padding.**क्लिप के अंत को शून्य पैडिंग से पीछे की फ्रेम में एक सपाट स्पेक्ट्रम उत्पन्न होता है।

## इसे भेजें

`outputs/skill-feature-extractor.md`. कौशल एक दिए गए मॉडल लक्ष्य के लिए विशेषता प्रकार, मेल गिनती, फ्रेम/हॉप और सामान्यीकरण चुनता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. यह एक चिप (आवृत्ति 200 → 4000 हर्ट्ज) को संश्लेषित करता है और प्रति फ्रेम argmax mel bin प्रिंट करता है। प्लॉट (वैकल्पिक) और पुष्टि करता है कि यह स्वीप से मेल खाता है।
2. **Medium.** के साथ फिर से चलाएँ`n_mels`में `{40, 80, 128}`और `frame_len`में `{200, 400, 800}`समय अक्ष पर तेज-पीक बैंडविड्थ मापें. कौन सा संयोजन चिप को सबसे अच्छा हल करता है?
3. **Hard.**कार्यान्वयन`power_to_db`और AudioMNIST पर एक छोटे सीएनएन वर्गीकरण की एएसआर सटीकता की तुलना (ए) कच्चे लॉग-मेल, (बी) डीबी-मेल के साथ `ref=max`, (ग) एमएफसीसी-13 + डेल्टा + डेल्टा-डेल्टा। शीर्ष-1 सटीकता रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## आगे पढ़ना

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) एमएफसीसी पेपर।
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) मूल मेल स्केल।
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) संदर्भ कार्यान्वयन पढ़ें।
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) संदर्भ के लिए `mfcc`,`melspectrogram`, और कूद / खिड़की.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) पैराकीट + कैनरी मॉडल के लिए उत्पादन पैमाने पर पाइपलाइन।
