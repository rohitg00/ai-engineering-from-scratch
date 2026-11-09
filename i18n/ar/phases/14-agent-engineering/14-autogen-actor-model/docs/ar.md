# نموذج الممثل للعملاء رسائل غير متزامنة وأوقات تشغيل من نوعها

> وكلاء كجهات الفاعلة: تبادل رسائل غير متزامنة، ومعالجي الحدث القائمة على التحكم، عزل الأخطاء، التزامن الطبيعي. قام AutoGen v0.4 (Microsoft Research، يناير 2025) بإعادة تصميم ترتيب وكلاء حول هذا النموذج. أصبح الإطار الآن في وضع الصيانة، مع Microsoft Agent Framework (مشاهدة مسبقة عامة أكتوبر 2025) كخلفة إنتاجها.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## أهداف التعلم

- وصف نموذج الممثل: العملاء كممثلين، الرسائل كمؤسسات التحكم الوحيدة، عزلة الفشل لكل ممثل.
- اسم ثلاثة طبقات API في AutoGen v0.4  Core، AgentChat، Extensions  وما هي كل منها.
- شرح لماذا إنفصال إرسال الرسالة عن التدريب يمنح عزل عن الأخطاء وتزامن طبيعي.
- تنفيذ وقت تشغيل محرك stdlib في Python و نقل تدفق مراجعة كود اثنين من الوكلاء عليه.

## المشكلة

معظم إطار العملاء متزامن: يقوم وكيل واحد بإنتاج وكيل واحد استهلك، في كومة مكالمات. فشل تصطدم كومة. يتم تشغيل التنافس. يتطلب التوزيع إعادة الكتابة.

الإجابة من AutoGen v0.4: نموذج الممثل. كل وكيل هو ممثل مع صندوق بريدية خاصة. الرسائل هي التفاعل الوحيد. وقت تشغيل يفرق التسليم من التعامل. الفشل عزل إلى ممثل واحد. التنافسية هي الأصلية. التوزيع هو مجرد نقل مختلف.

## المفهوم

### الممثلين

الممثل لديه:

- دولة خاصة (لم تلمسها مباشرة من الخارج)
- صندوق البريد (صف الرسائل).
- المدير:`receive(message) -> effects`حيث يمكن أن تكون الآثار "رد"، "رسلها إلى ممثل آخر"، "تحدث عن ممثل جديد"، "تحديث حالة"، "وقف نفسك".

لا يمكن للاعبين أن يشاركوا ذاكرتهم، يمكنهم فقط إرسال رسائل

### ثلاث طبقات من API

AutoGen v0.4 تقسم سطحها إلى ثلاثة:

1. **Core.**إطار عمل منخفض المستوى. `AgentRuntime`،`Agent`،`Message`،`Topic`تبادل رسائل غير متزامنة، محركة على الأحداث
2. **AgentChat.**API عالية المستوى القائمة على المهام (بدل من ConversableAgent في v0.2). `AssistantAgent`،`UserProxyAgent`،`RoundRobinGroupChat`،`SelectorGroupChat`. . .
3. **Extensions.**التكاملات  OpenAI، Anthropic، Azure، الأدوات، الذاكرة.

### لماذا تفصل الارتباط مهم

في النموذج v0.2 ، الاتصال `agent_a.chat(agent_b)`يمنع العامل_أ حتى يعود العامل_ب. في v0.4`send(agent_b, msg)`يضع الرسالة في صندوق البريد الخاص بالعميل ويرجع وقت التشغيل بعد ذلك

- **Fault isolation.**العميل B الإصطدام لا يصل إلى الإصطدام العميل A  الوقت الإجراء يلتقط الفشل في عامل B ويقرر ما يجب القيام به (التسجيل، محاولة ثانية، الخطوط الميتة).
- **Natural concurrency.**العديد من الرسائل في الطيران في وقت واحد ؛ الممثلين معالجة صندوق البريد في نفس الوقت.
- **Distribution-ready.**صندوق البريد + النقل هو نفس الاستخفاف سواء كان الفاعل في العملية أو على مضيف آخر.

