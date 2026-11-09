# ارزیابی صوتی  WER، MOS، UTMOS، MMAU، FAD و فهرست های رتبه بندی باز

> شما نمی توانید چیزی را که نمی توانید اندازه گیری کنید ارسال کنید. این درس متریک های 2026 را برای هر کار صوتی نام می دهد: ASR (WER، CER، RTFx) ، TTS (MOS، UTMOS، SECS، WER-on-ASR-round-trip) ، زبان صوتی (MMAU، LongAudioBench) ، موسیقی (FAD، CLAP) و بلندگو (EER). به علاوه جدول رتبه بندی هایی که در آن مقایسه می کنید.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## مشکل

هر کار صوتی دارای چندین متریک است که هر یک از آنها محور متفاوتی را اندازه گیری می کند. با استفاده از متریک اشتباه، شما چگونه یک مدل را ارسال می کنید که در داشبورد شما عالی و وحشتناک در تولید است. لیست کَنونیکی 2026:

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

## مفهوم

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### متریک ASR

**WER (Word Error Rate).** `(S + D + I) / N`. کم حرف، خط خط خطي، شماره ها رو قبل از نمره ها معمول سازي`jiwer`یا OpenAI`whisper_normalizer`. &lt;۵٪ = صحبت کردن در برابر انسانها

**CER (Character Error Rate).**فرمول مشابه، سطح حروف. برای زبان های تن (ماندارین، کانتونیز) استفاده می شود که در آن بخش بندی کلمات مبهم است.

**RTFx (inverse real-time factor).**ثانيه هاي صداي در هر ساعت ديواري پردازش مي شود. بالاتر بهتره. Parakeet-TDT 3380× را به دست مي آورد. Whisper-large-v3 حدود 30× را به دست مي آورد.

**First-token latency.**ساعت ديواري از ورودی صوتی تا اولین توکن ترانسکریپت مهم برای پخش

### متریک TTS

**MOS (Mean Opinion Score).**1-5 درجه انسانی. استاندارد طلا اما آهسته. جمع آوری 20+ شنونده در هر نمونه، 100+ نمونه در هر مدل.

**UTMOS (2022-2026).**پیش بینی MOS آموخته شده. با MOS انسان در معیار استاندارد ارتباط دارد. F5-TTS: UTMOS 3.95; حقیقت پایه: 4.08.

**SECS (Speaker Encoder Cosine Similarity).**برای کلون کردن صدا. ECAPA شامل کردن cosine بین مرجع و تولید کلون شده. &gt; 0.75 = کلون قابل تشخیص.

**WER-on-ASR-round-trip.**Whisper را در خارج از TTS اجرا کنید، WER را با متن ورودی محاسبه کنید. بازگشت های قابل فهمی را ضبط می کند. SOTA: &lt; 2% WER در مجموعه های آزمون انگلیسی (به جای مجموعه های ماندارین گزارش CER).

**TTFA (time-to-first-audio).**تاخیر ساعت دیواری. کوکورو-82M: ~100 ms; F5-TTS: ~1 ثانیه.

### مخصوص کلون صدا

**SECS + MOS + CER**کلون هایی که دارای امتیاز بالا SECS اما MOS پایین هستند، به معنای تلفظ درست اما غیر طبیعی هستند. برعکس به معنای صدای طبیعی اما سخنران اشتباه است.

### تایید سخنرانان

**EER (Equal Error Rate).**حدّی که نرخ پذیرش نادرست برابر با نرخ رد نادرست است. ECAPA در VoxCeleb1-O: 0.87%.

**minDCF (min Detection Cost).**هزینه های وزن شده در یک نقطه عملیاتی انتخاب شده (معمولا FAR=0.01) ، نسبت به EER برای تولید بیشتر است.

### آبهام

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. گفتار گم شده + گفتار زنگ نادرست + مکالمه و سردرگمی، هر کدام به عنوان یک بخش. جلسات AMI: DER ~ 10-20% واقع بین است.

**JER (Jaccard Error Rate).**جایگزین DER، قوی به بخش کوتاه تعصب.

### طبقه بندی صوتی

چند تا برچسب: **mAP (mean Average Precision)**در تمام کلاس ها. آڈیوسیت: 0.548 mAP برای BEATs-iter3.

کلاس های چندگانه: **top-1, top-5 accuracy**. فرمان هاي گفتار v2: 99.0% top-1 (Audio-MAE).

عدم تعادل: **macro F1**+ **per-class recall**گزارش در هر کلاس  دقت کلی پنهان می کند که کدام کلاس ها شکست خورده اند.

### نسل موسیقی

**FAD (Fréchet Audio Distance).**فاصله بین توزیع های VGGish-بند شده از صداهای واقعی و تولید شده. MusicGen- کوچک در MusicCaps: 4.5 . MusicLM: 4.0. پایین تر بهتر است.

