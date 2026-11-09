# OpenTelemetry GenAI  أداة تتبع المكالمات من نهاية إلى نهاية

> عميل يدعو خمسة أدوات، ثلاثة خادمات MCP، و اثنين من العملاء الفرعيين. تحتاجين إلى دليل واحد على كل شيء الاتفاقيات الترجمية OpenTelemetry GenAI (الخصائص المستقرة في v1.37 وما فوق) هي معيار 2026 ، المدعومة بشكل أصلي من قبل Datadog ، Langfuse ، Arize Phoenix ، OpenLLMetry ، و AgentOps. هذه الدروس تعطي الأسماء للخصائص المطلوبة، وتتبع ترتيبات المدة (الوكيل → أداة LLM) ، وتشحن إمتير المدة القصوى يمكنك توصيلها إلى أي مصدر OTel.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## أهداف التعلم

- أسمائ صفات OTel GenAI المطلوبة لفترة LLM وفترة تنفيذ الأدوات.
- بناء تسلسل تسلسل تتبع يغطي حلقة وكيل، LLM المكالمة، أداة المكالمة، و MCP العميل إرسال.
- قرر أي محتوى يجب استيعابه (التخيار) مقابل التحرير (الخطط الافتراضية).
- إصدار المجموعات المحلية (Jaeger، Langfuse) دون إعادة كتابة رمز الأداة.

## المشكلة

تحذير من فبراير 2026: يبلغ المستخدم "يستغرق وكيلي في بعض الأحيان 30 ثانية للرد؛ في بعض الأحيان 3 ثوان". لا يوجد آثار. تسجلات تظهر مكالمة LLM، ولكن ليس إرسال الأداة، وليس الخادم MCP ذهابًا وإياباً، وليس الخادم الفرعي. تخمن. في النهاية تجد: خادم MCP واحد معلق في بعض الأحيان على بدء بارد.

بدون تعقب من نهاية إلى نهاية، لن تجد هذا

تم تسوية الاتفاقيات في عام 2025-2026 تحت مجموعة الاتفاقيات الترجمية OpenTelemetry. تحدد أسماء الصفات المستقرة بحيث يقوم Datadog ، Langfuse ، Phoenix ، OpenLLMetry ، و AgentOps بتحليل نفس المدى.

## المفهوم

### تسلسل تسلسل

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

كل شيء يقع تحت هوية واحدة و هوية المعلومات يربط بين العلاقات بين الوالدين و الطفل

### الميزات المطلوبة

في الفترة من 2025 إلى 2026,

- `gen_ai.operation.name` `"chat"`،`"text_completion"`،`"embeddings"`،`"execute_tool"`،`"invoke_agent"`. . .
- `gen_ai.provider.name` `"openai"`،`"anthropic"`،`"google"`،`"azure_openai"`. . .
- `gen_ai.request.model` سلسلة النموذج المطلوبة (مثل `"gpt-4o-2024-08-06"`)
- `gen_ai.response.model` النموذج خدم فعلاً
- `gen_ai.usage.input_tokens`- لا ، لا`gen_ai.usage.output_tokens`. . .
- `gen_ai.response.id` رقم الإجابة للمقدم للتصدي

لفترات الأدوات:

- `gen_ai.tool.name` معرف الأداة
- `gen_ai.tool.call.id` رقم المكالمة المحدد
- `gen_ai.tool.description` وصف الأداة (اختياري).

لفترات العملاء:

- `gen_ai.agent.name`- لا ، لا`gen_ai.agent.id`- لا ، لا`gen_ai.agent.description`. . .

### أنواع السباق

- `SpanKind.CLIENT`للاتصالات التي تتجاوز حدود العملية (مدفوع لـLLM، خادم MCP).
- `SpanKind.INTERNAL`لخطوات الحلقة الخاصة بالعميل وإجراء الأداة.

### التقاط المحتوى المختار

افتراضيا، تحمل المدة المقاييس والتوقيت  وليس الإشارات أو الإكمال. الحملات المفيدة الكبيرة و PII غير فعالة افتراضيا.`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`ووضع بيانات محددة لتحقيق المحتوى.

### الأحداث على المدى

يمكن إضافة أحداث مستوى الرمز كحوادث فترة:

- `gen_ai.content.prompt`رسائل إدخال
- `gen_ai.content.completion`رسائل إخراج
- `gen_ai.content.tool_call` دعوة الأداة كما تم تسجيلها.

