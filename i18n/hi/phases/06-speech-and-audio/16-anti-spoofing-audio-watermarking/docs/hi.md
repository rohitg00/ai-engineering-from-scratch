# आवाज विरोधी स्पूफिंग और ऑडियो वॉटरमार्किंग  ASVspoof 5, ऑडियोसील, वेववेरिफायर

> आवाज क्लोनिंग रक्षा की तुलना में तेजी से शिप किया गया। 2026 उत्पादन आवाज प्रणालियों को दो चीजों की आवश्यकता हैः एक डिटेक्टर (एएएसआईएसटी, रावनेट2) जो वास्तविक बनाम नकली भाषण को वर्गीकृत करता है, और एक वॉटरमार्क (ऑडियोसील) जो संपीड़न और संपादन से बचता है। दोनों जहाज या आवाज क्लोनिंग जहाज नहीं।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## समस्या

तीन संबंधित रक्षाएंः

1. **Anti-spoofing / deepfake detection.**ऑडियो क्लिप को देखते हुए, क्या यह सिंथेटिक है या असली? ASVspoof बेंचमार्क (ASVspoof 2019 → 2021 → 5) स्वर्ण मानक हैं।
2. **Audio watermarking.**उत्पन्न ऑडियो में एक अदृश्य संकेत एम्बेड करें जिसे एक डिटेक्टर बाद में निकाल सकता है। ऑडियो सील (मेटा) और वेवमार्क खुले विकल्प हैं।
3. **Authenticated provenance.**ऑडियो फ़ाइलों + मेटाडेटा के क्रिप्टोग्राफिक हस्ताक्षर। C2PA / सामग्री प्रामाणिकता पहल।

पहचान उन विरोधियों को संभालती है जो सहयोग नहीं करते हैं। वॉटरमार्किंग अनुपालन को संभालती है। एआई-जनरेट ऑडियो को इस तरह से पहचाना जाना चाहिए। दोनों की आवश्यकता 2026 में है।

## अवधारणा

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  2024-2025 बेंचमार्क

पिछले संस्करणों से सबसे बड़ा परिवर्तनः

- **Crowdsourced data**(स्टूडियो साफ नहीं)  यथार्थवादी परिस्थितियों.
- **~2000 speakers**(से पहले ~ 100 के खिलाफ) ।
- **32 attack algorithms.**टीटीएस + आवाज रूपांतरण + विरोधी विघटन।
- **Two tracks.**प्रति उपाय (CM) स्टैंडअलोन डिटेक्शन; बायोमेट्रिक सिस्टम के लिए स्पूफिंग-रोबस्ट ASV (SASV) ।

यूएसएसपीओएफ 5: ~ 7.23% ईईआर पर नवीनतम। पुराने यूएसएसपीओएफ 2019 पर एलएः 0.42% ईईआर। वास्तविक दुनिया में तैनातीः जंगली क्लिप पर 5-10% ईईआर की उम्मीद करें।

### AASIST और RawNet2  पता लगाने मॉडल परिवार

**AASIST**(2021, 2026 तक अद्यतन) स्पेक्ट्रल सुविधाओं पर ग्राफ-अवलोकन। ASVspoof 5 काउंटरमेजर टास्क पर वर्तमान SOTA।

**RawNet2.**कच्चा तरंगरूप + टीडीएनएन रीढ़ की हड्डी पर घुमावदार फ्रंट-एंड. सरल आधार रेखा; अभी भी बारीक- बारीक ट्यूनिंग के साथ प्रतिस्पर्धी।

**NeXt-TDNN + SSL features.**2025 संस्करणः ECAPA शैली + WavLM सुविधाएँ + फोकल हानि। ASVspoof 2019 LA पर 0.42% EER प्राप्त करता है।

### ऑडियोसील  2024 वॉटरमार्क डिफ़ॉल्ट

मेटा **AudioSeal**(जनवरी 2024, v0.2 दिसंबर 2024)

- **Localized.**16 kHz (1/16000 s) नमूना संकल्प पर प्रति फ्रेम वॉटरमार्क का पता लगाता है।
- **Generator + detector jointly trained.**जनरेटर अदृश्य संकेत को एम्बेड करना सीखता है; डिटेक्टर इसे वृद्धि के माध्यम से ढूंढना सीखता है।
- **Robust.**MP3 / AAC संपीड़न, EQ, गति-बदली ±10%, शोर मिश्रण +10 डीबी SNR से बचा है।
- **Fast.**डिटेक्टर 485× वास्तविक समय पर चलाता है; 1000× WavMark से तेज.
- **Capacity.**16-बिट उपयोगिता लोड (मॉडल आईडी को कोड कर सकते हैं, पीढ़ी समय टिकट, उपयोगकर्ता आईडी) प्रत्येक कथन में एम्बेड करने योग्य।

### वेवमार्क

पूर्व ऑडियो सील खुला बेसलाइन. उल्टा तंत्रिका नेटवर्क, 32 बिट्स / सेकंड. समस्याएंः

