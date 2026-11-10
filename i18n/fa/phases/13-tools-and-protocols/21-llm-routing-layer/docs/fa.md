# لایه راه اندازی LLM  LiteLLM, OpenRouter, Portkey

> قفل کردن ارائه دهنده گران است بار کاری مختلف برای تماس با ابزار برای مدل های مختلف مناسب است. دروازه های مسیریابی یک سطح API را، آزمایشات مجدد، شکست، ردیابی هزینه ها و محافظ را ارائه می دهند. سه آرکیتیپ در سال 2026 تسلط دارند: LiteLLM (مرکز باز خود میزبان) ، OpenRouter (SaaS مدیریت شده) ، Portkey (درجات تولید، منبع باز در مارس 2026). این درس معیارهای تصمیم گیری را نام می دهد و دروازه مسیریابی stdlib را راه اندازی می کند.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker), TypeScript
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## اهداف یادگیری

- گزینه های راه اندازی خود میزبان، مدیریت شده و درجه تولید را تشخیص دهید.
- اجرای یک زنجیره بازپسین که به ترتیب اولویت مشخصی از شکست های ارائه دهنده دوباره آزمایش می شود.
- هزینه هر درخواست و استفاده از توکن ها را در بین ارائه دهندگان ردیابی کنید.
- برای محدودیت تولید مشخصی بین LiteLLM، OpenRouter و Portkey تصمیم بگیرید.

## مشکل

سناریوهای که مسیر ارائه دهنده مهم است:

1. **Cost.**کلاود سونت سه برابر هزینه های هیکو است. برای یک کار تحریک، هیکو کافی است. برای یک کار سنتز، سونت ارزشش را دارد. مسیر به درخواست.

2. **Failover.**OpenAI يه ساعت بد داره، هر درخواستي که ميخواي شکست ميگيره، ميخواي بدون اينکه دوباره به آنتراپي برگردي

3. **Latency.**يه چيت زنده به يه سريع وقت براي اولين توکن نياز داره. يه خلاصه کننده دسته اي نه. روت به واسطه SLA تاخير.

4. **Compliance.**کاربران اتحادیه اروپا باید در مناطق اتحادیه اروپا بمانند.

5. **Experimentation.**دو مدل با هم کار ميکنن، روت به صورت امتحان

کد گذاری دستی همه این ها در هر یک از ادغام ها تکرار می شود. یک دروازه مسیریابی یک API سازگار با OpenAI را می دهد و بقیه را اداره می کند.

## مفهوم

### شکل پراکسی سازگار با OpenAI

همه با شکل OpenAI صحبت ميکنن.`/v1/chat/completions`، طرح OpenAI را قبول می کند و درونی به Anthropic / Gemini / Cohere / Ollama / هر چیزی است.

### نام مستعار مدل

به جای یه ID عکس گیر کرده، کد شما میگه`our_smart_model`. گیت وے نقشه های مستعار به مدل های واقعی. وقتی یک ارائه دهنده نسل جدید ارسال می کند، شما مستعار سرور سمت تغییر می دهید؛ کد شما هیچ چیز را لمس نمی کند.

### زنجیره های بازپسین

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

دروازه ها این را در یک پیکربندی تعریف می کنند. تلاش های بازبینی در برابر بودجه حساب می شوند تا سقوط سقوط هزینه ها منفجر نشود.

### ذخیره سازی رمزنگاری

پیام های مشابه یا تقریباً مشابه به جای ارائه دهنده به یک کش می رسند. پس انداز در حلقه های مکرر عامل می تواند 30 تا 60 درصد باشد. کلیدها مبتنی بر ادغام هستند؛ پیام های تقریباً مشابه یک فضای کش را به اشتراک می گذارند.

### رایل های نگهبان

سطح دروازه:

- **PII redaction.**قبل از ارسال پیام ها، ردگز یا ML را اجرا کنید.
- **Policy violations.**درخواست هایی که محتوای ممنوعه دارند را رد کنید.
- **Output filters.**تکمیلات رو برای لیک ها پاک کن

پورتکي و کنگ هر دو سفينه محافظي را با نظر مي دهند.

### محدودیت نرخ هر کلید

یک کلید API = یک تیم. بودجه های هر کلید مانع از مصرف یک تیم از کوتا مشترک می شوند. اکثر دروازه ها این را پشتیبانی می کنند.

### معاملات خود میزبان در مقابل معاملات مدیریت شده

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

