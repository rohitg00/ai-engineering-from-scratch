# Capstone 02  RAG بر روی کد (تلاش معنوی در میان گزارش ها)

> هر سازمان مهندسی جدی در سال 2026 یک جستجوی داخلی کد انجام می دهد که معنی را درک می کند، نه فقط رشته ها. منبع گراف Amp، پاسخ های کد پایه Cursor، نمودار شرکت Augment، نقشه مجدد Aider، MCP داخلی Pinterest  شکل مشابه. خیلی از بازبینی ها رو مصرف کن، با درختنگر تجزیه کن، بخش های سطح عملکرد و کلاس را وارد کن، جستجوی هیبریدی، رتبه بندی مجدد، پاسخ با نقل قول ها. این سنگ پایان از شما می خواهد که یک را بسازید که 2 میلیون خط کد را در 10 repos اداره کند و در هر فشار Git دوباره به طور فزاینده ای به عنوان شاخص زنده بماند.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## مشکل

تا سال 2026 هر عامل کد گذاری مرزی با یک لایه بازیافت کد پایه حمل می کند زیرا پنجره های زمینه به تنهایی سوالات بین المللی را حل نمی کنند. زمینه 1M-token کلاود کمک می کند؛ این نیاز به بازیافت رتبه بندی را از بین نمی برد. جستجوی ساده ای در مورد قطعات خام زهرات به دنبال کد تولید شده، تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک تک پاسخ تولید یک جستجوی ترکیبی (بثافت + BM25) در مورد قطعات آگاه از AST با یک رتبه بندی مجدد است، که توسط یک نمودار مرجع های نماد پشتیبانی می شود.

شما این را با شاخص سازی یک ناوگان واقعی  نه یک repo آموزش  و اندازه گیری MRR@10، وفاداری نقل قول و تازه بودن افزایشی یاد می گیرید. حالت های شکست زیرساخت هستند: یک monorepo فایل 100k، یک فشار که نیمی از فایل ها را بازنویسی می کند، یک سوال که برای پاسخ صحیح باید چهار repos را عبور کند.

## مفهوم

یک خط لوله مصرفی آگاه از AST هر فایل را با درختان زیر نظر می گیرد، از عملکرد و گره های کلاس استخراج می کند و قطعات را در مرزهای گره به جای پنجره های مشخصی ثابت می کند. هر قطعه سه تمثیل دارد: یک گنجانده شدن کثیف (کد Voyage-3 یا کد نامی-embed-code) ، اصطلاحات کم BM25 و خلاصه ای کوتاه از زبان طبیعی. خلاصه یک روش بازیافتی سوم را اضافه می کند  کاربران از "چگونه X مجاز است" می پرسند و خلاصه "authz" را ذکر می کند، حتی اگر کد فقط `check_permission`. .

بازيافت همبريد است یک جستجو هر دو جستجو کثیف و BM25 را می کشد، top-k را ادغام می کند و اتحادیه را به یک رتبه بندی مجدد کراس کدرها (Cohere rerank-3 یا bge-reranker-v2-gemma-2b) می دهد. لیست رتبه بندی مجدد به یک سنتزایزر طولانی (Claude Sonnet 4.7 با پیشخوانی سریع، یا Llama 3.3 70B خود میزبان) با دستورالعمل برای نقل از هر ادعای با فایل و خط دامنه می رود. پاسخ بدون نقل قول با فیلتر بعد از ارسال رد می شود.

تازه بودن افزایشی مشکل زیرساخت است. Git push باعث ایجاد تفاوت می شود: کدام فایل ها تغییر کرده اند، کدام نماد تغییر کرده است. تنها قطعات تحت تأثیر قرار داده شده دوباره وارد می شوند. حاشیه های نماد متقابل فایل (آمورد، تماس روش) تحت تأثیر قرار می گیرند. شاخص بدون پردازش مجدد 2M خط هر یک از آنها محاسبه می شود.

## معماری

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## دسته

- تجزیه و تحلیل: درختان با 17 دستور زبان (پایتون، TS، Rust، Go، جاوا، C ++ و غیره)
- گنجانده شدن های ضخیم: Voyage-code-3 (hosted) یا nomic-embed-code-v1.5 (self-host), bge-code-v1 fallback
- شاخص تنفسی: تنتیوی (رس) با BM25F، با وزن میدان بر نام نماد در مقابل بدن
- DB ویکتور: Qdrant 1.12 با جستجوی هیبریدی یا pgvector + pgvector scale برای تیم های زیر 50M
- مدل خلاصه قطعه: کلاود هیکو 4.5 یا جیمنی 2.5 فلش، سریع ذخیره شده
- رتبه بندی مجدد: Cohere renank-3 یا bge-renanker-v2-gemma-2b خود میزبان
- آرکیستر: LlamaIndex جریان های کاری برای مصرف، LangGraph برای عامل جستجو
- سنتزایزر: کلاود سونت 4.7 (1M کنتکس) با پیشگیری سریع
- نمودار نماد: Neo4j (مدار) یا kuzu (درشده) برای حاشیه های واردات و تماس
- قابل مشاهده: طول زمان لنگفوز در هر مرحله بازیافت + سنتز

