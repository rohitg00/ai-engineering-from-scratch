# مدل پروتکل زمینه (MCP)

> MCP به یک میزبان هوش مصنوعی یک پروتکل برای کشف و درخواست ابزارها، منابع و پیام ها می دهد. اصلاح 2026-07-28 این پروتکل را بی وضعیت می کند: قابلیت و زمینه نسخه با هر درخواست سفر می کند، نه در یک دست زدن متصل.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## اهداف یادگیری

- یک میزبان، مشتری، سرور، حمل و نقل و سرور اولیه MCP را تشخیص دهید.
- یک درخواست JSON-RPC را با متاداتا که توسط MCP 2026-07-28 مورد نیاز است بسازید.
- استفاده کنید`server/discover`برای بررسی نسخه ها، هویت و قابلیت ها.
- نتایج تایپ شده و آگاه از کش از ابزارها، منابع و پیام ها را بازگردانید.
- توضیح دهید که چگونه MCP بدون دولت مدرن با سرورهای عصر دست دادن همکاری می کند.
- برای سرور، حالت امن، حمل و نقل و محدودیت های تایید را انتخاب کنید.

## مشکل

برنامه شما نیاز به یک سوال پایگاه داده، یک عملیات تقویم و یک خواننده فایل دارد. بدون پروتکل مشترک، هر میزبان هوش مصنوعی نیاز به کشف سفارشی، دعوت، خطا، حمل و نقل و چسب مجوز برای همان قابلیت ها دارد.

MCP آن ماتریس ادغام را کاهش می دهد. یک سرور یک سطح استاندارد JSON-RPC را منتشر می کند. یک مشتری سازگار می تواند سطح را کشف کند، آن را به یک مدل یا کاربر ارائه دهد، آن را فراخوانی کند و نتیجه را بدون یک آداپتور خاص سرور تفسیر کند.

مرز مهم را فراموش کردن آسان است. MCP ارتباطات را استاندارد می کند. این تصمیم نمی گیرد که مدل باید به کدام ابزار مراجعه کند، محتوای غیرقابل اعتماد را ایمن کند یا یک درخواست بدون دولت را به وضعیت کاربردی پایدار تبدیل کند. میزبان و سرور شما هنوز هم مالک این تصمیمات هستند.

## مفهوم

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### سه سرور ابتدایی

1. **Tools**هر ابزار دارای نام، توصیف، ورودی JSON Schema و دستیار است.
2. **Resources**نامگذاری شده و محتوای URI که مشتری می تواند بخواند.
3. **Prompts**قالب های قابل استفاده مجدد هستند که میزبان می تواند به کاربر نشان دهد.

میزبان برنامه هوش مصنوعی است. یک مشتری MCP در داخل آن میزبان با یک سرور صحبت می کند. حمل و نقل پیام های JSON-RPC بین آنها را حمل می کند.

### درخواست های بی تابعیت جایگزین دست دادن

MCP 2026-07-28 حذف می شود `initialize`و`notifications/initialized`همچنین جلسات سطح پروتکل را حذف می کند. هر درخواست زمینه ای را برای تفسیر آن در`params._meta`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

نسخه پروتکل و قابلیت های مشتری مورد نیاز است. هویت مشتری توصیه می شود. یک گمشده`_meta`, یک فیلدی مورد نیاز که از دست رفته است یا یک فیلدی مورد نیاز با نوع اشتباه اشتباه است و Params Invalid را باز می گرداند (`-32602`). یک رشته نسخه خوب شکل گرفته که سرور پشتیبانی نمی کند باز می گردد `UnsupportedProtocolVersionError`(`-32022`) یک سرور می تواند درخواست معتبر را بدون بازیافت سابقه مذاکره قبلی پردازش کند.

