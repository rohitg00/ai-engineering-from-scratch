# ऑडियो मूल्यांकन  WER, MOS, UTMOS, MMAU, FAD, और ओपन रैंकरबोर्ड

> आप जो नहीं माप सकते हैं उसे भेज नहीं सकते। इस पाठ में प्रत्येक ऑडियो कार्य के लिए 2026 मीट्रिक का नाम दिया गया हैः एएसआर (WER, सीईआर, आरटीएफएक्स), टीटीएस (एमओएस, यूटीएमओएस, एसईसीएस, WER-ऑन-एएसआर-राउंड-ट्रिप), ऑडियो-भाषा (एमएमएयू, लॉन्ग ऑडियोबेंच), संगीत (एफएडी, सीएलएपी), और स्पीकर (ईईआर) । साथ ही आप तुलना करने वाले रैंकिंगबोर्ड।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## समस्या

प्रत्येक ऑडियो कार्य में कई मीट्रिक होते हैं, प्रत्येक एक अलग अक्ष को मापता है। गलत मीट्रिक का उपयोग करके आप एक मॉडल कैसे भेजते हैं जो आपके डैशबोर्ड पर बहुत अच्छा दिखता है और उत्पादन में भयानक है। 2026 की कैनोनिकल सूचीः

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## अवधारणा

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### एएसआर मेट्रिक्स

**WER (Word Error Rate).** `(S + D + I) / N`. कम अक्षर, अंकन, अंकन से पहले संख्याओं को सामान्य करें.`jiwer`या OpenAI की `whisper_normalizer`. &lt;5% = मानव-समानता भाषण पढ़ना.

**CER (Character Error Rate).**एक ही सूत्र, वर्ण-स्तर। स्वर भाषाओं (मान्डारीन, कैंटोन) के लिए उपयोग किया जाता है जहां शब्द विभाजन अस्पष्ट है।

**RTFx (inverse real-time factor).**ऑडियो सेकंड प्रति वॉल-क्लॉक सेकंड पर संसाधित. उच्च बेहतर है. पैराकीट-टीडीटी 3380x है. चुप्पी-बड़ी-v3 ~30x है.

**First-token latency.**ऑडियो इनपुट से पहले ट्रांसक्रिप्ट टोकन तक दीवार घड़ी स्ट्रीमिंग के लिए महत्वपूर्ण है।

### टीटीएस माप

**MOS (Mean Opinion Score).**1-5 मानव रेटिंग. स्वर्ण मानक लेकिन धीमा. प्रति नमूना 20+ श्रोताओं, प्रति मॉडल 100+ नमूने एकत्र.

**UTMOS (2022-2026).**सीखा MOS पूर्वानुमान. मानक बेंचमार्क पर मानव MOS के साथ ~0.9 के अनुरूप. F5-TTS: UTMOS 3.95; ग्राउंड सत्यः 4.08.

**SECS (Speaker Encoder Cosine Similarity).**आवाज क्लोनिंग के लिए. संदर्भ और क्लोन आउटपुट के बीच ECAPA कोसिन एम्बेडिंग. &gt; 0.75 = पहचान योग्य क्लोन.

**WER-on-ASR-round-trip.**TTS आउटपुट पर Whisper चलाएं, इनपुट पाठ के खिलाफ WER की गणना करें। समझदारी की प्रतिगमन को पकड़ता है। 2026 SOTA: अंग्रेजी परीक्षण सेट पर 2% WER (मान्डारिन सेट की बजाय CER रिपोर्ट करते हैं) ।

**TTFA (time-to-first-audio).**वॉल क्लॉक लेटेन्स. कोकोरो-82एम: ~100 ms; F5-TTS: ~1 s.

### आवाज क्लोनिंग-विशिष्ट

**SECS + MOS + CER**एक उच्च एसईसीएस लेकिन कम एमओएस स्कोर का मतलब है कि टिमबर-राइट-लेकिन-अनैसर्गिक; विपरीत का मतलब है प्राकृतिक आवाज लेकिन गलत स्पीकर।

