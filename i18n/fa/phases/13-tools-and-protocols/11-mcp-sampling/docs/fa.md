# ورودی مدل MCP: نمونه گیری مهاجرت و MRTR بی تابعیت

> MCP 2026-07-28 نمونه برداری برای طرح های جدید را حذف می کند و کانال درخواست سرور به مشتری را حذف می کند. اگر یک جریان کار موجود هنوز به مدل مشتری نیاز دارد، سرور یک `input_required`نتیجه و مشتری درخواست اصلی را با محصول مدل دوباره امتحان می کند. حلقه استدلال در لایه پروتکل صریح، محدود و بی وضعیت می شود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## اهداف یادگیری

- توضیح دهید که چرا نمونه گیری در MCP 2026-07-28 منسوخ شده است و پیش فرض یکپارچه سازی مدل مستقیم را برای سرورهای جدید انتخاب کنید.
- یک جریان کار سازگاری را اجرا کنید که شامل `sampling/createMessage`از طریق درخواست های چند سفر دور و عقب (MRTR).
- بررسي پروتکل و قابلیت هاي كلينده رو در هر درخواست قرار بده`_meta`هدف
- برگشت`resultType: "input_required"`و روش اصلی را با یک شناسه JSON-RPC تازه دوباره امتحان کنید.
- حفاظت از تمامیت`requestState`و آن را به اصل، روش، استدلال و انقضاء متعهد کند.
- حلقه های با کمک مدل محدود با بررسی قابلیت، تأیید، اعتبار پاسخ و یک محدودیت گرد.

## تصمیم قبل از پروتکل

ابزاری مثل`summarize_repo`دو نوع کار لازم داره:

1. کار تعیین کننده: فایل های لیست، فایل های مجاز را بخوانید، مسیرها را تأیید کنید و محتوای را جمع آوری کنید.
2. مدل کاری: فایل های نماینده را انتخاب کنید و خلاصه را ترکیب کنید.

حالا دو معماری معتبر دارید.

### سرور جدید: مستقیماً با یک ارائه دهنده مدل ادغام شود

این پیش فرض فعلی است. سرور مالک انتخاب مدل، اعتبارات، بودجه، تلاش مجدد و مشاهده است. یک معمول را باز می گرداند `tools/call`نتیجه برای مشتری MCP.

این را انتخاب کنید زمانی که سرور قبلاً یک سرویس میزبان است یا زمانی که رفتار مدل قابل پیش بینی مهم تر از استفاده از مدل میزبان است.

### جریان کار نمونه گیری موجود: آن را به MRTR انتقال دهید

نمونه گیری هنوز در طول پنجره تخفیف وجود دارد. یک سرور هدف قرار داده شده 2026-07-28 نمی تواند یک زنده ارسال کند `sampling/createMessage`درخواست را به مشتری برگردانید.`InputRequiredResult`. .

این مسیر سازگاری را تنها زمانی انتخاب کنید که از مدل مشتری استفاده کنید و اعتبارات یک نیاز واقعی محصول است. یک برنامه حذف را ثبت کنید زیرا پیاده سازی های جدید نباید نمونه سازی منسوخ را اتخاذ کنند.

## قرارداد بی تابعیت

پروتکل جولای 2026 هیچ`initialize`تبادل، نه`notifications/initialized`و نه`Mcp-Session-Id`هر درخواست اطلاعاتی را که قبلا در دست دادن زندگی می کرد، در خود دارد:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

سرور بر روی هر درخواست تجدید نظر را تأیید می کند. یک نسخه گم شده یا غیر رشته ای پارام های باطل است.`-32602`. یک رشته غیر پشتیبانی شده باز می گردد`-32022`با اطلاعات دقیق`{"supported":["2026-07-28"],"requested":"<client version>"}`. قابلیت نمونه گیری گمشده برگشت`-32021`با`data.requiredCapabilities`به `{"sampling":{}}`. .

یک پاکت بدون JSON-RPC `id`یک اطلاعیه است. گیرنده ممکن است آن را پردازش کند، اما نه پاسخ موفقیت و نه پاسخ خطا را ارسال می کند. یک آداپتور HTTP قابل پخش باز می گردد `202 Accepted`بدون هیچ نهاد برای اطلاع رسانی پذیرفته شده.

سرور هم اجرا می کند `server/discover`با دقیق`supportedVersions`کلید، قابلیت ها`ttlMs`و`cacheScope`تا مشتری بتواند قرارداد سرور را قبل از تماس با ابزار یاد بگیرد و ذخیره کند. چون کشف تبلیغات`tools`، سرور هم مجبور به اجرا کردن`tools/list`. تعیین کننده اش`summarize_repo`توضیحات شامل یک شی معتبر است `inputSchema`،`resultType: "complete"`، متاداتا هویت سرور و نکات مخزن عمومی