بدون تابعیت به این معنی نیست که یک برنامه هرگز نمی تواند وضعیت را حفظ کند. به این معنی است که وضعیت در پشت یک اتصال MCP پنهان نیست یا`Mcp-Session-Id`اگر یک جریان کار نیاز به تداوم دارد، سرور یک دستی نامشفق را می کند و مشتری آن را به عنوان یک استدلال ابزار معمولی در تماس های بعدی می گذرد. اجازه هنوز هم باید در هر درخواست بررسی شود.

### کشف و انتخاب نسخه

هر سرور مدرن اجرا می کند`server/discover`نتیجه تبلیغات نسخه های پشتیبانی شده، قابلیت ها و هویت سرور:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

یک مشتری ممکن است به طور مستقیم به یک روش دیگر زنگ بزند و یک خطا نسخه را مدیریت کنند، اما کشف باعث می شود نمایش قابلیت و انتخاب نسخه صریح شود. یک نسخه غیر پشتیبانی شده باز می گردد `UnsupportedProtocolVersionError`با کد`-32022`داده های آن شامل`supported`, مجموعه ای از اصلاحات سرور , و `requested`، اصلاح رد شده

در استودیو، یک مشتری دو دوره ای با`server/discover`. نتیجه ی کشف یا خطا ی مدرن شناخته شده مانند`UnsupportedProtocolVersionError`هر خطا یا زمان بندی که به عنوان مدرن شناخته نمی شود اجازه می دهد به سال 2025-11-25 بازگردد`initialize`رفتارهای میراث، کد سازگاری است، نه پیش فرض مدرن.

### نتایج واضحه

هر هسته ای که در سال 2026-07-28 نتیجه داده شده`resultType`:

- `complete`یعنی عملیات تمام شده
- `input_required`یعنی سرور به یک سفر دیگر از طریق الگوی درخواست های چند سفر دور نیاز دارد. سرورهای اصلی ممکن است آن را فقط از `tools/call`،`resources/read`، یا`prompts/get`. .

مشتری ها باید یک نتیجه قدیمی را که حذف می شود، درمان کنند.`resultType`تمام شد

سرورها باید شامل باشند`io.modelcontextprotocol/serverInfo`در هر نتیجه ای`_meta`این هویت خود گزارش شده است و برای نمایش، ثبت و اشکال زدایی است، نه برای تصمیمات امنیتی.

لیست و نتایج خواندن نیز شامل `ttlMs`و`cacheScope`. یک تعیین کننده`tools/list`سفارش به علاوه یک نکته تازه اجازه می دهد تا مشتریان کشف را به صورت ایمن ذخیره کنند و ثبات ذخیره سازی سریع را بهبود بخشد. `cacheScope: public`اجازه ذخیره سازی مشترک؛ `private`استفاده مجدد به زمینه تماس محدود می شود.

### شکل سیم و حمل و نقل

MCP از JSON-RPC 2.0 در stdio یا Streamable HTTP استفاده می کند.

- درخواست ای داره`jsonrpc`،`id`،`method`و`params`. .
- پاسخ به همبستگی داره`id`و یا`result`یا`error`. .
- اطلاعیه ای نیست`id`و انتظار پاسخگویی ندارد.

HTTP Streamable مدرن یک نقطه پایان را که POST را پذیرفته است نشان می دهد. هر پیام JSON-RPC POST خود را دریافت می کند. یک درخواست POST یک شی JSON یا یک جریان رویداد های سرور ارسال شده توسط درخواست را دریافت می کند که با پاسخ نهایی پایان می یابد. یک اطلاعیه POST پذیرفته شده HTTP 202 را بدون بدن پاسخ دریافت می کند. این تجدید نظر اصلی هیچ اطلاعیه مشتری به سرور را بر روی HTTP Streamable تعریف نمی کند.

هیچ جریان مستقل MCP GET وجود ندارد، نقطه پایان جلسه DELETE، `Mcp-Session-Id`، یا`Last-Event-ID`تکرار در 2026-07-28 . اطلاعیه های تغییر طولانی مدت از یک`subscriptions/listen`POST که پاسخ آن به عنوان یک جریان SSE باز باقی می ماند.

