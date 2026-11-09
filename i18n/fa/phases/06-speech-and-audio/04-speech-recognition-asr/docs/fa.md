# تشخیص گفتار (ASR)  CTC, RNN-T, توجه

> تشخیص گفتار، طبقه بندی صوتی در هر مرحله زمانی است که توسط یک مدل تسلسل که انگلیسی و سکوت را می داند، به هم متصل می شود. CTC، RNN-T و توجه سه راه برای انجام این کار هستند. یکی را انتخاب کنید و بفهمید چرا.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## مشکل

شما یک کلیپ 10 ثانیه 16 kHz دارید. شما یک رشته می خواهید: " چراغ های آشپزخانه را روشن کنید". چالش ساختاری است: فریم های صوتی با یک حرف با یک هم تعادل نمی کنند. کلمه "خوب" ممکن است 200 ms یا 1200 ms طول بکشد. سکوت بیان را نشان می دهد. برخی از فونم ها طولانی تر از دیگران هستند. تعداد توکن های خروجی پیش از این معلوم نیست.

سه فرمول این مسئله را حل می کند:

1. **CTC (Connectionist Temporal Classification).**احتمالات توکن در هر فریم را شامل یک * خالی* خاص صادر کنید. تکرار های سقوط و خالی در زمان رمزگذاری. غیر خودکشی، سریع. توسط wav2vec 2.0 استفاده می شود. MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**شبکه مشترک پیش بینی می کند که رمز بعدی به عنوان فریم کدر و رمز های قبلی است. قابل پخش. توسط دستگاه ASR گوگل، NVIDIA Parakeet استفاده می شود.
3. **Attention encoder-decoder.**کدگر آدیو را به حالت های پنهان فشرده می کند، کدگر به صورت متقابل برای تولید توکن ها به صورت خودکار استفاده می کند.

در سال 2026، SOTA WER در LibriSpeech test-clean 1.4٪ (Parakeet-TDT-1.1B، NVIDIA) و 1.58٪ (Whisper-Large-v3-turbo) است. تفاوت ها کوچک هستند؛ تفاوت های انتشار بسیار بزرگ هستند.

## مفهوم

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**اجازه دهید کدگر خارج شود`T`توزیع سطح فریم در طول `V+1`توکن ها (V حرف + خالی) برای یک رشته هدف`y`طولش`U < T`، هر خطيشون قابي که به سمت`y`شمارش. CTC خسارت مجموع تمام این خط بندی ها. تعبیر: هر فریم argmax، سقوط تکرار، حذف خالی.

مزایای: غیر خودکشی، قابل جریان، صفر نگاه. مزیت: * فرض استقلال مشروط*  هر پیش بینی فریم از دیگران مستقل است، بنابراین هیچ مدل زبان داخلی وجود ندارد. با یک LM خارجی از طریق جستجوی شعاع یا فیژن سطحی حل کنید.

**RNN-T intuition.**یک شبکه *predictor* را اضافه می کند که تاریخچه توکن را در خود قرار می دهد و یک *joiner* را که حالت پیش بینی کننده را با فریم کدر به یک توزیع مشترک در یک ترکیب می کند.`V+1`(موقع`+1`یک null / no-emitt است). به طور صریح وابسته بودن مشروط CTC را نادیده می گیرد. قابل پخش است زیرا هر مرحله فقط در فریم های گذشته و توکن های گذشته است.

مزایا: جریان پذیر + LM داخلی. عوارض: آموزش پیچیده تر و گرسنه حافظه (3D grid loss) است؛ هسته های RNN-T loss یک دسته کتابخانه کامل در خود هستند.

**Attention encoder-decoder.**کدگر (6-32 لایه ترانسفورماتور) بر روی فریم های log-mail. کدگر (6-32 لایه ترانسفورماتور) به تولیدات کدگر در جهت تولید توکن ها به صورت خودکار عمل می کند. هیچ محدودیت تعادل  توجه می تواند در هر نقطه از صوتی نگاه کند. غیر قابل پخش است مگر اینکه توجه را محدود کنید (سخت شده Whisper-Streaming، 2024).

