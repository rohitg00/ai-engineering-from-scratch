# خروجی ساختار یافته  طرح JSON، Pydantic، Zod، رمزگذاری محدود

> " از مدل به خوبی بخواهید JSON را برگرداند " حتی در مدل های مرزها 5 تا 15 درصد از زمان شکست می خورد. خروجی ساختاری با رمزگذاری محدود این شکاف را می پوشاند: مدل به معنای واقعی کلمه از انتشار یک توکن که به شکلی از طرح جلوگیری می کند. حالت سخت OpenAI ، استفاده از ابزار طرح های Anthropic ، Gemini `responseSchema`، هوش مصنوعی پيدانتیک`output_type`، و زود`.parse`این درس اعتبار دهنده شیما را می سازد و متعلمین قرارداد حالت سخت برای هر لوله استخراج تولید استفاده خواهند کرد.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## اهداف یادگیری

- یک طرح JSON 2020-12 برای یک هدف استخراج با استفاده از محدودیت های مناسب (enum، min/max، مورد نیاز، الگوی) بنویسید.
- توضیح دهید که چرا حالت سختگیرانه و رمزگذاری محدود تضمین های متفاوتی از "مفعولیت پس از نسل" را ارائه می دهند.
- سه حالت شکست را تشخیص دهید: خطا تجزیه، نقض طرح، رد مدل.
- یک خط لوله استخراج با تعمیر تایپ شده و مدیریت رد تایپ شده ارسال کنید.

## مشکل

يه مامور که يه ایمیل سفارش خريد رو ميخواد بايد متن آزاد رو به `{customer, line_items, total_usd}`سه راه

**Approach one: prompt for JSON.**"به JSON با زمینه های مشتری، line_items، total_usd پاسخ دهید". 85 تا 95 درصد زمان در مدل های مرزی کار می کند. به شش روش شکست می خورد: بازپرداخت گمشده، کمال عقب، انواع اشتباه، زمینه های توهم، کوتاه شده در حد نشانه، پروز لکه "JSON:".

**Approach two: validate after generation.**آزادانه تولید، تجزیه و تحلیل، تأیید با شیما، دوباره در شکست تلاش کنید. قابل اعتماد اما گران قیمت  شما برای هر تلاش مجدد پرداخت می کنید، و اشکال کوتاه کردن هزینه یک باری اضافی در هر اتفاق است.

**Approach three: constrained decoding.**ارائه دهنده در زمان رمزگذاری طرح را اجرا می کند. توکن های باطل از توزیع نمونه گیری پنهان می شوند. تولید تضمین شده برای تجزیه و تحلیل و تضمین برای تأیید است. شکست به یک حالت سقوط می کند: انکار (نموذج تصمیم می گیرد که ورودی با طرح مطابقت ندارد).

هر ارائه دهنده مرز 2026 نوعی راه حل سه را ارسال می کند.

- **OpenAI.** `response_format: {type: "json_schema", strict: true}`و اضافه`refusal`در پاسخ اگر مدل کاهش یابد.
- **Anthropic.**اجرای طرح در `tool_use`ورودی ها`stop_reason: "refusal"`اين چيزيه که نميخوام بگم، ولي`end_turn`بدون صداي ابزار، سيگنال هست
- **Gemini.** `responseSchema`در سال 2026، Gemini محدودیت های گرامرایی در سطح توکن برای انواع انتخاب شده را ارسال می کند.
- **Pydantic AI.** `output_type=InvoiceModel`یک ساختار ساختاری را منتشر می کند`RunResult`به عنوان `InvoiceModel`. .
- **Zod (TypeScript).**تجزیه کننده زمان اجرا که تولید ارائه دهنده را با یک طرح Zod تأیید می کند؛ با OpenAI جفت می کند `beta.chat.completions.parse`. .

موضوع مشترک: یک بار طرح را اعلام کنید، آن را از پایان به پایان اجرا کنید.

## مفهوم

### برنامه JSON 2020-12  زبان فرانسه

هر ارائه دهنده JSON Schema 2020-12 را قبول می کند. ساختارهای مورد استفاده شما بیشتر:

- `type`: یکی از`object`،`array`،`string`،`number`،`integer`،`boolean`،`null`. .
- `properties`: نقشه نام زمینه به زیر طرح
- `required`: لیست نام های زمینه ای که باید ظاهر شوند.
- `enum`: مجموعه بسته از مقادیر مجاز
- `minimum`-`maximum`(نمره ها)`minLength`-`maxLength`-`pattern`(حافظه ها)
- `items`: فرعی که برای هر عنصر آرایه اعمال می شود.
- `additionalProperties`.`false`حظر کردن زمینه های اضافی (پیش فرض با حالت متفاوت است).

