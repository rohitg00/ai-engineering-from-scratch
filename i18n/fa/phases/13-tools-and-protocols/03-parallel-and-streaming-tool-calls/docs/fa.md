# تماس های متوازی و پخش با ابزار

> سه بررسی هواشناسی مستقل به ترتیب سه سفر دور و عقب است. آنها را به طور موازی اجرا کنید و زمان کل به آهسته ترین تماس واحد سقوط می کند. هر ارائه دهنده مرزی اکنون چندین تماس ابزار را در یک نوبت ارسال می کند. پاداش واقعی است؛ لوله کشی ظریف است. این درس هر دو نیمه را انجام می دهد: فان-آउट موازی و جمع آوری مجدد استدلال جریان، با تاکید بر تله ارتباط هویت.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## اهداف یادگیری

- چرا توضیح بده`parallel_tool_calls: true`وجود دارد و چه زمانی باید آن را غیرفعال کند.
- به عنوان مثال، در حال انجام کار با یک دستگاه، یک دستگاه را به صورت یک دستگاه متصل کنید.
- بخش هاي ديگه رو جمع کن`arguments`رشته ها به JSON کامل بدون تجزیه و تحلیل زودرس
- یک معیار آب و هوا سه شهر اجرا کنید که تاخیر متناوب و موازی را نشان می دهد.

## مشکل

بدون تماس های موازی، یک مامور پاسخ می دهد "طقس در بنگلور، توکیو و زیوریخ چگونه است" این کار را انجام می دهد:

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

سه سفر برگشت و برگشت LLM که هر کدام هم زمان تعویض کار اجرا کننده را پرداخت می کنند. حدود چهار برابر زمان ایده آل دیوار ساعت.

با تماس های موازی:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

یک سفر دور و عقب LLM. زمان اجرا حداکثر سه مورد است، نه مجموع. معیار تولید در OpenAI، انسان شناسی و دوقلوها نشان می دهد 60 تا 70 درصد کاهش ساعت دیواری در بار کار فان.

قیمت مربوط به پیچیدگی ارتباط است. وقتی سه تماس کامل از راه خارج می شوند، نتایج شما باید مطابق باشد `tool_call_id`بنابراین مدل می تواند آنها را به خط. هنگامی که نتایج جریان، شما باید جمع آوری قطعات استدلال جزئی به JSON کامل قبل از اجرا. دوقلوها 3 اضافه شده است ID های منحصر به فرد به بخشی برای حل یک مشکل دنیای واقعی که دو تماس موازی به یک ابزار بودند غیر قابل تشخیص.

## مفهوم

### امکان موازی

- **OpenAI.** `parallel_tool_calls: true`بطور پیش فرض فعال شد`false`تا به زور سریال
- **Anthropic.**متوازي از طریق`disable_parallel_tool_use: false`(به طور پیش فرض در کلاود 3.5 و بالاتر) تنظیم شده`true`برای سریال
- **Gemini.**همیشه همگام میشه`tool_config.function_calling_config.mode = "AUTO"`بذار مدل تصمیم بگیره

غیر فعال کردن موازی زمانی که ابزارها وابستگی های ترتیب (`create_file`پس`write_file`), زمانی که خروجی یک تماس به ورودی دیگری اطلاع می دهد، یا زمانی که محدودی سرعت نمی تواند با فان-آउट مقابله کند.

### ارتباط ID

هر تماس که مدل پخش ميکنه يه شماره داره`id`هر نتیجه ای که میزبان می دهد باید همان شناسه را داشته باشد بدون این، نتایج مبهم است.

- **OpenAI.** `tool_call_id`در هر پیام نقش ابزار.
- **Anthropic.** `tool_use_id`در هر یک`tool_result`بلوک
- **Gemini.** `id`در هر یک`functionResponse`(جمیله های 3 و بالاتر؛ جمیله های 2 با نام مطابقت داشت که برای تماس های موازی با همان نام شکسته شد).

### همزمان تماس ها را اجرا کنید

