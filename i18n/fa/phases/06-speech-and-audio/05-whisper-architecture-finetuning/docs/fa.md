# همس زدن  معماری و تنظیم دقیق

> Whisper یک ترانسفورمتر پنجره ای 30 ثانیه ای کدگذاری و دیکوتر است که در 680 هزار ساعت از زوج های صوتی متن چند زبانی که به طور ضعیف تحت نظارت هستند آموزش دیده است. یک معماری، وظایف متعدد، قوی در 99 زبان. ASR مرجع 2026 .

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## مشکل

ویسپر، که توسط OpenAI در سپتامبر 2022 منتشر شد، اولین مدل ASR بود که به عنوان یک کالای عرضه شد: آڈیو را پیوند دهید، متن دریافت کنید، 99 زبان، قوی به صدا، در لپ تاپ اجرا می شود. تا سال 2024 OpenAI نسخه های بزرگ v3 و توربو را عرضه کرده بود؛ تا سال 2026، ویسپر پایه پیش فرض برای همه چیز از نقل پوکاست تا دستیاران صوتی تا زیرنویس یوتیوب است.

اما "ویسپر" یک خط لوله نیست که شما می توانید به عنوان یک جعبه سیاه برای همیشه برخورد کنید. تغییر دامنه آن را می کشد  اصطلاحات فنی، تلفظ سخنرانان، اسم های مناسب، کلیپ های کوتاه، سکوت. شما باید بدانید:

1. اون چه چیزی هست که در داخلش هست
2. چطور به طور درست به صورت قطعات، پخش و یا شکل بلند صدا بدهیم؟
3. چه وقت و چطور بايد درستش کنيم

## مفهوم

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**ترانسفورماتور استاندارد کدگر-دکدر

- ورودی: 30 ثانیه طیف نامه ی log-mel، 80 میلیمتر، 10 ms hop → 3000 فریم. کلیپ های کوتاه تر صفر پوشانده شده و کلیپ های طولانی تر پاره شده اند.
- کدرها: نمونه پایین (خطای 2) + `N`بلوک هاي ترانسفورماتور براي مدل بزرگ v3: 32 لايه، 1280-dim، 20 سر
- کد کد:`N`بلوک های ترانسفورماتور با خودآگاهی علت + آگاهی کراس به خروجی کدرها. اندازه ی مشابه کدرها.
- تولید: توکن های BPE بر روی یک لغت ۵۱٫۸۶۵ توکن.

Large-v3 دارای پارامای 1.55B است. توربو از یک کدگر چهار لایه (از 32) استفاده می کند، که تاخیر 8x را با ضربه WER <1% کاهش می دهد.

**The prompt format.**Whisper یک مدل چند وظیفه ای است که توسط توکن های ویژه در پرامپت دیکودر هدایت می شود:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: برچسب زبان؛ نام زبان صحبت شده در صدا. آن را خارج کنید و Whisper زبان را اولین بار تشخیص می دهد.
- `<|transcribe|>`یا`<|translate|>`: task tag؛ سخنرانی را به زبان اصلی اش نقل کنید یا به متن انگلیسی ترجمه کنید.
- `<|notimestamps|>`: از زمان بندی های سطح کلمه عبور کنید (سرعت تر).

پرامپت چیزی است که به یک مدل اجازه می دهد کارهای زیادی را انجام دهد. تغییر `<|en|>`به`<|fr|>`و به زبان فرانسه نقل می کند.

**30-second window.**همه چیز به ۳۰ ثانیه متصل می شود. کلیپ های طولانی تر نیاز به شکستن دارند؛ کلیپ های کوتاه تر پر شده اند. ویندوز ها به طور بومی جریان نمی گیرند.

