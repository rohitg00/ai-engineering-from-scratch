# أساسيات الصوت  أشكال الموجات، أخذ العينات، تحويل فوريه

> أشكال الموجات هي الإشارة الخامة. تعد البرامج الطيفية هي التمثيل. هي أشكال الميل التي تتوافق مع ML. كل خط أنابيب ASR و TTS الحديثة يسير على هذا السلم، والخطوة الأولى هي فهم العينات و فوريه.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## المشكلة

يُنتج الميكروفون إشارة ضغط مقابل الوقت. شبكة عصبية تستهلك المضغوطات. بينها تعيش كومة من الاتفاقيات التي، عندما تنتهك، تنتج حشرات صامتة: يتدرب النموذج بشكل جيد ولكن WER تضاعف، أو TTS يرسل صيحة، أو نظام تخصيص الصوت يتذكر الميكروفون بدلاً من المتحدث.

كل حشرة في أنظمة الكلام تعود إلى واحدة من ثلاثة أسئلة:

1. ما هو معدل العينة التي تم تسجيلها، وما الذي يتوقع النموذج؟
2. هل الإشارة مستعارة؟
3. هل تعمل على عينات خامة أم على تمثيل تردد؟

إصطلح هذه بشكل صحيح و الباقي من المرحلة 6 يمكن التعامل معه إصطلحهم بشكل خاطئ وحتى "سيسبر-غرف-ف4" تنتج القمامة

## المفهوم

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**مجموعة واحدة من العوامل العائمة في`[-1.0, 1.0]`. مقياس على عدد العينة. لتحويل إلى ثواني، تقسيم معدل العينة: `t = n / sr`-قطعة 10 ثواني عند 16 كيلوهرتز هي مجموعة من 160,000 عائمة.

**Sampling rate (sr).**كم عدد العينات في الثانية؟

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**معدل العينة `sr`يمكن أن تمثل بشكل واضح ترددات تصل إلى `sr/2`- المُؤمنون`sr/2`الحد هو * تردد Nyquist. الطاقة فوق Nyquist يصبح * المتحفّز *  ينحني إلى أسفل إلى ترددات أقل  ويحطّم الإشارة. دائماً تصفية مرور منخفضة قبل أخذ العينات.

**Bit depth.**PCM 16-bit (موقع int16, نطاق ±32,767) هو تنسيق التبادل العالمي. 24 بت للموسيقى، 32 بت العائمة ل DSP الداخلي. المكتبات مثل `soundfile`قراءة int16 ولكن كشف المصفوفات float32 في `[-1, 1]`. . .

**Fourier Transform.**أي إشارة محدودة هي مجموع من السينوسويدات في ترددات مختلفة. تحسب تحويل فوريه المميز (DFT) ، ل`N`العينات`N`معدلات معقدة  واحد لكل قمامة ترددات. `bin k`خرائط التردد`k · sr / N`الحجم هو الطول عند تلك التردد، الزاوية هي المرحلة.

**FFT.**تحويل فوريه سريع: `O(N log N)`الخوارزمية لـ DFT عندما `N`كل مكتبة صوتية تستخدم FFT تحت الغطاء. FFT 1024 عينة عند 16 kHz يعطي 512 حاويات ترددات قابلة للاستخدام تتراوح بين 08 kHz عند قرار 15.6 Hz.

**Framing + window.**نحن لا نقوم بـ FFT كليف كامل. نحن نقصمه إلى *إطارات متداخلة * (عادةً 25 ms مع 10 ms hop) ، ونضاعف كل إطارات بمهمة نافذة (هان ، هامينغ) لقتل عدم استمرار الحافة ، ثم FFT كل إطارات. هذا هو تحويل فوريه في وقت قصير (STFT). يبدأ الدروس 02 من هنا.

```figure
mel-scale
```

## بناءها

### الخطوة الأولى: قراءة المقطع و رسم شكل الموجة

`code/main.py`يستخدم فقط الـ stdlib `wave`وحدة للحفاظ على التبعية التجريبية.`soundfile`أو`torchaudio.load`(كلتا العائلتين`(waveform, sr)`(أربعة):

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### الخطوة الثانية: قم بتجميع موجة السينوس من المبادئ الأولى

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

440 هرتز سينوس (مؤدي A) عند 16 كيلوهرتز لمدة ثانية واحدة هو 16000 طائرة.`wave.open(..., "wb")`باستخدام تشفير PCM 16 بت.

### الخطوة الثالثة: حساب DFT يدوياً

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

`O(N²)`حسناً`N=256`للتأكيد على صحة، لا فائدة من الصوت الحقيقي.`numpy.fft.rfft`أو`torch.fft.rfft`. . .

### الخطوة الرابعة: العثور على التردد المهيمن

مؤشر ذروة الحجم`k_star`خرائط التردد`k_star * sr / N`إذا قمت بتشغيل هذا على 440 هرتز سينوس يجب أن يعود ذروة في بن`440 * N / sr`. . .

### الخطوة 5: إظهار التعبير

عينة من 7 كيلو هرتز الصين عند 10 كيلو هرتز (نيكوست = 5 كيلو هرتز).`10 − 7 = 3 kHz`. تظهر ذروة FFT عند 3 كيلوهرتز . هذا هو التجريبية الكلاسيكية وتلك هي السبب في كل DAC / ADC السفينة مع حائط الطوب منخفض الممر الصفافة .

## استخدمها

الكبيرة التي ستُرسلونها في عام 2026:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

قاعدة القرار: **match sample rate before you match anything else**ويشبر يتوقع 16 كيلو هرتز من التنقل الموحد32 . إعطيه 44.1 كيلو هرتز من الصوت الصوت الصوتي وستحصل على قمامة تبدو مثل حشرة النموذج.

## أرسله

إبقوا`outputs/skill-audio-loader.md`هذه المهارة تساعدك على التحقق من أن مدخل الصوت يطابق توقعات النموذج التدريجي ويعيد التمثيل بشكل صحيح عندما لا.

## التمارين

1. **Easy.**قم بتجميع خليط ثانية واحدة من 220 هرتز + 440 هرتز + 880 هرتز عند 16 كيلوهرتز. تشغيل DFT. تأكد ثلاثة قمم في القمامة المتوقعة.
2. **Medium.**سجل WAV 3 ثواني من صوتك عند 48 كيلوهرتز.`torchaudio.transforms.Resample`(مع مكافحة التخفيف) ، ثم إلى 16 كيلوهرتز باستخدام العشرية البديلة (كل عينة ثالثة).
3. **Hard.**قم ببناء STFT من الصفر باستخدام فقط `math`و DFT من الخطوة 3 حجم الإطار 400، هوب 160، نافذة Hann.`matplotlib.pyplot.imshow`هذه هي الطيفيات في الدروس رقم 02

## الشروط الرئيسية

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

## المزيد من القراءة

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) الورقة وراء نظرية أخذ العينات.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) كتاب دراسي DSP مجاني
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) عملية المشي مع الرمز.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) إشارة لماذا الصوت في العالم الحقيقي ليس سينوسيد نظيف.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/)إنطباع القمامة الترددية تمت تصفيته في غضون 10 دقائق
