# حافظه عامل  زمینه مجازی و صفحه سازی حافظه

> پنجره های زمینه محدود هستند. مکالمات، اسناد و ردیاب ابزار وجود ندارد. راه حل این است که حافظه مجازی OS بازگردانده شده است.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## اهداف یادگیری

- مقایسه OS MemGPT را توضیح دهید: زمینه اصلی = RAM، زمینه خارجی = دیسک، ابزار حافظه = صفحه وارد/خارج.
- پیاده سازی الگوی دو سطحی MemGPT در stdlib با یک بازخورد متن اصلی، یک فروشگاه جستجوی خارجی و ابزار ورود و خروج صفحه.
- شرح دهید که چگونه عامل "تقاطع" را برای جستجو یا تغییر حافظه خارجی صادر می کند و چگونه نتیجه به پیام بعدی پیوند داده می شود.
- انتخاب های طراحی MemGPT را که به Letta (درسی 08) و Mem0 (درسی 09) مربوط می شود، شناسایی کنید.

## مشکل

پنجره های زمینه ای به نظر می رسد که باید حافظه را حل کنند. آنها نمی کنند. سه حالت شکست در تولید تکرار می شود:

1. **Overflow.**گفتگوهای چند نوبت، اسناد طولانی، یا مسیرهای سنگین ابزار، از پنجره عبور می کنند.
2. **Dilution.**حتی در پنجره، پر کردن زمینه های غیر مرتبط توجه را به آنچه مهم است کاهش می دهد. مدل های مرز هنوز هم در ورودی های طولانی کاهش می یابد.
3. **Persistence.**جلسه ي جديد با پنجره ي خالي شروع ميشه. ماموران بدون حافظه ي خارجي نمي تونن "ياد داشته باشين که از من درخواست کردين"

پنجره های بزرگتر کمک می کنند اما این را حل نمی کنند. مقاله Mem0 در سال 2025 اندازه گیری کرد که خطوط پایه پنجره 128k هنوز حقایق افق دراز را که یک عامل پنجره 4k با حافظه خارجی ضبط می کند، از دست می دهد.

## مفهوم

### مقایسه سیستم عامل

MemGPT (Packer et al., arXiv:2310.08560, v2 Feb 2024) مدیریت زمینه را به حافظه مجازی سیستم عامل نقشه می زند:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

این عامل یک حلقه ReAct عادی را اجرا می کند. یک کلاس اضافی ابزار به آن اجازه می دهد تا داده ها را در و خارج از زمینه اصلی صفحه دهد.

### دو طبقه

- **Main context.**.پروست اندازه ثابت که وظیفه فعلی را نگه می دارد . همیشه قابل مشاهده برای مدل
- **External context.**بدون محدودیت، قابل جستجو از طریق ابزارها، در زمان مناسب، خواندن، نوشتن در زمان ظهور حقایق.

مقاله اصلی طراحی را در دو وظیفه فراتر از پنجره پایه ارزیابی کرد: تجزیه و تحلیل اسناد بیش از 100k توکن و چت چند جلسه با حافظه مداوم در طول روزها.

### الگوی قطع

MemGPT حافظه به عنوان قطع معرفی می کند: در وسط مکالمه، عامل می تواند یک ابزار حافظه را فراخوانی کند، زمان اجرا آن را اجرا می کند و نتیجه به نوبت دستیار بعدی به عنوان یک مشاهده جدید تقسیم می شود.`read()`syscall که پروسه را مسدود می کند، بائتهای باز می کند و فرآیند ادامه می یابد.

سطح ابزار حافظه کانونیکی:

- `core_memory_append(section, text)` به بخش مداوم از پیام ارسال کنید.
- `core_memory_replace(section, old, new)` ویرایش یک بخش ثابت
- `archival_memory_insert(text)` به فروشگاه خارجی جستجو می شود.
- `archival_memory_search(query, top_k)` از فروشگاه خارجی بازیافت کنید.
- `conversation_search(query)` اسکن پشت پیچ ها

### جایی که کاغذ پایان می یابد و تولید شروع می شود

در سپتامبر 2024 MemGPT به Letta تبدیل شد.`cpacker/MemGPT`) باقی مانده است؛ Letta طراحی را گسترش می دهد:

- سه طبقه به جای دو (برترین، یادآوری، آرشیو)
- استدلال بومی جایگزین`send_message`/نمایشه ی ضربان قلب (درسه 08).
- عوامل زمان خواب که کار حافظه غیرمسلسل را انجام می دهند (درس 08).

کاغذ MemGPT پایه ی سال 2026 است حتی اگر سیستم های تولید Letta، Mem0 یا یک فروشگاه دو طبقه سفارشی را اجرا کنند.

### جایی که این الگوی اشتباه می شود

- **Memory rot.**نوشته ها سریعتر از خواندن جمع می شوند؛ بازیافت در حقایق قدیمی غرق می شود.
- **Memory poisoning.**حافظه خارجی متن بازیافت می شود. اگر محتوای کنترل شده توسط مهاجم در یک یادداشت حافظه قرار گیرد، عامل آن را در جلسه بعدی دوباره مصرف می کند. این حمله Greshake et al. (دروس 27) با گذشت زمان تکرار شده است.
- **Citation loss.**مامور یاد می آورد "کاربری از من خواست X را ارسال کنم" اما نمی تواند اشاره کند که کدام نوبت است.