میزبان اجرای هر تماس را بر روی رشته، coroutine یا کارکن از راه دور خود اجرا می کند. ساده ترین هنیز از یک استخر رشته استفاده می کند؛ تولید از asyncio با `asyncio.gather`یا هم زمان ساختار یافته. ترتیب تکمیل غیرقابل پیش بینی است  شناسه شناسه است.

یک خطا رایج: پاسخ با نتایج در ترتیب لیست تماس به جای ترتیب تکمیل. این معمولا کار می کند زیرا مدل فقط به `tool_call_id`، اما اگر یک نتیجه حذف یا دوبرابر شود، یک لیست پاسخ که از ترتیب نتایج به دست آمده جدا شده است، ایجاد شکاف را در سوابق دشوارتر می کند. ترجیح می دهد به ترتیب تکمیل با شناسه های صریح پاسخ داده شود.

### تماس های ابزار جریان

وقتی مدل جریان داره`arguments`سه تا قطعه قطعه برای سه تماس موازی در سیم به هم می رسند.

شکل توسط ارائه دهنده:

- **OpenAI.**هر قطعه از اون`choices[0].delta.tool_calls[i].function.arguments`(حرکت جزئي) قطعه ي حمل`index`شما به هر شاخص جمع می کنید، بخوانید`id`وقتی که برای اولین بار ظاهر می شود، و JSON را تجزیه و تحلیل کنید وقتی`finish_reason = "tool_calls"`. .
- **Anthropic.**رویدادهای جریان`message_start`، بعدش يه نفر`content_block_start`هر بلوکی با نوع`tool_use`(داشته از اسم، آدرس، ورودی خالی)`content_block_delta`حوادث انجام`input_json_delta`قطعات`content_block_stop`هر بلوک رو مي بندد
- **Gemini.** `streamFunctionCallArguments`(جمیله ها 3 تا بالا) قطعات را با یک `functionCallId`قبل از "جمیونی 3" پخش پخش یک تماس کامل در یک زمان باز می گشت.

### JSON جزئي و تله تجزیه و تحلیل اولیه

تو نميتوني تحليل کني`arguments`تا زمانی که کامل شود. جزئي JSON مانند `{"city": "Beng`دروازه درست سیگنال پایان تماس ارائه دهنده است: OpenAI `finish_reason = "tool_calls"`، انتروپيك`content_block_stop`، یا رویداد آخر جریان دوقلوها فقط بعد از آن تلاش کنید`json.loads`یک رویکرد قوی تر از یک تجزیه کننده JSON افزایشی استفاده می کند که حوادث را به عنوان ساختار کامل می کند؛ راهنمای جریان OpenAI این را برای UX که نشان دهنده "فکر" زنده را نشان می دهد توصیه می کند. شمارش برانس به عنوان یک آزمایش کاملیت غیرقابل اعتماد است (برانس ها در داخل رشته های نقل شده یا محتوای فرار شده موجب مثبت نادرست می شوند) و فقط باید به عنوان یک هوریستیک غیررسمی استفاده شود.

### تکمیل غیر سفارش

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

پاسخ میزبان باید هنوز هم آدی ها را ذکر کند:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

نظم در پاسخ برای درست بودن در OpenAI یا Anthropic مهم نیست. جمینی هر سفارش را تا زمانی که شناسه ها مطابقت داشته باشد قبول می کند.

### معیار: دنباله ای در مقابل موازی

. آبروس در`code/main.py`شبیه سازی سه اجرای با 400، 600 و 800 ms تاخیر. ترتیب آن را در 1800 ms کل اجرا می کند. موازی آن را در حداکثر 400، 600، 800) = 800 ms اجرا می کند. تفاوت ثابت است، متناسب نیست، بنابراین پس انداز با تعداد ابزار افزایش می یابد.

هشدار در دنیای واقعی: تماس های موازی API های پایین جریان را تحت فشار قرار می دهند. یک فان-آو 10 راه به یک سرویس محدود نرخ شکست می خورد. مرحله 13 · 17 فشار در سطح دروازه را پوشش می دهد؛ برای یک مرحله آینده، آزمایش معنوی دوباره برنامه ریزی شده است.