### ورودی مشتری بدون درخواست های آغاز شده توسط سرور

نسخه های قبلی اجازه می دهد یک سرور درخواست هایی مانند `sampling/createMessage`،`roots/list`، یا`elicitation/create`بر روی یک جریان. پروتکل فعلی در عوض از درخواست های چند سفر دور استفاده می کند. یک تماس ابزار واجد شرایط، خواندن منابع، یا سریع دریافت بازپرداخت`resultType: input_required`حداقل یک نفر از`inputRequests`یا`requestState`. مشتری هر گونه ورودی مورد نیاز را جمع آوری می کند، روش اصلی را با یک شناسه JSON-RPC جدید و متناظر دوباره امتحان می کند `inputResponses`و به طور دقیق هم مطابقت داره`requestState`وقتی که یکی از آنها ارائه شد.`inputRequests`اگه حضور داشته باشيد، دوباره امتحانش رو از دست ميدهيد`inputResponses`. .

ریشه ها، نمونه گیری و ثبت نام همچنان فعال هستند اما به طور منسوخ شده اند، بنابراین پیاده سازی های جدید نباید آنها را اتخاذ کنند. ریشه های موجود یا درخواست نمونه گیری در داخل MRTR سفر می کنند `inputRequests`، هرگز به عنوان درخواست های JSON-RPC مستقل سرور به مشتری. پارامترهای صریح فایل یا دایرکتوری، URIs منابع، پیکربندی سرور و یکپارچه سازی مستقیم ارائه دهنده مدل را ترجیح دهید. برای تشخیص استودیو از stderr و OpenTelemetry برای تله متری تولید استفاده کنید.

```figure
mcp-nxm-collapse
```

## آن را بسازید

### مرحله اول: سطح سرور را ثبت کنید

ثبت نام ساده باقی می ماند حتی اگر قرارداد درخواست تغییر کند:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

اجرای ارسال شده در `code/main.py`همچنین یک منبع و پرامپت را ثبت می کند. آن عمدا از کتابخانه استاندارد استفاده می کند تا شما بتوانید هر پاکت را ببینید به جای انتقال پروتکل به یک SDK.

### مرحله دوم: متاداتا را به هر درخواست متصل کنید

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

این متاداتا را فقط در یک شی اتصال ذخیره نکنید. سرور آن را در هر درخواست تأیید می کند.

### مرحله 3: انتخاب کنید قبل از لیست کردن

تماس بگیرید`server/discover`، نسخه ای پشتیبانی شده را انتخاب کنید، سپس تماس بگیرید `tools/list`. یک مستقیم`tools/list`اگر نسخه را قبلاً می شناسید و می توانید آن را مدیریت کنید`-32022`. .

نمایش لیست ابزارها را به ترتیب نامها و پیوست ها باز می کند `ttlMs`،`cacheScope`،`resultType`یک تماس ابزار یک نتیجه کامل و غیر قابل کیش را به ارمغان می آورد زیرا تولید آن می تواند به وضعیت فعلی بستگی داشته باشد.

### مرحله 4: نقشه همان درخواست به HTTP

یک راه دور`tools/call`POST شامل عناوین است که بدن JSON-RPC را منعکس می کند:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

.`MCP-Protocol-Version`عنوان باید با نسخه در `_meta`.`Mcp-Method`در هر درخواست JSON-RPC مورد نیاز است و باید مطابقت داشته باشد `method`.`Mcp-Name`فقط برای `tools/call`،`resources/read`و`prompts/get`در این حالت، در این حالت باید نام ابزار، URI منابع یا نام پرامپت را مطابقت دهد. یک عنوان مورد نیاز یا عدم مطابقت از دست رفته HTTP 400 را با `HeaderMismatch`کد`-32020`. .

### مرحله 5: اجرای ایمنی خارج از حالت پروتکل