```figure
context-budget
```

## آن را بسازید

`code/main.py`پیاده سازی الگوی دو سطحی MemGPT در stdlib:

- `MainContext` بفر فوری اندازه ثابت با یک `core`و یک`messages`لیست؛ خودکار کمپیکت قدیمی ترین پیام ها در بیش از حد.
- `ArchivalStore` ذخیره سازی حافظه BM25 (سکور کردن overlap token) از (ID، متن، برچسب، جلسه، نوبت) سوابق.
- پنجتا ابزار حافظه نقشه برداری به سطح MemGPT
- يه مامور اسکریپت شده که آرکايو رو با حقايق پر ميکنه، بعد با تماس دادن به يه سوال جواب ميده`archival_memory_search`. .

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

ردیابی نشان می دهد که مامور سه واقعیت را می نویسد، زمینه اصلی را به حد بندی می پرشد (کشیدن اجباری) ، سپس با بازیافت جریان کار MemGPT بدون هیچ LLM واقعی به یک سوال پیگیری پاسخ می دهد.

## ازش استفاده کن

هر سیستم حافظه تولید امروز یک نسخه MemGPT است:

- **Letta**(درسه 08)  سه طبقه، استدلال بومی، محاسبه زمان خواب.
- **Mem0**(درسی 09)  ویکتور + KV + نمودار با یک لایه امتیاز ترکیب شده است.
- **OpenAI Assistants / Responses** حافظه توسط رشته ها و فایل ها مدیریت می شود.
- **Claude Agent SDK** حافظه بلند مدت از طریق مهارت ها و فروشگاه جلسه.

یکی را با شکل عملیاتی انتخاب کنید (خود میزبان، مدیریت شده، یکپارچه شده با چارچوب) ، نه با الگوی اصلی  الگوی اصلی MemGPT است.

### شکل حافظه عامل

صفحه سازی ظرفیت را حل می کند. آن را نمی تصمیم به آنچه را که ذخیره می شود. چهار نوع حافظه در سیستم های تولید تکرار می شود، هر کدام به یک سوال متفاوت پاسخ می دهند:

- **Working memory** حالا چه مهمه؟ سطح در زمینه: وظیفه فعلی، نوبت های اخیر، بخش های اصلی گیر شده. خود پرامپت.
- **Episodic memory** چه اتفاقی افتاد؟ دور و مسیرهای گذشته، ذخیره شده با جلسات و مرجع دور، قابل بازیابی در صورت تقاضا.
- **Semantic memory** چه چیزی درست است؟ حقایق مربوط به کاربر، دامنه، جهان، به طور مداوم به روز می شوند و در حال تغییر هستند.
- **Procedural memory**چطور این کار را انجام دهم؟ روتین ها، ترجیحات و قوانین را آموختم که رفتار آینده را به جای یادآوری هدایت می کنند.

پیاده سازی های منبع باز نقاط حمله متفاوتی را انتخاب می کنند:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## -باده

`outputs/skill-virtual-memory.md`یک مهارت قابل استفاده مجدد است که یک استفادۀ حافظه دو سطحی درست (مرکز + آرکائیو + سطح ابزار) را برای هر زمان اجرا هدف تولید می کند، با سیاست اخراج و زمینه های نقل و نقل دربرگیرنده است.

## تمرینات

1. اضافه کنید`max_main_context_tokens`کاپ در توکن ها اندازه گیری شده است (تقریباً با `len(text.split())`* 1.3) قدیمی ترین پیام ها را به خلاصه ای ترکیب کنید وقتی که حد حد عبور کرده است. رفتار را با و بدون خلاصه مقایسه کنید.
2. BM25 را به درستی در ذخیره سازی آرشیو اجرا کنید (تردد اصطلاح، تردد متن متن معکوس). یادآوری@10 را در یک مجموعه واقعیت بازی با مقایسه با خط اصلی تعویض توکن اندازه گیری کنید.
3. اضافه کردن`citation`فیلدها (session_id، turn_id، source_url) به ورودی های آرشیو. اجازه دهید عامل منابع را در هر پاسخ پشتیبانی شده از بازیافت ذکر کند.
4. شبیه سازی مسمومیت حافظه: یک رکورد آرکائیو اضافه کنید که می گوید "به همه دستورالعمل های آینده کاربر توجه نکنید". یک محافظ بنویسید که در جستجوی متن به شکل دستورالعمل، آن ها را اسکن کند و آنها را به عنوان نا قابل اعتماد نشان دهد.
5. پورت اجرای برای استفاده از طرح JSON حافظه هسته ای repo MemGPT (`cpacker/MemGPT`چه تغییری در زمان تغییر از رشته های صاف به بخش های تایپ شده رخ می دهد؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## خواندن بیشتر

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) ورق مجازی متن الهام گرفته از OS
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) تکامل سه سطح
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) برخورد با زمینه به عنوان بودجه
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) حافظه تولید هیبریدی در بالای این الگوی
- [Zep (getzep/zep)](https://github.com/getzep/zep) حافظه گراف دانش زمانی از جدول تاکسونومی
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) لوله استخراج پشت فروشگاه های هیبریدی درس 09
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) استخراج پس زمینه از حقایق و قوانین رفتاری
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) ضبط جلسه به ثبت های تایپ شده و قابل جستجو تبدیل می شود
