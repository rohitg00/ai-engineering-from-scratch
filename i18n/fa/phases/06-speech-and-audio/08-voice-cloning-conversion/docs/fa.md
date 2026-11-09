# کلون صدا و تبدیل صدا

> کلون صدا متن شما را در صدای شخص دیگری می خواند. تبدیل صدا صدا صدا صدا شما را به صدای شخص دیگری می نویسد در حالی که آنچه را که گفتید را حفظ می کند. هر دو به تجزیه یکسان وابسته هستند: هویت سخنران را از محتوای جداگانه.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## مشکل

در سال 2026، یک کلیپ صوتی 5 ثانیه برای تولید یک کلون با کیفیت بالا از صدای هر کسی با یک GPU مصرف کننده کافی است. ElevenLabs، F5-TTS، OpenVoice v2، VoiceBox همه کلون صفر شات یا چند شات را ارسال می کنند. این فناوری یک نعمت (توصول TTS، دوبینگ، صداهای کمک کننده) و یک سلاح (دعوات کلاهبرداری، deepfakes سیاسی، سرقت IP) است.

دو وظیفه مرتبط:

- **Voice cloning (TTS-side):**متن + 5 ثانیه صداي مرجع → صداي در آن صدا
- **Voice conversion (speech-side):**صوتی منبع (شخص A می گوید X) + صدای مرجع شخص B → صوتی B می گوید X.

هر دو عامل یک موج شکل به (محتوی، سخنران، prosody) و ترکیب مجدد محتوا از یک منبع با سخنران از دیگر.

محدودیت اصلی که الان در سال 2026 تحتش قرار می گیرید:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**لوله ات بايد يه علامت آبي ناشناخته رو منتشر کنه و کلان غير متفق رو رد کنه

## مفهوم

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**یک کلیپ 5 ثانیه را به یک مدل که در هزاران سخنران آموزش دیده است منتقل کنید. کدگر بلندگو کلیپ را به یک بلندگو که در آن قرار دارد نقشه می زند؛ کدگر TTS شرایط آن در آن قرار دارد و متن.

استفاده شده توسط: F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024).

**Few-shot fine-tuning.**ضبط 5-30 دقیقه از صدای هدف. LoRA-فین-تون یک مدل پایه برای یک ساعت. کیفیت از "خوب" به "غیر قابل تشخیص" می رود. کوکی و ElevenLabs هر دو از این الگوی پشتیبانی می کنند؛ جامعه از آن با F5-TTS استفاده می کند.

**Voice conversion (VC).**دو خانواده:

- **Recognition-synthesis.**مدل ASR مانند را اجرا کنید تا نمایش محتوا (به عنوان مثال، پسترهای فونیم نرم، PPG) را استخراج کنید، سپس با قرار دادن بلندگوی هدف دوباره ترکیب کنید. قوی به زبان و تاکید. توسط KNN-VC (2023) ، Diff-HierVC (2023) استفاده می شود.
- **Disentanglement.**یک خودکار کدگر را آموزش دهید که محتوای، سخنران و پروسودی را در فضای پنهان در گلو بطن جدا می کند. اسپکر را در نتیجه گیری گنجانده می کند. کیفیت پایین تر اما سریعتر. توسط AutoVC (2019) استفاده می شود، ویرانت VITS-VC.

**Neural codec-based cloning (2024+).**VALL-E، VALL-E 2، NaturalSpeech 3، VoiceBox  صوتی را به عنوان توکن های جداگانه از SoundStream / EnCodec در نظر بگیرید، یک مدل بزرگ خودکشی یا تطابق جریان را بر روی توکن های کودک آموزش دهید. کیفیت قابل مقایسه با ElevenLabs در پیام های کوتاه است.

### يه چيز اخلاقي، نه يه چيزهاي ديگه