- क्रूर बल सिंक्रनाइज़ेशन धीमा है।
- इसे गौशियन शोर या एमपी3 संपीड़न द्वारा हटाया जा सकता है।
- वास्तविक समय में दोस्ताना नहीं।

### वेववेरीफाई (जुलाई 2025)

ऑडियोसेल की कमजोरियों को संबोधित करता है  विशेष रूप से temporal manipulations (उपवर्तन, गति) । FiLM आधारित जनरेटर + Mixture-of-Experts डिटेक्टर का उपयोग करता है। मानक हमलों पर AudioSeal के साथ प्रतिस्पर्धी; temporal edits को संभालता है।

### अंतर विरोधी शोषण

AudioMarkBench सेः "पीच शिफ्ट के तहत, सभी वॉटरमार्क बिट रिकवरी सटीकता 0.6 से नीचे दिखाते हैं, जो लगभग पूर्ण हटाने का संकेत देता है। " **Pitch-shift is the universal attack.**No 2026 वॉटरमार्क आक्रामक पिच संशोधन के लिए पूरी तरह से मजबूत है। यही कारण है कि आपको वॉटरमार्किंग के साथ-साथ डिटेक्शन (AASIST) की आवश्यकता है।

### सी2पीए / सामग्री प्रामाणिकता पहल

एक एमएल तकनीक नहीं  एक स्पष्ट प्रारूप। ऑडियो फ़ाइलें निर्माण उपकरण, लेखक, तिथि के बारे में क्रिप्टोग्राफिक रूप से हस्ताक्षरित मेटाडेटा लेती हैं। ऑडबॉक्स / सीमलेस इसका उपयोग करती हैं। उत्पत्ति के लिए अच्छा है; कुछ भी नहीं करता है यदि एक बुरा अभिनेता री-कोडिंग और मेटाडेटा स्ट्रिप्स करता है।

```figure
v4-audio-watermark
```

## इसे बनाओ

### चरण 1: एक सरल स्पेक्ट्रल फीचर डिटेक्टर (खेलौना)

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

सिंथेटिक भाषण में अक्सर असामान्य रूप से उच्च आवृत्ति ऊर्जा होती है उत्पादन डिटेक्टर AASIST का उपयोग करते हैं, यह नहीं है। लेकिन अंतर्ज्ञान सही है।

### चरण 2: ऑडियोसील एम्बेड + डिटेक्ट

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

### चरण 3: मूल्यांकन  ईईआर

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

### चरण 4: उत्पादन एकीकरण

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

प्रत्येक पीढ़ी के जहाजों मेंः (1) वॉटरमार्क, (2) हस्ताक्षरित मैनिफस्ट, (3) भंडारण नीति के अनुरूप लेखा परीक्षा लॉग।

## इसका प्रयोग करें

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## फंदे

- **Watermark without detector ever running.**अपने आईसी में डिटेक्टर भेजें।
- **Detection without calibration.**एएसआईएसटीएस एएसवीएस स्पूफ एलए ओवरफिट पर प्रशिक्षित, वास्तविक दुनिया सटीकता में गिरावट. अपने डोमेन पर माप.
- **Pitch-shift gap.**आक्रामक पिच शिफ्ट अधिकांश जलचिह्नों को हटा देता है।
- **Metadata strip-and-rehost.**C2PA को पुनः एन्कोडिंग द्वारा मामूली रूप से बायपास किया जा सकता है। हमेशा क्रिप्टोग्राफिक + धारणा (वाटरमार्क) रक्षा को एक साथ जोड़ें।
- **Liveness as detection.**उपयोगकर्ता से एक यादृच्छिक वाक्यांश कहने के लिए कहें। दोहराव हमलों को रोकता है लेकिन वास्तविक समय में क्लोनिंग नहीं।

## इसे भेजें

`outputs/skill-spoof-defender.md`. वॉयस-जेन तैनाती के लिए डिटेक्शन मॉडल, वॉटरमार्क, उद्गम पत्र और ऑपरेशनल प्लेबुक चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. खिलौना डिटेक्टर + खिलौना वॉटरमार्क सिंथेटिक ऑडियो पर एम्बेड/डिटेक्ट करें।
2. **Medium.**स्थापित करें`audioseal`, एक 16-बिट उपयोगिता लोड TTS आउटपुट में एम्बेड, पुनः डिकोड. शोर के साथ ऑडियो भ्रष्ट और बिट रिकवरी सटीकता मापने.
3. **Hard.**ASVspoof 2019 LA पर एक RawNet2 या AASIST को ठीक से ट्यून करें। EER मापें। F5-TTS-जनित क्लिप के एक लंबे सेट पर परीक्षण करें  देखें कि OOD पता लगाने में कैसे गिरावट आती है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## आगे पढ़ना

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) वर्तमान बेंचमार्क।
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) डिफ़ॉल्ट वॉटरमार्क।
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) समय के हमले के लिए MoE डिटेक्टर।
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) SOTA का पता लगाने की रीढ़।
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) मजबूती का मूल्यांकन।
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) प्रवासन प्रपत्र प्रारूप।
