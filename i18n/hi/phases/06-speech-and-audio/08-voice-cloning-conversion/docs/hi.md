# आवाज क्लोनिंग और आवाज रूपांतरण

> आवाज क्लोनिंग आपके पाठ को किसी और की आवाज में पढ़ता है। आवाज रूपांतरण आपकी आवाज को किसी और की आवाज में फिर से लिखता है जबकि आप जो कहते हैं उसे संरक्षित करता है। दोनों एक ही विघटन पर लटकाए रहते हैंः सामग्री से अलग स्पीकर पहचान।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## समस्या

2026 में, उपभोक्ता जीपीयू के साथ किसी के भी आवाज का एक उच्च गुणवत्ता वाला क्लोन बनाने के लिए 5 सेकंड का ऑडियो क्लिप पर्याप्त है। इलेवनलैब्स, एफ 5-टीटीएस, ओपनवॉइस वी 2, वॉइसबॉक्स सभी शून्य-शॉट या कुछ-शॉट क्लोनिंग जहाज। प्रौद्योगिकी एक आशीर्वाद (उपलब्धता टीटीएस, डबिंग, सहायक आवाजें) और एक हथियार (स्कैम कॉल, राजनीतिक गहरे फर्जी, आईपी चोरी) है।

दो निकटतः संबंधित कार्यः

- **Voice cloning (TTS-side):**पाठ + 5 सेकंड संदर्भ आवाज → उस आवाज में ऑडियो।
- **Voice conversion (speech-side):**स्रोत ऑडियो (व्यक्ति A कहते हैं X) + व्यक्ति B की संदर्भ आवाज → B का ऑडियो कहते हैं X.

दोनों एक तरंगरूप (सामग्री, स्पीकर, प्रोसोडी) में कारक हैं और एक स्रोत से दूसरे स्रोत से स्पीकर के साथ सामग्री को फिर से जोड़ते हैं।

मुख्य प्रतिबंध आप अब 2026 में जहाज के तहतः **watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**आपकी पाइपलाइन को एक अदृश्य जलचिह्न का उत्सर्जन करना चाहिए और गैर-सहमति वाले क्लोन को अस्वीकार करना चाहिए।

## अवधारणा

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**एक 5 सेकंड क्लिप को एक मॉडल पर पारित करें जिसे हजारों स्पीकर पर प्रशिक्षित किया गया है। स्पीकर एन्कोडर क्लिप को एक स्पीकर एम्बेडिंग पर मैप करता है; TTS डिकोडर उस एम्बेडिंग प्लस टेक्स्ट पर स्थितियां रखता है।

F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024) द्वारा उपयोग किया जाता है।

**Few-shot fine-tuning.**लक्ष्य आवाज के 5-30 मिनट रिकॉर्ड करें। लोरा एक घंटे के लिए बेस मॉडल को ठीक से ट्यून करता है। गुणवत्ता "ठीक" से "अविशिष्ट" तक कूदती है। कोकी और इलेवनलैब्स दोनों इस पैटर्न का समर्थन करते हैं; समुदाय इसे F5-TTS के साथ उपयोग करता है।

**Voice conversion (VC).**दो परिवारः

- **Recognition-synthesis.**सामग्री प्रतिनिधित्व (जैसे, नरम ध्वन्यात्मक पोस्टियर्स, पीपीजी) को निकालने के लिए एएसआर-जैसे मॉडल चलाएं, फिर लक्षित स्पीकर एम्बेडिंग के साथ फिर से संश्लेषण करें। भाषा और उच्चारण के लिए मजबूत। KNN-VC (2023), Diff-HierVC (2023) द्वारा उपयोग किया जाता है।
- **Disentanglement.**एक ऑटोकोडर को प्रशिक्षित करें जो बोतल गला पर लटेंट स्थान में सामग्री, स्पीकर और प्रोसोडी को अलग करता है। अनुमान पर एम्बेडिंग स्पीकर स्विच करें। कम गुणवत्ता लेकिन तेज़। ऑटोवीसी (2019) द्वारा उपयोग किया जाता है, VITS-VC संस्करण।

**Neural codec-based cloning (2024+).**VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox  ध्वनि को SoundStream / EnCodec से अलग टोकन के रूप में व्यवहार करते हैं, कोडक टोकन पर एक बड़े ऑटोरेग्रेसिव या प्रवाह-मिलान मॉडल का अभ्यास करते हैं। गुणवत्ता कम संकेतों पर ElevenLabs के समान है।

### नैतिकता का टुकड़ा, एक बोल्ट नहीं

**Watermarking.**PerTh (पर्थ) और SilentCipher (2024) ऑडियो में ~16-32 बिट आईडी को अदृश्य रूप से एम्बेड करते हैं। पुनर्-एन्कोडिंग, स्ट्रीमिंग और सामान्य संपादन से बचा जाता है। उत्पादन के लिए तैयार खुला स्रोत।

