# ऑडियो पीढ़ी

> ऑडियो 16-48 kHz पर 1-डी सिग्नल है। पांच सेकंड का क्लिप 80-240k नमूने है। कोई ट्रांसफार्मर सीधे उस अनुक्रम का पालन नहीं करता है। 2026 में प्रत्येक उत्पादन ऑडियो मॉडल के लिए समाधान समान हैः एक तंत्रिका कोडक (Encodec, SoundStream, DAC) 50-75 Hz पर ऑडियो को अलग टोकन में संपीड़ित करता है, और एक ट्रांसफार्मर या विसारण मॉडल टोकन उत्पन्न करता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## समस्या

तीन ऑडियो जनरेशन कार्यः

1. **Text-to-speech.**पाठ दिए जाने पर, भाषण का उत्पादन करें। स्वच्छ भाषण संकीर्ण बैंड है और इसमें मजबूत ध्वन्यात्मक संरचना है।
2. **Music generation.**एक त्वरित (पाठ, धुन, स्वर प्रगति, शैली) के कारण, संगीत का उत्पादन करें। बहुत व्यापक वितरण। MusicGen (मेटा), स्थिर ऑडियो 2.5, सूनो वी 4, यूडियो, रिफ्यूजन।
3. **Audio effects / sound design.**एक संकेत के साथ, परिवेश ध्वनि या फोली उत्पन्न करें।

तीनों एक ही सब्सट्रेट पर चल रहे हैंः तंत्रिका ऑडियो कोडक + टोकन-एआर या विसारक जनरेटर।

## अवधारणा

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### तंत्रिका ऑडियो कोडक

एनकोड (मेटा, 2022), साउंडस्ट्रीम (Google, 2021), डिस्क्रिप्ट ऑडियो कोडेक (DAC, 2023) । एक घुमावदार एन्कोडर एक समय-चरण वेक्टर में तरंग स्वरूप को संपीड़ित करता है; अवशिष्ट वेक्टर क्वांटिज़ेशन (RVQ) प्रत्येक वेक्टर को K कोडबुक सूचकांक के एक कैस्केड में परिवर्तित करता है। डिकोडर इसे उलटता है। 24 kHz ऑडियो 2 kbps पर 8 RVQ कोडबुक का उपयोग करके 75 Hz = 600 टोकन / सेकंड पर।

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### दो जनरेटिव प्रतिमान ऊपर

**Token-autoregressive.**एक अनुक्रम में फ्लैट RVQ टोकन चलाएं, केवल एक डिकोडर-ट्रांसफॉर्मर चलाएं। MusicGen प्रति-स्ट्रीम ऑफसेट के साथ समानांतर में K कोडबुक स्ट्रीम जारी करने के लिए "प्रलंबित समानांतर" का उपयोग करता है। VALL-E एक पाठ प्रॉम्प्ट + 3-सेकंड आवाज नमूना से भाषण टोकन उत्पन्न करता है।

**Latent diffusion.**कॉडेक टोकन को निरंतर लटेंट के रूप में पैक करें या उन्हें श्रेणीबद्ध विसारण के साथ मॉडल करें। स्थिर ऑडियो 2.5 निरंतर ऑडियो लटेंट पर प्रवाह मिलान का उपयोग करता है। ऑडियोएलडीएम 2 पाठ-से-मेल-ऑडियो विसारण का उपयोग करता है।

2024-2026 का रुझानः प्रवाह मिलान संगीत के लिए जीत हासिल कर रहा है (त्वरित निष्कर्ष, स्वच्छ नमूने) जबकि टोकन-एआर अभी भी भाषण पर हावी है क्योंकि यह स्वाभाविक रूप से कारण है और अच्छी तरह से प्रवाह करता है।

## उत्पादन परिदृश्य

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## इसे बनाओ

`code/main.py`मूल विचार का अनुकरण करता हैः दो अलग-अलग "शैली" (शैली ए के लिए कम और उच्च टोकन, शैली बी के लिए एकादशी रैंप) से उत्पन्न सिंथेटिक "ऑडियो टोकन" अनुक्रमों पर एक छोटे से अगले टोकन ट्रांसफार्मर को प्रशिक्षित करें। शैली और नमूना पर स्थिति।

### चरण 1: सिंथेटिक ऑडियो टोकन

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### चरण 2: एक छोटे टोकन भविष्यवाणी प्रशिक्षित करें

एक बिग्राम शैली पूर्वानुमान शैली पर आधारित। बिंदु पैटर्न हैः कोडिक टोकन → क्रॉस-एंट्रोपी प्रशिक्षण → ऑटोरेग्रेसिव नमूनाकरण।

### चरण 3: सशर्त नमूना

शैली टोकन और एक प्रारंभिक टोकन को देखते हुए, भविष्यवाणी वितरण से अगले टोकन का नमूना लें। 20-40 टोकन के लिए जारी रखें।

## फंदे

