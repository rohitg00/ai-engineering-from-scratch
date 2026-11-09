# पाठ-से-भाषण (टीटीएस)  टैकोट्रॉन से एफ5 और कोकोरो तक

> ASR भाषण को पाठ में परिवर्तित करता है; TTS पाठ को भाषण में परिवर्तित करता है। 2026 स्टैक में तीन भाग हैंः पाठ → टोकन, टोकन → mel, mel → तरंग स्वरूप। प्रत्येक भाग में एक डिफ़ॉल्ट मॉडल है जो लैपटॉप में फिट बैठता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## समस्या

आपके पास एक स्ट्रिंग हैः "कृपया मुझे शाम 6 बजे पौधों को पानी देने के लिए याद दिलाएं।" आपको एक 3-सेकंड ऑडियो क्लिप की आवश्यकता है जो प्राकृतिक लगता है, जिसमें सही प्रोसोडी (विराम, तनाव) है, सही स्वर के साथ "प्लान्ट" का उच्चारण करता है, और लाइव वॉयस असिस्टेंट के लिए सीपीयू पर 300 एमएस से कम समय में चलता है। आपको आवाजों को भी आदान-प्रदान करने, कोड-स्विच इनपुट ("मुझे शाम 6 बजे याद दिलाएं, दाइजूबू? "), और नामों पर शर्मिंदा नहीं होना चाहिए।

आधुनिक टीटीएस पाइपलाइन इस तरह दिखती हैंः

1. **Text frontend.**पाठ (तारीख, संख्या, ईमेल) को सामान्य करें, ध्वन्यात्मक या उपशब्द टोकन में परिवर्तित करें, प्रोसोडी सुविधाओं की भविष्यवाणी करें।
2. **Acoustic model.**पाठ → मेल स्पेक्ट्रोग्राम. टैकोट्रॉन 2 (2017), फास्ट स्पीच 2 (2020), वीआईटीएस (2021), एफ5-टीटीएस (2024), कोकोरो (2024).
3. **Vocoder.**वेवनेट (2016), वेवआरएनएन, हाइफी-गैन (2020), बिगवीगैन (2022), 2024+ में न्यूरल कोडेक वॉकोडर।

2026 में ध्वनिक + वोकॉडर अंत-से-अंत विसारण और प्रवाह-अनुरूप मॉडल के साथ विभाजित हो जाता है। लेकिन तीन भागों का मानसिक मॉडल अभी भी डिबगिंग के लिए मान्य है।

## अवधारणा

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: char-embedding → BiLSTM encoder → location-sensitive attention → autoregressive LSTM decoder mel frames emits. धीमी (AR), लंबी पाठ पर wobbly. अभी भी एक आधार के रूप में उद्धृत किया जाता है।

**FastSpeech 2 (2020).**गैर-स्वतः-निवर्तनीय। अवधि पूर्वानुमान आउटपुट करता है कि प्रत्येक ध्वनिक कितने मेल फ्रेम प्राप्त करता है। 1 पास, टैकोट्रॉन से 10 गुना तेज। कुछ प्राकृतिकता (एकतरफा संरेखण) खो देता है लेकिन हर जगह जहाज करता है।

**VITS (2021).**संयुक्त रूप से एसीडी + प्रवाह आधारित अवधि + हाइफी-जीएएन वॉकोडर अंत-से-अंत के साथ भिन्नता अनुमान के साथ प्रशिक्षित करता है। उच्च गुणवत्ता, एकल मॉडल। प्रमुख ओपन-सोर्स टीटीएस 20222024. संस्करणः यूआरटीटीएस (मल्टी-स्पीकर शून्य-शॉट), एक्सटीटीएस वी 2 (2024, कोकी) ।

**F5-TTS (2024).**प्रवाह मिलान पर विसारण ट्रांसफार्मर. प्राकृतिक प्रोसोडी, 5 सेकंड संदर्भ ऑडियो के साथ शून्य शॉट आवाज क्लोनिंग. 2026 ओपन-सोर्स टीटीएस रैंकिंग बोर्ड के शीर्ष. 335M पैरामीटर.

**Kokoro (2024).**छोटे (82M), सीपीयू-चलन योग्य, वास्तविक समय उपयोग के लिए कक्षा में सर्वश्रेष्ठ अंग्रेजी टीटीएस। बंद-वाक्यपुलरी अंग्रेजी-केवल, apache-2.0।

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**वाणिज्यिक अत्याधुनिकता। इलेवनलैब्स v2.5 भावना टैग ("[फुसफुसाया]", "[हांसते]") और चरित्र आवाजें 2026 में ऑडियोबुक उत्पादन पर हावी हैं।

### Vocoder विकास

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

2026 तक अधिकांश "टीटीएस" मॉडल पाठ से तरंग के रूप तक अंत-टू-अंत हैं; मेल स्पेक्ट्रोग्राम एक आंतरिक प्रतिनिधित्व है।

