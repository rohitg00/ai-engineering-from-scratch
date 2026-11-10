# OpenTelemetry GenAI  ابزار ردیابی تماس های آخر به آخر

> يه مامور 5تا ابزار، 3تا سرور MCP و 2تا فرعي مامور رو ميخواد تو به يه رد نياز داري که همه چيز رو از بين ببري کنوانسیون های معنوی OpenTelemetry GenAI (اعتماد های پایدار در v1.37 و بالاتر) استاندارد 2026 هستند که از طرف Datadog، Langfuse، Arize Phoenix، OpenLLMetry و AgentOps پشتیبانی می شود. این درس ویژگی های مورد نیاز را نام می دهد، سلسله مراتب اسپان را (کارگری → LLM → ابزار) بررسی می کند و یک فرستنده اسپان stdlib را ارسال می کند که می توانید به هر صادر کننده OTel وصل کنید.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## اهداف یادگیری

- ویژگی های OTel GenAI مورد نیاز برای مدت LLM و مدت اجرای ابزار را نام ببرید.
- یک سلسله مراتب ردیابی ایجاد کنید که شامل حلقه های عامل، تماس LLM، تماس ابزار و ارسال مشتری MCP باشد.
- تصمیم بگیرید که چه محتوایی را ضبط کنید (اختیار داشته باشید) در مقابل ویرایش (پیش فرض).
- ارسال دامنه به یک جمع کننده محلی (Jaeger، Langfuse) بدون نوشتن مجدد کد ابزار.

## مشکل

یک اشکال از فوریه 2026: کاربر گزارش می دهد "مستثمر من گاهی اوقات 30 ثانیه زمان می برد تا پاسخ دهد؛ گاهی اوقات 3 ثانیه". هیچ اثری. ثبت نام تماس LLM را نشان می دهد، اما نه فرستادن ابزار، نه سرور MCP بازگشت و بازگشت، نه فرعی. شما حدس می زنید. در نهایت شما متوجه می شوید: یک سرور MCP گاهی به یک شروع سرد معلق است.

بدون ردیابی تمام نهایتاً نمیتونی اینو پیدا کنی

این کنوانسیون ها در سال های 2025-2026 تحت گروه کنوانسیون های معنوی OpenTelemetry قرار گرفتند. آنها نام های استاندارتی را تعریف می کنند تا Datadog، Langfuse، Phoenix، OpenLLMetry و AgentOps همه در طول مدت یکسان تجزیه و تحلیل شوند. ابزار یک بار؛ به هر پس زمینه ارسال می شود.

## مفهوم

### سلسله مراتب اسپان

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

همه چيز تحت يه شناسه ي پيچيده قرار داره

### ویژگی های مورد نیاز

در سال های 2025-2026:

- `gen_ai.operation.name` `"chat"`،`"text_completion"`،`"embeddings"`،`"execute_tool"`،`"invoke_agent"`. .
- `gen_ai.provider.name` `"openai"`،`"anthropic"`،`"google"`،`"azure_openai"`. .
- `gen_ai.request.model` رشته مدل مورد نیاز (به عنوان مثال `"gpt-4o-2024-08-06"`)
- `gen_ai.response.model` مدل واقعا خدمت کرد
- `gen_ai.usage.input_tokens`-`gen_ai.usage.output_tokens`. .
- `gen_ai.response.id` شناسه پاسخ ارائه دهنده برای ارتباط.

برای دامنه ابزار:

- `gen_ai.tool.name` شناسه ابزار
- `gen_ai.tool.call.id` شماره تماس خاص
- `gen_ai.tool.description` توضیحات ابزار (اختيار)

برای مدت زمان کار اجنتی:

- `gen_ai.agent.name`-`gen_ai.agent.id`-`gen_ai.agent.description`. .

### انواع اسپان

- `SpanKind.CLIENT`برای تماس هایی که از مرز فرآیند عبور می کنند (پرویدر LLM، سرور MCP).
- `SpanKind.INTERNAL`برای مراحل حلقه و اجرای ابزار توسط عامل

### ضبط محتوای انتخاب شده

به طور پیش فرض، مدت زمان دارای متریک و زمان بندی است نه پیام ها یا تکمیل ها. بار های بزرگ و PII به طور پیش فرض غیر فعال هستند.`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`و محیط های خاص ضبط محتوا برای شامل کردن محتوا.

### رویدادهای در اسپان

رویدادهای سطح توکن می توانند به عنوان رویدادهای زمان اضافه شوند:

