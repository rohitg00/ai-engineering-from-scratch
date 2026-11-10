# قابلیت اطمینان، لغو و کنترل جریان MCP

> یک شناسه درخواست ارتباط یک پیام دارد. این هیچ تأثیری جانبی را ایمن نمی کند، یک کارگر را متوقف نمی کند، یا جریان را از مصرف کننده آهسته محافظت نمی کند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 09 and 13
**Time:** ~120 minutes

## اهداف یادگیری

- سیگنال لغو صحیح برای stdio و Streamable HTTP را اجرا کنید.
- بدون ارسال پیام بعد از لغو مسابقه های تکمیل و لغو را حل کنید.
- حذف درخواست های جداگانه از دوامدار`tasks/cancel`معنوی
- تصمیمات دوباره را از طریق عوارض جانبی و کلید های صریح بی قدرت سازی بسازید.
- صف های پیشرفت را محدود کنید و در عین حال پاسخ های نهایی را حفظ کنید.
- از طریق دوباره اتصال، بازسازي و بازپرداخت عصبی جریان ها را بازمی گردانیم.

## مشکل

راه خوشبختی گران ترین خطاهای سیستم های توزیع شده را پنهان می کند.

یک مشتری به یک ابزار می گوید. سرور کار را شروع می کند. پیشرفت می آید. یک پروکسی جریان را بفر می کند. مشتری به زمان پایان خود می رسد و از اتصال می افتد. سرور یک میلی ثانیه بعد کار را تمام می کند. مشتری دوباره با یک شناسه JSON-RPC جدید تلاش می کند. جهش دو بار اجرا می شود.

هر جزءي که در محله رفتار ميکنه، سيستم در سطح عالمي شکست خورده

MCP رفتار پیام و حمل را تعریف می کند، اما برنامه شما هنوز مالک:

- بودجه های زمانی؛
- آزادی کسب و کار؛
- صف های محدود
- طبقه بندی مجدد آزمایش
- وضعیت کار پایدار؛
- دوباره ارتباط برقرار کردن و تغییر سیاست

این درس این تصمیمات را به یک شبیه ساز تعیین کننده تبدیل می کند.
بدون خواب، سوکت ها و یا شکست تصادفی
یک تست رشته همگام دو مشتری دفترچه را مجبور به رقابت می کند
برای همان کلید آزادیت

## درخواست لغو خاص حمل و نقل است

هدف در هر حمل و نقل یکسان است: مشتری دیگر به نتیجه در پرواز نیاز ندارد. سیگنال سیم متفاوت است.

### استودیو

