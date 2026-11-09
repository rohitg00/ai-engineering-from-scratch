# كابستون 17  معلم الذكاء الاصطناعي الشخصي (متكيف، متعددة الحركات، مع الذاكرة)

> خانميغو (أكاديمية خان) ، دوولينغو ماكس ، جوجل تعلمLM / جيمين للتعليم ، كويزليت Q-Chat ، و Tutor Synthesis جميعهم أرسلوا التدريبات المتعددة الطرق التكيفية على نطاق واسع في عام 2026. الشكل الشائع هو سياسة سقراطية (لا تنزل الإجابة أبداً) ، ونموذج متعلم يقوم بتحديثها بعد كل تفاعل (نمط تعقب المعرفة البايسية) ، وإدخال الصوت + النص + الرسوم البصرية ، واسترداد الرسم البياني للمنهج الدراسي ، وتخطيط التكرار المتفاصيل ، ومصفحات السلامة الصلبة للمحتوى المناسب للسن. الحجر النهائي هو إرسال معلم محدد للموضوع (الجيبر K-12 أو مقدمة Python) ، وإجراء دراسة فعالية لمدة أسبوعين مع 10 متعلمين، والجائزة على مراجعة سلامة المحتوى.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## المشكلة

التعليم التكيفي كان مكاناً بحثياً في مجال التكنولوجيا بحلول عام 2026 سيكون منتجًا استهلاكياً. يتم نشر "خانميغو" في معظم مناطق المدارس الأمريكية. (دوالينغو ماكس) أصيب بـ عشرات الملايين من المواطنين يُمكّن نظام LearnLM/ Gemini for Education من تقديم الدروس في Google Classroom. "كويزليت" "كيو تشات" يجلس بجانب بطاقات الفلاش "معلم التكوين" ضرب الفيروسات مع "معلم لأطفال فضوليين". العناصر المشتركة: المدخلات المتعددة الطرق (النوع، الكلام، معادلات التصوير) ، التربية السوكراتية (اسأل أولا، شرح لاحقا) ، نموذج المتعلم الذي يُحديث بعد كل تفاعل، والسلامة الصارمة المناسبة للسن.

ستقوم ببناء واحدة من هذه للجماعة المحددة. شريط القياس هو دراسة فعالية فعلية: درجات ما قبل الاختبار وبعدها الاختبار على مدى أسبوعين مع 10 متعلمين. يجب أن تشعر حلقة الصوت الطبيعية (كابستون 03 فرعية-مجموعة). يجب أن تكون الذاكرة محترمة للخصوصية. يجب أن يمر المرشح الأمني COPPA-وعي الفريق الأحمر للخلفية 12.

## المفهوم

أربعة مكونات**Tutor policy**هو حلقة سقراطية: عندما يسأل المتعلم عن الإجابة، فإن السياسة تسأل سؤالًا رئيسيًا؛ عندما يحصلون عليه بشكل صحيح، ينتقل إلى المفهوم التالي؛ عندما يعلقون، فإنه يقدم إشارةً متضخمةً. **Learner model**هو تعقب المعرفة البايسية (أو خيار بسيط) الذي يحدد احتمالية إتقان لكل عقدة منهج الدراسة بعد كل تفاعل. **Curriculum graph**هو Neo4j من المفاهيم مع حواف شرطية؛ السياسة تتجول على الرسم البياني لتحديد المفهوم التالي. **Memory**هو متجر حلقة + تعبير (مثل الذاكرة العميلة) الذي يحمل التفاعلات والخطأ والتفضيلات السابقة.

يستخدم UX متعدد الطرق. إدخال النص للإجابات المكتوبة. إدخال الصوت عبر LiveKit + Whisper (استعمال رأس الحجر 03). إدخال الصور لمشاكل الرياضيات عبر dots.ocr أو PaliGemma 2. إدخال الصوت عبر Cartesia Sonic-2.

دراسة الفعالية هي المنتج. 10 متعلمين، قبل الاختبار وبعدها الاختبار، أسبوعين. تقرير اكتساب التعلم دلتا وفاصل الثقة. مقارنة مع خط أساسي غير تكييفي (المحتوى نفسه يتم تقديمه خطيا دون سياسة المعلم).

## الهندسة المعمارية

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## الـ"كثيرة"