الأحداث في التسلسل الزمني في فترة لإعادة عرض مفصل.

### المصدرون

وتتجاوز نطاق تصدير OTel إلى:

- **Jaeger / Tempo.**أوس، على موقع.
- **Langfuse.**خاصة بملاحظة القانون؛ تظهر استخدام الرمز.
- **Arize Phoenix.**المواصفات + التتبع مجتمعة
- **Datadog.**التجارية ، والفحص الأصلي `gen_ai.*`الصفات
- **Honeycomb.**المتحركات العمودية، ودية الاستفسار.

كلّهم يتحدثون بـ (أوتل بي) ، و تنسيقات الأسلاك، رمزك لا يهتم.

### التنشر عبر MCP

عندما يتصل عميل MCP بخادم ، قم بتحريك رأس W3C traceparent في الطلب. تدعم HTTP المباشرة القياسية. لا يحمل Stdio رؤوس HTTP بشكل أصلي ؛ يتناقش خريطة الطريق 2026 الخاصة بالتفصيل إضافة `_meta.traceparent`الحقل على مكالمات JSON-RPC.

حتى تلك السفن: تضمين العبارة في `_meta`كل طلب يدويًا، يقوم الخادم بتسجيل هوية التتبع

### المقاييس

إلى جانب المدة، تعريف GenAI semconv المقاييس:

- `gen_ai.client.token.usage` التشخيص الهستومي
- `gen_ai.client.operation.duration` التشخيص الهستومي
- `gen_ai.tool.execution.duration` التشخيص الهستومي

استخدم هذه لأجهزة التحكم التي لا تحتاج إلى تفاصيل كل مكالمة.

### طبقة AgentOps

AgentOps (مؤسسة عام 2024) متخصصة في قابلية مراقبة GenAI. يضم الإطارات الشعبية (LangGraph ، Pydantic AI ، CrewAI) لإصدار امتدادات OTel تلقائيًا. مفيد إذا استخدم كومة البيانات الإطار المدعوم ؛ استخدم الأدوات اليدوية خلاف ذلك.

```figure
t3-span-waterfall
```

## استخدمها

`code/main.py`يُصدِر فترات تشكيلة OTel إلى stdout (في شكل OTLP-JSON) لوكيل يدعو LLM ، ويرسل أدواتًا ، ويقوم برحلة ذهابًا وإياباً واحدة من MCP. لا يوجد مصدر حقيقي  يركز الدروس على مجموعة شكل الفترات وصفوص. ضعي الخروج في متفرج متوافق مع OTLP أو اقرأه فقط.

ما الذي يجب أن ننظر إليه:

- يتم مشاركة رقم التتبع على جميع المراحل
- الروابط بين الوالدين والأطفال يتم ترميزها عبر `parentSpanId`. . .
- مطلوب`gen_ai.*`المصفوفات مكتظة.
- يتم إيقاف استيعاب المحتوى بطبيعة الحال؛ سيناريو واحد يُشغيله عبر env var.

## أرسله

هذا الدرس يُنتج`outputs/skill-otel-genai-instrumentation.md`. بالنظر إلى قاعدة رمزية للعامل، فإن المهارة تنتج خطة أدوات: أين تضيف المنتجات، ما الذي يعطي السكان، وما الذي يستهدف المصدرين.

## التمارين

1. أركض`code/main.py`عدّ المدة و حدّد أيّ من العملاء مقابل الداخليين

2. قم بتشغيل تسجيل المحتوى (env var) و تأكيد `gen_ai.content.prompt`و`gen_ai.content.completion`لاحظ الآثار على PII

3. إضافة مقياس أداة تنفيذ `gen_ai.tool.execution.duration`ويعطيها على شكل عينة من أوراق التاريخ لكل مكالمة.

4. نشر العبارة عن أحد الوالدين من وكيل الأم في عرض طلب MCP `_meta.traceparent`التحقق من أن خادم MCP يرى نفس الهوية التتبعية

5. اقرأ تحديدات OTel GenAI semconv. حدد صفة واحدة المدرجة في semconv التي لا ينبعثها رمز هذا الدروس. أضفها.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## المزيد من القراءة

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) اتفاقيات طائفية لمتوسعات ومتراكمات وحدثات GenAI
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) قائمة خصائص المجال التدريبي ومدة تنفيذ الأدوات
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) مستوى الوكيل `invoke_agent`المدة
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) مصدر الحقيقة المضمن في GitHub
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) إدماج الإنتاج