stdio از یک کانال دو جهت مشترک استفاده می کند. یک مشتری یک اطلاعیه را ارسال می کند:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 41,
    "reason": "User closed the operation"
  }
}
```

اطلاعیه آتش و فراموشی است. سرور هیچ پاسخ JSON-RPC را به آن ارسال نمی کند.

سرور باید کار خود را متوقف کند، منابع را آزاد کند و از ارسال پاسخ به درخواست لغو شده اجتناب کند. ممکن است لغو را نادیده بگیرد وقتی درخواست ناشناخته، قبلاً تکمیل شده است یا نمی تواند به طور ایمن متوقف شود.

اطلاعات منسوخی که اشتباه شکل گرفته، ناشناخته و قبلاً تکمیل شده است نادیده گرفته می شود.

### HTTP قابل پخش

HTTP Streamable مدرن به هر درخواست پاسخ HTTP یا جریان پاسخ SSE خود را می دهد. مشتری با بسته شدن جریان پاسخ آن درخواست را لغو می کند.

ارسال نکن`notifications/cancelled`برای یک درخواست HTTP معمولی. بسته شدن جریان سیگنال لغو است.

وقتی سرور قطع ارتباط را مشاهده کند، باید کار خود را متوقف کند و نباید پیام های بیشتری برای این درخواست ارسال کند.

### لغو ارسال شده توسط سرور محدود است

سرور استفاده نمی کند`notifications/cancelled`در استودیو، لغو ارسال شده توسط سرور برای پایان دادن به یک تماس اختصاص داده می شود.`subscriptions/listen`اين راه رو از رد درخواست هاي معمول مشتری جدا نگه دار

## لغو کردن یک نژاد است

دو دستور حوادث هم معتبر هستند

### لغو برنده شد

```text
request starts
client sends cancellation signal
server marks request cancelled
worker reaches completion
server suppresses the response
```

### تکمیل برنده شده

```text
request starts
worker commits the result
server sends the response
cancellation arrives late
server ignores the late notification
```

مشتری باید پاسخ دیرینی را برای یک درخواست که قبلاً رها کرده است نادیده بگیرد. تاخیر شبکه به این معنی است که هیچ یک از طرف ها نمی توانند اثبات کنند که کدام اتفاق دیگری اولین دیده شده است.

```figure
mcp-reliability-race
```

درس اینه`RequestCoordinator`يه حالت پايانگاهي رو نگه ميده`complete()`پس از لغو هیچ پاسخی نمی دهد. لغو دیر نمی تواند یک رکورد کامل را تغییر دهد.

## زمان بندی ها به دو ساعت نیاز دارند

یک تایمر غیرفعالیت کافی نیست.

دو حد استفاده کن:

1. **Idle timeout.**تا چه مدت درخواست ممکن است هیچ فعالیت مفید را ایجاد نکند.
2. **Maximum timeout.**بودجه کامل ساعت دیواری از زمان درخواست شروع

پیشرفت ممکن است ساعت بیکار را بازنویسی کند.

```text
start: 0 ms
progress: 400 ms
progress: 800 ms
progress: 1200 ms
idle timeout: 500 ms
maximum timeout: 2000 ms
```

در 1500 ms، درخواست هنوز فعال است زیرا آخرین پیشرفت تنها 300 ms است. در 2000 ms، حداکثر مهلت آن را لغو می کند حتی اگر یک رویداد پیشرفت دیگر در 1999 ms آمد.

پیشرفت اختیاری است. یک سرور می تواند یک توکن پیشرفت را بپذیرد و هیچ بروزرسانی را ارسال نکند. هرگز حضور یک توکن را به یک زمان بندی بی نهایت تبدیل نکنید.

ارزش های پیشرفت MCP باید افزایش یابد. اطلاعیه ها پس از تکمیل یا لغو متوقف می شوند. پیشرفت حد نرخ به طوری که یک کارگر سریع نمی تواند حمل و نقل را تحت طوفان قرار دهد.

## درخواست لغو نمی شود`tasks/cancel`

این مکانیسم ها زندگی های مختلف را حل می کنند.

| Mechanism | Target | Signal | What success means |
|-----------|--------|--------|--------------------|
| Request cancellation on stdio | One in-flight RPC | `notifications/cancelled` | Client abandoned the request; server should stop if practical |
| Request cancellation on HTTP | One in-flight response stream | Close the stream | Client abandoned the request; server should stop if practical |
| `tasks/cancel` | One durable Task | Ordinary MCP request | Server acknowledged cancellation intent |

موفق`tasks/cancel`نتیجه ثابت نمی کند که کارکن متوقف شده است.`working`تا زمانی که یک نقطه بازرسی کارگر پرچم را مشاهده کند.

هنگام بسته شدن اتصال HTTP، حالت کار ماندگار را حذف نکنید. دلیل ایجاد یک کار این است که چرخه عمر آن یک درخواست و یک اتصال را از دست می دهد.

## یک شناسه جدید JSON-RPC غیر قابل استفاده نیست

JSON-RPC id ها درخواست ها و پاسخ ها را مرتبط می کنند. آنها یک عملیات تجاری را شناسایی نمی کنند.

فرض کنید یک مشتری یک بار با یک آدی شکایت می کند`41`، پاسخ رو از دست ميده و دوباره با id تلاش ميکنه`42`سرور دو پيغام مختلف رو مي بينه بدون يك کلید برنامه، نمي تونه بدونش که يه کدوم از آنها يه کاشو هستن

کلید "ایدمپوتنس" قصد کسب و کار را مشخص می کند:

```json
{
  "name": "charge_account",
  "arguments": {
    "account": "acct-7",
    "cents": 1200,
    "idempotencyKey": "checkout-7"
  }
}
```

سرورها ذخیره می کنند:

- کلید؛
- یک اثر انگشت از استدلال های عملیاتی؛
- نتیجه تعهد شده.

کلید و استدلال های مشابه نتیجه ذخیره شده را باز می آورند. کلید مشابه با استدلال های مختلف رد می شود. این مانع از استفاده مجدد کلید تصادفی از تغییر یک عملیات تجاری متفاوت می شود.

### مرز دفترچه باید اتمی و پایدار باشد

اين دنباله امن نيست:

```text
check key
run mutation
store result
```

دو کارگر هم می تونن یک کلید گمشده رو مشاهده کنن و هم می تونن جهش رو اجرا کنن
بعد از اثر اما قبل از اینکه فروشگاه باعث شود که در دوباره امتحانش هم این دوجهایی ایجاد شود.

دروس با استفاده از یک دفترچه SQLite با پشتیبانی از فایل.`BEGIN IMMEDIATE`سریالیز می کند
چک کلید، اثر تجاری شبیه سازی شده، شمارش اجرا و نتیجه ذخیره شده در
دو اتصال مستقل با يك کلید
بنابراین یک نتیجه متعهد و یک اجرای را مشاهده کنید.
دفترچه اون پرونده رو نگه داره

هر مقدار بازگشت از JSON ذخیره شده بازسازی می شود. تماس گیرنده هرگز دریافت نمی کند
شی متحول در دفترچه نگهداری می شود، بنابراین تغییر یک لغت بازگردانده نمی تواند
نتایج بازيابي بعد خراب شده

اثر کسب و کار شبیه ساز، شمارش دریافت و اجرا در داخل
یک پرداخت واقعی، انتشار، یا تماس API خارجی
تولید به یک جدول محلی به سادگی با نوشتن اتم ساخته نمی شود.
یک معامله پایگاه داده مشترک، یک جعبه ورودی معاملات یا یک ارائه دهنده پیشرو
که همان کلید آزادتی را اعمال می کند. یک قفل فرآیند به تنهایی محافظت نمی کند
چند تا نسخه یا زنده ماندن از یک بازخورد.

### ماتریس بازتجربه

قبل از اجرای آن ها، دوباره به طبقه بندی بپردازید.

| Class | Example | Retry rule |
|------|---------|------------|
| Safe | Deterministic read with no side effect | Retry with a new JSON-RPC id after the failure boundary is understood |
| Conditional | Mutation with a durable idempotency key | Retry with the same key and identical arguments |
| Unsafe | Mutation without business deduplication | Do not retry automatically; reconcile first |

تشریحات ابزار مانند `readOnlyHint`و`idempotentHint`قرارداد برنامه و اجرای سرور تصمیم گیری در مورد ایمنی دوباره انجام می شود.

## فشار منفی بخشی از درست است

یک تولید کننده SSE می تواند پیشرفت را سریعتر از یک مشتری، پروکسی یا شبکه مصرف کند. یک صف بیحد باعث تبدیل کندگی به خستگی حافظه می شود.

از صف محدود استفاده کن و مشخص کن که چه چیزی می تونه از دست بشه

پیشرفت قابل تعویض است. یک مقدار پیشرفت بعدی برای همان توکن از یک مقدار قبلی جایگزین می شود. پاسخ نهایی JSON-RPC قابل تعویض نیست.

بازدارنده درس این سیاست را اعمال می کند:

1. به همین خاطر پیشرفت های مجاور را همگام کنید.
2. وقتي ظرفیتش به دست مياد پيشرفت قدیمی رو رها کن
3. به عنوان نیاز به اصلاح معتبر جریان را نشان دهید.
4. جواب نهایی رو نگه دار
5. رد کردن حالت ای که حفظ پاسخ نهایی به کاهش پاسخ نهایی دیگر نیاز دارد.

اين ضرر محدود و معاوضه صريفي است.

### بفرینگ نماینده

یک سرور می تواند به درستی جریان دهد در حالی که یک پراکسی معکوس رویدادها را در یک پوشه نگه می دارد.

برای پاسخ SSE ارسال کنید:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

مشخصات HTTP Streamable 2026 توصیه می کند `X-Accel-Buffering: no`پس پراکسي هاي سازگار فوراً حوادث رو ارسال ميکنن

برای جریان های طولانی مدت آرام، به طور دوره ای یک نظر SSE را ارسال کنید:

```text
:
```

مشتری خطوط نظرات را نادیده می گیرد، واسطه ها ترافیک را می بینند و احتمال بسته شدن یک اتصال بیکار را کمتر می کنند.

Keeppalive پیشرفت نیست. فقط به خاطر اینکه یک نظر حمل و نقل به شما رسید، زمان توقف معنوی یک عملیات را تنظیم نکنید.

## دوباره ارتباط برقرار کردن به معنی دوباره

HTTP جدید Streamable از SSE های بازخوردنی پشتیبانی نمی کند`Last-Event-ID`. .

بعد از یک`subscriptions/listen`قطرات جریان:

1. یک درخواست گوش دادن جدید را با یک شناسه JSON-RPC جدید باز کنید.
2. فیلتر اشتراک مورد نظر را بازگرداندن.
3. ابزار، منابع، پیام ها یا وظایف تحت تاثیر قرار گرفته را از روش های معتبر بازمی گردانیم.
4. حالت درخواست را با شناسه های پایدار تکثیر کنید.
5. فقط بخاطر اینکه واکنشش از دست رفته، یک جهش غیرمحفوظ را تکرار نکنید.

نقشه بازیافت نمونه به طور صریح مشخص شده است`sendLastEventId`به دروغ و فهرست منابع برای تغییر.

### جلوگیری از اتصال مجدد گله

اگر 10 هزار مشتری در یک ثانیه دوباره ارتباط برقرار کنند، سرور بازیابی دوباره شکست می خورد.

با استفاده از بازتاب معروضی با jitter و a cap، درس jitter تعیین کننده را از ID مشتری و تعداد تلاش محاسبه می کند تا آزمایشات قابل بازیافت باشند:

```text
attempt 0: up to 250 ms
attempt 1: up to 500 ms
attempt 2: up to 1000 ms
...
cap: 8000 ms
```

تولید می تواند از رمزنگاری ایمن یا تصادفی زمان اجرا استفاده کند. غیر متغیر توزیع است، نه یک فرمول خاص.

## آن را بسازید

`code/main.py`پنج قطعه کوچک قابلیت اطمینان را ایجاد می کند.

### `RequestCoordinator`

- شروع درخواست در پرواز با مهلت های بیکار و حداکثر؛
- اطلاعات پیشرفت یکنواخت را صادر می کند؛
- سیگنال حذف stdio یا HTTP را درست تولید می کند.
- از اطلاعیه های باطل لغو استفاده نمی کند؛
- به طور صریح، مسابقات لغو و تکمیل پایانی را مشخص می کند.
- از لغو ارسال شده توسط سرور برای اشتراک های استودیو حجز می کند.

### `MutationLedger`

- اثبات اینکه دو ID JSON-RPC بدون کلید تجاری دو بار اجرا می شوند؛
- استفاده از یک معامله SQLite با پشتیبانی از فایل برای چک کلید، اثر شبیه سازی،
  شمارش اجرای و تعهد به نتیجه
- تکرار تکرار استدلال های مشابه تحت یک کلید غیرمستقل در سراسر مستقل
  ارتباطات دفترچه؛
- رد یک کلید دوباره استفاده شده با استدلال های مختلف؛
- کپي دفاعي باز مي کنه و سوابق اشتباه رو حفظ ميکنه

### `DurableTaskService`

- درخواست لغو را تایید می کند؛
- وظیفه رو حفظ مي کنه`working`تا یک نقطه بازرسی کارگران؛
- نشان می دهد که چرا تایید وضعیت نهایی نیست.

### `BoundedSseBuffer`

- در حال جمع شدن یا کاهش پیشرفت تحت فشار؛
- ثبت اینکه نیاز به بازنویسی معتبر است؛
- هرگز پاسخ نهایی را رها نمی کند.

### کمک کننده های بهبود

- بازگردانیدن سرنخ های SSE امن و نگهدارنده؛
- ایجاد یک برنامه اتصال مجدد و بازتولید؛
- بازمکنین بازمکنین با تعدد تعیین کننده و ارتفاعی

## ازش استفاده کن

از ریشه مخزن:

```bash
cd phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

