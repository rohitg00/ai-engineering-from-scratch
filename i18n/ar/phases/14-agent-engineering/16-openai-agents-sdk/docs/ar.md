# SDK وكلاء OpenAI: التسليمات، الحراسة، التتبع

> OpenAI Agents SDK هو إطار متعدد الوكلاء خفيف الوزن بني على API الإجابات. خمسة بدائيات: وكيل، التنفيذ، الحراسة، الجلسة، التتبع. التنفيذات هي أدوات تسمى `transfer_to_<agent>`.الآثار المراقبة تتحرك عند المدخل أو الخروج

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## أهداف التعلم

- أسمائ خمسة أسباب بدائية من OpenAI Agents SDK.
- شرح التسليمات: لماذا يتم تصميمها كأدوات، ما هي الشكل الذي يراه النموذج، وكيف يتم نقل السياق.
- تمييز بين حواجز المدخلات والحواجز الخارجة وحواجز الأدوات ؛ شرح `run_in_parallel`مقابل وضع الحظر
- تنفيذ وقت تشغيل stdlib مع التسليم + الحراس + تعقب في نمط الانطلاع.

## المشكلة

وكلاء لا يستطيعون تفويض النظافة ينتهي بهم المطاف بإملاع كل شيء في طلب واحد. وكلاء دون حواجز شحن PII، أو الخروج الذي ينتهك السياسات، أو حلقة إلى الأبد. SDK OpenAI يرمز الأسباب الثلاثة التي تجعل عمل متعدد الوكلاء قابلة للتعامل.

## المفهوم

### خمسة بدائيات

1. **Agent.**الـ LLM + تعليمات + أدوات + التسليمات
2. **Handoff.**تمثيل إلى وكيل آخر تمثل للنموذج كوسيلة تسمى `transfer_to_<agent_name>`. . .
3. **Guardrail.**التحقق من المصادقة على المدخل (الوكيل الأول فقط) ، والخروج (الوكيل الأخير فقط) ، أو استدعاء الأداة (للأداة الوظيفية).
4. **Session.**تاريخ المحادثات الآلي عبر المنحنى
5. **Tracing.**مدخلات للمؤسسات التدريبية للأجيال، دعوات الأدوات، التسليمات، الحراسة.

### التسليم كأدوات

النموذج يرى`transfer_to_billing_agent`في قائمة الأدوات، إن تسميته يشير إلى وقت التشغيل إلى:

1. نسخ السياق المحادثات (أو انهياره عبر `nest_handoff_history`(بيتا)
2. إبدأ العميل المستهدف مع تعليماته
3. استمر في الركض مع العميل المستهدف

هذا هو نمط المشرف (المدرسة 13 / الدروس 28) المنتجة.

### الحراسة

ثلاث طعامات:

- **Input guardrails.**إستخدم بيانات العميل الأول، ورفض طلبات غير آمنة أو خارج نطاقه قبل أي دعوة لـ"إل إل إم".
- **Output guardrails.**إستخدم بيانات العميل الأخير، اكتشف تسريبات المعلومات الشخصية، انتهاكات السياسات، ردود فعل خاطئة.
- **Tool guardrails.**إشغيل أداة لكل وظيفة، تأكيد الحجج، التحقق من الإذن، تنفيذ المراجعة.

وضع:

- **Parallel**(الابتكار) تدير ماجستير القانون الوطني في غاردريل جنبا إلى جنب مع ماجستير الوطني الرئيسي. تأخر الذيل السفلي. إذا تعثرت، يتم التخلص من عمل ماجستير الوطني الرئيسي (نفايات الوهم).
- **Blocking**(`run_in_parallel=False`ماجستير القانون في "غاردريل" يبدأ أولاً، إذا تعثرت، فلا تُهدر أي رموز في المكالمة الرئيسية

السلك الثلاثي يرفع`InputGuardrailTripwireTriggered`- لا ، لا`OutputGuardrailTripwireTriggered`. . .

### التتبع

كل جيل من أدوات الجامعة، وكل إرسال أدوات، وكل إرسال، وكل سكة حراسة تنبعث من فترة.`OPENAI_AGENTS_DISABLE_TRACING=1`يختار الخروج`add_trace_processor(processor)`المُعجبون يتمتعون إلى خلفيتكِ الخاصة بجانب OpenAI.

### الجلسات

`Session`تخزين تاريخ المحادثات في الخلفية (SQLite، Redis، custom). `Runner.run(agent, input, session=session)`تحميلات تلقائية و إضافات

### حيث يذهب هذا النمط خطأ

- **Handoff drift.**العميل (أ) يُسلم إلى العميل (ب) الذي يعيد إلى العميل (أ
- **Guardrail bypass.**حواجز الأدوات تنطلق فقط على أدوات الوظيفة؛ الأدوات المدمجة (قراءة الملفات، استلام الويب) تحتاج إلى سياسة منفصلة.
- **Over-tracing.**المحتوى الحساس في المدة. إزواج مع قواعد OTel GenAI لالتقاط المحتوى (الدرس 23)  التخزين الخارجي، الإشارة بواسطة ID.

```figure
ae-agent-handoff
```

## بناءها

`code/main.py`يطبق شكل SDK في stdlib:

- `Agent`،`FunctionTool`،`Handoff`(كوسيلة وظيفة مع النطقية النقلية).
- `Runner`مع حواجز المدخل / الخروج / الأدوات ، وإرسال التسليم ، ومعدل القفز.
- إصدار بسيط للكشف عن شكل البصمة
- وكيل التجديد الذي يقدم الفواتير أو الدعم بناءً على استفسار المستخدم؛ رحلات الحراسة على مدخل واحد.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

يظهر البصمة إثنين من التسليمات الناجحة، رحلة واحدة في الحافظة المدخلة، و شجرة إطار تعكس ما ينبعث منه SDK الحقيقي.

## استخدمها

- **OpenAI Agents SDK**بالنسبة لمنتجات OpenAI الأولى.
- **Claude Agent SDK**(الدرس 17) بالنسبة لمنتجات كلود-أول.
- **LangGraph**(الدرس 13) عندما تريد بيانا صريحاً و سيرتك الذاتية الدائمة.
- **Custom**عندما تحتاج إلى التحكم الدقيق (صوت، مزود متعدد، عمليات نشر مشتركة).

## أرسله

`outputs/skill-agents-sdk-scaffold.md`يضع أساسًا تطبيق Agents SDK مع وكيل التجديد ، والمسارات ، والحواجز المدخولية / الخروجية / الأداة ، وتخزين الجلسات ، ومعالج التتبع.

## التمارين

1. إضافة معداد التسليم: رفض بعد N نقل. تتبع السلوك.
2. تنفيذ`nest_handoff_history`كخيار  تحويل الرسائل السابقة إلى ملخص واحد قبل النقل.
3. اكتب حواجز حراسة محاصرة الخروج وقارن التأخير على الطلبات التي ستعثرها مقابل تلك التي تمر
4. السلك`add_trace_processor`إلى سجل JSON. ما هي الشكل الذي ينبعث به لكل فترة؟
5. اقرأ وثائق SDK و احملي لعبة SDLIB الخاصة بك إلى`openai-agents-python`ما الذي أخطأت في نموذجها؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## المزيد من القراءة

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) البدائية، التسليمات، الحراسة، التتبع
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) نظير ذوق كلويد
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)متى يجب أن يصل إلى التبرعات على الإطلاق
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) تمتد خريطة SDK الوكلاء القياسية إلى