حالت سخت OpenAI سه مورد نیاز اضافه می کند: هر ملک باید در `required`،`additionalProperties: false`همه جا و هيچکدوم حل نشده`$ref`اگه اينو بشکني، API 400 رو در زمان درخواست باز مياد

### پیدانتیک، پیتون

Pydantic v2 از طریق مدل های شکل کلاس داده ها، طرح JSON را تولید می کند.`model_json_schema()`هوش مصنوعی پیدانتیک اینو بسته می کنه تا بنویسی:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

و چارچوب عامل این طرح را به حالت سخت OpenAI، Anthropic ترجمه می کند`input_schema`، يا دوقلوها`responseSchema`در کنار آن، محصول مدل به عنوان یک تایپ شده باز می گردد`Invoice`مثال. اشتباهات اعتبار افزايش`ValidationError`با مسیرهای خطا تایپ شده.

### زود، اتصال تایپ اسکریپت

زاد (`z.object({customer: z.string(), ...})`) معادل TS است. SDK Node OpenAI نشان می دهد `zodResponseFormat(Invoice)`که به بار مفید JSON Schema API ترجمه می شود.

### رد

حالت سخت نمی تواند مدل را مجبور به پاسخ دهد. اگر ورودی نمی تواند به طرح ("ایمیل یک شعر بود، نه یک فاکتور") ، مدل یک `refusal`فیلدی که دلیل را در بر می گیرد. کد شما باید این کار را به عنوان یک نتیجه درجه اول، نه یک شکست انجام دهد. این رد نیز به عنوان یک سیگنال ایمنی مفید است: یک مدل که از یک شماره کارت اعتباری از یک ایمیل محموده شده درخواست می کند، یک رد با دلیل ایمنی همراه است.

### رمزنگاری محدود در فضای باز

پیاده سازی های وزن باز از سه تکنیک استفاده می کند.

1. **Grammar-based decoding**(`outlines`،`guidance`،`lm-format-enforcer`): یک اتوماتوم محدود تعیین کننده از طرح بسازید؛ در هر مرحله، لاجیت توکن هایی را که FSM را نقض می کنند، پنهان کنید.
2. **Logit masking with a JSON parser**: یک مرورگر JSON جریان را در مرحله قفل با مدل اجرا کنید؛ در هر مرحله، مجموعه ی توکن های معتبر- بعدی را محاسبه کنید.
3. **Speculative decoding with a verifier**: مدل طرح ارزان پیشنهاد توکن ها، تایید کننده اجرای طرح.

ارائه دهندگان تجاری یکی از این موارد را در پشت صحنه انتخاب می کنند. در سال 2026، حالت فن سریعتر از تولید ساده برای تولیدات کوتاه و ساختاری است و تقریباً همان سرعت برای تولیدات طولانی است.

### سه حالت شکست

1. **Parse error.**محصول JSON معتبر نیست. نمی تواند در حالت سخت اتفاق بیفتد. هنوز هم می تواند در ارائه دهندگان غیر سخت اتفاق بیفتد.
2. **Schema violation.**. محصولي که ازش استفاده مي کنه . اما از طرح تخريب مي کنه . نمي تونه تحت حالت سختي اتفاق بيفته
3. **Refusal.**مدل کاهش می یابد باید به عنوان یک نتیجه تایپ شده اداره شود

### استراتژی بازتجربه

وقتی شما خارج از حالت سخت هستید (استفاده از ابزار انسان، غیر سخت OpenAI، دوقلوها قدیمی تر) ، الگوی بازیابی این است:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

یک بار تکرار به اندازه کافی است. سه بار تکرار، فلک های ضعیف مدل را می گیرد. فراتر از سه نشانه ای از یک طرح بد است: مدل نمی تواند آن را برای برخی ورودی ها برآورده کند و پرامپت یا طرح نیاز به اصلاح دارد.

### حمایت از مدل های کوچک

کد بندی محدود در مدل های کوچک کار می کند. یک مدل باز 3B با اجرای دستور کار از مدل 70B با دستور العمل خام در وظایف ساختاری بهتر است. این دلیل اصلی است که تولیدات ساختاری مهم است: این قابلیت اطمینان را از اندازه مدل جدا می کند.

```figure
constrained-decoding
```

## ازش استفاده کن

