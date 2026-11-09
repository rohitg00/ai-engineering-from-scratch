# التدفقات التدريبية من الكلام إلى الكلام  موشي، هيبيكي، وحوار مزدوج كامل

> 2024-2026 تعيد تعريف الذكاء الاصطناعي الصوتي. موشي يرسل نموذج واحد يستمع ويكلّم في وقت واحد عند تأخر 200 م. تقوم هيبيكي بترجمة الخطاب إلى الخطاب قطعة بعد قطعة. كلاً يتخلّى عن خط الأنابيب ASR → LLM → TTS من أجل بنية متوحدة كاملة مزدوجة على رموز ميمي. هذا هو التصميم المرجعي الجديد.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## المشكلة

كل وكيل صوتي بني من الدروس 11 + 12 لديه أساسي سطح تأخر حوالي 300-500 ms: إطلاق VAD، عمليات STT، LLM أسباب، TTS تولد. كل مرحلة لديها حد أدنى تأخر خاص بها. يمكنك ضبط وتوازي، ولكن شكل خط الأنابيب يغطيك.

يسأل موشي (كيوتاي، 2024-2026) سؤالًا مختلفًا: ماذا لو لم يكن هناك خط أنابيب؟ ماذا لو كان نموذجًا واحدًا يأخذ الصوت ويصدر الصوت مباشرةً، بشكل مستمر، مع النص كـ "مونوغور داخلي" متوسط بدلاً من مرحلة مطلوبة؟

الإجابة هي**full-duplex speech-to-speech**. التأخير النظري 160 ms (80 ms Mimi frame + 80 ms تأخير صوتي) التأخير العملي 200 ms على GPU واحد L4 . هذا هو نصف ما يحقق أفضل في الفئة وكيل الصوت المباشر.

## المفهوم

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### معمارة موشي

**Inputs.**اثنين من ميكي ميكي، كلاهما عند 12.5 هرتز × 8 كودكوب:

- التيار 1: صوت المستخدم (ممشفّر من الـ "ميمي"، يصل باستمرار)
- التيار 2: صوت موشي الخاص (مولد من موشي)

**The transformer.**معدل 7B-المتحول الزمني يعالج كل من التدفقات وتدفق نص "المونوغ الداخلي". في كل خطوة 80 ms، فإنه:

1. يستهلك أحدث رموز Mimi للمستخدم (8 كتب رمزية).
2. يستهلك أحدث رموز موشي ميمي (8 كتب رمزية، كما تم إنتاجها).
3. يخلق رمز النص الموسي التالي (الوحيد الداخلي).
4. يولد رموز موشي ميمي التالية (8 كتب رمزية عبر محول عمق صغير).

جميع التيارات الثلاثة  صوت المستخدم، صوت موشي، نص موشي  تعمل بالتوازي. يمكن لموسي سماع المستخدم أثناء التحدث؛ يمكن للمستخدم أن يقطع نفسه عندما يقاطع؛ يمكن للقناة الخلفية ("mhm") دون كسر التعبير الرئيسي.

**The depth transformer.**في إطار ، لا يتم التنبؤ بأكواد الكود الثمانية بالتوازي  لديهم اعتمادات بين الكود الكود. "تحول عمق" صغير ذو 2 طبقات يتنبأ بهم تسلسليًا في غضون 80 ms. هذا هو التصوير القياسي لـ LMs كوديك AR (يستخدم أيضًا من قبل VALL-E ، VibeVoice).

### لماذا نص من المونولوج الداخلي يساعد

بدون نص صريح، يجب على النموذج أن يضع نموذج لغة ضمنياً في تيارها الصوتي. نظرة موشي: إجبارها على إصدار رموز نصية جنباً إلى جنب مع الصوت. يعد تيار النص في الأساس نسخة لما يقوله موشي. وهذا يحسن التماسك التمويلي، ويسهل استبدال رأس نموذج لغة، ويقدم لك نسخة مجاناً.

### Hibiki: ترجمة حديثة إلى حديثة

نفس الهندسة المعمارية ، تدرب على أزواج الترجمة. الصوت المصدر داخل ، الصوت خارج اللغة المستهدفة ، باستمرار. يزيل Hibiki-Zero (فبراير 2026) الحاجة إلى بيانات التدريب المتماشىة على مستوى الكلمة  يستخدم بيانات على مستوى الجمل + تعلم تعزيز GRPO لتحسين التخفيف.

أربعة أزواج اللغات مدعومة في البداية؛ يمكن تكييفها إلى لغة جديدة مع ≈1000 ساعة.