هر نتیجه موفق مدرن دارای یک متمایز کننده است:

- `resultType: "complete"`یعنی عملیات تمام شده
- `resultType: "input_required"`یعنی مشتری باید درخواست های داخلی را برآورده کند و دوباره تلاش کند.
- افزونه ها ممکن است انواع نتایج اضافی را تعریف کنند. افزونه وظایف اضافه می شود `"task"`در درس 13

## یک دور MRTR

سرور نمی تواند در هنگام پردازش درخواست به مشتری زنگ بزند. در عوض این نتیجه را باز می گرداند:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

مشتری تأیید می کند که از نمونه گیری پشتیبانی می کند، سیاست های تأیید و مدل خود را اعمال می کند و پاسخ مدل را دریافت می کند. سپس یک درخواست جدید با یک شناسه JSON-RPC متفاوت ارسال می کند:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

تکرار تکرار یک جلسه پروتکل نیست. این یک درخواست جدید است که روش و استدلال اصلی را تکرار می کند، فقط شامل دور فعلی می شود `inputResponses`و صداها`requestState`بايت به بايت

MRTR فقط در`tools/call`،`prompts/get`و`resources/read`. سرور نباید برگردد`input_required`از روش های غیر مرتبط.

## دولت چند دور

این درس به دو نمونه نیاز داره:

1. `pick_files`یک آرایه JSON را باز می گرداند.
2. `summary`به پایان نامه نامه باز می گردد.

هر بار تکرار فقط پاسخ های آن دور را حمل می کند. بنابراین سرور مرحله و داده های میانگین تایید شده را به مرحله بعدی می گذارد `requestState`. .

با اين ارزش ها رفتار کنيد که توسط مهاجم کنترل شده باشه. امضاء نام فاز خام کافی نيست. حالت رو به:

- اصلی معتبر، خود گزارش نشده `clientInfo`؛
- روش اصلی؛
- یک بازخورد استدلال های اصلی؛
- یک انقضاء کوتاه مدت؛
- مرحله فعلی و ارزش های میانگین معتبر.

استفاده از HMAC در صورتی که محرمانه بودن مورد نیاز نباشد. استفاده از رمزگذاری معتبر در صورتی که مشتری نباید وضعیت را بخواند. رد یک امضا بد، ارزش انقضاء شده، تغییر اصل یا تغییر استدلال با `-32602`. .

مشتری نباید تحلیل یا تغییر کند`requestState`تنها کاري که داره اينه که در بازي دوباره به هم صدا بزنه

## انتخاب های مدل ها نشانه هایی هستند

`costPriority`،`speedPriority`و`intelligencePriority`این گزینه ها ترجیحات مستقل هستند. آنها توزیع احتمال نیستند و نیازی به جمع کردن به یک نفر ندارند. مشتری ممکن است آنها را نادیده بگیرد زیرا مشتری مالک سیاست مدل است.

نگه دار`includeContext`در`"none"`اگر یک جریان نمونه گیری قدیمی را حفظ کنید. حالت های دیگر زمینه خطر رسوب را افزایش می دهند و خود به خود منسوخ می شوند. حداقل زمینه صریح را در درخواست ارسال کنید.

## حفاظت از انواع

مشتری مرز اعتماد برای درخواست های نمونه گیری داخلی است.

- به کاربر نشان دهید که سرور از مدل می خواهد چه کاری انجام دهد وقتی که سیاست نیاز به تأیید دارد.
- سرگرد MRTR رو محدود کن، اگه باشه، يه سرور مخرب ميتونه يه حلقه خرج مدل رو ایجاد کنه
- قبل از استفاده از آن به عنوان نام فایل، URL یا ورودی ابزار، هر پاسخ نمونه گیری را تأیید کنید.
- بايت ها و توکن ها رو محدود کن
- درخواست ورودی را که در قابلیت های فعلی مشتری اعلام نشده است رد کنید.
- محصول مدل را از تصمیمات مجوز خارج کنید.
- روش اصلی و کلید درخواست ورودی را بدون ثبت محتوای حساس فوری ثبت کنید.

`clientInfo`و`serverInfo`این اطلاعات از متاداتا نمایش و تشخیصی است. هرگز از هر دو به عنوان یک هویت معتبر استفاده نکنید.

```figure
t3-sampling-flip
```

## آن را بسازید

`code/main.py`جریان دو دور کامل را بدون بسته های شخص ثالث اجرا می کند:

