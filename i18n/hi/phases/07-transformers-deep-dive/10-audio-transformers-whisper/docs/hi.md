# ऑडियो ट्रांसफार्मर  विस्पर आर्किटेक्चर

> ऑडियो समय के साथ आवृत्ति की एक छवि है. विस्पर एक वीटी है जो मेल स्पेक्ट्रोग्राम खाता है और वापस बोलता है।

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## समस्या

विस्पर (OpenAI, Radford et al. 2022) से पहले, अत्याधुनिक स्वचालित भाषण मान्यता (ASR) का मतलब था wav2vec 2.0 और HuBERT  स्व-निरीक्षण सुविधा निकालने वाले उपकरण प्लस एक ठीक से ट्यून किया गया सिर। उच्च गुणवत्ता, महंगी डेटा पाइपलाइन, डोमेन-ब्रैगिल। बहुभाषी भाषण मान्यता को भाषा परिवार के लिए अलग मॉडल की आवश्यकता थी।

विस्मय ने तीन दांव लगाएः

1. **Train on everything.**इंटरनेट से 680,000 घंटे की कम लेबल वाली ऑडियो 97 भाषाओं में स्क्रैप की गई। कोई साफ अकादमिक कॉर्पस नहीं। कोई ध्वन्यात्मक लेबल नहीं।
2. **Multi-task single model.**एक डिकोडर को टास्क टोकन के माध्यम से ट्रांसक्रिप्शन, अनुवाद, आवाज गतिविधि का पता लगाने, भाषा आईडी और टाइमस्टैम्पिंग पर संयुक्त रूप से प्रशिक्षित किया गया था।
3. **Standard encoder-decoder transformer.**एन्कोडर लॉग-मेल स्पेक्ट्रोग्राम का उपभोग करता है। डिकोडर ऑटोरेग्रेसिव रूप से पाठ टोकन उत्पन्न करता है। कोई Vocoder, कोई CTC, कोई HMM नहीं।

परिणामः विस्पर लार्ज-वी 3 उच्चारण, शोर और भाषाओं में मजबूत है जिनमें शून्य स्वच्छ लेबल वाले डेटा हैं। यह 2026 में हर ओपन-सोर्स वॉयस असिस्टेंट और अधिकांश वाणिज्यिक के लिए डिफ़ॉल्ट स्पीच फ्रंट-एंड है।

## अवधारणा

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### चरण 1  पुनः नमूना + विंडो

16 kHz पर ऑडियो. क्लिप / पैड से 30 सेकंड तक. लॉग-मेल स्पेक्ट्रोग्राम की गणना करेंः 80 मेलबिन, 10 एमएस कदम → ~ 3,000 फ्रेम × 80 फीचर्स। यह "इनपुट छवि" है जो विस्पर देखता है।

### चरण 2  घुमावदार स्टेम

कर्नेल 3 और स्टेड 2 के साथ दो Conv1D परतों 3,000 फ्रेम को 1,500 तक कम करते हैं। बहुत सारे पैरामीटर जोड़ने के बिना अनुक्रम लंबाई को आधा करता है।

### चरण 3  एन्कोडर

एक 24 परत (बड़े के लिए) ट्रांसफार्मर एन्कोडर 1,500 समय चरणों पर। सिनोसाइडल स्थिति एन्कोडिंग, स्व-ध्यान, GELU FFN। 1,500 × 1,280 छिपे हुए राज्यों का उत्पादन करता है।

### चरण 4  डिकोडर

यह एक 24 परतों के ट्रांसफार्मर डिकोडर है। यह एक बीपीई शब्दावली से टोकन स्वचालित रूप से उत्पन्न करता है जो कुछ ऑडियो-विशिष्ट विशेष टोकन के साथ जीपीटी-2 का एक सुपरसेट है।

### चरण 5  कार्य टोकन

डिकोडर प्रॉम्प्ट नियंत्रण टोकन के साथ शुरू होता है जो मॉडल को बताता है कि क्या करना हैः

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

या

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

इस सम्मेलन पर प्रशिक्षित किया गया है आप कार्य को पूर्ववर्ती के द्वारा नियंत्रित करते हैं 2026 के बराबर निर्देश-ट्यूनिंग, लेकिन भाषण पर लागू होता है।

### चरण 6  आउटपुट

लॉग-प्रोब सीमा के साथ बीम खोज (चौड़ाई 5)। समय के टिकट ऑडियो के हर 0.02 सेकंड की भविष्यवाणी की जाती है जब `<|notimestamps|>`टोकन अनुपस्थित है।

### चुप्पी आकार

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

बड़े v3-turbo (2024) ने <1 WER बिंदु प्रतिगमन के साथ 32 परतों से 4.8 × तेज़ डिकोडिंग तक डिकोडर को काट दिया। यह डिकोडिंग गति अनलॉक करने का कारण है कि 2026 में वास्तविक समय के वॉयस एजेंटों के लिए विस्पर-टर्बो डिफ़ॉल्ट है।

### विस्मय क्या नहीं करता