**CLAP Score.**امتیاز تعادل متن و صوتی با استفاده از گنجانده های CLAP. &gt; 0.3 = تعادل معقول.

**Listening panel MOS.**هنوز آخرین کلمه برای موسیقی مصرف کننده است. Suno v5 ELO 1293 را در معیار اولویت های جفتی Suno بدست آورد. این یک شماره فروشنده است؛ TTS Arena سخنرانی را رتبه بندی می کند، نه موسیقی.

### معیار های زبان صوتی

**MMAU (Massive Multi-Audio Understanding).**10 هزار تا جفت صداي-QA

**MMAU-Pro.**1800 قطعه سخت، چهار دسته: گفتار / صدا / موسیقی / چند صدا. شانس تصادفی 25٪ در چهار راه. دوقلوها 2.5 پرو در مجموع ~ 60٪؛ چند صدا ~ 22٪ در تمام مدل ها.

**LongAudioBench.**کلیپ چند دقیقه ای با سوال های معنوی آڈیو فلامینگو بعدی از جیمنی 2.5 پرو بهتر است

**AudioCaps / Clotho.**به عنوان عنوان شاخص های مرجع، SPICE، CIDER، FENSE متریک

### پخش از حرف به حرف

**Latency P50 / P95 / P99.**ساعت دیواری از آخر کاربری تا اولین پاسخ شنونده.

**WER / MOS**در خروجی

**Barge-in responsiveness.**زمان از قطع کاربری تا معاون خاموش. هدف 150 ms.

### فهرست برتر سال 2026

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

## آن را بسازید

### مرحله ی ۱: WER با عادی سازی

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

### مرحله دوم: WER سفر برگشت و بازگشت TTS

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### مرحله 3: SECS برای کلون کردن صدا

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### مرحله 4: FAD برای تولید موسیقی

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### مرحله 5: EER برای تایید سخنرانان (هم کد با درس 6)

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

## ازش استفاده کن

هر تعيين با يک هيرنس تحسيني ثابت که در هر تمديد مدل اجرا مي شود، جفت ميکنه.

1. **Normalize before scoring.**کم حرف، خط خطي، شماره ي بزرگ، قانون نرمالي را گزارش بده
2. **Report distributions, not averages.**P50/P95/P99 برای تاخیر. به هر کلاس برای طبقه بندی. به هر دسته برای MMAU.
3. **Run one canonical public benchmark.**حتی اگر داده های تولید شما متفاوت باشد، گزارش در Open ASR / TTS Arena / MMAU اجازه می دهد که بازرس ها سیب به سیب مقایسه کنند.

## دام ها

- **UTMOS extrapolation.**آموزش دیده در گفتار تمیز سبک VCTK؛ امتیاز های صدای سر و صدا / کلون / عاطفی ضعیف.
- **MOS panel bias.**20 کارمند آمازون مکانیک ترک ≠ 20 کاربر هدف. اگر شرط بالا باشد برای یک پانل دامنه پرداخت کنید.
- **FAD depends on reference set.**با مقایسه با همان توزیع مرجع در مدل ها مقایسه کنید.
- **Aggregate WER.**یک WER 5٪ به طور کلی می تواند 30٪ WER را در سخنرانی تاکید شده پنهان کند. گزارش بر اساس بخش جمعیتی.
- **Public benchmark saturation.**بیشتر مدل های مرزی در حدود سقف در معیار استاندارد هستند. یک مجموعه در خانه نگه داشته شده بسازید که بازتاب ترافیک شما را منعکس کند.

## -باده

پس از`outputs/skill-audio-evaluator.md`. برای هر نسخه از مدل صوتی، متریک، معیارها و فرمت گزارش را انتخاب کنید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`WER / CER / EER / SECS / FAD-ish / MMAU-ish را بر روی ورودی های بازیابی محاسبه کنید.
2. **Medium.**یک ربات WER سفر و بازگشت TTS بسازید. تولید Kokoro یا F5-TTS خود را از طریق Whisper اجرا کنید. WER را بیش از 50 پیام محاسبه کنید. پیام های پرچم با WER &gt; 10%.
3. **Hard.**امتیاز را در انتخاب درس ۱۰ LALM خود در MMAU-Pro سخنرانی + فرعی فرعی چند صدا (50 مورد هر) ثبت کنید. دقت هر دسته را گزارش کنید و با تعداد منتشر شده مقایسه کنید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [jiwer](https://github.com/jitsi/jiwer) کتابخانه WER/CER با ابزار عادی سازی.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) پیش بینی کننده MOS یاد گرفتم
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) استاندارد موسیقی
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) رتبه بندی زنده 2026
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) رتبه بندی TTS با رای های انسانی
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) رتبه بندی استدلال LALM
- [HEAR benchmark](https://hearbenchmark.com/) معیار های صوتی SSL
