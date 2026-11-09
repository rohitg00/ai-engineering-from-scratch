# المجموعات المتطرفة، مقياس الميل وميزات الصوت

> الشبكات العصبية لا تستخدم أشكال الموجات الخام بشكل جيد. إنها تستخدم الطيفيات. إنها تستخدم الطيفيات الميل بشكل أفضل. كل ASR ، TTS ، و تصنيف الصوت في 2026 يعيش أو يموت بسبب هذا الخيار المحدد من قبل المعالجة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## المشكلة

خذ شريط 10 ثواني 16 كيلوهرتز هذا يعادل 160,000 طائرة، كل ذلك في`[-1, 1]`، لا علاقة لها بالكامل تقريباً بالعلامة "كلب يلعق" أو "الكلمة القطة". شكل الموجة الخام يحوي المعلومات ولكن في شكل لا يمكن أن يستخرجه النموذج بسهولة.

تصحيح جهاز الطيف هذا. إنه ينهار التفاصيل الزمنية حيث يتجاهلها الإدراك البشري (التزعج في ميكرو ثانية) ويحافظ على الهيكل الذي يشارك فيه الإدراك (التي تكون تردداتها قوية ، على نطاق نافذة زمنية ~ 1025 ms).

يضغط شبكات الطيف الميل إلى أبعد من ذلك. يدرك البشر النطاق اللوغاريثميًا: 100 هرتز مقابل 200 هرتز يسمع "المساواة بينهما" مثل 1000 هرتز مقابل 2000 هرتز. يلتوي مقياس الميل المحور الترددي لتطابقه. شبكات الطيف الميل هي الميزة الوحيدة الأكثر أهمية في الكلام ML من عام 2010 إلى عام 2026.

## المفهوم

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**قطع شكل الموجة إلى إطارات متداخلة (معتاد: 25 ms نافذة، 10 ms hop = 400 عينات / 160 عينات عند 16 kHz). ضرب كل إطارات من خلال وظيفة نافذة (هان هو الافتراض؛ هامونغ تغيير مختلف قليلاً). FFT كل إطارات. تراكم الطيفات الكبيرة إلى ماتريكس من الشكل `(n_frames, n_freq_bins)`هذه هي طيفك

**Log-magnitude.**الحجم الخام يتراوح بين 5-6 ترتيبات من الحجم.`log(|X| + 1e-6)`أو`20 * log10(|X|)`كل خط إنتاج يستخدم حجم الحسابات، وليس حجم الخام

**Mel scale.**التردد`f`في خرائط Hz إلى mel `m`من$m = 2595 \cdot \log_{10}(1 + f / 700)$. الخريطة خطية تقريبًا تحت 1 كيلوهرتز وعلى نحو لوغاريتميكي أعلاه. 80 مل بين تغطي 08 كيلوهرتز هي مدخل ASR القياسي.

