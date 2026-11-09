# Capstone 04  مستند چند مدل QA (Vision-First PDF، جدول ها، نمودار ها)

> مرز 2026 سند-QA از OCR-پس متن و به سمت تعامل دیر بینایی حرکت کرد. ColPali، ColQwen2.5 و ColQwen3-omni هر صفحه PDF را به عنوان یک تصویر در نظر می گیرند، آن را با تعامل دیر چند ویکتور در نظر می گیرند و اجازه می دهند که سوال به طور مستقیم به پیچ ها پاسخ دهد. در 10K مالی، مقالات علمی و یادداشت های دست نوشته این الگوی اول OCR را با حاشیه بزرگی می پیشه. از آخر به آخر 10 هزار صفحه خط لوله بسازید و آن را کنار هم با OCR-then-text منتشر کنید.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## مشکل

شرکت ها روی فایل های PDF نشسته اند که خط لوله های OCR را شکسته اند: 10K اسکن شده با میز های چرخش، مقالات علمی پر معادلات، نمودار هایی که فقط به عنوان تصاویر منطقی هستند، یادداشت های دست نوشته شده. با اين ها رفتار مي کنيم که اول متن مي فرستيم يعني نصف سيگنال رو از دست مي دهيم پاسخ 2026 بازیافت چند متری در تصاویر صفحه خام دیرین تعامل است. ColPali (تکنولوژی ایلین) آن را معرفی کرد؛ ColQwen2.5-v0.2 و ColQwen3-omni دقت را افزایش دادند. در ViDoRe v3، اولین بازیافت بینایی از OCR پس از متن با حاشیه های معنی دار بالاتر می رود و شکاف در نمودارها، جدول ها و خط دستی گسترش می یابد.

تعادل ذخیره سازی و تاخیر است. یک ورق ColQwen شامل ~ 2048 متری پیچ در هر صفحه است، نه یک متری 1024-dim. بالون های ذخیره سازی خام. DocPruner (2026) بدون از دست دادن دقت قابل اندازه گیری 50٪ کاسته را می آورد. شما 10k صفحات را شاخص می کنید، ViDoRe v3 nDCG@5 را اندازه گیری می کنید، پاسخ های زیر 2 ثانیه را ارائه می دهید و مستقیما با یک OCR پس از متن مقایسه می کنید.

## مفهوم

تعامل دیر به این معنی است که هر نمره ی توکن جستجو در برابر هر نمره ی پچ امتیاز می گیرد و حداکثر نمره ی هر نمره ی جستجو در مجموع داده می شود. شما بدون نیاز به یک ویکتور جمع آوری شده، مطابقت دقیق را دریافت می کنید. یک شاخص چند ویکتور (Vespa، Qdrant Multi-vector یا AstraDB) گنجانده های هر پیچ را ذخیره می کند و MaxSim را در زمان بازیافت اجرا می کند.

پاسخ دهنده یک مدل زبان دید است که سوال و صفحات بالا به عنوان تصاویر می گیرد و پاسخ را با مناطق شواهد (صندوق های مرجع یا مرجع صفحات) می نویسد. Qwen3-VL-30B، Gemini 2.5 Pro و InternVL3 انتخاب های مرزی 2026 هستند. برای معادلات و نماد علمی، یک OCR fallback (Nougat، dots.ocr) به عنوان یک کانال متنی اختیاری ترکیب می شود.

ارزیابی یک ماتریس دو بعدی است. یک محور: نوع محتوا (برگ های متن ساده، جدول های کثیف، نمودار های بار / خط، یادداشت های دست نوشته، معادلات) . محور دیگر: رویکرد بازیافت (بینیدن اول تعامل دیر در مقابل OCR سپس متن در مقابل هیبرید). هر سلول به nDCG@5 و دقت پاسخ می رسد. گزارش تحویل داده می شود.

## معماری

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## دسته

- نمایش صفحه: PyMuPDF (fitz) در 180 DPI، تصویر عادی
- مدل تعامل دیر: ColQwen2.5-v0.2 یا ColQwen3-omni (تعداد ویدور در Hugging Face)
- شاخص: Vespa با میدان چند ویکتور، یا Qdrant چند ویکتور، یا AstraDB با MaxSim
- کشتن: سیاست DocPruner 2026 (پات های با تنوع بالا را حفظ کنید، 50٪ فشرده سازی در < 0.5٪ از دست دادن دقت)
- OCR fallback (معادلات / جدول های کثیف): dots.ocr یا Nougat
- پاسخ دهنده VLM: Qwen3-VL-30B خود میزبان یا Gemini 2.5 Pro میزبان؛ InternVL3 به عنوان عقب نشینی
- ارزیابی: معیار ViDoRe v3، M3DocVQA برای استدلال چند صفحه
- UI بیننده: Next.js 15 با پوشش لانو برای مناطق شواهد