نمایشگر هر دو طرف مسابقه مرکزی را اجرا می کند، یک معامله را اجرا می کند
جهش های غیر تکراری در یک دفترچه موقت با پرونده پشتیبان، بارگذاری یک محدودیتی
پیشرفت بفر، و نشان می دهد یک کار پایدار حرکت از تایید لغو
به لغو مشاهده شده توسط کارگر

## آزمایشگاه تعاملی

چهار تا دستورات حوادث رو بدون اضافه کردن خواب انجام بده

1. درخواست شروع`A`، آن را لغو کنید ، سپس تماس بگیرید`complete()`. .
2. درخواست شروع`B`، تکمیلش کن بعدش لغوش رو تحویل بده
3. درخواست شروع`C`، پیشرفت رو قبل از هر زماني که تموم شده ، پخش کن بعد از اون زماني که تموم شده رو رد کن
4. درخواست شروع`D`از طریق HTTP قابل پخش و جریان پاسخ آن را ببندید.

ثبت برای هر سناریو:

- وضعیت درخواست ترمینل
- آیا پاسخ نهایی وجود دارد؛
- سیگنال لغو که روی سیم قرار داده شده است؛
- که مشتری باید از آن غافل باشه

پس عوضش کن`D`عمل مشابهه، اما سيگنال لغو بايد عوض بشه

