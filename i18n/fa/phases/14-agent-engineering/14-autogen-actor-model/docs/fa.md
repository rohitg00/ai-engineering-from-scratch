# مدل بازیگر برای عوامل  پیام های غیر هماهنگ و زمان اجرا تایپ شده

> عوامل به عنوان بازیگران: تبادل پیام های غیر هماهنگ، کنترل کننده های مبتنی بر رویداد، انزوا خطایی، همزمان طبیعی. AutoGen v0.4 (مرکز تحقیقاتی مایکروسافت، ژانویه 2025) ارتقا طراحی مجدد در مورد این مدل را انجام داد. چارچوب اکنون در حالت نگهداری است، با Microsoft Agent Framework (پیش نمایش عمومی اکتبر 2025) به عنوان جانشین تولید آن.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## اهداف یادگیری

- مدل بازیگر را توصیف کنید: عوامل به عنوان بازیگران، پیام ها به عنوان تنها IPC، تعزیر شکست در هر بازیگر.
- نام سه لایه API AutoGen v0.4  Core، AgentChat، Extensions  و هر کدام برای چه هستند.
- توضیح دهید که چرا جدا کردن پیام از کنترل باعث جداسازی خطا و همزمان بودن طبیعی می شود.
- اجرای یک زمان اجرا بازیگر stdlib در پایتون و پورت یک جریان بررسی کد دو عامل به آن.

## مشکل

اکثر چارچوب های عامل هم زمان هستند: یک عامل تولید می کند، یک عامل مصرف می کند، در یک استیک تماس. شکست ها استیک را سقوط می کند. مواقعی فعال است. توزیع نیاز به نوشتن مجدد دارد.

پاسخ AutoGen v0.4: مدل بازیگر. هر عامل بازیگر است که دارای یک جعبه ورودی خصوصی است. پیام ها تنها تعامل هستند. زمان اجرا تحویل را از مدیریت جدا می کند. شکست ها به یک بازیگر جدا می شوند. رقابت بومی است. توزیع فقط حمل و نقل متفاوت است.

## مفهوم

### بازیگران

یک بازیگر باید:

- یک دولت خصوصی (که هرگز مستقیماً از خارج لمس نشده است).
- یک صندوق ورودی (صفیر پیام)
- يه کارساز:`receive(message) -> effects`که اثرش رو می تونن جواب بده، به بازیگر دیگه بفرست، بازیگر جدید رو ایجاد کنه، حالت تازه ای رو انجام بده، خود رو متوقف کن

دو تا بازیگر نمیتونن حافظه رو به هم بزارن فقط میتونن پیام بفرستن

### سه لایه API

AutoGen v0.4 سطحش رو به سه قسمت ميفرقه:

1. **Core.**چارچوب بازیگران سطح پایین. `AgentRuntime`،`Agent`،`Message`،`Topic`. تبادل پيام هاي همگامي ، با توجه به اتفاقات
2. **AgentChat.**API سطح بالا مبتنی بر وظایف (بدل کنسرتابلاژنت v0.2) `AssistantAgent`،`UserProxyAgent`،`RoundRobinGroupChat`،`SelectorGroupChat`. .
3. **Extensions.**ادغام ها  OpenAI، انسان شناسی، Azure، ابزار، حافظه.

### چرا جدا کردن مهم است

در مدل v0.2، تماس گرفتن`agent_a.chat(agent_b)`. به طور همزمان به طور همزمان به طور همزمان به طور همزمان به عنوان یک عامل باز می گردد`send(agent_b, msg)`. پيام رو توي صندوق ورودی اگزنت_ب ميذاره و باز مياد . زمان اجرا بعد از اين رسيده

- **Fault isolation.**عامل B سقوط نمی کند عامل A  زمان اجرا شکست در دستیار B را می گیرد و تصمیم می گیرد چه کاری را انجام دهد (لاگ، دوباره تلاش، نامه مرده).
- **Natural concurrency.**پیام های زیادی در پرواز در یک زمان؛ بازیگران جعبه ی دریافتی خود را همزمان پردازش می کنند.
- **Distribution-ready.**صندوق ورودی + حمل همان انتزاع است، چه بازیگر در حال فرآیند باشد یا در میزبان دیگری.