مزایا: بالاترین کیفیت در ASR غیر فعال، آسان برای آموزش با ابزار استاندارد seq2seq. ممانعت: تاخیر autoregressive متناسب با طول خروجی است؛ نمی تواند بدون مهندسی جریان.

### WER: شماره ی یک

**Word Error Rate**= $(S + D + I) / N$، کجا$S$=تبدیل ها$D$= حذف شدن،$I$=درآمدها$N$= شمارش کلمات مرجع. با فاصله ی ویرایش Levenshtein در سطح کلمات مطابقت دارد. پایین تر بهتر است. WER بالای 20٪ به طور کلی غیرقابل استفاده است؛ زیر 5٪ برای خواندن صحبت با انسان برابر است. اعداد 2026 در معیار های استاندارد:

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

این سیستم ها همگی مبتنی بر کدگر-دکودر یا RNN-T هستند. سیستم های CTC خالص (wav2vec 2.0) در حدود 1.82.1% در حالت تمیز بودن تست قرار دارند.

```figure
ctc-collapse
```

## آن را بسازید

### مرحله اول: کدن کد CTC طمع

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

دو قانون: تکرار های پیوسته سقوط، خالی ها را رها کنید.`a a _ _ a b b _ c`→ `a a b c`. .

### مرحله دوم: CTC جستجو در شعاع

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

تولید از جستجوی شعاع درختان پیش فرض با فیوژن LM استفاده می کند؛ این اسکلت مفهومی است.

### مرحله سوم: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### مرحله چهارم: نتیجه گیری در مقابل همس

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

یک خط برای قوی ترین ASR عمومی در سال 2026 اجرا می شود بر روی یک GPU 24 GB در زمان واقعی ~ 20 ×.

### مرحله 5: پخش با Parakeet یا wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

پخش ASR نیاز به توجه کدرها و حالت حمل و نقل دارد؛ از یک کتابخانه که از آن پشتیبانی می کند استفاده کنید (NeMo برای Parakeet، `transformers`خط لوله ای با `chunk_length_s`)

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## خطرهایی که هنوز در سال 2026 وجود دارند

- **No VAD.**"در حال اجرا از صدای چپ زدن، توهمات ایجاد می کند".
- **Character vs word vs subword WER.**گزارش WER سطح کلمه * پس از * عادی سازی (کمترین حرف، علامت بندی حذف شده)
- **Language ID drift.**Whisper's auto LID کلیپ های سر و صدا را به زبان ژاپنی یا ولسی اشتباه می کند؛ زور `language="en"`وقتی که می دونی
- **Long clips without chunking.**"سسپر" يه پنجره 30 ثانيه داره`chunk_length_s=30, stride=5`تا هر چیزی که بیشتر باشد

## -باده

پس از`outputs/skill-asr-picker.md`مدل انتخاب، استراتژی رمزگذاری، شکستن و ترکیب LM برای هدف تحرک مشخص

## تمرینات

1. **Easy.**فرار کن`code/main.py`. آن بخاطری یک محصول CTC دستکاری را رمزگذاری می کند و WER را با یک مرجع محاسبه می کند.
2. **Medium.**جستجوی شعاع درخت پیش فرض را در مرحله 2 به درستی اجرا کنید (حساب قاعده ترکیب خالی را محاسبه کنید). در مجموعه داده های مصنوعی 10 نمونه با طمع مقایسه کنید.
3. **Hard.**استفاده کنید`whisper-large-v3-turbo`در[LibriSpeech test-clean](https://www.openslr.org/12).WER را در 100 سخنان اول محاسبه کنید. با اعداد منتشر شده مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## خواندن بیشتر

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) مقاله CTC
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) کاغذ RNN-T
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) کاغذ کلیسای سنت 2022؛ گسترش v3-توربو در سال 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) 2026 رهبر صفحه ی سطح ASR باز.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) معیار زنده در 25 مدل