- `gen_ai.content.prompt` پیام های ورودی
- `gen_ai.content.completion` پیام های ورودی
- `gen_ai.content.tool_call` تماس ابزار به صورت ثبت شده

وقایع در زمان زمان برای تکرار دقیق

### صادرکنندگان

OTel به صادرات:

- **Jaeger / Tempo.**.او.اس. ، در محل
- **Langfuse.**LLM-تحقیقیت-خصوصی؛ استفاده از توکن ها را تجسم می کند.
- **Arize Phoenix.**همبستگی + ردیابی ترکیب شده
- **Datadog.**تجاري؛ به طور اصلي پارس`gen_ai.*`ویژگی ها
- **Honeycomb.**به ستون ها توجه می کند، برای سوال کردن دوستانه است.

همه از OTLP حرف ميزنن، فرمت تلويزيوني

### گسترش در سراسر MCP

وقتی یک مشتری MCP به یک سرور تماس می گیرد، سرپرست ردیابی W3C را در درخواست تزریق کنید. HTTP قابل پخش از سرپرستی استاندارد پشتیبانی می کند. Stdio سرپرستی HTTP را به طور بومی حمل نمی کند؛ نقشه راه 2026 مشخصات شامل یک `_meta.traceparent`در زمینه تماس های JSON-RPC.

تا اینکه کشتی ها: شامل پدر و مادر ردیابی در `_meta`هر درخواست رو دستي انجام ميده. سرور شناسه ي رد را ثبت ميکنه.

### متریک

در کنار اسپان، GenAI semconv متریک ها را تعریف می کند:

- `gen_ai.client.token.usage` هیستogram
- `gen_ai.client.operation.duration` هیستogram
- `gen_ai.tool.execution.duration` هیستogram

از این ها برای داشبورد هایی استفاده کنید که نیازی به جزئیات هر تماس ندارند.

### لایه ای AgentOps

AgentOps (ساخته شده در سال 2024) متخصص در مشاهده GenAI است. این چارچوب های محبوب (LangGraph، Pydantic AI، CrewAI) را برای انتشار خودکار OTel spans بسته می کند. مفید است اگر استیک شما از یک چارچوب پشتیبانی شده استفاده می کند؛ در غیر این صورت از ابزار دستی استفاده کنید.

```figure
t3-span-waterfall
```

## ازش استفاده کن

`code/main.py`در این روش، یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به عنوان یک عامل به یک عامل به یک یک عامل به یک یک یک یک یک یک یک به عنوان یک به عنوان یک یک یک یک به عنوان یک به عنوان یک به یک یک یک به یک به یک به یک به یک به یک به یک یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به یک به به یک به یک به به به به به یک به به به به یک به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به به

چه چیزی رو باید ببینیم:

- شناسه ردیابی در تمام مناطق مشترک است.
- لینک های والدین و کودکان از طریق `parentSpanId`. .
- لازم است`gen_ai.*`صفات پر شده
- ضبط محتوا به طور پیش فرض غیر فعال شده است؛ یک سناریو آن را از طریق env var فعال می کند.

## -باده

این درس به ما کمک می کند`outputs/skill-otel-genai-instrumentation.md`. با توجه به یک پایگاه کد عامل، مهارت یک برنامه ابزار تولید می کند: کجا باید دامنه ها را اضافه کند، چه ویژگی هایی برای جمعیت و چه صادرکنندگان را هدف قرار دهد.

## تمرینات

1. فرار کن`code/main.py`. طول زمان ها رو بشمار و مشخص کن کدام مشتری مقابل داخلی

2. ضبط محتوا را فعال کنید و تایید کنید`gen_ai.content.prompt`و`gen_ai.content.completion`اتفاقات رخ می دهد. پیامدهای PII را توجه کنید.

3. متریک اجرای ابزار را اضافه کنید `gen_ai.tool.execution.duration`و آن را به عنوان نمونه هیستوگرافی در هر تماس ارسال کنید.

4. گسترش یک ردیابی از یک عامل والدین در عرض درخواست MCP `_meta.traceparent`.به نظر ميرسه که سرور MCP همون شناسه ي رد رو مي بينه

5. مشخصات semconv OTel GenAI را بخوانید. یک ویژگی ذکر شده در semconv را که کد این درس منتشر نمی کند شناسایی کنید. آن را اضافه کنید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) کنوانسیون های کاینونیکی برای دامنه های GenAI، متریک ها و رویدادها
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) لیست ویژگی های LLM و مدت اجرای ابزار
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) سطح مامور `invoke_agent`مدت زمان
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) منبع حقیقت میزبان GitHub
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) راهبرد تکاملی تولید