### स्पीकर सत्यापन

**EER (Equal Error Rate).**वोक्ससेलेब1-ओ पर ECAPA: 0.87%.

**minDCF (min Detection Cost).**चयनित परिचालन बिंदु पर वजन की गई लागत (अक्सर FAR=0.01) जो EER की तुलना में उत्पादन से अधिक प्रासंगिक है।

### डायरीकरण

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. मिस स्पीच + फेक अलार्म स्पीच + स्पीकर-कन्फ्यूजन, प्रत्येक अंश के रूप में। एएमआई मीटिंग्सः डीईआर ~ 10-20% यथार्थवादी है। पियानोट 3.1 + प्रेसिजन-2 विज्ञापनः &lt;10% डीईआर अच्छी तरह से रिकॉर्ड किए गए ऑडियो पर।

**JER (Jaccard Error Rate).**डीईआर के विकल्प, मजबूत से लघु खंड पूर्वाग्रह।

### ऑडियो वर्गीकरण

बहु-लेबलः **mAP (mean Average Precision)**सभी वर्गों पर। ऑडियोसेट: बीएटीएस-आईटीईआर3 के लिए 0.548 एमएपी।

बहु-वर्ग विशेष: **top-1, top-5 accuracy**. भाषण कमांड v2: 99.0% शीर्ष-1 (ऑडियो-MAE).

असंतुलित: **macro F1**+ **per-class recall**. प्रति वर्ग रिपोर्ट  समग्र सटीकता छिपाता है कि कौन से वर्ग विफल होते हैं।

### संगीत पीढ़ी

**FAD (Fréchet Audio Distance).**वास्तविक बनाम उत्पन्न ऑडियो के वीजीजीआईएसईएम एम्बेडेड वितरण के बीच दूरी। MusicGen-small on MusicCaps: 4.5. MusicLM: 4.0. कम बेहतर।

**CLAP Score.**CLAP एम्बेडेड का उपयोग करके पाठ-ऑडियो संरेखण स्कोर। &gt; 0.3 = उचित संरेखण।

**Listening panel MOS.**फिर भी उपभोक्ता-ग्रेड संगीत के लिए अंतिम शब्द। Suno v5 ने Suno के अपने जोड़े-प्रीफेरेंस बेंचमार्क पर ELO 1293 स्कोर किया। यह एक विक्रेता संख्या है; TTS Arena भाषण को रैंक करता है, संगीत नहीं।

### ऑडियो भाषा बेंचमार्क

**MMAU (Massive Multi-Audio Understanding).**10k ऑडियो-QA जोड़े.

**MMAU-Pro.**1800 हार्ड आइटम, चार श्रेणियांः भाषण / ध्वनि / संगीत / मल्टी-ऑडियो। 4-वे पर 25% यादृच्छिक मौका। मिथुन 2.5 प्रो कुल ~ 60%; सभी मॉडल पर मल्टी-ऑडियो ~ 22%।

**LongAudioBench.**अर्थिक प्रश्नों के साथ मल्टी मिनट क्लिप। ऑडियो फ्लेमिंगो नेक्स्ट Gemini 2.5 प्रो से बेहतर है।

**AudioCaps / Clotho.**संदर्भ मानकों का उपशीर्षक। SPICE, CIDER, FENSE मेट्रिक्स।

### भाषण-भाषण स्ट्रीमिंग

**Latency P50 / P95 / P99.**उपयोगकर्ता के अंत-उपयोगकर्ता भाषण से पहली श्रव्य प्रतिक्रिया तक दीवार घड़ी।

**WER / MOS**आउटपुट पर।

**Barge-in responsiveness.**उपयोगकर्ता के अंतराल से सहायक मूक तक समय। लक्ष्य &lt; 150 ms.

### 2026 के शीर्ष स्थान

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## इसे बनाओ