### پخش کننده فان-آو-وال ساعت

اگر مدل خود جریان باشد، می توانید به محض تکمیل حجت های یک تماس، به جای انتظار تمام تماس ها برای نهایی شدن، اجرا را شروع کنید. این یک بهینه سازی است که اسناد OpenAI اما نه همه SDK ها نشان می دهد. استفاده از این درس این کار را انجام می دهد: به محض اینکه جریان شبیه سازی یک شیء حجت کامل را به ارمغان می آورد، میزبان آن تماس را شروع می کند.

```figure
tp-parallel-fanout
```

## ازش استفاده کن

`code/main.py`دو نیمه دارد. اولین سه تماس هواشناسی شبیه سازی شده را به ترتیب و موازی با استفاده از`concurrent.futures.ThreadPoolExecutor`و زمان ساعت دیواری را چاپ می کند. نیمه دوم پاسخ پخش جعلی را تکرار می کند  قطعات `arguments`برای سه تماس موازی که در یک جریان به هم متصل شده اند  و آنها را به طور متقابل با `StreamAccumulator`نه مدرک تحصیلی، نه شبکه، فقط منطق جمع آوری مجدد

چه چیزی رو باید ببینیم:

- تایمر دنباله ای 1.8 ثانیه را می گیرد. تایمر موازی 0.8 ثانیه را می گیرد در همان تاخیر جعلی.
- این akkumulator با بفر کردن per-id و تجزیه و تحلیل فقط زمانی که JSON هر تماس کامل است، قطعات خارج از نظم را اداره می کند.
- اجراگر به محض اینکه حجت های یک شناسه نهایی شده است شروع می شود نه بعد از تمام جریان ها.

## -باده

این درس به ما کمک می کند`outputs/skill-parallel-call-safety-check.md`. در نظر گرفتن یک ثبت ابزار، حسابرسی مهارت هایی که ابزارها را به طور ایمن به همبستگی می دهند، که وابستگی های سفارش دارند و که محدودیت های نرخ پایین تر را به شدت از دست می دهند  بازگشت یک ثبت تجدید نظر با هر ابزار `parallel_safe`پرچم ها

## تمرینات

1. فرار کن`code/main.py`و تاخیر شبیه سازی شده را تغییر می دهد. تایید کنید که نسبت موازی به دنباله دار تقریباً`max/sum`(در جریان های واقعی به دلیل برنامه ریزی رشته، سریالیزاسیون و هزینه های بالای استفاده از رشته ها کمی از ایده آل منحرف می شوند).

2. با حذف بازدارنده و انتشار یک`cancelled`چه ارائه دهنده اي اين پرونده رو به طور صريحه ثبت ميکنه؟`content_block_stop`سیمانیک و OpenAI `finish_reason: "length"`رفتار

3. حاشیه رو با  عوض کن`asyncio.gather`. هر دو را بنچ مارک کنید. شما باید برندهای کوچک را در async ببینید به دلیل هزینه های پایین تر تغییر زمینه، اما فقط اگر اجرا کنندگان انجام واقعی I / O.

4. دو ابزار را انتخاب کنید که نباید موازی باشند (به عنوان مثال `create_file`پس`write_file`) اضافه کنید`ordering_dependency`این ماشین آلات حداقل برای برنامه ریزی وابسته به وابستگی است که در مرحله آینده مهندسی عامل رسمی می شود.

5. بخش تماس های عملکرد موازی OpenAI و Anthropic را بخوانید `disable_parallel_tool_use`دوکس. نوع ابزار واقعی را شناسایی کنید که در آن آنترپیک توصیه می شود موازی را غیرفعال کنید. (تغییر: جهش های بعدی در همان منبع).

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## خواندن بیشتر

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) رفتار پیش فرض و پرچم حذف
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) `disable_parallel_tool_use`و دسته بندی نتیجه
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) تماس های موازی مرتبط با ID از Gemini 3
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) جمع آوری مجدد استدلال های قطعی برای جریان های OpenAI
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) `content_block_delta`با`input_json_delta`
