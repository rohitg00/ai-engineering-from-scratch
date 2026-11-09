# Capstone 08  تولید RAG Chatbot برای یک عمودی تنظیم شده

> هاروی، گلین، مندهبل و لاماکلود در سال 2026 به شکل تولید یکسان کار می کنند. مصرف با docling یا Unstructured و ColPali برای تصاویر. جستجوی ترکیبی با "بج رينکر" "و2-جيمما" رتبه ي جديد رو بگيرم با کلاود سونت 4.7 با استفاده از حافظه پیشگیری سریع با 60 تا 80 درصد ضربه ها ترکیب کنید. نگهبان با نگهبان لاما 4 و نگهبان نيمو با لانگفوز و فینکس مراقب باشین با "راگاس" در سيتا سوال "گولدن سيت" نمره گرفتيم یکی را در یک دامنه تنظیم شده بسازید (قانونی، بالینی، بیمه) و سنگ پایانی از مجموعه طلایی، تیم قرمز و داشبورد حرکت عبور می کند.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## مشکل

RAG (عقود قانونی، پروتکل های آزمایشات بالینی، سیاست های بیمه) در سال 2026 بیشترین تولید را به بازار می رساند زیرا ROI آشکار است و شرط ها مشخص است. هاروی (آلن و اووری) این را برای قانونی ساخته است. . به نظر مياد که اين يه سفينه ي "دک" توسعه دهنده گلن در مورد جستجوی شرکت ها پوشش میده الگوی این است: مصرف وفاداری بالا، بازیافت هیبرید با رتبه بندی مجدد، ترکیب با اجرای نقل قول و ذخیره سازی سریع، محافظت با چندین لایه ایمنی و نظارت مداوم.

قسمت سختي مدل نيست آنها رعایت صلاحیت آگاهانه (HIPAA، GDPR، SOC2) ، حسابرسی سطح نقل قول، کنترل هزینه ها (تخزین سریع تخفیف 60-90٪ را در صورت افزایش نرخ ضربه می خرید) ، تشخیص توهم از طریق وفاداری RAGAS و تشخیص حرکت زمانی که اسناد منبع بدون پیگیری شاخص به روز می شوند. این سنگ پایه از شما می خواهد که تمام آن را در یک مجموعه طلایی 200 سوال با یک سوئیت تیم قرمز در کنار ارسال کنید.

## مفهوم

لوله دو طرفه**Ingestion**: docling یا Unstructured اسناد ساختاری را تجزیه می کند؛ ColPali با اسناد غنی بصری کار می کند؛ قطعات خلاصه، برچسب ها و برچسب های دسترسی مبتنی بر نقش را دریافت می کنند. ویکتورها به pgvector + pgvector scale (در زیر 50M ویکتورها) یا Qdrant Cloud می روند؛ BM25 نادر در کنار هم اجرا می شود. **Conversation**: LangGraph حافظه و چند نوبت را اداره می کند؛ هر پرسشی بازرسی ترکیبی را اجرا می کند، با bge-reranker-v2-gemma-2b رتبه بندی می کند، با Claude Sonnet 4.7 (به سرعت ذخیره شده) ترکیب می کند، تولید را از طریق Llama Guard 4 و NeMo Guardrails منتقل می کند و پاسخ لنگر شده با نقل قول را ارسال می کند.

ستک ارزیابی چهار لایه داره.**Golden set**(به عنوان 200 سوال و پاسخ با نقل قول) برای دقت. **Red team**(جیل بریک، تلاش برای استخراج اطلاعات شخصی، سوالات خارج از حوزه) برای امنیت. **RAGAS**برای وفاداری / ارتباط پاسخ / دقت زمینه به طور خودکار در هر نوبت. **Drift dashboard**(فینکس را بازداشت) به دنبال کیفیت بازیافت و هالوسیناسیون نمره هفته ای.

پیشگیری سریع، لفت هزینه است. کلاود 4.5+ و GPT-5+ از سیستم پیشگیری پشتیبانی می کند + زمینه بازیافت شده. با نرخ 60 تا 80٪، هزینه هر درخواست 3-5 برابر کاهش می یابد. لوله باید برای پیشگوهای پایدار طراحی شود (نظام سریع + زمینه رتبه بندی مجدد اول) تا نرخ بالای پیشگیری از پیشگام به دست آید.

## معماری

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## دسته