## آزمایشگاه تمرین

اضافه کنید`reserve_inventory`جهش به `MutationLedger`. .

الزامات:

1. کلید SKU، مقدار، مستاجر و نام عملیات را می پیوندد.
2. یک تلاش مجدد با همان کلید و استدلال ها اولین رزرو را باز می گرداند.
3. یک تلاش مجدد با تغییر مقدار بدون تحفظات دیگر شکست می خورد.
4. اعدامي که مرتکب شده اما پاسخش رو از دست داده ميتونه با کلید حل بشه
5. نتیجه هیچ اطلاعات مخفی یا پرداختی ثبت نمی کند.
6. بازتولید خودکار غیرفعال می شود وقتی مشتری کلید را ارائه نکرده است.
7. یک تخفیف تخفیف شبیه سازی شده را اضافه کنید و قبل از تصمیم گیری در مورد بعدی، پرونده موجودی را تغییر دهید.
8. دو اتصال به دفترچه را در یک مانع شروع کنید و همان کلید را ارسال کنید
   هم زماني که يک رزرو انجام شده است
9. اولین شی بازگردانده شده را تغییر دهید. کلید را دوباره بازی کنید و ثابت کنید که
   نتیجه ذخیره شده تغییر نکرده
10. پرونده دفترچه را ببندید و باز کنید، سپس رزرو را با کلید هماهنگ کنید.

