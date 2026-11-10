# گسترش وظایف MCP: کار پایدار در هسته بی تابعیت

> MCP بدون دولت به این معنی نیست که هر عملیات باید در یک درخواست به پایان برسد. تمدید رسمی وظایف به کار طولانی مدت یک دستی پایدار صریح می دهد. یک سرور می تواند آن دستی را از `tools/call`، هر نمونه اي ميتونه جواب بده`tasks/get`، و اطلاعات مشتری از طریق`tasks/update`بدون احیای جلسات پروتکل

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## اهداف یادگیری

- انتقال پروتکل بدون دولت را از حالت کار برنامه کاربردی پایدار متمایز کنید.
- مذاکره کن`io.modelcontextprotocol/tasks`گسترش قابلیت های هر درخواست و`server/discover`. .
- یک سرور را بازگردانید`CreateTaskResult`با`resultType: "task"`پس از آفرینش پایدار
- نظرسنجی با`tasks/get`، انجام دادن ورودی وظیفه با `tasks/update`، و درخواست لغو همکاری با `tasks/cancel`. .
- اون بزرگتر رو بردار`tasks/status`،`tasks/result`و`tasks/list`فرضیه ها
- برای اطلاعیه های اختیاری از طریق `subscriptions/listen`در جریان SSE پاسخ POST
- زمان انقضاء وظیفه مدل، بازپرداخت مجدد، تخفیف کلید ورودی و اشتباهات اجرا به درستی.

## چرا وظایف یک تمدید هستند

وظایف برای اولین بار به عنوان یک ویژگی اصلی تجربی در سال 2025-11-25 ظاهر شد. طراحی مجدد ژوئیه 2026 آنها را به رسمیت رسمی منتقل می کند.`io.modelcontextprotocol/tasks`توسعه به طوری که مشتریان و سرورها می توانند بدون گسترش پروتکل اصلی برای همه به چرخه زندگی اضافی بپردازند.

مشخصات تمدید یک سطح مسود است حتی اگر این خانه رسمی فعلی برای وظایف باشد. نسخه تمدید پشتیبانی شده توسط SDK شما را پین کنید، سناریوهای مطابقت را اجرا کنید و آداپتورهای سیم را از دامنه کارکن و ذخیره سازی خود جدا کنید.

از یک کار زمانی استفاده کنید که عملیات دارای یکی یا چند از این ویژگی ها باشد:

- ممکن است از زمان معطل درخواست معمولی بیشتر عمر کند.
- یک قطار کارگر یا سیستم کاری خارجی قبلاً مالک اجرای است.
- مشتری باید پس از شروع مجدد خود بهبود پیدا کنه
- عملیات در هنگام اجرا برای ورودی کاربر یا مدل توقف می کند.
- لغو و بازیافت نتیجه پایدار، نیاز به محصول است.

برای یک جستجوی تعیین کننده ارزان قیمت، یک کار را ایجاد نکنید. یک دستگیر، استقامت، رای گیری، انقضاء و لغو یک پیچیدگی واقعی است.

## هسته بی تابعیت، درخواست دولتی

MCP 2026-07-28 حذف می شود `initialize`،`notifications/initialized`, جلسه های پروتکل و`Mcp-Session-Id`که محصولات دولتی را ممنوع نمی کند.

یک task id یک حالت درخواست صریح است:

- سرور قبل از اينکه برگردونه ادامه ميده
- مشتری می تونه پس از باز کردنش نگهش داره و دوباره ازش پرسشنامه کنه
- شناسه مي تونه به هر نسخه اي که توسط يه فروشگاه پايدار پشتيباني شده رو رو به سمتش رو ببره
- مجوز در هر روش کار بررسی می شود.
- انقضاء و حذف توسط زمینه های وظیفه تعریف می شود نه عمر حمل و نقل.

این از نظر عملی متفاوت از حالت پنهان متصل به یک اتصال است.

چهار عمر رو جدا نگه داريد:

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