**Mel filterbank.**مجموعة من المرشحات الثلاثية المتراكمة بالتساوي على مقياس ميل. كل مرشح هو جمع وزن من حاويات FFT المجاورة. مضاعفة حجم STFT بالصفائح المصدر يمنح طيف ميل في ممل واحد.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`مدخلات "سيسبر" مدخلات "باراكيت" مدخلات "م4 تي" مدخلات الصوت العالمي 2026

**MFCCs.**خذ طيف الملفات المختلفة، وطبق DCT (نوع II) ، وابق العاملات الثلاثة عشر الأولى. ينسحب الميزات ويضغط أكثر. ميزة هيمنة حتى حوالي عام 2015 عندما تم التقاط سي إن إن / محولات على الملفات المختلفة الخام. لا يزال يستخدم في التعرف على المتحدثين (مجهرات x ، ECAPA).

**Resolution trade.**أكبر FFT = تحديد تردد أفضل ولكن تحديد وقت أسوأ. 25 ms / 10 ms هو الصوت-ML الافتراضي؛ 50 ms / 12.5 ms للموسيقى؛ 5 ms / 2 ms للكشف المؤقت (ضربات الطبول، الزبائن).

```figure
spectrogram-window
```

## بناءها

### الخطوة الأولى: إطار شكل الموجة

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

مقطع 10 ثواني 16 كيلوهرتز مع `frame_len=400, hop=160`يُعطى 998 إطار

### الخطوة الثانية: نافذة هان

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

مضاعفة العنصر قبل FFT. يزيل التسرب الطيفي الناجم عن التخفيض في نقاط نهاية غير صفر.

### الخطوة الثالثة: حجم STFT

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

استخدامات الإنتاج `torch.stft`أو`librosa.stft`(دعم FFT، متجهة) الحلقة هنا هي علمية؛ انها تعمل على مقاطع قصيرة في `code/main.py`. . .

### الخطوة الرابعة:

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

80 ميل تغطي 08 كيلوهرتز مع `n_fft=400`يعطي`(80, 201)`المصفوفة. ضرب `(n_frames, 201)`حجم STFT من خلال تحويل للحصول على `(n_frames, 80)`-ميل) ، (المتصفحات)

### الخطوة 5: المخططات

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

البدائل المشتركة: `librosa.power_to_db`(دبليو بي إيه المعتاد المرجعي)`10 * log10(power + eps)`. يستخدم Whisper كليب أكثر إدماجًا + تطبيع روتين (انظر Whisper's `log_mel_spectrogram`)

### الخطوة 6: MFCCs

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

تطبيق DCT على كل إطار الملفات، والحفاظ على العدد الأول 13. وهذا هو المصفوفة MFCC الخاص بك. العامل الأول عادة ما يتم إسقاط (إنه يرمز الطاقة الإجمالية).

## استخدمها

"مجموعة 2026"

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

قاعدة عامة:**if you are not working on music, start with 80 log-mels.**عبء الدليل على أي انحراف

## الفخاخ التي لا تزال تشغل في عام 2026

- **Mel count mismatch.**التدريب مع 80 ميل، الإستنتاج مع 128 ميل، فشل صامت، تسجيل الشكل المميز في كلا الطرفين.
- **Sample-rate mismatch upstream.**الميلات المحوسبة عند 22.05 كيلوهرتز تبدو مختلفة عن 16 كيلوهرتز.
- **dB vs log.**ويشبر يتوقع "لوج ميل" وليس "دي بي ميل" بعض خطوط الأنابيب HF تكتشف نفسها، لكن رمزك الخاص لن يفعل
- **Normalization drift.**التطبيع في التدريب، التطبيع العالمي خلال الإستنتاج، خطأ إنتاج يضاعف WER.
- **Leakage from padding.**إضافة الصفر إلى نهاية المقطوعة تنتج طيفاً مسطحاً في الإطارات المتأخرة.

## أرسله

إبقوا`outputs/skill-feature-extractor.md`. تحدد المهارة نوع الميزات، عدد الميل، الإطار/قفز، والطبيعية لهدف نموذج معين.

## التمارين

1. **Easy.**أركض`code/main.py`. يختلط الصفحة (تصفية تردد 200 → 4000 هرتز) ويطبخ مخطط argmax mel لكل إطار.
2. **Medium.**إعادة التدريب مع`n_mels`في`{40, 80, 128}`و`frame_len`في`{200, 400, 800}`-قاس عرض النطاق في جميع أنحاء محور الزمن.
3. **Hard.**تنفيذ`power_to_db`و مقارنة دقة ASR من تصنيف CNN الصغيرة على AudioMNIST باستخدام (أ) الملفات الخام الملفية، (ب) dB-mel مع `ref=max`(ج) MFCC-13 + دلتا + دلتا-دلتا.

## الشروط الرئيسية

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

## المزيد من القراءة

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420)ورقة المجلس المالي
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) مقياس الميل الأصلي
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) قراءة تنفيذ المرجعية.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) إشارة إلى `mfcc`،`melspectrogram`، و قفز / نافذة.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers)خط أنابيب على نطاق الإنتاج للطرازات Parakeet + Canary.