- مصرف: Unstructured.io یا docling برای اسناد ساختاری؛ ColPali برای PDF های غنی از بصری
- DB متری: pgvector + pgvectorscale تحت 50M متری؛ Qdrant Cloud در غیر این صورت
- Sparse: Tantivy BM25 با وزنهای میدان
- آرکیستر: LlamaIndex جریان کار (خورد) + LangGraph (گفتگویی)
- رتبه بندی مجدد: bge-reranker-v2-gemma-2b میزبان خود یا Voyage
- LLM: کلاود سونت 4.7 با ذخیره سازی سریع؛ Llama 3.3 70B خود میزبان
- ايوال: RAGAS 0.2 اونلاين، DeepEval براي توهم و جيل برک سويت
- قابل مشاهده: Langfuse خود میزبان با صف یادداشت؛ Arize Phoenix برای حرکت
- گاردریلس: Llama Guard 4 طبقه بندی کننده ورودی/خروجی، سیاست NeMo Guardrails v0.12, اسکرب PII Presidio
- مطابقت: برچسب های دسترسی مبتنی بر نقش در قطعات؛ برچسب های صلاحیت برای GDPR/HIPAA

```figure
canary-rollout
```

## آن را بسازید

1. **Ingestion.**برای صفحات اسکن شده / بصری سنگین، مسیر را از طریق ColPali. قطعات را با خلاصه، برچسب های نقش، برچسب های صلاحیت تولید کنید.

2. **Index.**گنجانده شدن کثیف (Voyage-3 یا Nomic-embed-v2) به pgvector + pgvector scale. BM25 side-index از طریق Tantivy. نقش و فلتر های حوزه قضایی به عنوان بار مفید.

3. **Hybrid retrieve.**اول توسط نقش + صلاحیت فیلتر کنید؛ سپس متوازی کثافت + BM25؛ با ترکیب رتبه متقابل ادغام کنید؛ top-20 به ranker؛ top-5 به synth.

4. **Synthesize with prompt caching.**دستورات سیستم + سیاست های جامد در سرنخ کیش؛ ترتیب مجدد زمینه به عنوان تمدید کیش؛ سوال کاربر به عنوان ضمیمه غیر کیش. نرخ ضربه های کیش 60 تا 80٪ را در حالت ثابت هدف قرار دهید.

5. **Guardrails.**Llama Guard 4 در ورودی؛ رایل های NeMo Guardrails سوالات خارج از دامنه یا موضوعات ممنوعیت سیاست را مسدود می کند؛ Presidio PII تصادفی را در خروجی پاک می کند؛ فیلتر پس از اجرای نقل قول.

6. **Golden set.**200 زوج سوال/جواب توسط یک متخصص حوزه با (جواب، نقل قول) برچسب گذاری شده است. عامل امتیاز در مطابقت دقیق نقل قول، جواب درست، وفاداری (RAGAS).

7. **Red team.**50 درخواست ضد: jailbreaks (PAIR، TAP) ، تلاش برای افشای PII، خارج از حوزه، دزدی بین حوزه های قضایی. امتیاز با عبور / شکست و شدت.

8. **Drift dashboard.**آريز فينيکس هر هفته با کیفیت بازيابي (nDCG) ارتباط برقرار مي کند

9. **Cost report.**لنگفوز: نرخ ضربه های ذخیره سازی سریع، توکن ها در هر جستجو، $ / سوال به مرحله.

## ازش استفاده کن

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## -باده

`outputs/skill-production-rag.md`یک چت روت دامنه تنظیم شده با برچسب های مطابقت، از طریق Rubric عبور کرده و با نظارت زنده drift مشاهده شده است.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## تمرینات

1. ساخت یک قسمت دوم corpus تحت یک حوزه قضایی متفاوت (به عنوان مثال HIPAA در کنار GDPR). فیلتر نقش + حوزه قضایی را نشان دهید که از دزدی در یک تحقیق 20 سوال بین حوزه قضایی جلوگیری می کند.

2. اندازه گیری نرخ ضربه های پیشگیری از حافظه کش در طول یک هفته ترافیک تولید، شناسایی اینکه کدام سوالات پیش فرض حافظه کش را شکسته اند. ساختار مجدد.

3. حافظه چند دور را با بازخورد خلاصه 10k- توکن اضافه کنید. اندازه گیری کنید که آیا وفاداری با افزایش مکالمه کاهش می یابد.

4. کلاود سونت 4.7 رو به لاما 3.3 70 بي خود میزبان عوض کن

5. حالت "ضمن" را اضافه کنید: اگر نمرات بالاتر رتبه بندی مجدد زیر یک حد قرار گیرد، نماینده به جای پاسخ دادن می گوید "من اقتباسات مطمئن ندارم". کاهش اعتماد نادرست را اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## خواندن بیشتر

- [Harvey AI](https://www.harvey.ai) دسته بندی تولید قانونی مرجع
- [Glean enterprise search](https://www.glean.com) RAG مرجع در مقیاس شرکت
- [Mendable documentation](https://mendable.ai) مرجع RAG توسعه دهنده-دک
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) مصرف مدیریت شده
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) مرجع هزینه های سودآور
- [RAGAS 0.2 documentation](https://docs.ragas.io/) چارچوب ارزیابی RAG کانونیک
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) مشاهده ی انحراف مرجع
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) طبقه بندی ایمنی 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) چارچوب سیاست های راه آهن
