# پخش پخش گفتار به گفتار  موشی، هیبیکی و گفتار دوگانه کامل

> در سال 2024-2026، هوش مصنوعی صوتی را دوباره تعریف کرد. موشی یک مدل واحد را ارسال می کند که به طور همزمان با 200 ms تاخیر گوش می دهد و صحبت می کند. هیبیکی ترجمه گفتار به گفتار را قطعه به قطعه انجام می دهد. هر دو لوله ASR → LLM → TTS را برای یک معماری یکپارچه کامل دوگونی بر روی توکن های کدک میمی رها می کنند. این طراحی مرجع جدید است.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## مشکل

هر عامل صوتی ساخته شده از درس 11 + 12 دارای یک سطح تأخیر اساسی در حدود 300-500 ms است: آتش VAD، فرآیندهای STT، دلایل LLM، TTS تولید می کند. هر مرحله دارای تأخیر حداقل خود است. شما می توانید تنظیم و موازی سازی کنید، اما شکل لوله شما را محدود می کند.

موشی (کیوتای، 2024-2026) یک سوال متفاوت را مطرح می کند: اگر لوله کشی وجود نداشته باشد؟ اگر یک مدل آڈیو را وارد کند و آڈیو را مستقیماً، به طور مداوم، با متن به عنوان یک "مونوگ داخلی" میانگین به جای مرحله مورد نیاز، منتشر کند؟

جواب اينه**full-duplex speech-to-speech**. تاخیر نظری 160 ms (80 ms Mimi frame + 80 ms تاخیر صوتی) . تاخیر عملی 200 ms در یک GPU L4 . این نیمی از آنچه که یک بهترین در کلاس پایپلاین شده است.

## مفهوم

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### معماری موشی

**Inputs.**دو جریان کدک میمی، هر دو در 12.5 هرتز × 8 کد بوک:

- جریان 1: صوتی کاربر (ممی کوده شده، به طور مداوم در حال ورود)
- جریان 2: صداهای موشی (که توسط موشی تولید شده)

**The transformer.**یک ترانسفارمر زمانی 7B-پاراستمر هر دو جریان و یک جریان متن "مونوگ داخلی" را پردازش می کند. در هر مرحله 80 ms، آن را:

1. آخرین توکن های کاربر میمی (8 کتاب کد) را مصرف می کند.
2. مصرف آخرین توکن های Moshi Mimi (8 کتاب کد، به عنوان تولید شده است).
3. تولید نشانه متن بعدی موشی (مونوگ داخلی) می کند.
4. تولید سیگنال های بعدی Moshi Mimi (8 کد بوک از طریق یک ترانسفورماتور کوچک عمق)

تمام سه جریان  آڈیو کاربر، آڈیو موشی، متن موشی  موازی اجرا می شود. موشی می تواند کاربر را در حالی که صحبت می کند بشنود؛ می تواند خود را هنگام قطع کاربر قطع کند؛ می تواند بدون شکستن سخنان اصلی خود به کانال عقب برگرداند.

**The depth transformer.**در یک فریم، 8 کد بوک متوازی پیش بینی نمی شوند. آنها وابستگی های بین کد بوک دارند. یک "ترانسفارمر عمق" دو لایه کوچک آنها را به ترتیب در عرض 80 ms پیش بینی می کند. این فاکتورسازی استاندارد برای LMs کدک AR است (که توسط VALL-E ، VibeVoice نیز استفاده می شود).

### چرا متن یک متن داخلی کمک می کند

بدون متن صریح، مدل باید به طور ضمنی زبان را در جریان صوتی خود مدل کند. بینش موشی: آن را مجبور کنید تا توکن های متن را در کنار صوتی ارسال کند. جریان متن اساساً نقل قول آنچه موشی می گوید است. این باعث بهبود همبستگی معنوی می شود، جایگزینی یک سر مدل زبان را آسان تر می کند و شما را به صورت رایگان نقل قول می کند.

### Hibiki: ترجمه تلفنی به تلفنی

معماری مشابه، آموزش داده شده در جفت ترجمه. صوتی منبع در، صوتی زبان هدف، به طور مداوم. Hibiki-Zero (فروری 2026) نیاز به داده های آموزش هماهنگ در سطح کلمه را از بین می برد.

چهار جفت زبان در ابتدا پشتیبانی می شود؛ می تواند با ≈1000 ساعت به یک زبان جدید سازگار شود.