### كومة كيوتاي الأوسع (2026)

- **Moshi** حوار كامل مزدوج (الفرنسية أولاً، الإنجليزية مدعومة جيداً)
- **Hibiki / Hibiki-Zero** ترجمة متزامنة للخطاب
- **Kyutai STT** التدفق ASR (500 ms أو 2.5 ثانية في النظر إلى الأمام)
- **Kyutai Pocket TTS** 100M-param TTS يعمل على CPU (كانون الثاني 2026)
- **Unmute** خط أنابيب كامل يجمع بين هذه على الخوادم العامة

التشغيل على GPU L40S: 64 جلسة متزايدة في 3× في الوقت الحقيقي.

### السيسام CSM  ابن عم

تستخدم Sesame CSM (2025) فكرة مماثلة  العمود الفقري Llama-3 مع رأس ميمي. ولكن CSM هو واحد الاتجاه (يتخذ السياق + النص ، تنتج الكلام) بدلاً من الكامل. إنها أفضل "حضور الصوت" TTS في السوق ؛ ليس تماماً كما قدرة Moshi الكاملة.

### أرقام الأداء 2026

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

## بناءها

### الخطوة الأولى: الواجهة

موشي يكتشف خادم ويب سوكت الذي يأخذ 80 ميس من الصوت المشفر من ميمي ويعيد 80 ميس من الصوت المشفر من ميمي

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

### الخطوة الثانية: حلقة كاملة

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

كلا الاتجاهين يعملان في وقت واحد. Python asyncio أو Rust futures هي النقل القياسي.

### الخطوة الثالثة: هدف التدريب (المفهوم)

لكل إطار 80 ميس`t`:

- المدخل: `user_mimi[0..t]`،`moshi_mimi[0..t-1]`،`moshi_text[0..t-1]`
- التنبؤ:`moshi_text[t]`، ثم`moshi_mimi[t, codebook_0..7]`

يتم التنبؤ بالنص قبل الصوت (الموتي الداخلي) ؛ يتم التنبؤ بالصوت في تسلسل كتاب التعليمات داخل محول العمق.

### الخطوة الرابعة: أين يفوز موشي وأين لا

موسشي) يفوز)

- تحت 250 ميس من نهاية إلى نهاية على الأجهزة الرخيصة.
- قنوات عادية و انقطاعات طبيعية
- لا يوجد رمز لصق الأنابيب

موشي لا يفوز:

- دعوة الأدوات (ليس مدربًا لذلك ، تحتاج إلى مسار LLM منفصل).
- التفكير الطويل (موشي هو نموذج حوار 8B ، وليس كلود / GPT-4).
- دقة حقيقية في مواضيع خاصة
- معظم حالات الاستخدام في المؤسسات الإنتاجية (ما زالت تستخدم خطوط الأنابيب في عام 2026).

## استخدمها

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## الفخاخ

- **Limited tool calling.**موشي هو نموذج حوار، وليس إطار عميل.
- **Specific-voice conditioning.**المشي يستخدم شخصية واحدة مدربة؛ التنسيق هو تدريب منفصل.
- **Language coverage.**الفرنسية + الإنجليزية ممتازة، والبعض الآخر محدود. يُساعدك Hibiki-Zero، ولكنك لا تزال بحاجة إلى بيانات التدريب.
- **Resource cost.**جلسة موشي كاملة تحتوي على فتحة GPU؛ وليس نمط تنفيذ مشارك شائع رخيص.

## أرسله

إبقوا`outputs/skill-duplex-pipeline.md`اختر خط الأنابيب مقابل بنية كاملة للعملية وكيل الصوت، مع سبب.

## التمارين

1. **Easy.**أركض`code/main.py`إنه يحاكي بنية التيارين + الهندسة الداخلية بشكل رمزي
2. **Medium.**سحب موشي من HuggingFace، تشغيل الخادم، اختبار محادثة واحدة، قياس تأخير الساعة الحائطية من نهاية المستخدم إلى بداية موشي-رد
3. **Hard.**خذ وكيل خط الأنابيب الخاص بك درسا 12 ومقارنة تأخر P50 مقابل موشي على 20 بيانات اختبار متطابقة. اكتب عندما نيل خط الأنابيب معماريا على أي حال.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## المزيد من القراءة

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)-الورقة
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) تحويلات مجرى بدون بيانات متوافقة
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) تحديدات CSM
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) إثباط + خادم.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) أقر التجارة المغلقة
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) إطار STT/TTS تحت الغطاء.