لایت للم وقتی برنده می شود که شما یک تیم SRE دارید و می خواهید حاکمیت داده ها را داشته باشید. OpenRouter وقتی برنده می شود که شما یک اشتراک واحد و بدون زیرنویس می خواهید. Portkey وقتی برنده می شود که شما نیاز به محافظ و رعایت از جعبه دارید.

### ردیابی هزینه ها

هر درخواستي که هست`provider`،`model`،`input_tokens`،`output_tokens`. به قیمت هر مدل برای هر توکن ضرب کنید (از یک صفحه قیمت گذاری که دروازه نگه می دارد) .

### MCP + رویتینگ

دروازه می تواند هر دو تماس LLM و درخواست نمونه گیری MCP را هدایت کند. هنگامی که مدل درخواست نمونه گیری ترجیحات یک مدل خاص را ترجیح می دهد، دروازه به پشت سرانه راست ترجمه می شود. این جایی است که مرحله 13 · 17 (دروازه MCP) و دروازه مسیریابی این درس گاهی به یک سرویس ادغام می شوند.

### استراتژی های مسیر

- **Static priority.**اولين نفر در فهرست، به اشتباه برگرد
- **Load balancing.**- گرد و غبار یا وزن
- **Cost-aware.**ارزان ترین مدل را انتخاب کنید که با تاخیر / کیفیت ملاقات کند.
- **Latency-aware.**سریعترین مدل رو در اين نين دقیقه آخر انتخاب کن
- **Task-aware.**مسیرهای طبقه بندی سریع کدگذاری به یک مدل، خلاصه به مدل دیگر.

```figure
tp-router-failover
```

## ازش استفاده کن

`code/main.py`یک دروازه مسیریابی را در حدود 150 خط پیاده سازی می کند: درخواست های شکل OpenAI را پذیرفته است، به هر ارائه دهنده ترجمه می کند، زنجیره پیشگام گیری پیشگامایی را اجرا می کند، هزینه های هر درخواست را ردیابی می کند و یک گذرنامه ویرایش PII را در ورودی ها اعمال می کند. آن را با سه سناریو اجرا کنید: درخواست عادی، قطع کار ارائه دهنده اصلی که باعث رد گیری می شود، لیک PII که توسط ویرایش دیده می شود.

چه چیزی رو باید ببینیم:

- `ROUTES`dict: alias -> لیست اولویت بندی ارائه دهندگان قطعی.
- بازتاب بازي در 5xx دوباره تلاش ميکنه
- ردیابی هزینه استفاده از توکن را با نرخ هر مدل ضرب می کند.
- Redaktor PII قبل از ارسال الگوهای شکل SSN را پاک می کند.

## -باده

این درس به ما کمک می کند`outputs/skill-routing-config-designer.md`با توجه به یک پروفایل بار کاری (خستگی، هزینه، مطابقت) ، مهارت LiteLLM / OpenRouter / Portkey را انتخاب می کند و یک پیکربندی روتینگ را تولید می کند.

## تمرینات

1. فرار کن`code/main.py`. سناریوی قطع برق را فعال کنید؛ تایید کنید که در مورد ارائه دهنده دوم سقوط می کند و هزینه به درستی نسبت داده می شود.

2. اضافه کردن حافظه پیشگیری معنوی: SHA256 از پرامپت یک کلید جستجوی است؛ کلیک های حافظه پیشگیری بلافاصله باز می گردند. صرفه جویی هزینه ها را در تماس مکرر اندازه گیری کنید.

3. اضافه کردن یک طبقه بندی سریع که مسیر "کوید ..." به یک نام مستعار که به نفع هوش و "جمع ..." به نام مستعار که به نفع سرعت است.

4. بودجه های طراحی در هر تیم: هر تیم دارای یک حد هزینه ماهانه است؛ دروازه درخواست ها را پس از رسیدن به حد رد می کند. یک اندازه گیری تحقیقی اجرا را انتخاب کنید (به صورت درخواست یا پنجره).

5. اسناد LiteLLM، OpenRouter و Portkey را کنار هم بخوانید. یکی از ویژگی های هر کشتی را نام ببرید که دو کشتی دیگر ندارند.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## خواندن بیشتر

- [LiteLLM — docs](https://docs.litellm.ai/) راه اندازی راهبری خود میزبان
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) مدیریت روتینگ SaaS
- [Portkey — docs](https://portkey.ai/docs) مسیر تولید با رایل های محافظ
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) راهنمای تصمیم گیری
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) بررسی فروشنده
