# كابستون 03  مساعد صوتي في الوقت الحقيقي (ASR إلى LLM إلى TTS)

> وكيل صوتي يشعر أنه على ما يرام لديه تأخير آخر إلى آخر أقل من 800ms، يعرف متى توقفت عن التحدث، يتعامل مع المباراة، ويمكن أن تدعو أداة دون تأخير. (ريتيل) و (فابي) و (لايف كيت) و (بيبيكات) جميعهم يصلون إلى هذا الشارع في عام 2026. يقومون بذلك بنفس الشكل: ASR التدفق، كاشف التحول، LLM التدفق، و TTS التدفق، كل شيء متصل عبر WebRTC مع ميزانيات تأخر عدوانية في كل قفزة. قم ببناء واحد، وقاس WER و MOS ومعدل التوقف الكاذب، و قم بتشغيله تحت خسارة الحزم.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## المشكلة

صوت كان أسرع فئة AI UX تتحرك من 2025-2026. السقف التقني انخفض كل ربع OpenAI Realtime API، Gemini 2.5 Live، Cartesia Sonic-2، ElevenLabs Flash v3، LiveKit Agents 1.0، وPipecat 0.0.70 كل وضعت تحت 800ms أول صوت خارج الوصول. الحانة ليست تأخير وحدها. إنها إحساس التفاعل: عدم قطع المستخدم، عدم قطع نفسه، التعافي من تعطل منتصف الجملة، استدعاء أداة في منتصف المحادثة دون تعليق الصوت، البقاء على قيد الحياة شبكات الهاتف المحمول المزعجة.

لا يمكنك الوصول إلى هناك عن طريق خياطة ثلاث مكالمات REST. يتم تشكيل الهندسة المعمارية على سلسلة من نهاية إلى نهاية. قم ببناءها وتصبح أوضاع الفشل مرئية: VAD المنسقة لإطلاق صوت الهاتف على شاشة التلفزيون الخلفية ، ومتعلم التحول ينتظر التقاطع الذي لا يأتي أبدًا ، و TTS الذي يضغط 400ms قبل الإصدار. الحجر النهائي هو إصلاح هذه في وقت واحد تحت الحمل ونشر تقرير تأخر والجودة.

## المفهوم

خط الأنابيب يحتوي على خمس مراحل:**audio in**(WebRTC من المتصفح أو PSTN) ،**ASR**(تدفق النسخة الجزئية من Deepgram Nova-3 أو أسرع-مفتشة) ،**turn detection**(الـ VAD بالإضافة إلى نموذج صغير لمتعلم التحول الذي يقرأ النصوص الجزئية لمشارات الانتهاء)**LLM**(تدوين الرموز العلامية بمجرد أن يتم اعتبار الدورة قد اكتملت) ،**TTS**(تذاكر الصوت في غضون ~ 200ms من أول رمز LLM).

ثلاثة مخاوف متقاطعة**Barge-in**: عندما يبدأ المستخدم في الكلام بينما يتحدث الوكيل، يقوم TTS بإلغاء ويتم استرداد ASR على الفور. **Tool use**: يجب أن تعمل مكالمات وظيفة المحادثة المتوسطة (الطقس، التقويم) على قناة جانبية دون تعليق الصوت. يقوم الوكيل بتشغيل رمز التأكيد مسبقاً ("ثانية واحدة...") إذا تجاوز التأخير 300ms. **Backpressure**: تحت فقدان الحزمة، يتم احتفاظ بنسخ جزئية، ورفع VAD عتبة البوابة الكلامية، ويتجنب الوكيل التحدث عن رسالة غير معترف بها.

شريط القياس كميئي. WER أقل من 8% على مقياس هامينغ VAD عند 15 dB SNR. أول صوت خارج p50 تحت 800ms على 100 مكالمة مقياسة. معدل التوقف الكاذب تحت 3٪. MOS أعلى من 4.2 على TTS. 50 مكالمة متزايدة على g5.xlarge واحد. هذه الأرقام هي المنتجة.

## الهندسة المعمارية

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

## الـ"كثيرة"

- النقل: LiveKit Agents 1.0 (WebRTC) بالإضافة إلى بوابة Twilio PSTN ؛ Pipecat 0.0.70 كإطار بديل
- ASR: Deepgram Nova-3 (التدفق ، تحت 300ms الجزئية الأولى) أو أسرع-تهمس Whisper-v3-turbo مضيفة ذاتية
- VAD: Silero VAD v5 بالإضافة إلى جهاز كشف التحول LiveKit (المحول الصغير الذي يقرأ النصوص الجزئية)
- ماجستير في العلوم: OpenAI GPT-4o-realtime للتكامل الضيق، Gemini 2.5 Flash Live، أو Claude Haiku 4.5 (تكتملات البث، مسار صوتي منفصل)
- TTS: Cartesia Sonic-2 (أقل بايت أول) ، ElevenLabs Flash v3 ، أو Open-source Orpheus للمضيف الذاتي
- الأدوات: قناة جانبية FastMCP للأرصاد الجوية / التقويم / الحجز ؛ وكيل إصدار الملفات المسبقة إذا استغرق الأدوات > 300ms
- قابلية الملاحظة: OpenTelemetry امتدادات الصوت، أثرات الصوت لاندفوز مع إعادة تشغيل الصوت
- النشر: g5.xlarge واحد (24GB VRAM) لـ Whisper + Orpheus المضيفة الذاتية ؛ APIs المضيفة لأدنى تأخر

