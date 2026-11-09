# ऑडियो मूल बातें  तरंगों का आकार, नमूनाकरण, फ़ूरियर परिवर्तन

> तरंगों का आकार कच्चे संकेत है। स्पेक्ट्रोग्राम प्रतिनिधित्व हैं। मेल सुविधाएं एमएल-अनुकूल रूप हैं। प्रत्येक आधुनिक एएसआर और टीटीएस पाइपलाइन इस सीढ़ी पर चलता है, और पहला चरण नमूनाकरण और फ़ूरियर को समझना है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## समस्या

माइक्रोफोन दबाव बनाम समय संकेत देता है। आपके तंत्रिका नेटवर्क में टेंसर का सेवन होता है। उनके बीच एक ढेर में कन्वेंशन होते हैं जो उल्लंघन होने पर मूक बग उत्पन्न करते हैंः मॉडल ठीक से चलता है लेकिन WER दोगुना हो जाता है, या TTS एक चिपचिपापन भेजता है, या वॉयस क्लोनिंग सिस्टम स्पीकर के बजाय माइक्रोफोन को याद करता है।

भाषण प्रणाली में प्रत्येक बग तीन प्रश्नों में से एक पर वापस जाता हैः

1. नमूना दर पर डेटा दर्ज किया गया था, और मॉडल क्या उम्मीद करता है?
2. क्या यह संकेत एक उपनाम है?
3. क्या आप कच्चे नमूने या आवृत्ति प्रतिनिधित्व पर काम कर रहे हैं?

उन्हें गलत करें और यहां तक कि विस्पर-लार्ज-वी 4 कचरा पैदा करता है।

## अवधारणा

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**एक आयामी फ्लोट्स की एक सरणी में `[-1.0, 1.0]`. नमूना संख्या से अनुक्रमित. सेकंड में परिवर्तित करने के लिए, नमूना दर से विभाजित करेंः `t = n / sr`16 kHz पर 10 सेकंड क्लिप 160,000 फ्लोट का एक सरणी है।

**Sampling rate (sr).**2026 में आम दरेंः

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**`sr` तक आवृत्तियों को स्पष्ट रूप से दर्शा सकते हैं`sr/2`. . .`sr/2`सीमा *निविस आवृत्ति* है। निविस से ऊपर की ऊर्जा *अन्यस * नीचे नीचे नीचे नीचे आवृत्तियों में तह जाती है और संकेत को खराब करती है। हमेशा नीचे के नमूने से पहले कम पास फ़िल्टर।

**Bit depth.**16-बिट पीसीएम (अक्षरित int16, रेंज ±32,767) सार्वभौमिक विनिमय प्रारूप है। संगीत के लिए 24-बिट, आंतरिक डीएसपी के लिए 32-बिट फ्लोट। लाइब्रेरी जैसे `soundfile`int16 पढ़ें लेकिन float32 सरणी को उजागर करें `[-1, 1]`. .

**Fourier Transform.**किसी भी परिमित संकेत विभिन्न आवृत्तियों पर सिनोसाइड्स का योग है।`N`नमूने, `N`जटिल गुणांक  प्रत्येक आवृत्ति बिन पर एक। `bin k`आवृत्ति के लिए मानचित्र `k · sr / N`हर्ट्ज. परिमाण उस आवृत्ति पर परिमाण है, कोण चरण है।

**FFT.**फास्ट फ़ूरियर ट्रांसफ़ॉर्मः एक `O(N log N)`डीएफटी के लिए एल्गोरिथ्म जब `N`प्रत्येक ऑडियो लाइब्रेरी हुड के नीचे एफएफटी का उपयोग करती है। 16 kHz पर 1024-सैम्पल एफएफटी 15.6 Hz रिज़ॉल्यूशन पर 08 kHz के 512 उपयोग करने योग्य आवृत्ति डिब्बे देता है।

**Framing + window.**हम एक पूरी क्लिप को FFT नहीं करते हैं। हम इसे ओवरलैपिंग *फ्रेम* (आमतौर पर 25 ms के साथ 10 ms हॉप) में काटते हैं, किनारे के विराम को खत्म करने के लिए प्रत्येक फ्रेम को एक विंडो फ़ंक्शन (हैन, हैमिंग) से गुणा करते हैं, फिर प्रत्येक फ्रेम को FFT करते हैं। यह शॉर्ट-टाइम फ़ौरियर ट्रांसफॉर्म (STFT) है। पाठ 02 यहां से शुरू होता है।

