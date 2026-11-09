# OpenTelemetry GenAI کنوانسیون های معنوی

> GenAI SIG OpenTelemetry (بازدید آوریل 2024) طرح استاندارد برای تله متری عامل را تعریف می کند. نام های اسپان، ویژگی ها و قوانین ضبط محتوا در سراسر فروشندگان به هم می پیوندند بنابراین ردیابی عامل به معنای همان چیزی در Datadog، Grafana، Jaeger و Honeycomb است.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## اهداف یادگیری

- دسته بندی های دامنه GenAI را نام ببرید: مدل/مشتری، نماینده، ابزار.
- تشخیص بده`invoke_agent`مدت زمان مشتری در مقابل مدت زمان داخلی و زمانی که هر یک از آنها اعمال می شود.
- ویژگی های GenAI سطح بالا را لیست کنید: نام ارائه دهنده، مدل درخواست، شناسه منبع داده.
- قرارداد ضبط محتوا رو توضیح بده: قبول`OTEL_SEMCONV_STABILITY_OPT_IN`، توصیه مرجع خارجی

## مشکل

هر فروشنده نام های دامنه خود را اختراع می کند. تیم های عملیات در نهایت در هر چارچوب داشبورد ایجاد می کنند. GenAI SIG OpenTelemetry با تعریف یک استاندارد کل اهداف اکوسیستم این مسئله را حل می کند.

## مفهوم

### دسته بندی های اسپان

1. **Model / client spans.**فراخوان های LLM خام را پوشش دهید. توسط SDK های ارائه دهنده (Anthropic، OpenAI، Bedrock) و آداپتورهای مدل چارچوب صادر می شود.
2. **Agent spans.** `create_agent`(وقتی که عامل ساخته شده است) و `invoke_agent`(وقتی که راه می رود)
3. **Tool spans.**یک در هر ابزار دعوت؛ به واسطه رابطه پدر و مادر-بچه به مدت عامل متصل شده است.

### نام مامور اسپان

- اسم اسپان: `invoke_agent {gen_ai.agent.name}`اگر نامش مشخص شده باشد، به `invoke_agent`. .
- نوع اسپان:
  - **CLIENT** برای خدمات مامورین از راه دور (API دستیاران OpenAI، Bedrock Agents).
  - **INTERNAL** برای چارچوب های عامل در فرآیند (LangChain، CrewAI، ReAct محلی).

### ویژگی های کلیدی

- `gen_ai.provider.name` `anthropic`،`openai`،`aws.bedrock`،`google.vertex`. .
- `gen_ai.request.model` شناسه مدل
- `gen_ai.response.model` مدل حل شده (می تواند با درخواست به دلیل رویت متفاوت باشد).
- `gen_ai.agent.name` شناسه مامور
- `gen_ai.operation.name` `chat`،`completion`،`invoke_agent`،`tool_call`. .
- `gen_ai.data_source.id` برای RAG: کدام کپس یا فروشگاه مورد بررسی قرار گرفت.

کنوانسیون های خاص فناوری برای Anthropic، Azure AI Inference، AWS Bedrock، OpenAI وجود دارد.

### ضبط محتوا

قانون پیش فرض: ابزارها نباید ورودی ها / خروجی ها را به طور پیش فرض ضبط کنند. ضبط از طریق:

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

الگوی تولید توصیه شده: محتوای خارج از (S3، فروشگاه روزنامه شما) ذخیره کنید، مرجع ها را در طول زمان ثبت کنید (تعرفات اشاره، نه پروسه). این دفاع از مواد مسموم در درس 27 است که به قابل مشاهده است.

### ثبات

بیشتر کنوانسیون ها از مارس 2026 به صورت آزمایشی انجام می شوند.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

نقشه های Datadog v1.37+ GenAI به طور بومی در طرح مشاهده LLM خود نسبت می دهد. پس زمینه های دیگر (Grafana، Honeycomb، Jaeger) ویژگی های خام را پشتیبانی می کنند.

### جایی که این الگوی اشتباه می شود

- **Capturing full prompts in spans.**اطلاعات اطلاعاتي، اسرار، اطلاعات مشتری در اثرها که عمليات ميتونن بخوانند
- **No `gen_ai.provider.name`.**داشبورد های چند ارائه دهنده وقتی نسبت داده ها از دست می رود، خراب می شوند.
- **Spans without parent links.**ابزار يتيم ها هميشه متن رو پخش ميکنن
- **Not setting stability opt-in.**ممکن است با ارتقاء پس زمینه، ویژگی های شما نامگذاری شوند.

```figure
ae-genai-span-tree
```

## آن را بسازید

`code/main.py`یک فرستنده مدت stdlib را که با کنوانسیون های GenAI مطابقت دارد پیاده سازی می کند:

- `Span`با طرح ویژگی GenAI
- `Tracer`با`start_span`، زمینه های سرسبز
- يه اگزنتي که متنش رو ميفرستد:`create_agent`،`invoke_agent`(داخلي) ، در هر ابزار،`chat`مدت زمان برای تماس های LLM
- یک حالت ضبط محتوا که پیام های خارجی را ذخیره می کند و شناسه ها را در طول زمان ثبت می کند.

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

محصول: یک درخت اسپان با تمام ویژگی های GenAI مورد نیاز و یک "خزنۀ خارجی" که مرجع محتوای انتخاب شده را نشان می دهد.

## ازش استفاده کن

- **Datadog LLM Observability**(v1.37+) ویژگی های نقشه به طور بومی.
- **Langfuse / Phoenix / Opik**(درسی 24)  خود ابزار اکوسیستم.
- **Jaeger / Honeycomb / Grafana Tempo** ردیابی خام OTel؛ ایجاد داشبورد از ویژگی های GenAI.
- **Self-hosted** کلکتور OTel را با پردازنده GenAI اجرا کنید.

## -باده

`outputs/skill-otel-genai.md`سیم های OTel GenAI به یک عامل موجود با ضبط محتوای پیش فرض و ذخیره سازی مرجع خارجی گسترش می یابد.

## تمرینات

1. دروس درس 01 خود را با حلقه ReAct`invoke_agent`(داخلي) + هر ابزار اسپانز. به یک نمونه Jaeger ارسال کنید.
2. اضافه کردن ضبط محتوا در حالت "فقط مرجع": پیام های به SQLite، ویژگی های span فقط ID ردیف را دارند.
3. مشخصات رو بخونيد`gen_ai.data_source.id`. اينو به جستجو يادداشت درس 9 تو ببر
4. تنظیم شده`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`و مطمئن شو که ویژگیاتتون توسط جمع کننده تغییر نام نداد
5. یک داشبورد بسازید: "که کدام خطا ابزار با کدام مدل ارتباط دارد" تنها از ویژگی های GenAI.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) مشخصات
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) GenAI به طور پیش فرض
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) اسپان OTel ساخته شده در
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) W3C پخش زمینه ردیابی
