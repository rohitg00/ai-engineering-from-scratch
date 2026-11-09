# نمایندگان صدا: پیپکت و LiveKit

> اجنتی های صوتی یک دسته تولید درجه اول در سال 2026 هستند. پیپکت به شما یک خط لوله مبتنی بر فریم پایتون (VAD → STT → LLM → TTS → حمل و نقل) می دهد. LiveKit Agents مدل های AI را به کاربران از طریق WebRTC متصل می کند. اهداف تاخیر تولید در 450600ms از انتهای تا انتهای برای استیک های برتر.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## اهداف یادگیری

- خط لوله مبتنی بر فریم Pipecat را توصیف کنید: DOWNSTREAM ( منبع→سنگ) و UPSTREAM (کنترول).
- مراحل خط لوله صداهای کانونیک و که پشتیبانی های پیپکت را حمل می کند را نام دهید.
- دو کلاس عامل صدا (MultimodalAgent، VoicePipelineAgent) و زمانی که هر یک از آنها مناسب است را توضیح دهید.
- انتظارات تاخیر تولید 2026 را خلاصه کنید و چگونگی هدایت انتخاب معماری را.

## مشکل

اجنتی های صوتی یک حلقه متن با TTS متصل نیستند. بودجه های تاخیر خشن (~ 600ms) هستند، صوتی جزئی پیش فرض است، تشخیص نوبت یک مدل است و حمل و نقل از SIP تلفن به WebRTC می باشد. یا شما یک خط لوله مبتنی بر فریم (Pipecat) ایجاد می کنید یا شما بر روی یک پلت فرم (LiveKit) تکیه می کنید.

## مفهوم

### پیپکت (pipecat-ai/pipecat)

- چارچوب لوله مبتنی بر چارچوب پایتون
- `Frame`→ `FrameProcessor`زنجیر
- دو جهت جریان:
  - **DOWNSTREAM** منبع → مخزن (آدیو وارد، TTS خارج)
  - **UPSTREAM** بازخورد و کنترل (لغو، متریک، بارج-این).
- `PipelineTask`چرخه زندگی را با رویدادها مدیریت می کند (`on_pipeline_started`،`on_pipeline_finished`،`on_idle_timeout`) و ناظرین برای متریک/تراسکینگ/RTVI.

خط لوله های معمولی:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

حمل و نقل: روزانه، LiveKit، SmallWebRTCTransport، FastAPI WebSocket، واتس اپ.

جریان های پیپکت مکالمات ساختاری (آلهای حالت) را اضافه می کند. Pipecat Cloud زمان اجرا مدیریت شده است.

### LiveKit (livekit/agents)

- مدل های هوش مصنوعی را از طریق WebRTC به کاربران متصل می کند.
- مفاهیم اصلی: `Agent`،`AgentSession`،`entrypoint`،`AgentServer`. .
- دو کلاس مامور صداي:
  - **MultimodalAgent** صدا مستقیم از طریق OpenAI Realtime یا معادل.
  - **VoicePipelineAgent** STT → LLM → TTS کاسکات؛ کنترل سطح متن را می دهد.
- تشخیص چرخش معنوی از طریق یک مدل ترانسفورماتور
- ادغام MCP بومی
- تلفن از طریق SIP
- 50+ مدل بدون کلید API از طریق LiveKit Inference؛ 200+ مدل بیشتر از طریق افزونه ها.

### پلتفرم های تجاری

Vapi (~ 450600ms در یک استیک برتر بهینه شده) و Retell (~ 600ms از انتهای تا انتهای در 180 تماس آزمون) بر روی این استک ها ساخته شده است. زمانی که شما می خواهید یک استیک صدا مدیریت شده بدون یک تیم WebRTC انتخاب کنید.

### جایی که این الگوی اشتباه می شود

- **No barge-in handling.**کاربر قطع می کند، مامور صحبت می کند. درخواست UPSTREAM را در Pipecat، معادل در LiveKit لغو کنید.
- **STT confidence ignored.**نقل نامه هاي کم اعتماد به نفس به عنوان يه انجیل به ماجرا تحصيلي منتقل مي شوند
- **TTS mid-sentence cutoff.**وقتی لوله در وسط خروجی لوله ها را لغو می کند، TTS باید صدای را بشنود یا قطع کند.
- **Latency budget ignored.**هر قطعه 50200ms اضافه می کنه.

### تاخیر های معمول 2026

- VAD: 2060ms
- STT جزئي: 100250ms
- اولین توکن LLM: 150400ms
- صدا اول TTS: 100200ms
- RTT حمل و نقل: 3080ms

450600ms از انت به انت است پرایمی 8001200ms رایج است هر چیزی که بیشتر از 1500ms احساس شکسته است.

```figure
voice-pipeline
```

## آن را بسازید

`code/main.py`یک لوله بازی مبتنی بر قاب با:

- `Frame`انواع (آدیو، نقل، متن، tts_audio، کنترل).
- `Processor`رابط با `process(frame)`. .
- یک خط لوله پنج مرحله ای (VAD → STT → LLM → TTS → حمل و نقل) به عنوان پردازنده های اسکریپت.
- يه قاب لغو UPSTREAM براي نشان دادن بارجين

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

رد نشان ميده که جریان طبيعي و يک بارج-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در-در

## ازش استفاده کن

- **Pipecat**برای کنترل کامل  پردازنده های سفارشی، Python-first، ارائه دهندگان قابل وصل.
- **LiveKit Agents**برای اولین بار در WebRTC و تلفن
- **Vapi / Retell**برای ماموران صدا میزبان بدون تیم WebRTC.
- **OpenAI Realtime / Gemini Live**برای آدیو مستقیم وارد/خارج (MultimodalAgent).

## -باده

`outputs/skill-voice-pipeline.md`یک خط خط صدا به شکل Pipecat با VAD + STT + LLM + TTS + حمل و نقل و همراه با کاربری بارج-in.

## تمرینات

1. یک متریک مشاهده کننده را به لوله بازی خود اضافه کنید: فریم ها را در هر مرحله در ثانیه شمارش کنید.
2. اجرای STT با گیت اطمینان: زیر حد، درخواست "می توانید این را تکرار کنید؟"
3. اضافه کردن تشخیص نوبت معنوی: قاعده ساده  اگر نقل با "؟" پایان نوبت پایان می یابد.
4. اسناد حمل و نقل پیپکت را بخوانید. انتقال stdlib را به پیکربندی SmallWebRTCTransport (stub) تغییر دهید.
5. اندازه گیری یک سری OpenAI Realtime vs STT+LLM+TTS در همان جستجو. هزینه تاخیر کنترل سطح متن چه هزینه ای دارد؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Frame | "Event" | Typed unit of data in the pipeline (audio, transcript, text, control) |
| Processor | "Pipeline stage" | Handler with process(frame) |
| DOWNSTREAM | "Forward flow" | Source to sink: audio in, speech out |
| UPSTREAM | "Feedback flow" | Control: cancel, metrics, barge-in |
| VAD | "Voice activity detection" | Detects when user is speaking |
| Semantic turn detection | "Smart end-of-turn" | Model-based decision that the user is done |
| MultimodalAgent | "Direct audio agent" | Audio in, audio out; no text in the middle |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS; text-level control |

## خواندن بیشتر

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) لوله های مبتنی بر فریم، پردازنده ها، حمل و نقل
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + صداهای اولیه
- [Vapi](https://vapi.ai/) سیستم عامل مدیریت شده صدا
- [Retell AI](https://www.retellai.com/) مدیریت صدا، بنچ مارک تاخیر
