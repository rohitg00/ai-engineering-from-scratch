# OpenTelemetry GenAI اتفاقيات تعريفية

> تعريف نظام GenAI SIG (الذي تم إطلاقه في أبريل 2024) للعملاء التلفزيونية. اسمات المجال والخصائص وقواعد استيراد المحتوى تتقارب بين البائعين بحيث تعني آثار العملاء نفس الشيء في Datadog و Grafana و Jaeger و Honeycomb.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## أهداف التعلم

- أسمائ فئات المدى GenAI: النموذج/العميل، وكيل، الأداة.
- التمييز`invoke_agent`المستهلك مقابل المستهلك الداخلي و عندما ينطبق كل منهما
- قم بإدراج صفات GenAI على المستوى الأعلى: اسم المقدم، نموذج الطلب، معرف مصدر البيانات.
- شرح عقد استيعاب المحتوى: الاختيار`OTEL_SEMCONV_STABILITY_OPT_IN`، توصية مرجعية خارجية.

## المشكلة

كل مبيع يختلق أسماء فترة عمله الخاصة. فرق العمليات تنتهي بناء لوحة التحكم لكل إطار. إعدادات OpenTelemetry GenAI SIG تصحيح هذا عن طريق تعريف معيار واحد أهداف النظام الإيكولوجي بأكمله.

## المفهوم

### فئات المجال

1. **Model / client spans.**تغطي مكالمات LLM الخام. تم إصدارها من قبل SDKs (Anthropic، OpenAI، Bedrock) ومعدلات نموذج الإطار.
2. **Agent spans.** `create_agent`(عندما يتم بناء الوكيل) و `invoke_agent`(عندما يدير)
3. **Tool spans.**واحد لكل دعوة أداة، متصلة مع فترة الوكيل عن طريق علاقة الوالد والطفل.

### اسم العميل span

- اسم الإسبانية: `invoke_agent {gen_ai.agent.name}`إذا كان اسمها ، فلنقل إلى `invoke_agent`. . .
- نوع من النوع:
  - **CLIENT** لخدمات الوكلاء عن بعد (OpenAI Assistants API، Bedrock Agents).
  - **INTERNAL** لأطر العمليات العملية (LangChain، CrewAI، ReAct المحلية).

### الصفات الرئيسية

- `gen_ai.provider.name` `anthropic`،`openai`،`aws.bedrock`،`google.vertex`. . .
- `gen_ai.request.model`هوية النموذج
- `gen_ai.response.model` النموذج الذي تم حلّه (قد يختلف عن الطلب بسبب التوجيه).
- `gen_ai.agent.name` معرف الوكيل
- `gen_ai.operation.name` `chat`،`completion`،`invoke_agent`،`tool_call`. . .
- `gen_ai.data_source.id` لـ RAG: أي مجموعة أو مخزن تم استشارته.

توجد اتفاقيات محددة للتكنولوجيا لـ Anthropic، Azure AI Inference، AWS Bedrock، OpenAI.

### التقاط المحتوى

القاعدة الافتراضية: لا يجب أن تستقطب الأدوات المدخلات / المخرجات الافتراضية. يتم اختيار الاستقطاب عبر:

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

نمط الإنتاج الموصى به: تخزين المحتوى خارجيًا (S3 ، مخزن السجل الخاص بك) ، سجل الإشارات على المدى (معرفات المؤشر ، وليس النص). هذا هو الدروس 27 دفاع عن التسمم المحتوى معالجة إلى قابلية للملاحظة.

### الاستقرار

معظم المؤتمرات تجربية اعتبارا من مارس 2026. اختر المشاهدة المسبقة المستقرة مع:

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

خرائط Datadog v1.37+ تعود GenAI بشكل طبيعي إلى مخطط ملاحظة LLM. الدعم الخلفي الآخر (Grafana، Honeycomb، Jaeger) للمعايير الخام.

### حيث يذهب هذا النمط خطأ

- **Capturing full prompts in spans.**المعلومات الشخصية، السرّات، بيانات العملاء في أثر يمكن للعمليات قراءة.
- **No `gen_ai.provider.name`.**تختفي لوحة التحكم متعددة المزودين عندما يفتقر الخصيص.
- **Spans without parent links.**أدوات اليتامى تتفوق دائماً على النطاق
- **Not setting stability opt-in.**قد يتم إعادة تسمية صفاتك عند تحديث الخلفية.

```figure
ae-genai-span-tree
```

## بناءها

`code/main.py`ينفذ مستثمر مضربة مدة ستدليب يطابق اتفاقيات جناي:

- `Span`مع مخطط صفة GenAI.
- `Tracer`مع`start_span`، سياقات متضمنة
- وكيل مسجل يطلق:`create_agent`،`invoke_agent`(داخلية) ، على كل أداة، `chat`المدة المطلوبة لطلبات الجامعة
- وضع التقاط المحتوى الذي يحفظ الإشارات الخارجية ويستسجل الهويات على المدة.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

الناتج: شجرة المدى مع جميع صفات GenAI المطلوبة، و"متجر خارجي" يظهر مراجع المحتوى الاختيار.

## استخدمها

- **Datadog LLM Observability**(v1.37+) خرائط خصائص الأصلية.
- **Langfuse / Phoenix / Opik**(الدرس 24)  الآلة الذاتية النظام البيئي.
- **Jaeger / Honeycomb / Grafana Tempo** آثار OTel خام؛ بناء لوحة التحكم من صفات GenAI.
- **Self-hosted** تشغيل مجموعة OTel مع معالج GenAI.

## أرسله

`outputs/skill-otel-genai.md`الأسلاك OTel GenAI تمتد إلى وكيل موجود مع إيقاع المحتوى وتخزين المراجع الخارجية.

## التمارين

1. أداة دراستك 01 إعادة التأثير مع`invoke_agent`(داخلية) + امتدادات لكل أداة. أرسل إلى مثال جيجر.
2. إضافة التقاط المحتوى في وضع "المراجع فقط": الإشعارات إلى SQLite، سمات المدة تحمل فقط أجهزة تعريف الصف.
3. اقرأ المواصفات`gen_ai.data_source.id`. إدفعها إلى بحثك عن الدروس 09
4. المجموعة`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`وتحقق من أن صفاتك لا تُعيد اسمها من قبل المجمع
5. بناء لوحة التحكم: "أي أخطاء أداة تتصل مع أي نماذج" من صفات GenAI وحدها.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## المزيد من القراءة

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) المواصفات
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) تمتد GenAI حسب الافتراض
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) امتدادات OTel مدمجة في
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) W3C تعقب النطاق الانتشار