### التوبولوجيات

- **RoundRobinGroupChat.**العملاء يتناوبون في دورة ثابتة
- **SelectorGroupChat.**وكيل المنتخب يختار من يذهب بعد بناء على سياق المحادثة
- **Magentic-One.**فريق مرجع متعدد الوكلاء للتصفح عبر الويب، تنفيذ الشفرة، معالجة الملفات، مبني على "الوكيلات".

### الملاحظة

دعم OpenTelemetry مدمج. كل رسالة تنشر فترة ؛ الاتصالات الأداة تحمل `gen_ai.*`الصفات حسب اتفاقيات OTel GenAI الارضية لعام 2026 (الدرس 23).

### حالة: وضع الصيانة

أوائل 2026: أوتوجين v0.7.x مستقرة للبحث والنموذج الأول. تحولت مايكروسوفت التطوير النشط إلى Microsoft Agent Framework ، خليفة الإنتاج (المتصفح العام 1 أكتوبر 2025 ؛ تم استهداف 1.0 GA بنهاية الربع الأول 2026). أنماط أوتوجين تتقدم نظيفة  نموذج الممثل هو الفكرة الدائمة.

```figure
actor-mailbox
```

## بناءها

`code/main.py`يطبق وقت تشغيل الممثل STDlib:

- `Message` تحميل مفيد مع `sender`،`recipient`،`topic`،`body`. . .
- `Actor` مجردة مع `receive(message, runtime)`. . .
- `Runtime`حلقة الحدث مع صف مشترك، التسليم، عزل الفشل.
- عرض عرض ممثليين:`ReviewerAgent`رمز المراجعات`ChecklistAgent`يدير قائمة تفقد؛ يتبادلون الرسائل حتى يتوافقون.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

يظهر البصمة إرسال الرسالة، فشل محاكي في أحد الفاعلين الذي لا يضرب الآخر، وتقارب في حكم مشترك.

## استخدمها

- **AutoGen v0.4/v0.7**(صيانة)  مستقرة للبحث، النماذج الأولية، أنماط متعددة الوكلاء.
- **Microsoft Agent Framework** خليفة الإنتاج (مشاهدة عامة أكتوبر 2025) ؛ نفس أفكار الممثلين في نموذج في API تم تجديدها.
- **LangGraph swarm topology**(الدرس 13)  نمط مماثل من خلال التبرع بالوسائل المشتركة.
- **Custom actor runtime** عندما تحتاج إلى نقل محدد (NATS، RabbitMQ، gRPC).

## أرسله

`outputs/skill-actor-runtime.md`يخلق وقت تشغيل اللاعبين الحد الأدنى بالإضافة إلى نموذج فريق (RoundRobin أو Selector) لمهمة متعددة الوكلاء المعينة.

## التمارين

1. إضافة صف من الحروف الميتة: عندما يرفع المدير، وقع الرسالة الفاشلة للتفتيش البشري. كم مرة يتم ضرب DLQ في لعبةك؟
2. تنفيذ`SelectorGroupChat`: ممثل المنتخب يختار من يعالج الرسالة التالية بناءً على حالة المحادثة.
3. إضافة النقل الموزع: تبادل صف في العملية لمخادم JSON-over-HTTP حتى يتمكن اللاعبون من تشغيل عمليات منفصلة.
4. إرسال فترة OTel لكل رسالة (أو إرسال بدون عمل).`gen_ai.agent.name`،`gen_ai.operation.name`في الدروس الثالثة والعشرين
5. اقرأ رسالة المعماريات في AutoGen v0.4 ، وقل لعبةك إلى الواقع`autogen_core`ما الذي تخطيته المهم في الإنتاج؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## المزيد من القراءة

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) البند لإعادة التصميم
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) بديل على شكل الرسم البياني
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) تمتد AutoGen الإصدارات الافتراضية
