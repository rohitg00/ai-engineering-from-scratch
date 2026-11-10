# عملکرد فراخوان عمیق غوطه ور کردن  OpenAI، انسان شناسی، دوقلوها

> سه ارائه دهنده مرزی در سال 2024 در یک حلقه تماس ابزار یکسان جمع شدند و سپس در همه چیز دیگر اختلاف کردند. OpenAI استفاده می کند `tools`و`tool_calls`. استفاده های انسان`tool_use`و`tool_result`بلوک ها`functionDeclarations`و ارتباط هویت منحصر به فرد. این درس سه مورد را کنار هم جدا می کند تا کد که در یک ارائه دهنده ارسال می شود وقتی آن را پورت می کنید شکسته نشود.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## اهداف یادگیری

- سه تفاوت شکل بین OpenAI، Anthropic و Gemini (اعلان، تماس، نتیجه) که وظیفه را فرا می خواند را بیان کنید.
- یک بیانیه ابزار را در تمام سه فرمت ارائه دهنده ترجمه کنید و پیش بینی کنید که محدودیت های حالت سخت در کجا متفاوت خواهد بود.
- استفاده کنید`tool_choice`در هر ارائه دهنده برای اجبار، ممنوعیت، یا انتخاب خودکار ابزار تماس.
- محدودیت های سخت هر ارائه دهنده را بدانید (عدد ابزار، عمق طرح، طول استدلال) و امضای خطایی که هر یک از آنها هنگام نقض محدودیت ها منتشر می کند.

## مشکل

شکل درخواست درخواست درخواست درخواست درخواست درخواست درخواست درخواست درخواست در هر ارائه دهنده متفاوت است. سه مثال مشخص از دسته های تولید 2026:

**OpenAI Chat Completions / Responses API.**تو گذر مي کني`tools: [{type: "function", function: {name, description, parameters, strict}}]`پاسخ مدل شامل`choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`کجا`arguments`یک رشته JSON است که باید آن را تجزیه و تحلیل کنید. حالت سخت (`strict: true`) از طریق رمزگذاری محدود، رعایت طرح را اجبار می کند.

**Anthropic Messages API.**تو گذر مي کني`tools: [{name, description, input_schema}]`پاسخ به اين سوال اينه:`content: [{type: "text"}, {type: "tool_use", id, name, input}]`.`input`شما با یک کلمه جدید پاسخ می دهید`user`پيامى که شامل`{type: "tool_result", tool_use_id, content}`بلوک

**Google Gemini API.**تو گذر مي کني`tools: [{functionDeclarations: [{name, description, parameters}]}]`(در زیر میز قرار گرفته)`functionDeclarations`) پاسخ به این سوال به عنوان`candidates[0].content.parts: [{functionCall: {name, args, id}}]`کجا`id`در دوقلوها 3 و بالا همبستگی تماس های موازی منحصر به فرد است.`{functionResponse: {name, id, response}}`. .

. همان حلقه . نام های مختلف میدان ، انستیتورهای مختلف ، کنوانسیون های مختلف رشته به عنوان شی و مکانیسم های مرتبط مختلف . یک تیم که یک آژانس هواشناسی را در OpenAI می نویسد ، برای دو روز به Anthropic و یک روز دیگر به Gemini فقط برای لوله کشی پرداخت می کند

این درس یک مترجم را ایجاد می کند که سه فرمت را به یک اعلامیه ابزار کانونیک و مسیرهای کنار هم متحد می کند. مرحله 13 · 17 الگوی مشابه را به یک دروازه LLM عمومی می کند.

## مفهوم

### ساختار مشترک

هر ارائه دهنده به پنج چیز نیاز داره:

1. **Tool list.**نام هر ابزار، توصیف و طرح ورودی.
2. **Tool choice.**یک ابزار خاص را مجبور کنید، ابزارها را ممنوع کنید، یا اجازه دهید مدل تصمیم بگیرد.
3. **Call emission.**تولید ساختار یافته نامگذاری ابزار و استدلال ها
4. **Call id.**ارتباط پاسخ به تماس صحیح (موضوع برای موازی).
5. **Result injection.**پيام يا بلوک که نتيجه را به تماس باز مي گرداند

### تفاوت شکل، زمینه به زمینه

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | `tool_calls[]` on assistant message | `content[]` of type `tool_use` | `parts[]` of type `functionCall` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI generates) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `user` with `tool_result`, `tool_use_id` | `functionResponse` with matching `id` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | `strict: true` per tool (opt-in) | `responseSchema` at request level |