**Watermarking.**PerTh (Perth) و SilentCipher (2024) یک ID ~16-32 بیت را به طور غیر قابل تشخیص در آڈیو گنجانده اند. دوباره کدگذاری، پخش و ویرایش های رایج زنده می ماند. منبع باز آماده تولید.

**Consent gates.**بايد هر محصولي که کلان شده است با سوابق موافقتي که قابل تصديق است همراه بشه. "من، روهيت، در سال 2026-04-22 اين صدا رو براي هدف X تصريح مي کنم".

**Detection.**AASIST، RawNet2 و Wav2Vec2-AASIST به عنوان آشکارسازها کشتی. ASVspoof 2025 چالش منتشر EER 0.82.3% برای آشکارساز های پیشرفته در برابر ElevenLabs، VALL-E 2 و بارک خروجی.

### شماره ها (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0.70 معمولا برای اکثر شنونده ها از هدف قابل تشخیص نیست.

```figure
sp-voice-factorize
```

## آن را بسازید

### مرحله 1: با تشخیص- سنتز (تنها کد در main.py) تجزیه کنید

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

مفهوم ساده است؛ جرم اجرای آن در `tts_model`و کدگر بلندگو

### مرحله 2: کلون صفر شوت با F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

نقل متن باید دقیقا با صوتی مطابقت داشته باشد؛ عدم مطابقت تعادل را قطع می کند.

### مرحله سوم: تبدیل صدا با KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC WavLM را اجرا می کند تا هر قاب را برای منبع و هدف از مجموعه استخراج کند، سپس هر قاب منبع را با نزدیکترین همسایه خود در حوضچه جایگزین می کند. غیر پارامترکی، با یک دقیقه سخنرانی هدف کار می کند.

### مرحله 4: یک آبیاری را وارد کنید

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~32 بیت بار مفید، قابل تشخیص بعد از MP3 کدگذاری مجدد و صداهای سبک

### مرحله 5: دروازه رضایت

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## دام ها

- **Misaligned reference transcript.**F5-TTS و موارد مشابه نیاز به متن مرجع برای مطابقت دقیق با صدا مرجع، شامل امتیاز دارد.
- **Reverberant reference.**اکو کلون رو ميکشه.
- **Emotional mismatch.**"مطمئن" آموزش به کلون های شاد از همه چیز تولید می کند.
- **Language leakage.**شبیه سازی یک زبان انگلیسی پس از آن از اینکه از مدل بخواهید فرانسوی صحبت کند اغلب به هر حال به آن تاکید دارد؛ از مدل های میان زبانی (XTTS، VALL-E X) استفاده کنید.
- **No watermark.**از اوت 2026 به طور قانونی در اتحادیه اروپا قابل حمل نیست.

## -باده

پس از`outputs/skill-voice-cloner.md`طراحی یک خط تولید کلون یا تبدیل با دروازه رضایت + آبی نشان + هدف کیفیت.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. نشان دهنده تبادل شامل کننده سخنران با محاسبه کوسین بین دو " سخنران" قبل و پس از تبادل.
2. **Medium.**از OpenVoice v2 برای کلان کردن صدای خود استفاده کنید. SECS را بین مرجع و کلان اندازه گیری کنید. CER را از طریق Whisper اندازه گیری کنید.
3. **Hard.**آبی نشان SilentCipher را به 20 کلون اعمال کنید، آنها را از طریق کد MP3 128 kbps + کد decode اجرا کنید، بار مفید را تشخیص دهید. دقت بیت را گزارش کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## خواندن بیشتر

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) کلون کردن سوتا با منبع باز صفر شوت
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)و[VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) TTS عصب-کودک
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) تبدیل صدا مبتنی بر تفکیک
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) سرمایه گذاری مبتنی بر بازیافت
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) آبیاری از صوتی 32 بت آماده تولید
- [ASVspoof 2025 results](https://www.asvspoof.org/)مسابقه تسلیحات دیتکتور در مقابل سنتزيزر، به روز رسانی شده در سال 2026