لابراتوار را صادقانه نگه دارید: اگر موجود در سرویس دیگری زندگی می کند، توضیح دهید که آیا
این سرویس همان کلید آزادتی را می پذیرد یا یک جعبه ورودی معاملات را می پذیرد
پل ها، تعهد محلی به اثر دور افتاده

## آثار هنری ارسال شده

`outputs/skill-mcp-reliability-reviewer.md`یک مهارت بررسی قابلیت اطمینان مسطح است. به آن یک عملیات MCP، حمل و نقل، سیاست زمان بندی، رفتار بازجویی، سیاست صف و برنامه بازیابی بدهید. این یک جدول مسابقه، طبقه بندی بازجویی، مرز بی اختیار، چک کنترل جریان و فکسورهای شکست را باز می گرداند.

## بررسی کنید

درس کامل می شود وقتی این اظهارات درست است:

- استودیو لغو ارسال می کنه`notifications/cancelled`و هيچ پاسخي به اين سوال نمي دهد
- حذف HTTP قابل پخش جریان درخواست را می کند و هیچ پیام لغو را ارسال نمی کند.
- رد قبل از تکمیل پاسخ نهایی را سرکوب می کند.
- کامل قبل از لغو پاسخ را حفظ می کند و لغو دیر را نادیده می گیرد.
- پیشرفت می تواند زمان تخفیف را تنظیم کند اما هرگز حداکثر زمان تخفیف را تنظیم نکند.
- یک شناسه جدید JSON-RPC به تنهایی دوباره جهش را اجرا می کند.
- یک کلید idempotency و استدلال های یکسان یک بار در یک همزمان اجرا می شوند
  دو مسابقه ارتباط