انتقال یک رکورد کار به حافظه فرآیند MCP را حالت پذیر نمی کند. این باعث می شود برنامه غیرقابل اعتماد باشد. پروتکل بدون حالت باقی می ماند، اما بعداً یک`tasks/get`در این حالت، هر یک از روش های انجام شده، همان رکورد مشترک را تحت چک مستاجر و اصلی حل کند.

## مذاکره در مورد قابلیت

مشتری در هر درخواست واجد شرایط حمایت را اعلام می کند:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

سرور درست برگشت`supportedVersions`، قابلیت ها`ttlMs`و`cacheScope`از`server/discover`این برنامه به عنوان یک ابزار تبلیغاتی، همچنین اجرای اجباری را انجام می دهد.`tools/list`. اين نتيجه يه دترمينست باز مياد`generate_report`توضیحات، شی معتبر `inputSchema`،`resultType: "complete"`، متاداتا هویت سرور و نکات مخزن عمومی

یک روش کار از طرف یک مشتری که بازپرداخت تمدید را اعلام نکرده است `-32021`, قابلیت مطلوب مشتری گم شده`data.requiredCapabilities`به `{"extensions":{"io.modelcontextprotocol/tasks":{}}}`. یک رشته پروتکل غیر پشتیبانی شده باز می گردد`-32022`با دقت`supported`و`requested`داده ها؛ یک نسخه گمشده یا غیر رشته ای باز می گردد `-32602`. .

یک پاکت بدون JSON-RPC `id`یک اطلاعیه است. گیرنده ممکن است آن را پردازش کند، اما هیچ نتیجه یا خطا JSON-RPC را صادر نمی کند. یک آداپتور HTTP قابل پخش باز می گردد `202 Accepted`بدون هیچ نهاد برای اطلاع رسانی پذیرفته شده.

در حال حاضر فقط`tools/call`پشتیبانی از اجرای افزوده شده با وظایف. طراحی انتزاع داخلی خود را به طوری که انواع درخواست آینده نیاز به نوشتن مجدد ذخیره سازی.

## ایجاد وظایف هدایت شده توسط سرور

پرچم قدیمی مشتری`params._meta.task.required`پس سرور تصمیم می گیرد که آیا یک برنامه خاص`tools/call`به عنوان یک کار تبدیل می شود.

درخواست:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

پاسخ:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

سرور نباید این دستگیر رو تا زمانی که یک`tasks/get`در یک فروشگاه ثابت، قبل از پاسخ دادن منتظر بینایی خواندن باشید. در غیر این صورت یک مشتری می تواند یک شناسه معتبر را دریافت کند و بلافاصله "نابودی" شود.

پاسخ به کار در این معنا که مشتری درخواست نمی کند حالت کار. این بدون مذاکره نیست: درخواست فعلی هنوز باید تبلیغ تمدید.

## شکل کار

هر وظیفه ای شامل:

- `taskId`: شناسه ثابت تولید شده توسط سرور
- `status`.`working`،`input_required`،`completed`،`cancelled`، یا`failed`؛
- `createdAt`و`lastUpdatedAt`: تایم های ISO 8601
- `ttlMs`: زمان انقضاء از زمان ایجاد، یا `null`برای هیچ محدودیتی که تبلیغ شده باشد؛
- اختیاری`pollIntervalMs`: حداقل زمان پیشنهاد انتخابات فعلی سرور
- اختیاری`statusMessage`: زمینه ای که به کاربر یا مدل توجه دارد.

زمینه های خاص وضعیت فقط در صورت مربوطه ظاهر می شوند:

- `input_required`شامل می شود`inputRequests`. .
- `completed`شامل درخواست اصلی است `result`شکل
- `failed`شامل یک JSON-RPC است `error`هدف

مشتری باید احترام بگذارد`pollIntervalMs`یک سرور ممکن است رای گیری های تهاجمی را محدود کند و ممکن است فاصله را در طول عمر کار تغییر دهد.

## نظرسنجی با`tasks/get`