- कोई डायरीकरण नहीं है (जो बोल रहा है) इसके लिए पियानोट के साथ जोड़ी।
- वास्तविक समय में मूल रूप से स्ट्रीमिंग नहीं  30 सेकंड की खिड़की तय है।`faster-whisper`,`WhisperX`) VAD + ओवरलैप के माध्यम से स्ट्रीमिंग पर बोल्ट।
- 30 सेकंड से अधिक समय तक कोई दीर्घकालीन संदर्भ नहीं है। यह व्यवहार में अच्छी तरह से काम करता है क्योंकि मानव भाषण को प्रतिलेखन के लिए शायद ही कभी दीर्घकालिक संदर्भ की आवश्यकता होती है।

### 2026 परिदृश्य

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## इसे बनाओ

देखो`code/main.py`हम Whisper प्रशिक्षित नहीं करते हैं हम लॉग-मेल स्पेक्ट्रोग्राम पाइपलाइन + कार्य-टोकन प्रॉम्प्ट प्रारूपक बनाते हैं। ये वे भाग हैं जो आप वास्तव में उत्पादन में स्पर्श करते हैं।

### चरण 1: ऑडियो संश्लेषित करें

16 kHz पर नमूने के साथ 440 हर्ट्ज पर एक सेकंड सिनेस तरंग उत्पन्न करें। 16,000 नमूने।

### चरण 2: लॉग-मेल स्पेक्ट्रोग्राम (सरलीकृत)

पूर्ण मेल स्पेक्ट्रोग्राम FFT की जरूरत है. हम एक सरलीकृत फ्रेमिंग + प्रति फ्रेम ऊर्जा संस्करण है कि पाइपलाइन को बिना आवश्यकता के दिखाता है करते हैं `librosa`:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

फ्रेम = 25 ms, hop = 10 ms. विसपर के विंडोइंग से मेल खाता है. प्रति फ्रेम ऊर्जा शिक्षा के लिए मेलबिन के लिए है।

### चरण 3: 30 सेकंड तक पैड

विस्पर हमेशा 30 सेकंड के टुकड़ों को संसाधित करता है।

### चरण 4: शीघ्र टोकन बनाएं

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

यह एक 4 टोकन पूर्वावलोकन है।

## इसका प्रयोग करें

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

तेज़, ओपनएआई संगतः

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- एक मॉडल के साथ बहुभाषी एएसआर।
- शोर, विविध ऑडियो का मजबूत प्रतिलिपि।
- अनुसंधान / प्रोटोटाइप एएसआर  सबसे तेज़ प्रारंभिक बिंदु।

**When to pick something else:**

- अल्ट्रा-कम विलंबता धार पर स्ट्रीमिंग  Moonshine एक समान गुणवत्ता पर विस्पर से बेहतर है।
- वास्तविक समय वार्तालाप एआई की आवश्यकता <200 ms  समर्पित स्ट्रीमिंग एएसआर।
- स्पीकर डायरीकरण  विस्पर यह नहीं करता; पियानोट पर बोल्ट।

## इसे भेजें

देखो`outputs/skill-asr-configurator.md`. कौशल एक नए भाषण अनुप्रयोग के लिए एक एएसआर मॉडल, पैरामीटर को डीकोडिंग, और पूर्व प्रसंस्करण पाइपलाइन चुनता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. 16 kHz पर 10 ms hop के साथ 1 सेकंड के सिग्नल के लिए फ्रेम की गिनती की पुष्टि करें ~ 100 फ्रेम है. 30 सेकंड के लिएः ~ 3,000 फ्रेम.
2. **Medium.**`numpy.fft`. 80 मेलबिन मेल मिलाप की जांच करें .`librosa.feature.melspectrogram(n_mels=80)`संख्यात्मक त्रुटि के भीतर।
3. **Hard.**स्ट्रीमिंग निष्कर्ष लागू करेंः 10 सेकंड के विंडो में 2 सेकंड ओवरलैप के साथ ऑडियो का एक टुकड़ा, प्रत्येक टुकड़े पर व्हिस्पर चलाएं, प्रतिलेखन को मिलाएं। 5 मिनट के पॉडकास्ट नमूने पर वर्ड-एरर दर बनाम सिंगल-पास मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## आगे पढ़ना

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) चुप्पी कागज।
- [OpenAI Whisper repo](https://github.com/openai/whisper) संदर्भ कोड + मॉडल वजन। पढ़ें `whisper/model.py`Conv1D स्टेम + एन्कोडर + डेकोडर को ऊपर से नीचे तक लगभग 400 पंक्तियों में देखने के लिए।
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) चरण 56 में वर्णित बीम-सर्च + टास्क-टोकन तर्क यहाँ है; 500 पंक्तियाँ, पूरी तरह से पठनीय।
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) पूर्ववर्ती; कुछ सेटिंग्स में अभी भी SOTA सुविधाएँ।
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) उत्पादन के लिए रैपर, संदर्भ से 4x तेज।
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 किनारे के अनुकूल एएसआर, व्हिस्पर के आकार में लेकिन छोटा।
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) मेल स्पेक्ट्रोग्राम प्रीप्रोसेसर और टोकन-टाइमस्टैम्प हैंडलिंग सहित कैनोनिक फाइन-ट्यूनिंग रेसिपी।
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) पूर्ण कार्यान्वयन (एकोडर, डेकोडर, क्रॉस-अटेंशन, जनरेशन) जो पाठ के वास्तुकला आरेख को दर्शाता है।