### دسته وسیع تری از کیوتای (2026)

- **Moshi** گفتگویی دوگانه (اول فرانسوی، انگلیسی با پشتیبانی خوب)
- **Hibiki / Hibiki-Zero** ترجمه همزمان سخنران
- **Kyutai STT** جریان ASR (500 ms یا 2.5 ثانیه به جلو)
- **Kyutai Pocket TTS** 100M-param TTS با CPU اجرا می شود (جنوری 2026)
- **Unmute** خط خط کامل ترکیب این موارد در سرورهای عمومی

درایو در یک GPU L40S: 64 جلسه همزمان در 3× زمان واقعی.

### ساسام CSM  پسر عموی

سیسم CSM (2025) از یک ایده مشابه استفاده می کند  یک ستون فقرات Llama-3 با یک سر کدک میمی. اما CSM یک جهت است (تکست + متن را می گیرد، صحبت را تولید می کند) به جای دوگونی کامل. این بهترین TTS "حاضر صدای" در بازار است؛ کاملاً مشابه توانایی دوگونی کامل Moshi نیست.

### شماره عملکرد 2026

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## آن را بسازید

### مرحله اول: رابط

موشي يه سرور ويب سوکت رو افشا ميکنه که 80 ميلي متر از صداي رمزگاري شده ميمي رو ميگرفته و 80 ميلي متر از صداي رمزگاري شده ميمي رو ميگيره هر دو طرف

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### مرحله دوم: حلقه دوپلیکس کامل

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

هر دو جهت همزمان اجرا می شوند. پیتون asyncio یا آینده Rust حمل و نقل استاندارد هستند.

### مرحله سوم: هدف آموزش (تصوری)

برای هر 80ms frame`t`:

- ورودی: `user_mimi[0..t]`،`moshi_mimi[0..t-1]`،`moshi_text[0..t-1]`
- پیش بینی:`moshi_text[t]`، پس`moshi_mimi[t, codebook_0..7]`

متن قبل از صوتی (مونوگ داخلی) پیش بینی می شود؛ صوتی در درون ترانسفارمر عمق، کد بوک-سلسل پیش بینی می شود.

### مرحله 4: جایی که موشی برنده و جایی که برنده نیست

موشي برنده شد:

- زیر 250 ms از آخر به آخر در سخت افزار ارزان
- کانال های طبیعی و قطعات
- کد چسب لوله اي نداره

موشي برنده نيست:

- ابزار دعوت (برای آن آموزش دیده نیست؛ شما نیاز به یک مسیر LLM جداگانه).
- استدلال طولانی (موشی یک مدل دیالوگ 8B است، نه کلاود/GPT-4).
- دقت واقعی در موضوعات خاص
- بیشتر موارد استفاده در شرکت های تولید (هم اکنون در سال 2026 استفاده از لوله ها است).

## ازش استفاده کن

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## دام ها

- **Limited tool calling.**موشي يه مدل گفتگويي است نه يه چارچوبي که به وسيله ايجاد ميکنه
- **Specific-voice conditioning.**موشی از یک شخصیت آموزش دیده استفاده می کند؛ کلون کردن یک تمرین جداگانه است.
- **Language coverage.**زبان فرانسه + انگلیسی عالی است، دیگران محدود هستند. هیبیکی صفر کمک می کند، اما هنوز به اطلاعات آموزشی نیاز دارید.
- **Resource cost.**یک جلسه کامل موشی دارای یک گرافیک GPU است نه یک الگوی ارزان توزیع مشترک مستاجر.

## -باده

پس از`outputs/skill-duplex-pipeline.md`براي کار اجنتی صداي، با عقل انتخاب کنين.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این دو جریان + معماری درون مونالوگ را نمادیه ای شبیه سازی می کند
2. **Medium.**موشي رو از HuggingFace بکشيد، سرور رو اجرا کنيد، يک مکالمه رو امتحان کنيد.
3. **Hard.**با درس 12، عامل لوله کشی خود را بگیرید و تاخیر P50 را با Moshi در 20 بیان آزمون مشابه مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## خواندن بیشتر

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)روزنامه
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) ترجمه جریان بدون داده های هماهنگ
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) مشخصات CSM
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) نصب + سرور
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) بسته شدن تجارت همتایی
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) چارچوب STT/TTS زیر کوپ
