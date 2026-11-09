# مشاهده ای: لانگفوز، فینکس، اوپیک

> در سال 2026 سه پلت فرم مشاهده ای از عوامل خود میزبان در اختیار است. لانگفوز (MIT)  6 میلیون نصب / ماه، ردیابی + مدیریت سریع + ارزیابی + بازیابی جلسه. آریز فینیکس (Elastic 2.0)  ارزیابی های عمیق خاص با عوامل، ارتباط RAG، ابزار خودکار OpenInference. کمیت آپیک (Apache 2.0)  بهینه سازی خودکار سریع، guardrails، تشخیص توهمات LLM-judge.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## اهداف یادگیری

- سه سیستم عامل قابل مشاهده خود میزبان و مجوزهای آنها را نام دهید و بگویید کدام مجوز منبع باز OSI نیست.
- در هر کدام از این موارد، قوی ترین ویژگی های آن ها را تشخیص دهید: Langfuse (مگمت سریع + جلسات) ، Phoenix (RAG + خودآداسازی) ، Opik (آداسازی + محافظ).
- توضیح دهید که چرا 89 درصد سازمان ها گزارش می دهند تا سال 2026 قابلیت مشاهده عوامل را در اختیار داشته باشند.
- پیاده سازی یک خط لوله از ردیابی به داشبورد با ارزیابی قاضی LLM.

## مشکل

OTel GenAI (درسی 23) به شما طرح را می دهد. شما هنوز هم به پلت فرم نیاز دارید که دامنه را جذب کند، ارزیابی ها را اجرا کند، نسخه های فوری را ذخیره کند و بازپسین ها را روی سطح قرار دهد. هر سه متقاضیان بر بخش های مختلف چرخه زندگی تاکید می کنند.

## مفهوم

### لانگفوز (MIT)

- 6M+ SDK نصب / ماه، 19k+ ستاره های GitHub.
- ویژگی ها: ردیابی، مدیریت سریع با ورژن سازی + زمین بازی، ارزیابی (LLM به عنوان قاضی، بازخورد کاربر، سفارشی) ، بازیابی جلسه.
- ژوئن 2025: ماژول های تجاری (LLM-as-a-judge، صف های یادداشت، آزمایش های فوری، Playground) که قبلاً تحت MIT منبع باز هستند.
- قوی ترین برای: مشاهده ای از پایان تا پایان با حلقه مدیریت سریع.

### آریز فینکس (لنسیز لاستیک 2.0)

- ارزیابی دقیق تر برای عوامل: دسته بندی ردی، تشخیص ناهنجاری، ارتباط بازیافت برای RAG.
- دستگاه خودکار OpenInference بومی
- جفت با آریز اکس برای تولید مدیریت شده
- هیچ نسخه ای سریع  به عنوان یک ابزار حرکت / بازپسین رفتاری در کنار سیستم عامل های گسترده تر قرار گرفته است.
- قوی ترین برای: ارتباط RAG، حرکت رفتاری، تشخیص ناهنجاری

### ستاره دنباله دار Opik (Apache 2.0)

- بهینه سازی سریع خودکار از طریق آزمایشات A/B
- محافظ (نویسی از PII، محدودیت های موضعی)
- حواسمي که در مورد "معلمي عدالت" پيدا ميکنه
- معیار از اندازه گیری خود Comet: Logs Opik + evals در 23.44s در مقابل Langfuse 327.15s (~ 14x شکاف)  معیار فروشنده را به عنوان جهت گیری می گیرند.
- قوی ترین برای: حلقه بهینه سازی، آزمایش خودکار، اجرای رایل محافظ

### اطلاعات صنعت

بر اساس ماکسیم (تحلیلی ساحی 2026): 89 درصد از سازمان ها قابلیت مشاهده عوامل را در اختیار دارند؛ مسائل کیفیت مانع تولید اصلی هستند (32 درصد از پاسخ دهندگان آنها را ذکر می کنند).

### یکی رو انتخاب میکنم

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### جایی که این الگوی اشتباه می شود

- **No eval strategy.**ردیابی بدون ارزیابی فقط ردیابی گران قیمت است.
- **Self-rolled LLM-judge without grounding.**الگوی انتقادی (درسی 05) اعمال می شود  قاضیان به ابزارهای خارجی برای تأیید واقعیت نیاز دارند.
- **Prompt versions not tied to traces.**وقتی پروگراژ برگشت می کنه، نمیتونی به اون پمپ که باعثش شد، تقسیم کنی.

```figure
wb-trace-ingest
```

## آن را بسازید

`code/main.py`یک جمع کننده ردیابی stdlib + ارزیابی کننده قاضی LLM را اجرا می کند:

- اسپانز شکل GenAI را بخور
- گروه به ترتیب جلسه، تگ شکست خورده اجرا (سفر محافظ، ارزیابی اعتماد کم).
- يه قاضي قانون نامه اي که پاسخ هاي مامورها رو بر روي يه موضوعي نمره ميده
- خلاصه ای شبیه داشبورد: نرخ شکست، دلایل شکست بالا، توزیع امتیاز ارزیابی.

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

نتیجه: امتیاز ارزیابی در هر جلسه و دسته بندی شکست مطابق با آنچه که Langfuse / Phoenix / Opik نشان می دهد.

## ازش استفاده کن

- **Langfuse**خود میزبان یا ابر؛ سیمبر از طریق OTel یا SDK خود.
- **Arize Phoenix**خود میزبان؛ آٹو ابزار OpenInference.
- **Comet Opik**خود میزبان یا ابر؛ حلقه بهینه سازی خودکار.
- **Datadog LLM Observability**برای تیم های مخلوط عملیات +ML که قبلاً Datadog را اداره می کنند.

## -باده

`outputs/skill-obs-platform-wiring.md`یک پلتفرم را انتخاب می کند و ردیابی + ارزیابی + نسخه های فوری را به یک عامل موجود منتقل می کند.

## تمرینات

1. یک هفته از آثار OTel را به ابر Langfuse صادر کنید کدام جلسات شکست خوردند؟ چرا؟
2. یک عنوان قضاوت LLM برای دامنه خود بنویسید (در حقیقت درست، صدا، رعایت دامنه).
3. مقایسه نسخه ی سریع لینگفوز با دسته بندی ردیف فینکس رو کنید که میگه چه چیزی سریعتر شکسته؟
4. اسناد محافظ اوپک رو مطالعه کن و به یکی از ماموراتت خبر بده
5. سه تا رو در کارپوست خودتون بنچ بزنید، اعداد منتشر شده توسط فروشنده را نادیده بگیرید، تعداد خودتون را اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## خواندن بیشتر

- [Langfuse docs](https://langfuse.com/) ردیابی، ارزیابی، پیام
- [Arize Phoenix docs](https://docs.arize.com/phoenix) دستگاه های خودکار، حرکت
- [Comet Opik](https://www.comet.com/site/products/opik/) بهینه سازی + محافظ
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) طرح سه تا مصرف