### محدوده ای که واقعاً به آن ها می رسی

- **OpenAI.**128 ابزار در هر درخواست. عمق طرح 5. رشته استدلال <= 8192 بایت. حالت سخت نیاز به هیچ `$ref`نه`oneOf`-بله .`anyOf`-بله .`allOf`با همپوشانی، هر ملک ذکر شده در `required`. .
- **Anthropic.**۶۴ ابزار در هر درخواست. عمق طرح به طور موثر بدون محدودیت اما محدودیت عملی 10. استفاده دقیق از ابزار با اختیار است.`strict: true`بدون آن، طرح یک قرارداد است که مدل تمایل به پیروی از آن دارد، نه یک تضمین.
- **Gemini.**64 تابع در هر درخواست. انواع طرح ها زیر مجموعه OpenAPI 3.0 هستند (اختلاف کمی از طرح JSON 2020-12). تماس های موازی از دوقلوها 3 به عنوان یک شناسه منحصر به فرد.

### `tool_choice`رفتار

سه حالت که همه از آن پشتیبانی می کنند، نام های متفاوتی دارند.

- **Auto.**مدل ابزار یا متن رو انتخاب میکنه
- **Required / Any.**مدل باید حداقل یک ابزار را فرا بخواند.
- **None.**مدل نباید به ابزار زنگ بزنه

و به علاوه يه حالت منحصر به فرد براي هر ارائه دهنده:

- **OpenAI.**به اسم یک ابزار خاص مجبور کن
- **Anthropic.**یک ابزار خاص را با نام مجبور کنید`disable_parallel_tool_use`پرچم تنها و چند تا را جدا می کند.
- **Gemini.** `mode: "VALIDATED"`هر پاسخ را از طریق یک تأیید کننده اسکیما بدون توجه به هدف مدل هدایت می کند.

### تماس های موازی

OpenAI`parallel_tool_calls: true`(به طور پیش فرض) تماس های متعدد را در یک پیام دستیار ارسال می کند. شما همه آنها را اجرا می کنید و با یک پیام نقش ابزار بسته ای که شامل یک ورودی در هر`tool_call_id`. انتروپيك تاريخي فقط يه تماس داشت`disable_parallel_tool_use: false`(به طور پیش فرض از کلاود 3.5) امکان پذیر است چند. جمیانی 2 اجازه تماس های موازی را داد اما شناخت های ثابت را نداد؛ جمیانی 3 UUID را اضافه کرد تا پاسخ های خارج از نظم به طور تمیز ارتباط برقرار کنند.

### پخش

هر سه تماس ابزار پشتیبانی می کنند. فرمت سیم متفاوت است:

- **OpenAI.**قطعات دلتا از`tool_calls[i].function.arguments`تا وقتي که به تدريج به اينجا برميگردين`finish_reason: "tool_calls"`. .
- **Anthropic.**وقایع بلاک-ستارت / بلاک-دلتا / بلاک-ستاپ`input_json_delta`قطعات بحث های جزئی را دارند.
- **Gemini.** `streamFunctionCallArguments`(جديد در جوميني 3) قطعاتي را با يک`functionCallId`تا چند تماس موازی بتوانند با هم ارتباط برقرار کنند.

مرحله 13 · 03 به طور عمیق در مورد جمع آوری مجدد موازی + جریان می پردازد. این درس بر شکل های اعلام و تماس یک بار متمرکز است.

### خطاها و تعمیر

اشتباهات استدلال غیرفعال نیز متفاوت به نظر می رسند.

- **OpenAI (non-strict).**مدل بازپرداخت`arguments: "{bad json}"`، تجزیه JSON شما شکست می خورد، شما یک پیام خطا تزریق و دوباره تماس بگیرید.
- **OpenAI (strict).**اعتبارسنجی در زمان رمزگذاری اتفاق می افتد؛ JSON غیرفعال غیرممکن است اما `refusal`می تونه ظاهر بشه
- **Anthropic (non-strict).** `input`ممکن است شامل زمینه های غیر منتظره باشد، طرح مشاوره ای است.`strict: true`نمونه گیری به طرح محدود می شود.
- **Gemini.**ویژگی OpenAPI 3.0: `enum`در زمینه های شی که به طور ساکت نادیده گرفته می شوند، خود را تأیید کنید.

### الگوی مترجم

یک اعلامیه ابزار کانونیکی در کد شما به این شکل است (شما شکل را انتخاب می کنید):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

سه تا تابع کوچک به سه شکل ارائه دهنده ترجمه می کنند.`code/main.py`این روش درست است و سپس یک ابزار جعلی را از طریق شکل پاسخ هر ارائه دهنده به صورت دور می کند. هیچ شبکه ای مورد نیاز نیست.