### मूल्यांकन

- **MOS (Mean Opinion Score).**15 पैमाने, भीड़ स्रोत. अभी भी स्वर्ण मानक; दर्दनाक धीमी.
- **CMOS (Comparative MOS).**A- बनाम B प्राथमिकता. प्रति टिप्पणी के लिए अधिक विश्वसनीयता अंतराल.
- **UTMOS, DNSMOS.**रेफरेंस मुक्त तंत्रिका MOS पूर्वानुमानकों. रैंकिंग बोर्ड के लिए इस्तेमाल किया.
- **CER (Character Error Rate) via ASR.**Whisper के माध्यम से TTS आउटपुट चलाओ, इनपुट पाठ के खिलाफ सीईआर गणना. समझदारी के लिए प्रॉक्सी.
- **SECS (Speaker Embedding Cosine Similarity).**आवाज क्लोनिंग गुणवत्ता।

LibriTTS परीक्षण-स्वच्छता पर 2026 संख्याः

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## इसे बनाओ

### चरण 1: इनपुट को ध्वन्यात्मक करें

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

फोनम सार्वभौमिक पुल हैं। VITS स्तर की गुणवत्ता से नीचे किसी भी चीज़ को कच्चे पाठ को फ़ीड करने से बचें।

### चरण 2: Kokoro (2026 CPU डिफ़ॉल्ट) चलाएं

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

ऑफ़लाइन चल रहा है, एकल फ़ाइल, 82M पैरामीटर.

### चरण 3: आवाज क्लोनिंग के साथ F5-TTS चलाएं

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

5 सेकंड के संदर्भ क्लिप + इसके प्रतिलिपि को पास करें; F5 प्रोसोडी और टिमब्रे क्लोन करता है।

### चरण 4: HiFi-GAN Vocoder खरोंच से

एक ट्यूटोरियल स्क्रिप्ट में फिट करने के लिए बहुत बड़ा, लेकिन आकार हैः

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

प्रशिक्षणः विरोधी (छोटी खिड़कियों पर भेदभाव) + मेल-स्पेक्ट्रोग्राम पुनर्निर्माण हानि + सुविधाओं के मिलान हानि।`hifi-gan`रेपो या एनवीडिया-नेमो।

### चरण 5: पूरी पाइपलाइन (पस्यूडोकोड)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

2026 तक ओपन सोर्स के नेताः **F5-TTS for quality, Kokoro for efficiency**. जब तक आप एक इतिहासकार नहीं हैं तब तक टैकोट्रन तक न पहुंचें.

## फंदे

- **No text normalizer.**"डॉ. स्मिथ" "डॉक्टर" या "ड्राइव" के रूप में पढ़ता है? "2026" "बीस बीस छह" या "दो शून्य दो छह" के रूप में पढ़ता है?
- **OOV proper nouns.**"गुमराई" → "ग्यू-मैर"? अज्ञात टोकन के लिए एक बैकग्राउंड ग्राफिम-टू-फोनम मॉडल भेजें।
- **Clipping.**Vocoder आउटपुट शायद ही कभी क्लिप, लेकिन मेल स्केलिंग असंगतता पर निष्कर्ष पर पार कर सकते हैं ±1.0. हमेशा `np.clip(wav, -1, 1)`. .
- **Sample-rate mismatch.**कोकोरो आउटपुट 24 किलोग्राम के हर्ट्ज है; आपकी डाउनस्ट्रीम पाइपलाइन 16 किलोग्राम के हर्ट्ज → पुनः नमूना या उपनाम प्राप्त करने की उम्मीद करती है।

## इसे भेजें

`outputs/skill-tts-designer.md`. किसी दिए गए आवाज, विलंबता और भाषा लक्ष्य के लिए एक टीटीएस पाइपलाइन डिजाइन करें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. एक खिलौना शब्दावली से एक ध्वन्यात्मक शब्दकोश बनाता है, प्रत्येक ध्वन्यात्मक अवधि का अनुमान लगाता है, और एक नकली "मेल" अनुसूची प्रिंट करता है।
2. **Medium.**Kokoro स्थापित करें, आवाज पर एक ही वाक्य संश्लेषित `af_bella`और `am_adam`. ऑडियो की अवधि और विषयगत गुणवत्ता की तुलना करें.
3. **Hard.**अपने आप को 5 सेकंड के संदर्भ क्लिप रिकॉर्ड करें, F5-TTS का उपयोग करें इसे क्लोन करने के लिए, संदर्भ और क्लोन आउटपुट के बीच SECS रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## आगे पढ़ना

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) सीक्वल सीक्वल बेसलाइन।
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) अंत-से-अंत प्रवाह आधारित।
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) वर्तमान ओपन सोर्स SOTA।
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) वोकोडर जो अभी भी 2026 में जहाज करता है।
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 सीपीयू-अनुकूल अंग्रेजी टीटीएस।