مشتری از یه عکس لحظه ای میخواد:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get`خودش تمام شده، پس نتیجه اش همیشه بوده`resultType: "complete"`. وظیفه ی سرگیشته هنوز هم می تواند داشته باشه`status: "working"`یا`status: "input_required"`. .

این تفاوت از یک خطا رایج در تجزیه کننده جلوگیری می کند:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

هیچکس نیست`tasks/result`وقتي کار تموم شد، بعدش`tasks/get`پاسخ به این سوال در اصل است`CallToolResult`زیر`result`:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

خارجیه`resultType`میگه`tasks/get`ريسپورت کامل شد`result.resultType`ميگه صداي اصلي ابزار تموم شده.`CallToolResult`بايد خودش رو هم حمل کنه`io.modelcontextprotocol/serverInfo`این درس به جای ذخیره کردن یک بار مفید بدون نوع آن را شامل می شود.

هیچکس نیست`tasks/list`. سرورهای بدون جلسه نمی توانند به طور ایمن نتیجه بگیرند که کدام وظایف به یک لیست مربوط به اتصال تعلق دارند. برنامه هایی که نیاز به تاریخچه دارند باید یک ابزار دامنه مجاز با فیلترهای صریح و قوانین مالکیت را نشان دهند.

## ورودی در هنگام انجام وظیفه

ورودی وظیفه و MRTR اصلی شبیه به هم هستند اما از ادامه های مختلف استفاده می کنند.

### ورودی که قبل از ایجاد وظیفه مورد نیاز است

هسته برگشت`resultType: "input_required"`از اصل`tools/call`.مصرفي انجامش ميده و دوباره ميخواد تماس اصلي رو بگيره فقط بعد از اينکه دور هاي هم زماني MRTR تموم بشه

### ورودی که پس از ایجاد وظیفه مورد نیاز است

وظیفه رو به انجام بده`input_required`.`tasks/get`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`inputRequests`، و مشتری پاسخ ها رو از طریق`tasks/update`. مشتری اصل رو دوباره امتحان نمی کنه`tools/call`. .

عکس:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

تازه:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

پاسخ موفقیت یک اعتراف خالی و اضافه است`resultType: "complete"`تغییر دولت ممکن است در نهایت ثابت باشد، بنابراین مشتری همچنان به نظرسنجی یا گوش دادن ادامه می دهد.

هرکدوم`inputRequests`کلید باید برای تمام عمر کار منحصر به فرد باشد. تکرار `tasks/get`عکس های فوری ممکن است همان کلید باقی مانده را نشان دهند؛ مشتریان UI را کپی می کنند و سرورها پاسخ های کلید های ناشناخته، جایگزین شده یا قبلاً تکمیل شده را نادیده می گیرند. یک به روز رسانی جزئی می تواند وظیفه را در `input_required`تا تمام کليد هاي مورد نياز پاسخ داده بشه

## لغو کردن همکارانه است

`tasks/cancel`این تایید تضمین نمی کند که کارکن متوقف شده است. کار ممکن است ابتدا به پایان برسد، لغو یا انتقال را بعد نادیده بگیرد.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

براي تمام سه روش کار،`Mcp-Name`آینه ها`params.taskId`. نام روش JSON-RPC را تکرار نمی کند. `code/main.py`این قانون را در مرکز`make_http_request`. .

یک کارمند درس بلافاصله لغو را احترام می گذارد و تماس های مکرر را بی اختیار می کند. یک مشتری تولید باید لغو را به عنوان همکاری در نظر بگیرد تا نه از تایید وضعیت نهایی کار نتیجه گیری کند.

استفاده نکنید`notifications/cancelled`این اطلاعیه متعلق به درخواست لغو است نه وظایف ماندگار

این تفاوت در مرز رویت مهم است. لغو درخواست یک عملیات JSON-RPC در پرواز یا پاسخ HTTP درخواست آن را هدف قرار می دهد. اگر `tools/call`قبلاً برگشته`resultType: "task"`، این درخواست کامل است و بسته شدن حمل و نقل نمی تواند نام یا توقف کار پایدار را. `tasks/cancel`این یک RPC جدید مجاز است.`params.taskId`، عکس هاي اين شناسه رو در`Mcp-Name`، پس زمینه مالکیت کار را حل می کند، قصد لغو همکاری را ثبت می کند و بدون ادعا کردن که کارکن متوقف شده است، تأییدیه ای را باز می گرداند.

در نتیجه یک دروازه باید هماهنگی درخواست ها و مسیرهای کار را در جدول های مختلف نگه دارد. جدول درخواست ممکن است در زمان پایان پاسخ ناپدید شود. مسیر کار باید تا زمانی که حالت نهایی و حفظ به پایان برسد، باقی بماند. [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)مسابقه رو ميسازد، زمانبردي، بي تواني، فشار و دوباره تلاش ميکنه براي هر دو راه

## اطلاعیه های اختیاری

نظرسنجی ها خط اصلی هستند. مشتری که می خواهد به روز رسانی های پش ارسال می کند`subscriptions/listen`برای Streamable HTTP، این یک POST است که پاسخ آن یک جریان SSE درخواست است. هیچ جریان رویداد GET مستقل و هیچ جلسه پروتکل برای زنده نگه داشتن وجود ندارد.

سرور شناسه های قبول شده را با `notifications/subscriptions/acknowledged`و بعد میتونم عکس های کامل رو بفرستم`notifications/tasks`. تایید و هر اطلاعیه وظیفه ای`io.modelcontextprotocol/subscriptionId`در`_meta`، برابر به `subscriptions/listen`هر اطلاعیه کاری به طور دیگر معادل چه چیزی است`tasks/get`در آن لحظه برمیگرده

مشتریان باید هنوز هم تمدید وظایف را اعلام کنند. آنها باید از ID های ماندگار وظیفه دوباره متصل و ادامه دهند نه به تکرار رویداد یا `Last-Event-ID`. .

## معنی شکست

از دو لایه خطا درست استفاده کنید.

### خطای پروتکل

پارامترهای روش ناشناس یا یک کار ناشناخته یک خطا JSON-RPC را بازگردانند، معمولا `-32602`. بازپرداخت بازپرداخت حمایت از تمدید`-32021`با شی صلاحیت مورد نیاز.

### نتیجه اجرای وظیفه

- نتیجه ی عادی ابزار با `isError: true`هنوزم يه`completed`وظیفه ای که به دلیل تماس ابزار نتیجه مشخص آن را تولید کرد.
- یک خطا JSON-RPC در زمان اجرا تأخیر انجام می دهد`failed`و این خطای JSON-RPC را در زیر ذخیره می کند`error`. .
- رد کاربر می تواند منجر به`cancelled`، نتیجه ی رد کامل یا نتیجه ی امن دیگری برای دامنه خاص.

## دوام، انقضاء مدت و مالکیت

حداقل ID کار، وضعیت، زمان مهر، ttl، فاصله نظرسنجی، مالکیت عملیات اصلی، نتیجه یا خطا، درخواست های ورودی باقی مانده و تمام کلید ورودی صادر شده باقی بماند.

کلید ذخیره سازی باید یک مستاجر معتبر و مدیر را شامل کند یا حل کند. شناخت یک کار نباید دسترسی را فراهم کند.`tasks/get`،`tasks/update`،`tasks/cancel`، و اشتراک

`ttlMs`یک مشتری می تواند آن را به عنوان یک پشتیبان در زمانی که یک کار تولید به روزرسانی قابل مشاهده را متوقف کرده است، درمان کند. یک سرور ممکن است شکست یابد و بعداً یک کار به پایان رسیده را حذف کند. آن را به عنوان وعده حفظ یک نتیجه کامل برای چند میلی ثانیه پس از تکمیل توصیف نکنید.

استفاده از نوشتن اتم یا معاملات. درس یک فایل موقت را می نویسد و به صورت اتم نامش را تغییر می دهد. یک سرویس چند نسخه باید از یک فروشگاه پایدار مشترک و یک اجاره کارگری یا کنترل همزمان معادل استفاده کند.

```figure
tp-task-lifecycle
```

## آن را بسازید

`code/main.py`یک سرویس وظیفه تعیین کننده را اجرا می کند:

- `server/discover`بازپرداخت`supportedVersions`، اشاره هاي مخفي و تمديد وظایف
- `tools/list`یک تعیین کننده، cacheable را باز می آورد`generate_report`یک توصیفگر با یک طرح ورودی معتبر.
- `tools/call`قبل از بازگشت، کار را ایجاد و ادامه می دهد `resultType: "task"`. .
- یک نمونه سرویس جدید همان کار را بارگذاری می کند و نشان می دهد که بازیابی را از نو شروع کنید.
- `tasks/get`عکس های کامل کار را باز می کند.
- کارگر از`working`به`input_required`. .
- `tasks/update`پاسخ فرم را قبول می کند و یک تایید کامل خالی را باز می گرداند.
- کارگر يه گره گيره نگه داره`CallToolResult`با خودش`resultType`و هویت سرور، سپس انتقال به `completed`. .
- `tasks/cancel`در این اجرا بی اختیار است.
- تنظیمات سازنده HTTP `Mcp-Name`به`params.taskId`برای`tasks/get`،`tasks/update`و`tasks/cancel`. .
- کمک کننده های اطلاع رسانی استفاده می کنند`notifications/subscriptions/acknowledged`و`notifications/tasks`، هر دو با اسم درخواست گوش دادن برچسب شده
- اطلاعیه های بدون ID هیچ پاسخ JSON-RPC را تولید نمی کنند.

کارگر به جای خواب در یک رشته پس زمینه به طور صریح پیش می رود. این باعث می شود هر انتقال حالت تعیین کننده باشد و نمونه پروتکل را از مکانیک صف جدا نگه دارد.

## ازش استفاده کن

از ریشه مخزن:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

دنباله نتایج انتظار می رود:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

و اينو هم تایید کن`tasks/status`،`tasks/result`و`tasks/list`روش برگشت در خدمات مدرن یافت نشده
اینو بررسی کن`tools/list`تعیین کننده است و هر روش کاری HTTP فعلی ID کار خود را از طریق `Mcp-Name`. .

## -باده

`outputs/skill-task-store-designer.md`اکنون یک طرح آگاه از گسترش تولید می کند: مذاکره قابلیت، ایجاد دوام قبل از بازگشت، روش های فعلی، جریان بروزرسانی ورودی، مالکیت، انقضاء، لغو، اشتراک و مهاجرت از روش های آزمایشی حذف شده.

## تمرینات

1. يه کلید ورودی دومي بيشتر اضافه کن.`tasks/update`و ثابت کنم که وظیفه هنوز ادامه داره`input_required`تا هر دو کلید جواب داده بشه
2. مالکیت مستاجر را به فروشگاه اضافه کنید و یک شناسه کار معتبر را که توسط مدیر معتبر اشتباه ارائه شده است رد کنید.
3. اضافه کردن یک قرارداد اجاره کار با انقضاء. نشان دهید که دو نمونه خدمات نمی توانند یک کار را همزمان انجام دهند.
4. یک آداپتور SSE پاسخ POST را برای `subscriptions/listen`. GET را اضافه نکنید`Last-Event-ID`، یا سرپرست جلسه
5. اضافه کردن پاکسازی پس از انقضاء. تشخیص یک کار انقضاء شده از یک کار نامناسب بدون دزدیدن وجود متقاضی.

## اصطلاحات کلیدی

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## مطابقت میراث

سطح آزمایشی سال 2025-11-25 از افزایش وظایف مورد نیاز مشتری استفاده کرد.`tasks/status`،`tasks/result`، و اختیاری`tasks/list`.این نام ها را فقط در یک آداپتور قدیمی متصل نگه دارید. یک مشتری فعلی از قابلیت تمدید استفاده می کند، دستاوردهای هدایت شده توسط سرور، نظرسنجی ها را قبول می کند`tasks/get`، عرضه کننده های ورودی با `tasks/update`، و نتیجه نهایی را از عکس کار می خواند.

## خواندن بیشتر

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