- مجوز و مخاطبان را در هر درخواست HTTP تأیید کنید.
- سرورهای محلی را به میزبان محلی متصل کنید و تایید کنید`Origin`در HTTP قابل پخش
- ابزار جهشگر را با `destructiveHint: true`و نیاز به تایید میزبان دارند.
- دامنه دایرکتوری و فایل را به وضوح عبور دهید به جای وابستگی به ریشه های قدیمی.
- منابع و ابزار تولید را به عنوان داده های غیرقابل اعتماد در نظر بگیرید.
- ذخیره stdout برای JSON-RPC در stdio؛ تشخیص را به stderr بنویسید.

## ازش استفاده کن

درس رو از فهرستش اجرا کن

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

اولين خط بايد گزارش پيدا کردن`demo-server`در پروتکل`2026-07-28`پس بازرسی کن`MCPClient.request`: بازسازی می کنه`_meta`برای هر تماس. متاداتا را از یک درخواست حذف کنید و مشاهده کنید که سرور آن را رد می کند.

## -باده

`outputs/skill-mcp-server-designer.md`یک دامنه را به یک طراحی MCP بدون دولت تبدیل می کند. دروازه پذیرش آن نیاز به یک نتیجه کشف، سیاست متادتا هر درخواست، لیست های تعیین کننده آگاه از کش، دستی های صریح حالت، سرنخ حمل و نقل، مجوز و قوانین تأیید دارد.

## ادامه دادن به غوطه عميق MCP

در این درس شما مدل پروتکل را می بینید. مرحله 13 چهار مرز تولید را به آموزش های جداگانه ساخت و تأیید تبدیل می کند:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)شامل طرح های ورودی بسته، محتوای ساختاری، متاداتا مسیر، صفحات غیر شفاف، مجوز تکمیل و تفاوت بین خطاهای پروتکل و دامنه ابزار است.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)شامل لغو درخواست، لغو کار ماندگار، مهلت ها، بی اختیار، فشار، بفرینگ پراکسی و رفتار اتصال مجدد است.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)شامل اثبات فضای نام، اصل اثاث، پین های غیر قابل تغییر، حرکت زنده، وضعیت ثبت نام، شواهد پذیرش و بازگشت.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)پوشش داده شده است نقاش های سیم طلایی و منفی، دوره های نسخه سخت، تفاوت های SDK، شواهد استازی، ویرایش، دروازه های سلامتی و بازپرداخت انتشار.

آنها را در ترتیب زمانی که سرور از یک تیم یا مرز اعتماد عبور می کند دنبال کنید. آنها با هم از  روش کار می کند به  قرارداد با استفاده از انتشار ایمن و تشخیصی باقی می ماند.

## تمرینات

1. اضافه کنید`subtract`ابزار و تایید`tools/list`به ترتیب الفبایی باقی می ماند.
2. کلید نسخه پروتکل را حذف کنید و Params Invalid را تایید کنید (`-32602`پس نسخه خوبي که درست شده ولي پشتیبانی نشده رو بفرست`2025-11-25`، تایید کنید`-32022`، تایید کن`requested`به نظر مي رسد که اين نظرسنجي شده و از بينش انتخاب ميکنه`supported`. .
3. اضافه کردن یک سرور-minted `draftId`برای ایجاد یک عملیات، سپس آن را به عنوان یک استدلال برای به روز رسانی نیاز دارید. توضیح دهید که چرا این وضعیت برنامه است نه یک جلسه پروتکل.
4. برگشت`input_required`از یک ابزار که نیاز به تایید کاربر دارد. تماس اصلی را با یک شناسه جدید، یک `inputResponses`وارد شدن و دقیق بودن`requestState`به جای اختراع یک درخواست JSON-RPC از سرور به مشتری.
5. یک مشتری استودیویی دو دوره را رسم کنید. یک نتیجه یا خطا مدرن را به عنوان مدرن و اجازه بازگشت به `initialize`فقط بخاطر خطا ناشناخته يا زمانبندی

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## خواندن بیشتر

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