`code/main.py`یک اعتبار دهنده JSON Schema 2020-12 را در stdlib (نوع، مورد نیاز، enum، min/max، الگوی، عناصر، ویژگی های اضافی) ارسال می کند.`Invoice`یک محصول LLM جعلی را از طریق اعتبار دهنده اجرا می کند که خطا تجزیه، نقض طرح و مسیرهای رد را نشان می دهد. محصول جعلی را برای پاسخ واقعی هر ارائه دهنده در تولید تغییر دهید.

چه چیزی رو باید ببینیم:

- اعتبار دهنده یک تایپ شده را بازمی گرداند`[ValidationError]`این شکل است که می خواهید در دستور دوباره امتحان کنید.
- شاخه رد دوباره تلاش نمی کند. آن را ثبت و بازگشت یک رد تایپ شده. مرحله 14 · 09 استفاده از رد به عنوان یک سیگنال ایمنی.
- .`additionalProperties: false`بررسی آتش در ورودی آزمایش خصومت، نشان دادن اینکه چرا حالت سخت در زمینه های توهم بند می کند.

## -باده

این درس به ما کمک می کند`outputs/skill-structured-output-designer.md`با توجه به هدف استخراج متن آزاد (فاکتورها، بلیط های پشتیبانی، رزومه ها و غیره) ، این مهارت یک طرح JSON 2020-12 را تولید می کند که با حالت سخت سازگار است و یک مدل Pydantic که آن را منعکس می کند، با رد تایپ شده و بازخورد مجدد در دستکاری است.

## تمرینات

1. فرار کن`code/main.py`. اضافه کنيد يه مورد آزمايش چهارم که`total_usd`یک عدد منفی است. تایید کننده آن را با `minimum`مسیر محدود کننده

2. اعتبار دهنده را به حمایت گسترش دهید `oneOf`با یک تبعیضگر.`line_item`یک محصول یا خدمات است که با برچسب `kind`. حالت سخت در اینجا قوانین ظریف دارد. راهنمای خروجی ساختار یافته OpenAI را بررسی کنید.

3. همان طرح فاکتور را با یک مدل پایه Pydantic بنویسید و مقایسه کنید `model_json_schema()`به شکل پیش فرض، مجموعه های Pydantic یک میدان را که در نسخه دستی حذف شده است شناسایی کنید.

4. میزان رد را اندازه گیری کنید. ده ورودی را که نباید استخراج شوند (یک آهنگ، یک مدرک ریاضی، یک ایمیل خالی) بسازید و آنها را از طریق یک ارائه دهنده واقعی با حالت سخت انجام دهید. رد ها را با خروجی های توهم آمیز محاسبه کنید. این حقیقت اصلی شما برای تلاش های مجدد آگاه از رد است.

5. راهنمای خروجی ساختاری OpenAI را از بالا تا پایین بخوانید. ساختاری را که به طور صریح ممنوع می کند در حالت سخت که JSON Schema ساده اجازه می دهد شناسایی کنید. سپس یک طرح طراحی کنید که از ساختاری ممنوع غیر ضروری استفاده کند و آن را برای مطابقت سخت تر تغییر دهد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "The schema spec" | IETF-draft schema dialect every modern provider speaks |
| Strict mode | "Guaranteed schema" | OpenAI flag that enforces schema via constrained decoding |
| Constrained decoding | "Logit masking" | Decode-time enforcement that masks invalid next-tokens |
| Refusal | "Model declines" | Typed outcome when input cannot fit the schema |
| Parse error | "Invalid JSON" | Output did not parse as JSON; impossible under strict |
| Schema violation | "Wrong shape" | Parsed but violated types / required / enum / range |
| `additionalProperties: false` | "No extras allowed" | Forbids unknown fields; required in OpenAI strict |
| Pydantic BaseModel | "Typed output" | Python class that emits and validates JSON Schema |
| Zod schema | "TypeScript output type" | TS runtime schema for provider output validation |
| Grammar enforcement | "Open-weights constrained decode" | FSM-based logit masking, as in outlines / guidance |

## خواندن بیشتر

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) شرایط سختگیرانه ای در مورد حالت، رد و رد و برنامه
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) پس از راه اندازی در اوت 2024 که تضمین رمزگذاری را توضیح می دهد
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) بسته بندی های output_type تایپ شده که به هر ارائه دهنده سریال می شوند
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) مشخصات کاینونیکی
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) یادداشت های پیاده سازی شرکت و هشدارهای سختگیرانه