```figure
ce-voice-latency
```

## بناءها

1. **WebRTC session.**قم بتصميم غرفة ليف كيت و عميل ويب يُبث صوت الميكروفون على الخادم، وربط عامل عميل يضم الغرفة.

2. **ASR streaming.**إرسال إطارات PCM 20ms إلى Deepgram Nova-3 (أو أسرع-سوس على GPU). الاشتراك في النسخ الجزئية والنهائية. تسجيل التأخير الجزئي.

3. **VAD and turn detector.**تشغيل Silero VAD v5 على تدفق الإطار. في حدث نهاية الكلام، اطلق جهاز كشف التحول LiveKit ضد آخر نسخة جزئية. فقط التزام "التحول إلى كامل" عندما يقول VAD صمت لمدة 500ms والجواب كشف التحول > 0.6.

4. **LLM stream.**عند الانتهاء من المكالمة، ابدأ مكالمة الجامعة مع المحادثة الجارية بالإضافة إلى النص النهائي، إرسال الرموز.

5. **TTS stream.**كارتيزيا سونيك-2 تدفق قطع الصوت مرة أخرى. يجب أن يغادر الجزء الأول الخادم في غضون 200ms من أول رمز LLM. إرسال قطع إلى غرفة LiveKit؛ العميل يلعب من خلال WebRTC مضخة الارتباك.

6. **Barge-in.**عندما يكتشف VAD حديث المستخدم الجديد أثناء تشغيل TTS ، قم بإلغاء تدفق TTS على الفور ، ووقف الناتج المتبقي لـ LLM ، وإعادة تشغيل ASR. نشر `tts_canceled`-إستمرار

7. **Tool side channel.**سجل الطقس والجدول التقليدي كأدوات الدعوة إلى الوظيفة. عند استدعاءها ، اطلق الدعوة في وقت واحد ؛ إذا لم يتم حلها في غضون 300ms ، فلتقوم الجامعة بتصدير "ثانية واحدة ، دعيني أتحقق" كملء ؛ استئناف بمجرد عودة الأداة.

8. **Eval harness.**تسجيل 100 مكالمة: حساب WER (ضد نسخة متأخرة) ، معدل التوقف الكاذب (تم إلغاء TTS بينما كان المستخدم في منتصف الجملة) ، أول صوت خارج p50 ، TTS MOS (بشرية أو NISQA) ، واختبار الخسارة القلق (سقطة 3% من الحزم).

9. **Load test.**قم بتشغيل 50 مكالمة متزايدة على جهاز g5.xlarge واحد مع مكالمة اصطناعية.

## استخدمها

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

## أرسله

`outputs/skill-voice-agent.md`هو المنتج. بالنظر إلى نطاق (دعم العملاء أو الجدول أو المفتاح) ، فإنه يُقيم وكيل LiveKit مع خط أنابيب ASR/VAD/LLM/TTS المنسق إلى شريط القياس.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## التمارين

1. تغيير Deepgram Nova-3 لتبادل أسرع التهمس v3 على g5.xlarge. قياس التأخير و WER الفجوة. تحديد حيث قرارات CPU مقابل GPU مهمة.

2. إضافة سياسة التقاطع-التحكيم: ما الذي يقوم به الوكيل عندما يقتحم المستخدم أثناء مكالمة الأداة؟ مقارنة ثلاثة سياسات (إلغاء صلب، أداة الانتهاء ثم وقف، صف التالي).

3. إجراء اختبار كشف التحول المضاد: إعطاء المستخدم وقوفات طويلة في منتصف الجملة. ضبط عتبة الصمت VAD وعتبة درجة الكشف التحول لأدنى قطع كاذب دون تجاوز 900ms.

4. نشر نفس الوكيل على شبكة الإنترنت عبر Twilio. مقارنة PSTN أول صوت إلى WebRTC. شرح الاختلافات بين الخرق والكودك.

5. إضافة اكتشاف النشاط الصوتي للغات غير الإنجليزية (اليابانية والإسبانية). قياس معدل تشغيل الكذب في Silero VAD v5 مقابل المزجات الدقيقة الخاصة باللغة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## المزيد من القراءة

- [LiveKit Agents 1.0](https://github.com/livekit/agents) إطار عميل WebRTC الإشارة
- [Pipecat](https://github.com/pipecat-ai/pipecat) إطار عمل متبادل Python-first
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) إشارة لنماذج الكلام المتكاملة
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) إشارة ASR المباشرة
- [Silero VAD v5](https://github.com/snakers4/silero-vad) نموذج مرجعية لـ VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) إشارة TTS ذات التأخير المنخفض
- [Retell AI architecture](https://docs.retellai.com) فنسة العملاء الصوتيين
- [Vapi.ai production stack](https://docs.vapi.ai) إشارة إنتاج بديل