**Log-mel normalization.** `(log_mel - mean) / std`که آمارها از کورپوس آموزش و پرورش ویسپر می آیند. شما باید از پردازش پیش از ویسپر استفاده کنید (`whisper.audio.log_mel_spectrogram`، نه`librosa.feature.melspectrogram`. .

### انواع در سال 2026

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### تنظیم دقیق

جریان کار کنونیکی در سال 2026:

1. جمع آوری 10100 ساعت صدا در دامنه هدف با نوسخه های هماهنگ شده.
2. فرار کن`transformers.Seq2SeqTrainer`با`generate_with_loss`تماس مجدد
3. پارامتر موثر: LoRA در `q_proj`،`k_proj`،`v_proj`از لایه های توجه حافظه GPU را 4× با هزینه WER < 0.3 کاهش می دهد.
4. اگر <10 ساعت وقت دارید کدر را منجمد کنید. فقط کدر را تنظیم کنید.
5. از توکنایزر و فورمات فوری Whisper استفاده کنید؛ هرگز توکنایزر ها را عوض نکنید.

نتایج جامعه: تنظیم دقیق متوسط در 20 ساعت دیکتات پزشکی WER را از 12 تا 4.5% در ذخایر پزشکی کاهش می دهد. تنظیم دقیق Turbo در 4 ساعت در ایسلند WER را از 18 تا 6 درصد کاهش می دهد.

```figure
sp-asr-attention
```

## آن را بسازید

### مرحله اول: Whisper را از جعبه خارج کنید

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

اشتباهات کلیدی که همیشه باید ردش کنید: `temperature=0.0`(نمونه گیری معیارهای پیش فرض به 0.0 → 0.2 → 0.4 ... زنجیره برگشت) `condition_on_previous_text=False`(از مشکل توهم در حال تبهکاری جلوگیری می کند) و`no_speech_threshold=0.6`(دستشکن سکوت)

### مرحله دوم: شکل طولانی قطعه ای

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX اضافه می کند (1) Silero VAD گاتینگ، (2) خط بندی سطح کلمه از طریق wav2vec 2.0، (3) روزانه سازی از طریق `pyannote.audio`. کارگاه 2026 برای نقل تولید

### مرحله 3: تنظیم دقیق با LoRA

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

بعد از اين، چک پينت هر هزار قدم رو با WER بررسي کن

### مرحله 4: بررسی کنید که هر لایه چه یاد می گیرد

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

با یک نقشه گرما مشاهده کنید  شما یک خط خطافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافافاف

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) سریع ترین زمان اجرا نتیجه گیری CPU + GPU در 2026 است  4x سریع تر از وانیل با خروجی یکسان.

## خطرهایی که هنوز در سال 2026 وجود دارند

- **Hallucinated text on silence.**در این بخش از فیلم، از جمله "شکریہ برای تماشا کردن"، "موقع ثبت نام"، متن آهنگ ها، همیشه قبل از تماس با VAD-gate استفاده می شود.
- **`condition_on_previous_text` cascade.**يه توهم پنجره هاي بعد رو آلوده ميکنه`False`مگر اینکه به تسلط در قطعات نیاز داشته باشید.
- **Short-clip padding.**یک کلیپ 2 ثانیه ای که تا 30 ثانیه بسته شده است می تواند در سکوت عقب ها تو هم الهاسیون ها ایجاد کند.`pad=False`یا دروازه های VAD
- **Wrong mel stats.**با استفاده از "ميلز" کتابچه به جای "ويسپر" به طور تصادفي تولید ميکنه`whisper.audio.log_mel_spectrogram`. .

## -باده

پس از`outputs/skill-whisper-tuner.md`طراحی یک خط لوله و یا نتیجه گیری Whisper برای یک دامنه خاص.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این یک پیام به سبک "ویسپر" را نشان می دهد، بودجه شکل های رمزگذاری شده را محاسبه می کند و برنامه قطعه را برای یک کلیپ 10 دقیقه چاپ می کند.
2. **Medium.**نصب کنید`faster-whisper`،پدکست 10 دقیقه ای را نقل کنید، WER را با یک نسخه انسانی مقایسه کنید.`language="auto"`به زور`language="en"`. .
3. **Hard.**استفاده از HF `datasets`، یک زبان را انتخاب کنید که Whisper با آن مبارزه می کند (به عنوان مثال، اردو) ، میانگین را با LoRA برای 2 دوره در 2 ساعت تنظیم کنید و WER دلتا را گزارش کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## خواندن بیشتر

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) معماری اصلی و دستور کار آموزش.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363) 4 لایه کدگر، 8x سرعت
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) شکل بلند، با کلمه هماهنگ، روزانه
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 پشتيباني شده، 4x سریعتر
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) راه رفتن کامل LRA / FT
