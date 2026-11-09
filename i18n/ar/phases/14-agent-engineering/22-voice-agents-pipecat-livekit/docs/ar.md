# وكلاء صوت: بيبيكات و LiveKit

> وكلاء الصوت هي فئة إنتاج من الدرجة الأولى في عام 2026. يقدم لك Pipecat خط أنابيب قائم على إطار Python (VAD → STT → LLM → TTS → النقل). LiveKit Agents يربط نماذج AI للمستخدمين عبر WebRTC. تهدف تأخر الإنتاج إلى 450600ms من نهاية إلى نهاية للمراكز البارزة.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## أهداف التعلم

- وصف خط أنابيب Pipecat القائم على الإطار: DOWNSTREAM (المصدر→الغموض) و UPSTREAM (التحكم).
- أسمائ مراحل خط الأنابيب الصوتية القنونية والتي تنقل دعم بيبيكات.
- شرح فصول وكلاء صوتي لـ LiveKit Agents (MultimodalAgent و VoicePipelineAgent) ومتى تناسب كل منهما.
- تلخيص توقعات تأخر الإنتاج عام 2026 وكيفية قيادة اختيارات الهندسة المعمارية.

## المشكلة

وكلاء الصوت ليسوا حلقة نصية مع TTS مدفوعة. ميزانيات التأخير وحشية (~ 600ms) ، الصوت الجزئي هو الافتراض، واكتشاف التحول هو نموذج، والنقل تتراوح من الهاتف SIP إلى WebRTC. إما أن تبني خط أنابيب القائم على الإطار (Pipecat) أو تعتمد على منصة (LiveKit).

## المفهوم

### البيت (بيتكيت-اي/بيتكيت)

- إطار خط أنابيب على أساس إطار Python.
- `Frame``FrameProcessor`السلسلة
- اتجاهين للتدفق:
  - **DOWNSTREAM** مصدر → حوض (صوت داخل، TTS خارج).
  - **UPSTREAM** ردود الفعل والتحكم (إلغاء، المقاييس، إدخال المياه).
- `PipelineTask`يدير دورة الحياة مع الأحداث (`on_pipeline_started`،`on_pipeline_finished`،`on_idle_timeout`) ومراقبين للمقاييس/التتبع/RTVI.

خط الأنابيب النموذجي:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

النقل: يومي، LiveKit، SmallWebRTCTransport، FastAPI WebSocket، WhatsApp.

تشتمل Pipecat Flow على محادثات مهيكلة (آلات الحالة).

### وكلاء ليف كيت (livekit/agents)

- يُجبر نماذج الذكاء الاصطناعي على المستخدمين عبر شبكة الويب.
- المفاهيم الرئيسية:`Agent`،`AgentSession`،`entrypoint`،`AgentServer`. . .
- فصول عامل صوتيّين:
  - **MultimodalAgent** صوت مباشر عبر OpenAI في الوقت الحقيقي أو ما يعادله.
  - **VoicePipelineAgent** STT → LLM → TTS سلسلة؛ يعطي التحكم على مستوى النص.
- الكشف عن التحولات المفصلة عبر نموذج المحول
- التكامل المحلي في MCP
- الهاتف عبر SIP.
- 50+ نموذج بدون مفاتيح API عبر LiveKit Inference؛ 200+ أكثر عبر المكونات التضخمية.

### المنصات التجارية

يُبني Vapi (~ 450600ms على كومة مكافأة مكافأة محسنة) و Retell (~ 600ms من نهاية إلى نهاية عبر 180 مكالمة اختبارية) على أعلى هذه. اختر منصة عندما تريد كومة صوتية مديرة دون فريق WebRTC.

### حيث يذهب هذا النمط خطأ

- **No barge-in handling.**المستخدم يقاطع، وكيل يستمر في الحديث. يطلب UPSTREAM إلغاء الإطارات في Pipecat، المكافئ في LiveKit.
- **STT confidence ignored.**نسخة منخفضة الثقة تُقدّم إلى ماجستير العلوم كإنجيل
- **TTS mid-sentence cutoff.**عندما يقوم خط الأنابيب بإلغاء الصوت في منتصف الصوت، يجب على TTS أن يعرف أو يقطع الصوت.
- **Latency budget ignored.**كل مكون يضيف 50200ms. جمع سلسلة قبل الشحن.

### التأخيرات النموذجية لعام 2026

- VAD: 2060ms
- المدة القصوى: 100250ms
- الـ "إلـم" الـ "أول رمز": 150400ms
- صوت TTS الأول: 100200ms
- RTT النقل: 3080ms

نهاية إلى نهاية 450600ms هي المكلفة المتميزة. 8001200ms هو شائع. أي شيء > 1500ms يشعر وكأنه مكسور.

```figure
voice-pipeline
```

## بناءها

`code/main.py`هو خط أنابيب لعبة على أساس الإطار مع:

- `Frame`النماذج (الصوت، النص، النص، tts_audio، التحكم).
- `Processor`التواصل مع `process(frame)`. . .
- خط أنابيب من خمس مراحل (VAD → STT → LLM → TTS → النقل) كمعالجات مكتوبة.
- إطار إلغاء UPSTREAM لإظهار القصف

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

يظهر البصمة التدفق الطبيعي و إغلاق المباراة التي توقف TTS في منتصف التعبير

## استخدمها

- **Pipecat**للسيطرة الكاملة  المعالجات المخصصة، Python-first، مزودي القابل للدخول.
- **LiveKit Agents**لتنفيذ خدمات الويب آر تي سي أولاً والاتصال الهاتفي.
- **Vapi / Retell**للوكلاء الصوتيين المضيفين بدون فريق WebRTC.
- **OpenAI Realtime / Gemini Live**للصوت المباشر في / خارج الصوت (متعدد الوسائل).

## أرسله

`outputs/skill-voice-pipeline.md`يستخدم جهاز الصوت على شكل بيبيكات مع VAD + STT + LLM + TTS + النقل بالإضافة إلى التعامل مع القارب.

## التمارين

1. إضافة مراقب قياسات إلى خط ألعابك: عد الإطارات لكل مرحلة في الثانية. أين تتراكم التأخير؟
2. تنفيذ إطار التدريبات المختلفة: تحت العد، طلب "هل يمكنك تكرار ذلك؟"
3. إضافة اكتشاف التحولات النطاقية: قاعدة بسيطة  إذا انتهى النص مع "؟" نهاية التحول.
4. قراءة وثائق نقل Pipecat. تبادل النقل stdlib لتنظيم SmallWebRTCTransport (stub).
5. قياس سلسلة OpenAI في الوقت الحقيقي مقابل STT+LLM+TTS على نفس الاستفسار. ما هي تكلفة التخفيف التي تحملها التحكم على مستوى النص؟

## الشروط الرئيسية

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

## المزيد من القراءة

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) خطوط الأنابيب القائمة على الإطار، المعالجات، النقل
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + صوتي بدائي
- [Vapi](https://vapi.ai/) منصة صوتية مُدارة
- [Retell AI](https://www.retellai.com/) صوت مدير، مؤشر تأخير