- **Codec quality caps output quality.**यदि कोडक ध्वनि को निष्ठापूर्वक प्रतिनिधित्व नहीं कर सकता है, तो जनरेटर गुणवत्ता की कोई मात्रा मदद नहीं करती है। डीएसी वर्तमान खुला सबसे अच्छा है।
- **RVQ error accumulation.**प्रत्येक आरवीक्यू परत पिछले के अवशिष्ट का मॉडल करती है। परत 1 पर त्रुटियां फैलती हैं। उच्च परतों पर तापमान 0 के साथ नमूने लेने से मदद मिलती है।
- **Musical structure.**30 सेकंड टोकन 75 हर्ट्ज पर 20k+ टोकन है। ट्रांसफार्मर के लिए कठिन है। म्यूजिकजेन स्लाइडिंग विंडो + त्वरित निरंतरता का उपयोग करता है; स्थिर ऑडियो छोटी क्लिप + क्रॉसफैडिंग का उपयोग करता है।
- **Artifacts at boundaries.**उत्पन्न क्लिप के बीच क्रॉसफैडिंग को सावधानीपूर्वक ओवरलैप-एड की आवश्यकता होती है।
- **Clean-data appetite.**संगीत जनरेटरों को लाइसेंस प्राप्त संगीत के हजारों घंटे की आवश्यकता होती है। सुनो / यूडियो आरआईएए मुकदमा (2024) ने इसे सतह पर लाया।
- **Voice cloning ethics.**एक 3 सेकंड का नमूना और एक पाठ संकेत VALL-E / XTTS / ElevenLabs के लिए एक आवाज क्लोन करने के लिए पर्याप्त है। प्रत्येक उत्पादन मॉडल को दुरुपयोग का पता लगाने + ऑप्ट-आउट सूचियों की आवश्यकता होती है।

## इसका प्रयोग करें

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## इसे भेजें

सहेजें`outputs/skill-audio-brief.md`. कौशल एक ऑडियो संक्षिप्त (कार्य, अवधि, शैली, आवाज, लाइसेंस) और आउटपुट लेता हैः मॉडल + होस्टिंग, शीघ्र प्रारूप (जाति टैग, शैली वर्णक, संरचनात्मक मार्कर), कोडेक + जनरेटर + vocoder श्रृंखला, बीज प्रोटोकॉल, और मूल्यांकन योजना (MOS / CLAP स्कोर / TTS / उपयोगकर्ता A / B के लिए CER) ।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`और शैली स्पष्ट रूप से सेट करें. उत्पन्न अनुक्रम शैली के पैटर्न से मेल खाते हैं की जांच करें.
2. **Medium.**देरी से समानांतर डिकोडिंग जोड़ेंः टोकन के 2 धाराओं का अनुकरण करें जो 1 चरण से ऑफसेट रहना चाहिए। एक संयुक्त भविष्यवाणी को प्रशिक्षित करें।
3. **Hard.**स्थानीय रूप से MusicGen-small चलाने के लिए HuggingFace ट्रांसफार्मर का उपयोग करें। तीन अलग-अलग संकेतों के साथ 10 सेकंड का क्लिप उत्पन्न करें; शैली अनुपालन के लिए ए / बी।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## उत्पादन नोटः ऑडियो स्ट्रीमिंग समस्या है

ऑडियो एक आउटपुट मोड है जिसे उपयोगकर्ता उत्पन्न होने के रूप में * आने की उम्मीद करते हैं*, एक बार में नहीं। उत्पादन के संदर्भ में इसका मतलब है कि TPOT मायने रखता है (Time Per Output Token) क्योंकि उपयोगकर्ता की सुनने की गति लक्ष्य आउटपुट है  उनकी पढ़ने की गति नहीं। ~ 75 टोकन / सेकंड (Encodec) पर टोकन किए गए 16kHz ऑडियो के लिए, सर्वर को प्रति उपयोगकर्ता ≥75 टोकन / सेकंड उत्पन्न करना चाहिए ताकि प्लेबैक सुचारू रहे।

दो वास्तु संबंधी परिणामः

- **Flow-matching audio models cannot stream trivially.**स्थिर ऑडियो 2.5 और ऑडियोक्राफ्ट 2 एक पास में एक निश्चित क्लिप लंबाई प्रस्तुत करते हैं। स्ट्रीम करने के लिए, आप क्लिप को छोटा करते हैं और ओवरलैप सीमाएँ  स्लाइडिंग-विंडो विसारण  जोड़ते हैं 100-300ms विलंबता ओवरहेड बनाम एक कोडेक एआर मॉडल।

यदि उत्पाद "लाइव वॉयस चैट" या "रियल-टाइम संगीत निरंतरता" है, तो कोडक एआर पथ चुनें। यदि यह "सबमिट पर 30 सेकंड का क्लिप प्रस्तुत करें", तो प्रवाह मिलान गुणवत्ता और कुल विलंबता पर जीतता है।

## आगे पढ़ना

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) कोडक मानक।
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) पहला व्यापक रूप से इस्तेमाल किया जाने वाला तंत्रिका ऑडियो कोडक।
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) डीएसी।
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) वॉल-ई.
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) संगीतGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) ऑडियोएलडीएम 2.
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 प्रवाह मिलान के साथ पाठ-संगीत।