```figure
ce-late-interaction
```

## آن را بسازید

1. **Ingest.**یک کورپوس از 10 هزار صفحه PDF را در 10 هزار صفحه، مقالات علمی و اسناد اسکن شده، ارسال کنید. هر صفحه را به یک PNG 1536x2048 ارسال کنید. ادامه دهید `{doc_id, page_num, image_path}`. .

2. **Embed.**ColQwen2.5-v0.2 را در هر تصویر صفحه اجرا کنید. شکل خروجی ~ 2048 پیوند در 128. برای حفظ نیمه بالاترین سیگنال، DocPruner را اعمال کنید. به میدان چند ویکتور Vespa یا Qdrant چند ویکتور بنویسید.

3. **Query.**برای هر جستجو وارد شده، با برج جستجو (توکین سطح گنجانده شده) گنجانده شود. MaxSim را در برابر شاخص اجرا کنید: برای هر نشانه جستجو، حداکثر نقطه محصول را بر روی صفحات پیوند گنجانده شده، جمع کنید. صفحات top-k را برگردانید.

4. **Synthesize.**با سوال و تصاویر صفحه اول 5، به Qwen3-VL-30B زنگ بزنید. پیام: "به تنها صفحات ارائه شده پاسخ دهید. هر ادعای را با (doc_id، صفحه) ذکر کنید و منطقه (نمره، جدول، پاراگراف) را نام دهید".

5. **Evidence regions.**پس از پردازش پاسخ به استخراج مناطق ذکر شده. اگر VLM جعبه های مرزی را منتشر کند (Qwen3-VL انجام می دهد) ، آنها را به عنوان پوشش در ناظر ارائه دهید.

6. **OCR fallback.**برای صفحات شناسایی شده به عنوان معادلات کثافت (هوریستیک در تفاوت تصویر) ، Nougat یا dots.ocr را اجرا کنید و متن OCR را به عنوان یک کانال اضافی در کنار تصویر منتقل کنید.

7. **Eval.**ViDoRe v3 (بازیافت nDCG@5) و M3DocVQA (درسی QA چند صفحه) اجرا کنید. همچنین لوله OCR-then-text را در همان کورپوس با همان سنتزسر اجرا کنید. یک ماتریس نوع محتوا × رویکرد تولید کنید.

8. **UI.**نمونه اولیه اول جریان روشن؛ نکست.جیس 15 نمایشگر تولید با پوشش صفحه به صفحه شواهد منطقه.

## ازش استفاده کن

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## -باده

`outputs/skill-doc-qa.md`ارائه شده را توصیف می کند: یک سیستم QA چند حالت برای مشاهده اول، که به یک کورپوس خاص تنظیم شده و با یک خط پایه OCR-then-text در ViDoRe v3 ارزیابی شده است.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## تمرینات

1. اندازه گیری ColQwen2.5 v0.2 در برابر ColQwen3-omni در همان کورپوس. کدام صفحه ها درست و دیگری اشتباه می شود؟ یک برچسب "کلاس محتوا" را به شاخص اضافه کنید تا مسیر را به لحاظ نوع تغییر دهید.

2. به شدت (75٪، 90٪) گنجانده ها را برش دهید. خفاش فشرده سازی را پیدا کنید: نقطه ای که در آن ViDoRe nDCG@5 از خط پایه OCR پایین می آید.

3. ساخت یک هیبرید: اجرا OCR-then-text و ColQwen در موازی، ترکیب با RRF، رتبه بندی مجدد با یک کراس کدر. آیا هیبرید به تنهایی می تواند هر دو را شکست دهد؟

4. Qwen3-VL-30B را با VLM کوچکتر (Qwen2.5-VL-7B) عوض کنید. منحنی دقت در دلار را اندازه گیری کنید.

5. اضافه کردن پشتیبانی از یادداشت های دست نوشته. ارائه corpus دست نوشته, گنجانده با ColQwen, اندازه گیری بازیافت. مقایسه با خط لوله OCR دست نوشته.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## خواندن بیشتر

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) بازیافت اسناد بازیافت در تعامل دیر
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) مقاله ی روش پایه ای
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) نقاط بازرسی آماده تولید
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) خط اصلی RAG چند صفحه ای
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) تکه خدمت مرجع
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) شاخص جایگزین
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) شاخص مدیریت جایگزین
- [Nougat OCR](https://github.com/facebookresearch/nougat) بازگشت OCR قابل معادلات