**Consent gates.**हर क्लोन आउटपुट को एक सत्यापित सहमति रिकॉर्ड के साथ जोड़ा जाना चाहिए। "मैं, रोहित, 2026-04-22 को, इस आवाज को एक्स उद्देश्य के लिए अधिकृत करता हूं।" एक छेड़छाड़ के लिए स्पष्ट लॉग में स्टोर करें।

**Detection.**एएसआईएसटी, रावनेट2, और वेव2वीईसी2-एएएसआईएसटी डिटेक्टर के रूप में जहाज। एएसवीएसपूफ 2025 चैलेंज ने एलेवनलैब्स, वैल-ई 2, और बार्क आउटपुट के खिलाफ अत्याधुनिक डिटेक्टरों के लिए 0.82.3% के ईईआर प्रकाशित किए।

### संख्याएँ (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

अधिकांश श्रोताओं के लिए SECS > 0.70 सामान्यतः लक्ष्य से अलग नहीं होता है।

```figure
sp-voice-factorize
```

## इसे बनाओ

### चरण 1: पहचान-संश्लेषण के साथ विघटित करें (मुख्य.py में केवल कोड डेमो)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

अवधारणा सरल; कार्यान्वयन द्रव्यमान में है `tts_model`और स्पीकर एन्कोडर।

### चरण 2: F5-TTS के साथ शून्य शॉट क्लोन

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

संदर्भ प्रतिलेख को ऑडियो से बिल्कुल मेल लेना चाहिए; असंगतता संरेखण को तोड़ती है।

### चरण 3: KNN-VC के साथ आवाज रूपांतरण

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC स्रोत और लक्ष्य पूल के लिए प्रति फ्रेम एम्बेडमेंट निकालने के लिए WavLM चलाता है, फिर पूल में अपने निकटतम पड़ोसी के साथ प्रत्येक स्रोत फ्रेम की जगह लेता है। गैर-परिमेट्रिक, लक्ष्य भाषण के एक मिनट के साथ काम करता है।

### चरण 4: एक वॉटरमार्क एम्बेड करें

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~32 बिट उपयोगी लोड, MP3 पुनः एन्कोडिंग और प्रकाश शोर के बाद पता लगाया जा सकता है।

### चरण 5: सहमति गेट

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## फंदे

- **Misaligned reference transcript.**F5-TTS और इसी तरह के संदर्भ पाठ को संदर्भ ऑडियो से सटीक रूप से मेल खाने की आवश्यकता होती है, विराम चिह्न शामिल है।
- **Reverberant reference.**इको क्लोन को मारता है।
- **Emotional mismatch.**प्रशिक्षण संदर्भ "खुश" हर चीज के हंसमुख क्लोन का उत्पादन करता है। लक्ष्य उपयोग के लिए संदर्भ भावनाओं को मेल खाता है।
- **Language leakage.**अंग्रेजी बोलने वाले को क्लोन करना और फिर मॉडल को फ्रेंच बोलने के लिए पूछना अक्सर उच्चारण को वैसे भी ले जाता है; क्रॉस-लिंग्वेज मॉडल (XTTS, VALL-E X) का उपयोग करें।
- **No watermark.**अगस्त 2026 से यूरोपीय संघ में कानूनी रूप से नामिली नहीं।

## इसे भेजें

`outputs/skill-voice-cloner.md`. सहमति गेट + वॉटरमार्क + गुणवत्ता लक्ष्य के साथ क्लोनिंग या रूपांतरण पाइपलाइन का डिजाइन करें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. दो "स्पीकर" के बीच कॉसिनस को गणना करके स्पीकर-एम्बेडिंग स्वैप को प्रदर्शित करता है।
2. **Medium.**अपने स्वयं के आवाज को क्लोन करने के लिए ओपनवॉइस v2 का उपयोग करें संदर्भ और क्लोन के बीच SECS मापें।
3. **Hard.**20 क्लोन पर SilentCipher वॉटरमार्क लागू करें, उन्हें 128 kbps MP3 एन्कोड + डिकोड के माध्यम से चलाएं, उपयोगिता लोड का पता लगाएं। बिट सटीकता रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## आगे पढ़ना

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) ओपन सोर्स SOTA शून्य शॉट क्लोनिंग।
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)और [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) तंत्रिका-कोडेक टीटीएस।
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) विघटन आधारित आवाज रूपांतरण।
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) पुनर्प्राप्ति आधारित वीसी।
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) उत्पादन के लिए तैयार 32-बिट ऑडियो वॉटरमार्क।
- [ASVspoof 2025 results](https://www.asvspoof.org/) डिटेक्टर बनाम सिंथेसाइज़र हथियारों की दौड़, 2026 में अद्यतन।