### توپولوژی ها

- **RoundRobinGroupChat.**ماموران به دور و در دور دور می گردند.
- **SelectorGroupChat.**یک نماینده انتخاب کننده بر اساس زمینه مکالمه انتخاب می کند که چه کسی بعدی می رود.
- **Magentic-One.**يه تیم مرجعي چند مامور براي مرور وب، اجرا کدها، اداره پرونده ها

### قابل مشاهده

پشتیبانی از OpenTelemetry ساخته شده است. هر پیام یک زمان ارسال می کند. تماس های ابزار حمل می کنند `gen_ai.*`ویژگی های مطابق کنوانسیون های معنوی OTel GenAI 2026 (درسی 23)

### وضعیت: حالت نگهداری

اوایل سال 2026: AutoGen v0.7.x برای تحقیق و نمونه سازی پایدار است. مایکروسافت توسعه فعال را به Microsoft Agent Framework، جانشین تولید (پیش نمایش عمومی 1 اکتبر 2025؛ 1.0 GA برای پایان Q1 2026 هدف قرار داده شده است) تغییر داده است. الگوهای AutoGen به طور تمیز به جلو حرکت می کنند.

```figure
actor-mailbox
```

## آن را بسازید

`code/main.py`اجرای زمان اجرا بازیگر stdlib:

- `Message` بار فایدایی تایپ شده با `sender`،`recipient`،`topic`،`body`. .
- `Actor` تجريبه با `receive(message, runtime)`. .
- `Runtime` حلقۀ رویداد با یک صف مشترک، تحویل، تعزیر شکست.
- يه نمایش دو بازیگر:`ReviewerAgent`کد بررسی ها`ChecklistAgent`یک لیست چک می کند؛ تا اتفاق رائے، پیام ها را می تبادله کنند.

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

ردیابی نشان می دهد ارسال پیام، شکست شبیه سازی شده در یک بازیگر که دیگر را سقوط نمی کند، و همگامگی در یک حکم مشترک.

## ازش استفاده کن

- **AutoGen v0.4/v0.7**(صلاح)  برای تحقیق، نمونه سازی، الگوهای چند عامل پایدار.
- **Microsoft Agent Framework** جانشین تولید (پیش نمایش عمومی اکتبر 2025) ؛ ایده های مشابه بازیگر-نموذج در یک API تازه شده.
- **LangGraph swarm topology**(درسی 13)  الگوی مشابه از طریق اشتراک ابزار.
- **Custom actor runtime** وقتی به حمل و نقل خاص نیاز دارید (NATS، RabbitMQ، gRPC).

## -باده

`outputs/skill-actor-runtime.md`تولید یک زمان اجرا بازیگر حداقل به همراه یک قالب تیم (RoundRobin یا Selector) برای یک کار چند عامل داده شده.

## تمرینات

1. یک ردیف حرف مرده اضافه کنید: وقتی یک دستیار بالا می آید، پیام شکست را برای بازرسی انسانی پارک کنید. DLQ به بازی شما چقدر ضربه می زند؟
2. اجرا`SelectorGroupChat`: یک بازیگر انتخاب کننده انتخاب می کند که پیام بعدی را بر اساس وضعیت مکالمه پردازش می کند.
3. اضافه کردن حمل و نقل توزیع شده: صف در فرآیند را برای یک سرور JSON-over-HTTP عوض کنید تا بازیگران بتوانند در فرآیندهای جداگانه اجرا شوند.
4. به هر پیام یک مدت OTel ارسال کنید (یا یک زمان بدون عملیات).`gen_ai.agent.name`،`gen_ai.operation.name`در درس 23
5. پست معماری AutoGen v0.4 رو بخونید.`autogen_core`API، تو چه چيزي رو که در توليد مهمه فراموش کردي؟

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) پست طراحی مجدد
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) جایگزین شکل نمودار
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) دامنه های خودکشی که توسط AutoGen به طور پیش فرض منتشر می شود
