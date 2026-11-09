# Capstone 03  دستیار صدا در زمان واقعی (ASR تا LLM تا TTS)

> یک عامل صدا که احساس درستی دارد، تاخیر پایان تا پایان کمتر از 800ms دارد، می داند که شما چه زمانی صحبت کردن را متوقف کرده اید، در حال کار با بارج-این است و می تواند بدون توقف به یک ابزار زنگ بزند. ریتل، ڤیپی، آژانس های لایو کیت و پیپکت همه در سال 2026 به این بار رسیدند. آنها با شکل مشابهی انجام می دهند: یک ASR جریان، یک ردیاب نوبت، یک LLM جریان، و یک TTS جریان، همه از طریق WebRTC با بودجه های تاخیر پرخاشگر در هر کود. یکی بسازید، WER و MOS و نرخ قطع اشتباه را اندازه گیری کنید و آن را تحت کاهش بسته اجرا کنید.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## مشکل

صدا سریع ترین دسته UX هوش مصنوعی در سال های 2025-2026 بوده است. سقف فنی هر ربع سقوط می کرد. OpenAI Realtime API، Gemini 2.5 Live، Cartesia Sonic-2، ElevenLabs Flash v3، LiveKit Agents 1.0، و Pipecat 0.0.70 همه زیر 800ms اولین آڈیو را در دسترس قرار دادند. فقط بار تاخير نيست این احساس تعامل است: قطع کردن کاربر، قطع شدن، بهبود از یک قطع در وسط جمله، تماس با یک ابزار در وسط مکالمه بدون متوقف کردن صوتی، زنده ماندن شبکه های موبایل عصبی.

شما نمی توانید با خشت سه تماس REST به آنجا برسید. معماری است که از پایان به آخر جریان است. آن را بسازید و حالت های شکست قابل مشاهده می شوند: یک VAD تنظیم شده برای ضبط صدا تلفن در تلویزیون پس زمینه، یک ردیاب نوبت منتظر نقطه بندی است که هرگز نمی آید، یک TTS که 400ms پیش از انتشار را ببفرید. سنگ نهایی این است که این یکی را در یک زمان تحت بارگذاری تنظیم کنید و گزارش تاخیر و کیفیت را منتشر کنید.

## مفهوم

خط لوله پنج مرحله پخش داره:**audio in**(WebRTC از مرورگر یا PSTN)**ASR**(برقراری پخش نسخه های جزئی از Deepgram Nova-3 یا سریعتر)**turn detection**(VAD به علاوه مدل کوچک ردیاب نوبت که نقل نامه های جزئی را برای نشان دادن تکمیل می خواند)**LLM**(در صورت تکمیل نوبت، توکن ها را پخش می کند)**TTS**(در حدود 200ms از اولین توکن LLM پخش صدا)

سه تا مسئله متقابل**Barge-in**: وقتی کاربر در حالی که مامور صحبت می کند شروع به صحبت می کند، TTS لغو می شود و ASR بلافاصله شروع به صحبت می کند. **Tool use**: تماس های میان زمان مکالمه (طقس، تقویم) باید در یک کانال جانبی بدون توقف صوتی اجرا شوند؛ عامل پیش از پر کردن یک توکن تأیید ("یک ثانیه...") اگر تاخیر بیش از 300ms باشد. **Backpressure**: در حالت از دست دادن بسته، نسخه های جزئی نگه داشته می شوند، VAD حد عبور از سخنرانی را افزایش می دهد و مامور از صحبت کردن در مورد یک پیام ناشناخته اجتناب می کند.

بار اندازه گیری کمی است. WER زیر 8% در مرجع مرجع Hamming VAD در 15 dB SNR. اولین صدا خارج p50 زیر 800ms در 100 تماس اندازه گیری شده. نرخ قطع غلط زیر 3٪. MOS بالاتر از 4.2 در TTS. 50 تماس همزمان در یک g5.xlarge. این اعداد تحویل پذیر هستند.

## معماری

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## دسته

- حمل و نقل: LiveKit Agents 1.0 (WebRTC) + Twilio PSTN دروازه؛ Pipecat 0.0.70 به عنوان چارچوب جایگزین
- ASR: Deepgram Nova-3 (ستریم، زیر 300ms اولین بخش) یا سریعتر همس Whisper-v3-turbo خود میزبان
- VAD: Silero VAD v5 به علاوه دستگاه تشخیص نوبت LiveKit (ترانسفارمر کوچک که نسخه های جزئی را می خواند)
- LLM: OpenAI GPT-4o-realtime برای ادغام دقیق، Gemini 2.5 Flash Live، یا Claude Haiku 4.5 (تکمال جریان، مسیر صوتی جداگانه)
- TTS: کارتزیا سونک-2 (کمترین بایت اول) ، ElevenLabs Flash v3 ، یا Orpheus منبع باز برای میزبان خود
- ابزار: کانال جانبی FastMCP برای آب و هوا / تقویم / رزرو؛ پرکننده ای که توسط عامل قبل از انتشار می شود اگر ابزار بیش از 300ms طول بکشد
- قابل مشاهده: OpenTelemetry، ردیابی صدا Langfuse با پخش مجدد صوتی
- استفاده: g5.xlarge (24GB VRAM) برای خود میزبان Whisper + Orpheus؛ API های میزبان برای کمترین تاخیر

