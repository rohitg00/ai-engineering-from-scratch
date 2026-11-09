# आवाज गतिविधि का पता लगाना और टर्न-टेकिंग  सिलेरो, कोबरा और फ्लश ट्रिक

> प्रत्येक आवाज एजेंट दो निर्णयों पर रहता है या मर जाता हैः क्या उपयोगकर्ता अभी बोल रहा है, और क्या वे कर रहे हैं? VAD पहले का जवाब देता है। टर्न डिटेक्शन (VAD + मौन-हंगावर + अर्थपूर्ण एंडपॉइंट मॉडल) दूसरे का जवाब देता है। या तो गलत हो जाओ और आपका सहायक या तो उपयोगकर्ताओं को काटता है या कभी चुप नहीं होता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## समस्या

तीन अलग निर्णय एक आवाज एजेंट हर 20 एमएस टुकड़ा पर करता हैः

1. **Is this frame speech?** VAD. द्विआधारी, प्रति फ्रेम.
2. **Has the user started a new utterance?** शुरुआत का पता लगाना।
3. **Has the user finished?** अंत-निर्देशन (टर्न-एंड)

साफ़ उत्तर (ऊर्जा की सीमा) किसी भी शोर पर विफल रहता है  यातायात, कीबोर्ड, भीड़ की बकवास। 2026 उत्तरः सिलेरो VAD (खुला, गहराई से सीखा) + एक बारी-बारी से पता लगाने वाला मॉडल (सिमेंटिक एंडपॉइंटिंग) + एक VAD-कैलिब्रेटेड चुप्पी का खांफ।

## अवधारणा

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### तीन स्तरीय VAD कैस्केड

**Tier 1: energy gate.**सबसे सस्ता. -40 dBFS पर RMS सीमा. स्पष्ट मौन फ़िल्टर करता है लेकिन सीमा से ऊपर किसी भी शोर पर फायर करता है.

**Tier 2: Silero VAD**(2020-2026, एमआईटी). 1 एम पैरामीटर। 6000+ भाषाओं पर प्रशिक्षित। एक एकल सीपीयू थ्रेड पर 30 एमएस के प्रति ~ 1 एमएस में चलता है। 5 एफपीआर पर 87.7% टीपीआर। ओपन-सोर्स डिफ़ॉल्ट।

**Tier 3: semantic turn detector.**लाइवकिट का टर्न-डिटेक्शन मॉडल (2024-2026) या आपका खुद का छोटा वर्गीकरणकर्ता। "पॉज़-मिड-सेंटेंस" को "डॉन-टॉक" से अलग करता है।

### प्रमुख पैरामीटर और उनके डिफ़ॉल्ट

- **Threshold.**सिलेरो एक संभावना आउटपुट करता है; भाषण को &gt; 0.5 (डिफ़ॉल्ट) या &gt; 0.3 (संवेदनशील) पर वर्गीकृत करें। निचला सीमा = कम पहले शब्द क्लिप, अधिक झूठे सकारात्मक।
- **Minimum speech duration.**250 ms से कम समय में बोलने से इनकार करें  आमतौर पर खांसी या कुर्सी की आवाज।
- **Silence hangover (end-pointing).**VAD 0 पर लौटने के बाद, टर्न-ऑफ समाप्त होने की घोषणा करने से पहले 500-800 ms का इंतजार करें। बहुत कम → उपयोगकर्ता को बाधित करें। बहुत लंबा → धीमा लगता है।
- **Pre-roll buffer.**VAD फायर करने से पहले 300-500 एमएस ऑडियो रखें। "हे" को काटने से बचाता है।

### फ्लश ट्रिक (क्यूताई 2025)

स्ट्रीमिंग STT मॉडल में आगे देखने में देरी होती है (किउताई STT-1B के लिए 500 ms, STT-2.6B के लिए 2.5 s) सामान्य तौर पर आप भाषण के अंत के बाद ट्रांसक्रिप्ट के लिए इतने लंबे समय तक इंतजार करेंगे। फ्लश ट्रिकः जब VAD भाषण के अंत को चलाता है, **send a flush signal to the STT**स्टीट 4x वास्तविक समय पर संसाधित, तो 500 ms बफर ~ 125 ms में समाप्त होता है।