```figure
ce-hybrid-retrieval
```

## آن را بسازید

1. **Ingestion walker.**تاریخچه git را در هر هک فشار تکرار کنید. فایل های تغییر یافته را جمع آوری کنید. برای هر فایل، با درخت ناظر، عملکرد استخراج و گره های کلاس با دامنه منبع کامل خود را تجزیه کنید. رکورد های شکاف منتشر کنید`{repo, path, start_line, end_line, symbol, body}`. .

2. **Chunk summarizer.**دسته بندی ها به Haiku 4.5 با پیش فرض سیستم به سرعت به صورت پیش فرض می شوند. پیام: "این تابع را در یک جمله خلاصه کنید، نام گذاری قرارداد عمومی و عوارض جانبی آن را". خلاصه را در کنار بخش ذخیره کنید.

3. **Embedding pool.**دو صف موازی: کثیف (سفر کد-3 دسته 128) و خلاصه (مثل مدل، اما در رشته خلاصه)`{repo, path, start_line, end_line, symbol, kind}`. .

4. **BM25 index.**شاخص تانتیوی با وزن میدان: وزن نام نماد 4، وزن بدن نماد 1، وزن خلاصه 2. امکان پیدا کردن تابع با نام X را در کنار پیدا کردن تابع که X را انجام می دهد.

5. **Symbol graph.**برای هر قطعه، حاشیه ها را ثبت کنید: واردات (این فایل از نماد Y از repo Z استفاده می کند) ، تماس (این تابع روش M را در کلاس C می خواند) ، میراث. ذخیره در kuzu. در زمان جستجو برای گسترش بازیافت در مرز های repo استفاده می شود.

6. **Query agent.**لنگ گراف با سه گره`retrieve`آتش فشرده + BM25 در موازی، دو برابر (repo، مسیر، نماد) `rerank`کراس کودر رو روی 50 بالا اجرا میکنه و 10 بالا رو نگه می داره`synth`کلاود سونت 4.7 را با قطعاتی که در زمینه آن ها قرار گرفته است، می خواند، دستور سیستم را زیرنویس می کند، به نقل قول فایل:خط نیاز دارد.

7. **Citation enforcement.**بررسی محصول مدل؛ هر ادعای بدون یک`(repo/path:start-end)`لنگر برای تکرار درخواست نشان داده می شود یا رها می شود. جواب فقط به عنوان اشاره به کاربر را به کاربر برگردانید.

8. **Incremental re-index.**در هر وب هوک، تفاوت سطح نماد را محاسبه کنید. فقط قطعات که متن آنها تغییر کرده است را دوباره وارد کنید. لبه های نماد را برای قطعات که واردات آنها تغییر کرده است، دوباره محاسبه کنید. اندازه گیری: یک 50 فایل فشار دوباره در کمتر از 60 ثانیه برای یک ناوگان 2M-LOC.

9. **Eval.**برچسب 100 سوال بین المللی با فایل طلا: پاسخ خط. اندازه گیری MRR@10, nDCG@10, وفاداری نقل قول (تعداد ادعاها با لنگرهای قابل تأیید) و تاخیر p50/p99.

## ازش استفاده کن

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## -باده

مهارت قابل ارائه`outputs/skill-codebase-rag.md`. در صورت جمع آوری اطلاعات، آن را به خط تولید، شاخص های هیبریدی و عامل جستجو نشان می دهد و برای هر سوال بین المللی پاسخ داده شده را باز می گرداند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## تمرینات

1. کد Voyage-3 را برای کد نامی که به صورت خودکار میزبانی شده است تغییر دهید. دلتای MRR@10 را اندازه گیری کنید. گزارش دهید که آیا با فعال کردن رتبه بندی مجدد شکاف بسته می شود.

2. 20٪ کد تولید شده (بایلرپلاست تولید شده توسط LLM) را به کارپوس تزریق کنید و دوباره ارزیابی کنید. سم گرفتن را مشاهده کنید. یک پرچم "تولید شده" را به بار مفید اضافه کنید و وزن این ضربه ها را کاهش دهید.

3. مقایسه جستجو های هیبریدی Qdrant با pgvector + pgvectorscale در اندازه کورپوس خود را نشان دهید. گزارش p99 در اندازه دسته 1.

4. یک بررسی تحرک مبتنی بر نمونه گیری را اضافه کنید: هر هفته، ارزیابی 100 سوال را تکرار کنید. هشدار در MRR@10 کاهش > 5٪.

5. به رزولوشن نماد های متعدد زبان گسترش دهید: یک تابع پایتون که یک سرویس Go را از طریق gRPC فرا می خواند. از نمودار نماد برای پیوند آنها استفاده کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## خواندن بیشتر

- [Sourcegraph Amp](https://ampcode.com) اطلاعات کد تولید بین گزارش ها
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) غوطه عمق مرجع برای این سنگ
- [Aider repo-map](https://aider.chat/docs/repomap.html) دید ریپو رتبه بندی درخت
- [Augment Code enterprise graph](https://www.augmentcode.com) نماد تجاری-گراف RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) اجرای مرجع
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) جزئیات کد سفر-3
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) مرجع کراس کدرها
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) مرجع داخلی پلتفرم