- یک رکورد متعهد زنده می ماند باز شود و باز کردن باز نسخه دفاعی را باز می کند.
- تغییر یک نتیجه بازگردانده نمی تواند نتیجه ذخیره شده را تغییر دهد.
- بازخورد محدود در ظرفیتی باقی می ماند و پاسخ نهایی را حفظ می کند.
- Reconnect از درخواست جدید استفاده می کند، ارسال نمی کند`Last-Event-ID`، و حالت تحت تاثیر قرار می دهد
- `tasks/cancel`تایید وظیفه را غیر نهایی می گذارد تا زمانی که کارگر آن را رعایت کند.

## روش های شکست تولید

| Failure | Observable symptom | Correct response |
|---------|--------------------|------------------|
| HTTP client POSTs cancellation notification | Server and client disagree about request lifetime | Close the request's SSE response stream |
| Server responds after accepted cancellation | Client receives an unusable late result | Stop work and suppress further messages when cancellation wins |
| Progress resets every deadline | Hung work survives forever | Keep a separate absolute maximum timeout |
| New RPC id treated as deduplication | Charge, deployment, or deletion runs twice | Add a durable application idempotency key |
| Key check and effect are separate | Concurrent workers both observe a missing key | Commit key claim, effect record, and result atomically |
| In-memory ledger used across replicas | Restart or another worker forgets prior commits | Use shared durable storage or upstream idempotency |
| Stored mutable result returned directly | Caller mutation corrupts later replays | Serialize committed results and return defensive copies |
| Key reused with changed arguments | One key aliases two business intents | Store and compare an argument fingerprint |
| Unbounded progress queue | Memory rises with a slow consumer | Coalesce and drop replaceable progress within a bound |
| Final response dropped under pressure | Client cannot know the request outcome | Reserve capacity or evict progress, never the final response |
| Proxy buffers SSE | Progress arrives in bursts or after timeout | Disable buffering and configure compatible proxy timeouts |
| `Last-Event-ID` assumed | Client resumes from state the server does not support | Reconnect with a new request and refetch |
| Every client reconnects immediately | Recovery creates another outage | Use capped exponential backoff with jitter |
| Task ack treated as final cancellation | Worker keeps running after UI says stopped | Poll the Task until a terminal status |

## اتصال Capstone

سنگ پایه سیستم زیست محیطی ابزار باید با قابلیت اطمینان به عنوان شواهد قابل اجرا، نه یک پاراگراف در یک نمودار معماری برخورد کند.

به اين آثار نياز داريم:

- یک نسخه از مسابقه لغو برای هر حمل و نقل؛
- یک میز آزمایش مجدد برای هر جهش آشکار؛
- یک رکورد کلید بی اختیار و یک دستگاه عدم مطابقت؛
- یک نسخه همزمان از کلید یکسان، چک باز کردن مجدد و چک جهش جهش
- یک نتیجه بیش از حد بارگذاری با بفر محدود؛
- سرنخ های SSE با پروکسی برگشت و سیاست بیکار
- یک برنامه اتصال مجدد که روش های معتبر ترمیم را مشخص می کند؛
- یک ردیابی پایدار از لغو وظایف زمانی که سنگ پایان از وظایف استفاده می کند.

یک درخواست سبز در یک فرآیند محلی تنها راه خوش شانس را ثابت می کند. سنگ پاینده آماده تولید است زمانی که پاسخ های از دست رفته، لغو دیر، مصرف کنندگان کند و گله های دوباره متصل به نتایج تعیین کننده ای داشته باشند.

## اصطلاحات کلیدی

| Term | Meaning |
|------|---------|
| Request cancellation | Abandonment of one in-flight MCP request |
| Cancellation race | Competition between terminal completion and cancellation events |
| Idle timeout | Limit since the last useful request activity |
| Maximum timeout | Absolute limit from request start, unaffected by progress |
| Idempotency key | Application identifier that deduplicates one business intent |
| Atomic ledger | Durable boundary that commits the key claim, effect record, and result as one unit |
| Backpressure | Control applied when producers outpace consumers |
| Progress coalescing | Replacing older progress with a newer authoritative value |
| Refetch | Reading current state again after a stream gap |
| Jitter | Deliberate variation that spreads retries across time |

## خواندن بیشتر

- [MCP Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Tasks Extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
