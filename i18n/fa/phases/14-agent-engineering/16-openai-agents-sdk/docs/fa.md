# SDK های OpenAI: انتقال، نگهبان، ردیابی

> OpenAI Agents SDK چارچوب چند عامل سبک وزن است که بر اساس API پاسخ ها ساخته شده است. پنج ابتدایی: عامل، دست دادن، guardrail، جلسه، ردیابی. دست دادن ابزار نامگذاری شده است `transfer_to_<agent>`. ريل هاي نگهباني در ورودي يا خروجي حرکت ميکنن . ردیابی به طور پيش فرض فعاله

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## اهداف یادگیری

- پنج نوع اولیه SDK OpenAI Agents را نام دهید.
- توضیح دهید که چرا آنها به عنوان ابزار مدل شده اند، چه شکل نامی مدل می بیند و چگونه زمینه انتقال می یابد.
- از محافظ های ورودی، محافظ های خروجی و محافظ های ابزار، تفاوت کنید؛ توضیح دهید `run_in_parallel`در مقابل حالت مسدود کردن
- اجرای یک زمان اجرا stdlib با دست دادن + محافظ + ردیابی سبک span.

## مشکل

عوامل که نمی توانند به طور تمیز به کارشان اختصاص دهند، در نهایت همه چیز را در یک پرامپت پر می کنند. عوامل بدون محافظ اطلاعات PII، خروجی که از سیاست ها نقض می کند، یا لوله برای همیشه ارسال می کنند. SDK OpenAI سه نوع اولیه را که کار چند عامل را قابل کنترل می کند، کدگذاری می کند.

## مفهوم

### پنج نوع ابتدایی

1. **Agent.**LLM + دستورالعمل + ابزار + کمک
2. **Handoff.**نمایندگی به یک نماینده دیگر. به عنوان یک ابزار به نام `transfer_to_<agent_name>`. .
3. **Guardrail.**اعتبارگذاری در ورودی (تنها عامل اول) ، خروجی (تنها عامل آخر) یا درخواست ابزار (به هر ابزار عملکرد).
4. **Session.**تاريخچه مکالمه ي اتوماتيک در هر دور
5. **Tracing.**در ساخت و ساز برای نسل های LLM، تماس ابزار، کمک های دستی، محافظ.

### دست دادن به عنوان ابزار

مدل میبینه`transfer_to_billing_agent`در فهرست ابزارش، نامش نشان می دهد زمان اجرا به:

1. متن مکالمه را کپی کنید (یا از طریق `nest_handoff_history`بیتا)
2. مامور هدف رو با دستورالعملش شروع کن
3. با مامور هدف ادامه بدين

این مدل نظارت (درسه 13 / درسه 28) تولید شده است.

### رایل های نگهبان

سه طعم:

- **Input guardrails.**از اطلاعات اولي که از طرف مامور مياد استفاده کن و قبل از هر تماس به عنوان مدرک تحصيلي درخواست هاي غير امن و خارج از محدوده رو رد کن
- **Output guardrails.**از اطلاعات آخري که از دست داده شده استفاده کنيد، دزدي اطلاعات شخصي، نقض قانون، پاسخ هاي اشتباه رو پيدا کنيد
- **Tool guardrails.**هر ابزار تابع رو اجرا کن، استدلال ها رو تایید کن، مجوزها رو چک کن، اجرا کن

حالت:

- **Parallel**(به طور پیش فرض) LLM Guardrail در کنار LLM اصلی اجرا می شود. تاخیر پایین تر دم. در صورت رکود، کار LLM اصلی رد می شود (توکین زباله).
- **Blocking**(`run_in_parallel=False`.گرادرايل اول مياد اگه از دستش برسه توکن هاي اصلي تلف نميشن

. ساید سه سیم بالا`InputGuardrailTripwireTriggered`-`OutputGuardrailTripwireTriggered`. .

### ردیابی

به طور پیش فرض تمام نسل های LLM، ابزار، انتقال و محافظ یک زمان را می فرستند.`OPENAI_AGENTS_DISABLE_TRACING=1`ازش خارج ميشه`add_trace_processor(processor)`طرفداران به پشت سرانه خود شما در کنار OpenAI گسترش می یابد.

### جلسات

`Session`تاریخچه مکالمه را در یک پس زمینه ذخیره می کند (SQLite، Redis، سفارشی). `Runner.run(agent, input, session=session)`بار اتوماتیک و لوازم جانبی

### جایی که این الگوی اشتباه می شود

- **Handoff drift.**مامور "آ" به مامور "ب" دست ميده که اون به مامور "آ" دست ميده
- **Guardrail bypass.**محافظ ابزار فقط در ابزار عملکردی آتش می زند؛ ابزار های داخلی (فایل ریڈر، وب گیر) نیاز به سیاست جداگانه دارند.
- **Over-tracing.**محتوای حساس در طول مدت. با قوانین ضبط محتوا OTel GenAI (درس 23)  ذخیره خارجی، مرجع با ID.

```figure
ae-agent-handoff
```

## آن را بسازید

`code/main.py`شکل SDK را در stdlib پیاده سازی می کند:

- `Agent`،`FunctionTool`،`Handoff`(به عنوان یک ابزار عملکرد با معنای انتقال).
- `Runner`با محافظ های ورودی/خروج/ ابزار، فرستادن و شمارش کننده hop.
- یک فرستنده ساده برای نشان دادن شکل ردی
- یک عامل triage که بر اساس سوال کاربر به صورت صورت صورت حساب یا پشتیبانی پرداخت می کند؛ guardrail در یک ورودی سفر می کند.

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

این ردیف دو انتقال موفق را نشان می دهد، یک سفر در رایل ورودی و یک درخت اسپان که منعکس کننده آنچه که SDK واقعی منتشر می کند.

## ازش استفاده کن

- **OpenAI Agents SDK**برای محصولات اول OpenAI.
- **Claude Agent SDK**(درسه 17) برای محصولات اول کلاود
- **LangGraph**(درسه 13) وقتی می خوای وضعیت صریح و رزومه پایدار داشته باشی.
- **Custom**وقتی به کنترل دقیق نیاز دارید (صوت، چند ارائه دهنده، انتشارات فدرال).

## -باده

`outputs/skill-agents-sdk-scaffold.md`یک برنامه SDK Agent با یک عامل دسته بندی، دستکاری، محافظهای ورودی/خروجی/ ابزار، ذخیره سازی جلسه و پردازنده ردیابی.

## تمرینات

1. اضافه کردن یک شمارشگر هپ هپ: رد پس از انتقال N. رفتار را ردیابی کنید.
2. اجرا`nest_handoff_history`به عنوان یک گزینه  پیام های قبلی را قبل از انتقال به یک خلاصه تبدیل کنید.
3. يه محافظ بازديد بازديد رو بنويسيد.
4. سیم`add_trace_processor`به یک ثبت کننده JSON. چه شکل را در هر مدت ارسال می کند؟
5. اسناد SDK رو بخونيد و اسطلب بازي خود رو به`openai-agents-python`چه چیزی رو اشتباه مدل کردی؟

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) ابتدایی ها، تحویل، رایل های نگهبانی، ردیابی
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) همتای خوشبو کلاود
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) چه وقت برای کمک های مالی دست پیدا کنیم
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) SDK استاندارد عوامل نقشه را به