```figure
mel-scale
```

## इसे बनाओ

### चरण 1: क्लिप पढ़ें और तरंग के रूप का चित्रण

`code/main.py`केवल stdlib का उपयोग करता है `wave`मॉड्यूल डेमो निर्भरता मुक्त रखने के लिए. उत्पादन के लिए आप उपयोग करेंगे `soundfile`या `torchaudio.load`(दोनों वापसी `(waveform, sr)`टूपल्स):

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### चरण 2: पहले सिद्धांतों से सिनेस तरंग को संश्लेषित करें

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

एक सेकंड के लिए 16 kHz पर 440 Hz सिनेस (कंसर्ट ए) 16,000 फ्लोट है।`wave.open(..., "wb")`16 बिट पीसीएम एन्कोडिंग का उपयोग कर।

### चरण 3: डीएफटी को हाथ से गणना करें

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)` ठीक है `N=256`सही पुष्टि करने के लिए, असली ऑडियो के लिए बेकार. असली कोड कॉल`numpy.fft.rfft`या `torch.fft.rfft`. .

### चरण 4: प्रमुख आवृत्ति खोजें

परिमाण शिखर सूचकांक `k_star`आवृत्ति के लिए मानचित्र `k_star * sr / N`440 हर्ट्ज सिनेस पर चलाने से बीन पर एक शिखर वापस आ जाएगा`440 * N / sr`. .

### चरण 5: उपनाम का प्रदर्शन करें

7 kHz सिनेस 10 kHz (Nyquist = 5 kHz) पर नमूना। 7 kHz स्वर Nyquist से ऊपर है और `10 − 7 = 3 kHz`. एफएफटी पीक 3 kHz पर दिखाई देता है. यह क्लासिक उपनाम डेमो है और हर डीएसी / एडीसी जहाजों के साथ एक ईंट दीवार कम पास फिल्टर के कारण है.

## इसका प्रयोग करें

वह ढेर जिसे आप वास्तव में 2026 में भेजेंगेः

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

निर्णय नियम: **match sample rate before you match anything else**. विस्पर 16 kHz मोनो फ्लोट32 की उम्मीद है. इसे 44.1 kHz स्टीरियो पास करें और आप कचरा मिलता है जो एक मॉडल बग की तरह दिखता है.

## इसे भेजें

`outputs/skill-audio-loader.md`. कौशल आपको यह जांचने में मदद करता है कि ऑडियो इनपुट डाउनस्ट्रीम मॉडल की अपेक्षाओं से मेल खाता है और जब यह नहीं करता है तो सही रीमॉडल करता है।

## व्यायाम

1. **Easy.**16 kHz पर 220 Hz + 440 Hz + 880 Hz का 1 सेकंड मिश्रण संश्लेषित करें। DFT चलाएं। अपेक्षित डिब्बे पर तीन शिखरों की पुष्टि करें।
2. **Medium.**48 kHz पर अपनी आवाज का 3 सेकंड WAV रिकॉर्ड करें। 16 kHz का उपयोग करके डाउनसैम्पल`torchaudio.transforms.Resample`(विरोधी अलियाइजिंग के साथ), फिर 16 kHz के लिए साफ़ दशमलव (हर तीसरे नमूने) का उपयोग करते हुए। एफएफटी दोनों। अलियाइजिंग कहां दिखाई देता है?
3. **Hard.**केवल  का उपयोग करके STFT को खरोंच से बनाएं`math`और चरण 3 से डीएफटी। फ्रेम आकार 400, हॉप 160, हैन विंडो।`matplotlib.pyplot.imshow`यह पाठ 02 का स्पेक्ट्रोग्राम है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## आगे पढ़ना

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) नमूना प्रमेय के पीछे का पेपर।
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) निःशुल्क, कैनोनिक डीएसपी पाठ्यपुस्तक।
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) कोड के साथ व्यावहारिक कदम।
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) संदर्भ क्यों वास्तविक दुनिया ऑडियो एक स्वच्छ sinusoid नहीं है.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) आवृत्ति बीन अंतर्ज्ञान 10 मिनट में साफ हो गया।