### चरण 1: सामान्यीकरण के साथ WER

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### चरण 2: टीटीएस वापसी-यात्रा WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### चरण 3: आवाज क्लोनिंग के लिए SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### चरण 4: संगीत पीढ़ी के लिए FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### चरण 5: स्पीकर सत्यापन के लिए ईईआर (लक्ष्य 6) के समान कोड

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## इसका प्रयोग करें

प्रत्येक तैनाती को एक निश्चित मूल्यांकन हर्नस के साथ जोड़ा जो प्रत्येक मॉडल अपडेट पर चलता है। तीन मुख्य नियमः

1. **Normalize before scoring.**लघु अक्षर, अंकन पट्टी, संख्या विस्तार। सामान्यीकरण नियम रिपोर्ट।
2. **Report distributions, not averages.**विलंबता के लिए P50/P95/P99। वर्गीकरण के लिए प्रति वर्ग याद। MMAU के लिए प्रति श्रेणी।
3. **Run one canonical public benchmark.**यहां तक कि अगर आपके उत्पादन डेटा अलग-अलग हैं, तो ओपन एएसआर / टीटीएस एरेना / एमएमएयू पर रिपोर्टिंग करने से समीक्षकों को सेब-से-सेब की तुलना करने की अनुमति मिलती है।

## फंदे

- **UTMOS extrapolation.**वीसीटीके शैली में स्वच्छ भाषण पर प्रशिक्षित; शोर / क्लोन / भावनात्मक ऑडियो खराब स्कोर करता है।
- **MOS panel bias.**20 अमेज़ॅन मैकेनिकल टर्क कर्मचारी ≠ 20 लक्षित उपयोगकर्ता। यदि दांव उच्च हैं तो डोमेन पैनल के लिए भुगतान करें।
- **FAD depends on reference set.**मॉडल के बीच समान संदर्भ वितरण के साथ तुलना करें।
- **Aggregate WER.**5% कुल मिलाकर, उच्चारण वाले भाषण पर 30% WER छिपा सकते हैं। जनसांख्यिकीय स्लाइस द्वारा रिपोर्ट करें।
- **Public benchmark saturation.**अधिकांश सीमा मॉडल मानक बेंचमार्क पर छत के पास हैं। एक घर में रखा सेट बनाएं जो आपके ट्रैफ़िक को प्रतिबिंबित करता है।

## इसे भेजें

`outputs/skill-audio-evaluator.md`किसी भी ऑडियो मॉडल रिलीज के लिए मेट्रिक्स, बेंचमार्क और रिपोर्टिंग प्रारूप चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`खेल के इनपुट पर WER / CER / EER / SECS / FAD-ish / MMAU-ish की गणना करें।
2. **Medium.**एक TTS रिंगट्रिप WER हर्नर बनाएं. अपने Kokoro या F5-TTS आउटपुट को Whisper के माध्यम से चलाएं. 50 से अधिक संकेतों के साथ WER की गणना करें. 10% WER के साथ ध्वज संकेत।
3. **Hard.**एमएमएयू-प्रो भाषण + बहु-ऑडियो उपसमूहों (प्रत्येक 50 वस्तुओं) पर अपने पाठ 10 LALM विकल्प को स्कोर करें। प्रति श्रेणी सटीकता की रिपोर्ट करें और प्रकाशित संख्या के साथ तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## आगे पढ़ना

- [jiwer](https://github.com/jitsi/jiwer) सामान्यीकरण उपयोगिताओं के साथ WER/CER पुस्तकालय।
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) सीखा MOS पूर्वानुमान।
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) संगीत-जन मानक।
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 2026 लाइव रैंकिंग।
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) मानव-मतों के साथ टीटीएस की रैंकिंग।
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) LALM तर्क तालिका।
- [HEAR benchmark](https://hearbenchmark.com/) ऑडियो एसएसएल बेंचमार्क।