```figure
ce-voice-latency
```

## آن را بسازید

1. **WebRTC session.**یک اتاق LiveKit و یک مشتری وب را که صداهای میکروفون را پخش می کند، در سرور، یک عامل عامل را متصل کنید که به اتاق می پیوندد.

2. **ASR streaming.**فریم های 20ms PCM را به Deepgram Nova-3 (یا سریعتر در GPU) ارسال کنید. برای نقل و نقل جزئی و نهایی اشتراک بگذارید.

3. **VAD and turn detector.**Silero VAD v5 را در جریان فریم اجرا کنید. در رویداد پایان سخنرانی، ردیاب نوبت LiveKit را در برابر آخرین نسخه جزئی اجرا کنید. تنها زمانی که VAD صدا خاموشی برای 500ms را بگوید و ردیاب نوبت امتیاز تکمیل > 0.6 را انجام دهد، "تولید کامل" را انجام دهید.

4. **LLM stream.**در نوبت کامل، تماس LLM با مکالمه اجرا و نقل نهایی شروع شود. توکن ها را پخش کنید. در اولین توکن، به TTS تحویل دهید.

5. **TTS stream.**کارتزیا سونیک ۲ قطعات صوتی را به سمت خود پخش می کند. اولین قطعه باید در عرض 200ms از اولین توکن LLM از سرور خارج شود. قطعات را به اتاق LiveKit ارسال کنید؛ مشتری از طریق بازخورد WebRTC jitter پخش می کند.

6. **Barge-in.**وقتی VAD صدای کاربر جدید را در حالی که TTS پخش می شود تشخیص می دهد، جریان TTS را بلافاصله لغو کنید، تولید LLM باقیمانده را رها کنید و ASR را دوباره مسلح کنید.`tts_canceled`. اسپان

7. **Tool side channel.**آب و هوا و تقویم را به عنوان ابزار تماس عملکرد ثبت کنید. هنگامی که به آن دعوت می شود، تماس را همزمان روشن کنید؛ اگر در عرض 300ms حل نشود، LLM را به عنوان یک پرکننده "یک ثانیه، اجازه دهید بررسی کنم" ارسال کنید؛ پس از بازگشت ابزار، ادامه دهید.

8. **Eval harness.**ثبت 100 تماس: محاسبه WER (در برابر یک نسخه بازداشت شده) ، نرخ قطع اشتباه (TTS در حالی که کاربر در وسط جمله بود لغو شده است) ، اولین صدا خارج p50, TTS MOS (انسانی یا NISQA) و یک تست jitter-loss (سقط 3% بسته ها).

9. **Load test.**50 تماس همزمان را با یک G5.xlarge با یک تماس دهنده مصنوعی اجرا کنید.

## ازش استفاده کن

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## -باده

`outputs/skill-voice-agent.md`در حال حاضر، این برنامه یک عامل LiveKit را با خط لوله ASR/VAD/LLM/TTS به بار اندازه گیری تنظیم می کند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## تمرینات

1. در G5.xlarge، Deepgram Nova-3 را با توربو v3 سریع تر به جا بگذارید. فاصله تاخیر و WER را اندازه گیری کنید. مشخص کنید که تصمیمات CPU در مقابل GPU در چه زمینه ای مهم است.

2. یک سیاست قطع-تحریک اضافه کنید: وقتی کاربر در طول تماس ابزار وارد می شود، نماینده چه می کند؟ سه سیاست را مقایسه کنید (حذف سخت، پایان ابزار سپس توقف، صف بعدی).

3. یک آزمایش ضد گیرنده باری را اجرا کنید: به کاربر توقف های طولانی در وسط جمله بدهید. حد خاموشی VAD و حد امتیاز گیرنده باری را برای پایین ترین قطع اشتباه بدون گذشت بیش از 900ms تنظیم کنید.

4. همان عامل را در PSTN از طریق Twilio استفاده کنید. اولین صدا PSTN را با WebRTC مقایسه کنید. تفاوت های جیتر-بوفر و کودک را توضیح دهید.

5. تشخیص فعالیت صوتی برای زبان های غیر انگلیسی (جاپانی، اسپانیایی) را اضافه کنید. نرخ غلط تگگ Silero VAD v5 را در مقابل تنظیمات دقیق خاص زبان اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## خواندن بیشتر

- [LiveKit Agents 1.0](https://github.com/livekit/agents) چارچوب عامل WebRTC مرجع
- [Pipecat](https://github.com/pipecat-ai/pipecat) چارچوب عامل پخش اول پایتون جایگزین
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) مرجع برای مدل های مدغام گفتار
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) انتقال مرجع ASR
- [Silero VAD v5](https://github.com/snakers4/silero-vad) مدل مرجع VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) مرجع TTS کم تاخیر
- [Retell AI architecture](https://docs.retellai.com) معماری عامل صدا تولید
- [Vapi.ai production stack](https://docs.vapi.ai) مرجع تولید جایگزین