- اختيار الموضوع: الجبر K-12 أو مقدمة Python (اختر واحد للعمق)
- سياسة المعلم: LangGraph على Claude Sonnet 4.7 (مع التخزين الآلي)
- نموذج المتعلم: تعقب المعرفة البايزية (معتادة) أو FSRS للتراجع
- الرسم البياني للمنهج الدراسي: Neo4j من المفاهيم + الحواف المسبقة + محتوى OER
- الذاكرة: عاملمجموعة متجهة مستمرة على النمط الذاكرة + الحلقة + التخزين المفصلي
- الصوت: LiveKit Agents 1.0 + Cartesia Sonic-2 (استعمال آخر 03
- الرياضيات الصورة: dots.ocr أو PaliGemma 2 لتحديد المعادلة
- السلامة: حارس لاما 4 + مرشح مخصص مناسب للسن
- Eval: توليد الأسئلة على مستوى الزهرة، استخدام ما قبل/ بعد الاختبار، أدوات دراسة الفعالية

```figure
cf-tutor-loop
```

## بناءها

1. **Curriculum graph.**بناء Neo4j من 50-150 عقدة مفهوم (على سبيل المثال ، الجبر K-12 من "خط الأرقام" إلى "الصيغة التربيعية") مع حواف مطلوبة. ضم محتوى OER لكل عقد (Open Textbook ، OpenStax).

2. **Learner model.**إبتدائ تعقب المعرفة البايسية مع سابقات: تخمين، تسريع، معدل التعلم. تحديث إتقان لكل مفهوم بعد كل تفاعل. استمر لكل متعلم.

3. **Tutor policy.**لنجراف مع العقد: `read_signal`(هل كانت إجابة المتعلم صحيحة / جزئية / عالقة؟)`select_concept`(مخطط المنهج الممشي يختار المفهوم ذو الأولوية العليا)`scaffold`(تعليق سقراطي) ،`update_mastery`. . .

4. **Memory.**كل تفاعل يكتب إلى متجر حلقة. الأخطاء والتفضيلات تعزز إلى الذاكرة النطاقية. سياسة الاحتفاظ واعية COPPA: تحذيف تلقائي بعد عام واحد، يمكن الوصول إليها من قبل الوالدين.

5. **Voice path.**عامل LiveKit Agents متصل بسياسة المعلم. ASR عبر Whisper-v3-turbo. TTS عبر Cartesia Sonic-2. Barge-in مدعوم (استعمال ميكانيكا كابستون 03).

6. **Photo-math path.**قم بتحميل الصورة أو التقاطها؛ قم بتشغيل dots.ocr أو PaliGemma 2 لتعرف المعادلة؛ قم بتغذية المعلم كمدخول مهيكلي.

7. **Safety.**كل نموذج خروجي يمر Llama Guard 4 + مرشح مناسب للسن (منع إيذاء الذات، محتوى البالغين، العنف). الوصول إلى الذاكرة يحدد من خلال هوية المتعلم؛ سطح الوصول إلى الوالدين للحذف.

8. **Efficacy study.**10 متعلمين، قبل الاختبار (مبدأ قياسي من 30 سؤال) ، أسبوعين من التفاعل مع المعلمين (3 جلسات/أسبوع) ، بعد الاختبار. مقارنة مع مجموعة من المتعلمين غير التكيفية من 10 متعلمين على نفس المحتوى.

9. **Weekly progress reports.**لكل متعلم، قم بتوليد ملخص PDF تلقائي للمواضيع التي تم استكشافها، ومسارات التعلم، والخطوات التالية الموصى بها.

## استخدمها

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## أرسله

`outputs/skill-ai-tutor.md`هو المنتج. معلم تكييفي محدد للموضوع مع مدخلات متعددة الطرق، ونموذج المتعلم، والذاكرة، والسلامة، والفعالية المقاسة.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## التمارين

1. إدارة دراسة الفعالية مع ونحو نموذج المتعلم التكيفي (ترتيب المفهوم العشوائي). إبلاغ عن الدلتا. توقع التكيفي للفوز، ولكن الحجم هو الرقم المثير للاهتمام.

2. إضافة قناة متعددة الطرق: نفس سؤال مفهوم يقدم كنص وصوت وصورة. قياس ما إذا كان المتعلمين يتقاربون بشكل أسرع مع الطريقة التي يفضلونها.

3. بناء لوحة التحكم الأم: الموضوعات الممارسة، مسارات التعلم، المفاهيم القادمة، الأحداث الأمنية (أي ضربات الحراسة).

4. إضافة وضع تغيير اللغة: يتقبل المعلم المدخل الإسباني ويعلم باللغة الإسبانية. قم بتقييم تغطية X-Guard.

5. الضغط على خصوصية الذاكرة: التحقق من أن المتعلم A لا يستطيع رؤية بيانات المتعلم B حتى من خلال هجوم إعادة استهلاك شريط صوتي. سجل محاولة الوصول والتحذير.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## المزيد من القراءة

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) المستهلك المرجعي المعلم K-12
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) معلم تعليم اللغة المرجعية
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) نموذج مرجعية مضيف
- [Quizlet Q-Chat](https://quizlet.com) إشارة بديلة
- [Synthesis Tutor](https://www.synthesis.com) إشارة بدء العمل
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) مُخطط للجدول المتفاصل
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) نموذج المتعلم الكلاسيكي
- [LiveKit Agents](https://github.com/livekit/agents) كومة صوتية