- `server/discover`بازپرداخت`supportedVersions`، پشتیبانی از ابزار را تبلیغ می کند و راهنمایی های پیشگیری را باز می گرداند.
- `tools/list`یک تعیین کننده، cacheable را باز می آورد`summarize_repo`توصیفگر با یک طرح ورودی اشیاء.
- `tools/call`متاداتا را بر حسب درخواست تأیید می کند.
- اولین نتیجه این است که`sampling/createMessage`برای انتخاب فایل
- اولین آزمایش مجدد نتیجه مدل را تأیید می کند و درخواست دوم را در آن قرار می دهد.
- محافظت شده توسط HMAC `requestState`مرحله ای بین درخواست های مستقل را انجام می دهد.
- نتیجه نهایی استفاده می کنه`resultType: "complete"`. .

مدل میزبان جعلی باعث می شود که نمونه تعیین کننده باشد. فقط جایگزین کنید`fake_host_model`وقتی که یک میزبان واقعی را متصل می کنید، دستگاه حالت طرف سرور باید تعیین کننده و قابل آزمایش باشد.

## ازش استفاده کن

از ریشه مخزن:

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

نقاط بازرسی انتظار می رود:

- کشف یک نتیجه کامل را با `ttlMs`و`cacheScope`. .
- کشف ابزار همان توصیفگر مرتب شده را با  باز می گرداند`resultType`، هویت سرور و اشاره های پیشگیری
- قابلیت های گمشده و نسخه های غیر پشتیبانی شده از استفاده دقیق استفاده می کنند`-32021`و`-32022`داده های خطا
- یک اطلاعیه بدون ID هیچ پاسخ JSON-RPC را تولید نمی کند.
- شناسه های درخواست`[1, 2, 3]`، که ثابت ميکنه هر دور MRTR مستقله
- دو نتیجه اول اینه`input_required`. .
- نتیجه نهایی اینه`complete`و شامل پرونده های انتخاب شده و خلاصه ای است.
- تغییر استدلال های اصلی در یک آزمایش مجدد، بررسی وضعیت درخواست را شکست می دهد.

## -باده

`outputs/skill-sampling-loop-designer.md`در حال حاضر یک برنامه ریز مهاجرت است. ابتدا تصمیم می گیرد که آیا نمونه برداری باید به نفع یکپارچه سازی مستقیم مدل حذف شود. اگر سازگاری مورد نیاز باشد، دور MRTR، اتصال حالت، دروازه قابلیت، بودجه، اعتبار و برنامه حذف را تولید می کند.

## تمرینات

1. پاسخ انتخاب فایل را به JSON ناشناس تغییر دهید. سرور را تایید کنید `-32602`به جای اعتماد به تولید مدل.
2. تغییر`audience`توضیح بده که چرا حالت مهر شده مانع از استفاده مجدد از درخواست های متقاطع می شود.
3. یک دور سوم اضافه کنید که از میزبان می خواهد خلاصه را مورد انتقاد قرار دهد. خلاصه قبلی را در حالت امضا شده نگه دارید و کل جریان را در سه دور محدود کنید.
4. نمونه گیری را با جایگزینی تماس های میزبان جعلی با یک آداپتور مدل متعلق به سرور حذف کنید. لیست اینکه کدام مسئولیت های تأیید، صورتحساب و مشاهده به سرور منتقل می شوند.
5. یک تست انقضاء با استفاده از یک مقدار حالت که یک ثانیه پس از پایان زمان آن است اضافه کنید.

## اصطلاحات کلیدی

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Sampling | Deprecated feature that asks the client's model for a completion |
| MRTR | Stateless retry pattern for client input required during a request |
| `InputRequiredResult` | Result with `resultType: "input_required"` |
| `inputRequests` | Server-assigned map of embedded elicitation, sampling, or roots requests |
| `inputResponses` | Current round's client results keyed like `inputRequests` |
| `requestState` | Opaque server state echoed exactly by the client and verified by the server |
| `resultType` | Required discriminator for modern MCP results |
| Direct model integration | Recommended replacement for new servers that need model inference |
| Capability gate | Rule that prevents sending an embedded request the client did not advertise |
| Loop budget | Maximum rounds, tokens, bytes, time, and spend allowed for the operation |

## مطابقت میراث

یک مشتری که به سال 2025-11-25 بسته شده است ممکن است هنوز از سرور قدیمی استفاده کند`sampling/createMessage`در یک اتصال زنده جریان. این رفتار را فقط در یک آداپتور خاص نسخه نگه دارید. راه جلسات را معماری برای یک سرور 2026-07-28 نکنید.

SDK های رسمی می توانند مدرن را ترجمه کنند `input_required`این شیم یک مرزی مطابقت است، نه اجازه اضافه کردن منطق وابسته به جلسه جدید.

## خواندن بیشتر

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