تیم های تولید این مترجم را در قالب`AbstractToolset`(آای پایدانتک)`UniversalToolNode`(لنگ گراف) یا`BaseTool`مرحله 13 · 17 یک دروازه را ارسال می کند که یک API به شکل OpenAI را در مقابل هر یک از سه مورد قرار می دهد.

```figure
function-call-args
```

## ازش استفاده کن

`code/main.py`یک قانون قانونی تعریف می کند`Tool`این سیستم در حال بررسی پاسخ ارائه دهنده هر شکل را به همان شیء تماس کانونیکی انجام می دهد و نشان می دهد که معنویت زیر پوست یکسان است. آن را اجرا کنید و سه اعلامیه را کنار هم تشخیص دهید.

چه چیزی رو باید ببینیم:

- سه بلوک اعلامی تنها با نام پاکت و زمینه متفاوت هستند.
- سه بلوک پاسخ در جایی که تماس زندگی می کند متفاوت است (در سطح بالا `tool_calls`،`content[]`بلوک`parts[]`وارد شدن
- یکی`canonical_call()`استخراجات تابع`{id, name, args}`از تمام سه شکل پاسخ.

## -باده

این درس به ما کمک می کند`outputs/skill-provider-portability-audit.md`. در صورت یکپارچه سازی تماس با یک ارائه دهنده، مهارت یک حسابرسی حمل و نقل را ایجاد می کند: کدام ارائه دهنده محدودیت هایی را دارد که به آن اعتماد دارد، کدام زمینه ها نیاز به تغییر نام دارند و چه چیزی در هنگام انتقال به هر ارائه دهنده دیگری قطع می شود.

## تمرینات

1. فرار کن`code/main.py`و بررسی کنید که سه اعلامیه JSON ارائه دهنده همگی یک سریال مشابه را در زیر قرار می دهند`Tool`ابزار کاینونیکی را برای اضافه کردن یک پارامتر enum تغییر دهید و تایید کنید که فقط مترجم Gemini برای مدیریت ویژگی OpenAPI نیاز دارد.

2. اضافه کنید`ListToolsResponse`پارسر برای هر ارائه دهنده که لیست ابزار را استخراج می کند یک مدل پس از یک `list_tools`OpenAI یک تماس بومی ندارد؛ توجه به این عدم همتایی کنید.

3. اجرا`tool_choice`تبدیل: نقشه یک کانونیک`ToolChoice(mode="force", tool_name="x")`در هر سه شکل ارائه دهنده.`mode="any"`و`mode="none"`. جدول تفاوت درس رو چک کن

4. یکی از سه ارائه دهنده را انتخاب کنید و راهنمای تماس با عملکرد را از پایان به آخر بخوانید. یک زمینه را در مشخصات طرح خود پیدا کنید که دو مورد دیگر از آن پشتیبانی نمی کنند.`strict`, انسان شناسی`disable_parallel_tool_use`، دوقلو`function_calling_config.allowed_function_names`. .

5. یک ویکتور آزمون بنویسید: یک ابزار که استدلال آن در نقض طرح اعلام شده است. آن را از طریق اعتبار دهنده هر ارائه دهنده اجرا کنید (stdlib در درس 01 به عنوان یک پراکسی انجام می شود) و ثبت کنید که کدام خطا ایجاد می شود. سند که شما در تولید برای دقت استفاده می کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Function calling | "Tool use" | Provider-level API for structured tool-call emission |
| Tool declaration | "Tool spec" | Name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | OpenAI flag that constrains decoding to match schema |
| `tool_use` block | "Anthropic's call shape" | Inline content block with id, name, input |
| `functionCall` part | "Gemini's call shape" | A `parts[]` entry containing name, args, and id |
| Arguments-as-string | "Stringified JSON" | OpenAI returns args as a JSON string, not an object |
| Parallel tool calls | "Fan-out in one turn" | Multiple tool calls in one assistant message |
| Refusal | "Model declines" | Strict-mode-only refusal block instead of a call |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini uses a JSON-Schema-like dialect with minor differences |

## خواندن بیشتر

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) مرجع قانونی شامل حالت سختگیرانه و تماس های موازی
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) `tool_use`و`tool_result`سیمانیک بلاک
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) تماس های موازی، شناسه های منحصر به فرد و زیر مجموعه OpenAPI
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) سطح شرکت دوقلوها
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) جزئیات اجرای طرح های حالت سخت