अंत-से-अंतः 125 ms VAD + फ्लश STT = वार्तालाप विलंबता।

### 2026 VAD तुलना

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

सिलेरो सही डिफ़ॉल्ट है। कोबरा अनुपालन / सटीकता उन्नयन है। केवल ऊर्जा-केवल VAD 2026 उत्पादन में कोई जगह नहीं है।

```figure
sp-vad-cascade
```

## इसे बनाओ

### चरण 1: ऊर्जा गेट

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### चरण 2: पायथन में सिलेरो VAD

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### चरण 3: टर्न-एंड स्टेट मशीन

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### चरण 4: फ्लश ट्रिक कंकाल

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (क्यूटाई, डीपग्राम, असेंबलीएआई) को फ्लश का समर्थन करना चाहिए ताकि यह काम कर सके। व्हिस्पर स्ट्रीमिंग नहीं करता है  यह ब्लॉक-आधारित है और हमेशा टुकड़ों का इंतजार करता है।

## इसका प्रयोग करें

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

अंगूठे का नियमः कभी भी केवल ऊर्जा वाले VAD को भेजें जब तक आपके पास वास्तव में कोई अन्य विकल्प नहीं है।

## फंदे

- **Fixed threshold.**चुपचाप काम करता है, शोर में विफलता। या तो डिवाइस पर मापें या Silero पर स्विच.
- **Too-short silence hangover.**एजेंट वाक्य के बीच में बाधित करता है. 500-800 एमएस बातचीत भाषण के लिए सबसे अच्छा स्थान है.
- **Too-long hangover.**लक्षित उपयोगकर्ताओं के साथ ए / बी परीक्षण.
- **No pre-roll buffer.**पहले 200-300 एमएस उपयोगकर्ता ऑडियो खो दिया. हमेशा रोलिंग पूर्व रोलिंग रखें.
- **Ignoring semantic endpointing.**"हम्म, मुझे सोचने दो"... में लंबे समय तक रुकने के लिए है। उपयोगकर्ताओं को सोच के बीच में काट दिया जाना पसंद नहीं है। लाइवकिट के टर्न डिटेक्टर या इसी तरह का उपयोग करें।

## इसे भेजें

`outputs/skill-vad-tuner.md`. कार्यभार के लिए VAD मॉडल, सीमा, खांसी, पूर्व-रोल, और बारी-बारी से पता लगाने की रणनीति चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`यह भाषण + मौन + भाषण + खांसी अनुक्रम का अनुकरण करता है और तीन VAD स्तरों का परीक्षण करता है।
2. **Medium.**स्थापित करें`silero-vad`, 5 मिनट की रिकॉर्डिंग को संसाधित करें, पहले शब्द क्लिप और झूठे ट्रिगर दोनों को कम करने के लिए सीमा समायोजित करें। सटीकता / याद करने की रिपोर्ट करें।
3. **Hard.**एक मिनी टर्न-डिटेक्टर बनाएंः सिलेरो VAD + अंतिम 10 शब्दों के एम्बेडमेंट पर 3-परत MLP (वाक्य-ट्रांसफॉर्मर का उपयोग करें) । एक हाथ लेबल वाले टर्न-एंड डेटासेट पर अभ्यास करें। केवल 10% F1 से सिलेरो को हराएं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## आगे पढ़ना

- [Silero VAD](https://github.com/snakers4/silero-vad) संदर्भ खुला VAD।
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) वाणिज्यिक सटीकता के लिए अग्रणी।
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) sub-200 ms इंजीनियरिंग ट्रिक।
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) उत्पादन में अर्थिक अंतनिर्देश।
- [WebRTC VAD](https://webrtc.googlesource.com/src/) विरासत आधार रेखा।
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) दैनिककरण-ग्रेड सेगमेंट।
