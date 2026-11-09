# تشخیص فعالیت های صوتی و تبدیل  سیلرو، کوبرا و ترفند فلوش

> هر نماینده صوتی زندگی می کند یا می میرد بر اساس دو تصمیم: آیا کاربر در حال صحبت است و آنها انجام شده اند؟ VAD پاسخ به اولین پاسخ می دهد. تشخیص باری (VAD + خاموشی-تراکم + مدل پایان نقطه معنوی) پاسخ به دوم می دهد. یا اشتباه کنید و دستیار شما یا کاربران را قطع می کند یا هرگز ساکت نمی شود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## مشکل

سه تصميم مختلف که يک مامور صداي در هر 20 ميلي متر ميکنه:

1. **Is this frame speech?**-فاد، دوگانه، هر فریم
2. **Has the user started a new utterance?** تشخیص شروع
3. **Has the user finished?** نشان دادن پایان (پیروان پایان).

پاسخ ساده (حاجر انرژی) در هر نوع صدا  ترافیک، صفحه کلید، گپ زدن جمعیت شکست می خورد. پاسخ 2026: Silero VAD (باز، عمیق آموخته) + یک مدل تشخیص نوبت (توجیه پایان معنوی) + یک سکوت خستگی VAD-کالیب شده.

## مفهوم

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### سه طبقه ای از قطعات VAD

**Tier 1: energy gate.**ارزان ترين، ريمس در -40 ديبل فورس، خاموشي رو تصفيه ميکنه اما هر صداي بالاتر از حد رو مي شليک کنه

**Tier 2: Silero VAD**(2020-2026, MIT). 1M پارامتر. آموزش داده شده در 6000+ زبان. در ~ 1 ms در هر 30 ms قطعه در یک رشته CPU واحد اجرا می شود. 87.7% TPR در 5% FPR. پیش فرض منبع باز.

**Tier 3: semantic turn detector.**مدل تشخیص نوبت LiveKit (2024-2026) یا طبقه بندی کوچک خود را. "منتظر در وسط جمله" را از "گفتار انجام شده" متمایز می کند.

### پارامترهای کلیدی و معیارهای آنها

- **Threshold.**سیلرو احتمال را تولید می کند؛ سخنرانی را با &gt; 0.5 (پیش فرض) یا &gt; 0.3 (حساس) طبقه بندی کنید. آستانه پایین تر = کلیپ های کلمه اول کمتر، مثبت های غلط بیشتر.
- **Minimum speech duration.**صحبت کوتاه تر از 250 ms را رد کنید  معمولا سرفه یا صدای صندلی.
- **Silence hangover (end-pointing).**بعد از اینکه VAD به 0 برگردد، قبل از اعلام پایان نوبت 500 تا 800 ms صبر کنید. خیلی کوتاه → قطع کاربر. خیلی طولانی → احساس کند.
- **Pre-roll buffer.**300 تا 500 ms صدا رو نگه داريد قبل از اينکه VAD شليک بشه

### راه حل فلش (کيوتاى 2025)

مدل های STT جریان به تاخیر در پیش بینی (500 ms برای Kyutai STT-1B، 2.5 ثانیه برای STT-2.6B) است. معمولاً شما تا این حد بعد از پایان سخنرانی برای نقل قول انتظار می کنید.**send a flush signal to the STT**که باعث می شود محصول فوری شود. STT در زمان واقعی 4x پردازش می کند، بنابراین 500 ms بفر در حدود 125 ms تمام می شود.

پایان تا پایان: 125 ms VAD + flush STT = تاخیر مکالمه.

### مقایسه VAD 2026

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

سیلرو به طور پیش فرض درست است. کوبرا ارتقاء مطابق / دقت است. تنها انرژی VAD هیچ جایی در تولید 2026 ندارد.

```figure
sp-vad-cascade
```

## آن را بسازید

### مرحله اول: دروازه انرژی

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### مرحله دوم: Silero VAD در پایتون

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

### مرحله سوم: ماشین حالت آخر

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

### مرحله چهارم: اسکلت فلو

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (Kyutai، Deepgram، AssemblyAI) باید از flush پشتیبانی کند تا این کار کند. پخش همس نمی کند  این بر اساس بلوک است و همیشه منتظر قطعات است.

## ازش استفاده کن

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

قانون عمومي: هرگز به جز VAD صرفاً انرژی را ارسال نکنید مگر اینکه واقعاً چاره ای ندارید.

## دام ها

- **Fixed threshold.**در زمان خاموشي کار ميکنه، در زمان شوري شکست ميده يا دستگاه رو در حال كارسازي ميکنه يا به سايلرو ميگيره
- **Too-short silence hangover.**مامور وسط جمله رو قطع ميکنه 500 تا 800 ms جاي خوبي براي گفتگويي
- **Too-long hangover.**حس کندي ميکنه. آزمايش A/B با کاربران هدف
- **No pre-roll buffer.**اولين 200 تا 300 ms صداي کاربر گم شده هميشه يه رول پيش رو نگه دار
- **Ignoring semantic endpointing.**"بذار فکر کنم"... شامل وقفه های طولانی است. کاربران از قطع شدن در وسط فکر متنفرند. از دستگاه تشخیص نوبت LiveKit یا چیزی شبیه آن استفاده کنید.

## -باده

پس از`outputs/skill-vad-tuner.md`مدل VAD، حد، زایمان، قبل از رول و استراتژی تشخیص نوبت برای یک بار کار را انتخاب کنید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این یک خطاط + سکوت + خطاط + سرفه ترتیب و تست سه سطح VAD.
2. **Medium.**نصب کنید`silero-vad`، 5 دقیقه ضبط را پردازش کنید، حدودی را تنظیم کنید تا کلیپ های کلمه اول و محرک های غلط را به حداقل برساند.
3. **Hard.**ساخت یک دستگاه کوچک ردیاب نوبت: Silero VAD + یک MLP سه لایه در 10 کلمه ی آخر (با استفاده از ترانسفورماتور جمله) تمرین کنید بر روی یک مجموعه داده های نوبت پایان دست نشان داده شده. فقط Silero را با 10٪ F1 شکست دهید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## خواندن بیشتر

- [Silero VAD](https://github.com/snakers4/silero-vad) باز کردن VAD مرجع
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) رهبر دقت تجاری
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) ترفند مهندسی زیر 200 ms
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) نشان دادن پایان معنوی در تولید
- [WebRTC VAD](https://webrtc.googlesource.com/src/) اصل میراث
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) بخش بندی درجه ی روزانه سازی
