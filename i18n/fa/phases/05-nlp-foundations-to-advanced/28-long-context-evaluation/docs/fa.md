# ارزیابی طولانی مدت  NIAH, RULER, LongBench, MRCR

> جمینی 3 پرو 10 میلیون توکن کنتکس را تبلیغ می کند. در 1 میلیون توکن، 8-نیدل MRCR به 26.3 درصد کاهش می یابد. تبلیغ شده ≠ قابل استفاده. ارزیابی کنتکس طولانی به شما می گوید ظرفیت واقعی مدل شما ارسال می شود.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## مشکل

شما یک قرارداد 200 صفحه ای دارید. مدل ادعا می کند یک زمینه 1M-توکن است. شما قرارداد را در میچسبید و می پرسید: "حجره پایان دادن چیست؟" مدل پاسخ می دهد  اما پاسخ می دهد از صفحه اصلی زیرا حجره پایان دادن در عمق 120k توکن قرار دارد، گذشته از جایی که مدل در واقع حضور دارد.

این شکاف ظرفیت زمینه ای در سال 2026 است. ورق های مشخصات می گویند 1M یا 10M. واقعیت می گوید 60-70% از آن قابل استفاده است، و "قابل استفاده" بستگی به کار دارد.

- **Retrieval (single needle in haystack):**تقریباً کامل تا حداکثر قیمت تبلیغاتی در مدل های مرز
- **Multi-hop / aggregation:**در اکثر مدل ها به شدت از ~ 128k گذشته می شود.
- **Reasoning over dispersed facts:**اولين کار که شکست خورده

ارزیابی طولانی زمینه این محور ها را اندازه گیری می کند. این درس معیارها را نام می دهد، هر کدام واقعاً چه اندازه گیری می کند و چگونه یک تست سوزن سفارشی برای دامنه شما بسازید.

## مفهوم

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**یک واقعیت ("کلمه جادویی آنناس است") را در عمق کنترل شده در یک زمینه طولانی قرار دهید. از مدل بخواهید آن را باز بگیرد. عمق × طول را پاک کنید. معیار اصلی در زمینه طولانی. مدل های مرزی اکنون این را پر می کنند؛ این یک خط پایه ضروری اما کافی نیست.

**RULER (Nvidia, 2024).**13 نوع وظیفه در 4 دسته: بازیافت (یک / چند کلید / چند ارزش) ، ردیابی چند هپ (تراکن متغیر) ، جمع آوری (عدد کلمه مشترک) ، QA. طول زمینه قابل تنظیم (4k تا 128k +). مدل هایی را که NIAH را پر می کنند اما در چند هپ شکست می خورند ، نشان می دهد. در نسخه 2024 ، تنها نیمی از 17 مدل که ادعا می کنند 32k + زمینه کیفیت را در 32k حفظ کرده است.

**LongBench v2 (2024).**503 سوال چند گزینه، 8k-2M زمینه های کلمه، شش دسته از وظایف: QA یک مستند، QA چند مستند، یادگیری طولانی در زمینه، گفتگوهای طولانی، کد ریپو، داده های ساختاری طولانی. معیار تولید برای رفتار طولانی در زمینه دنیای واقعی.

**MRCR (Multi-Round Coreference Resolution).**کُرفرنس چند دور در مقیاس 8، 24، 100 ولت، نشان می دهد که یک مدل قبل از کاهش توجه می تواند چند تا واقعیت را در نظر بگیرد.

**NoLiMa.**"برنخ غیرکلامی".برنخ و سوال هیچ تعاونی حرفی ندارند؛ بازیافت نیاز به یک مرحله استدلال معنوی دارد. سخت تر از NIAH.

**HELMET.**اون اسناد زیادی رو جمع می کنه، از هرکدوم سوال می کنه، توجه انتقادی رو امتحان میکنه

**BABILong.**به عنوان یک آزمایش، به عنوان یک آزمایش، نه فقط بازیافت.

### چه چیزی را باید گزارش کنیم

- **Advertised context window.**شماره مشخصات ورق
- **Effective retrieval length.**NIAH در حد مشخصی (به عنوان مثال، 90٪) عبور می کند.
- **Effective reasoning length.**چند رکاب یا جمع بندی در این حد عبور می کند.
- **Degradation curve.**دقت در مقابل طول زمینه، به هر نوع کار مشخص شده است.

دو عدد برای صفحه مشخصات شما: بازیافت موثر و استدلال موثر. معمولا استدلال موثر 25-50٪ از پنجره تبلیغ شده است.

```figure
gx-niah-decay
```

## آن را بسازید

### مرحله اول: یک NIAH سفارشی برای دامنه شما

ببین`code/main.py`. اسکلت:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

پاک کردن`depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`نقشه گرما رو نقشه بزن اين کارت NIAH براي مدل هدف شماست

### مرحله دوم: یک نوع چند سوزن

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

سوال هایی مانند "هرکدام سه کلمه جادویی هستند؟" نیاز به بازیافت هر سه کلمه دارد. موفقیت یک سوزن چند سوزن را پیش بینی نمی کند.

### مرحله 3: ردیابی متغیر چند رک (به سبک RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

جوابي به سه تا وظيفه لازم است. مدل هاي فرنتر با 128k اغلب به 50 تا 70 درصد دقت در اينجا ميرسن.

### مرحله 4: LongBench v2 در دسته شما

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

دقت گزارشات در هر دسته، نمرات جمع شده تفاوت های بزرگ در سطح وظایف را پنهان می کند.

## دام ها

- **NIAH-only evaluation.**نميشه از اين موضوع چيزي ياد گرفت هميشه رولر رو اجرا کن يا يه تست چند تا
- **Uniform depth sampling.**بسیاری از پیاده سازی ها فقط عمق آزمون=0.5 است. عمق آزمون=0, 0.25, 0.5, 0.75, 1.0  اثر "در وسط گم شده" واقعی است.
- **Lexical overlap with filler.**اگر سوزن کلمات کلیدی را با پرکننده به اشتراک بگذارد، بازیافت ساده می شود. سوزن های بدون تعویض سبک NoLiMa را استفاده کنید.
- **Ignoring latency.**درخواست های 1M-token 30-120 ثانیه طول می کشد تا قبل از پر شدن. زمان از اولین-token را همراه با دقت اندازه گیری کنید.
- **Vendor-self-reported numbers.**OpenAI، گوگل، انتروپک همه امتیازات خود را منتشر می کنند. همیشه به طور مستقل در مورد مورد استفاده خود اجرا می شوند.

## ازش استفاده کن

دسته 2026:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

قانون عمومي براي توليد: هرگز به پنجره ي سياقي اعتماد نكنيد تا وقتي که شما به طول مورد نظر خود به NIAH + 1 رسيديد.

## -باده

پس از`outputs/skill-long-context-eval.md`:

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## تمرینات

1. **Easy.**NIAH را با 3 عمق (0.25, 0.5, 0.75) × 3 طول (1k, 4k, 16k) بسازید. روی هر مدل اجرا کنید. سرعت عبور پلاوت به عنوان یک نقشه گرما 3 × 3.
2. **Medium.**یک نوع 3 سوزن اضافه کنید. در هر طول 3 را اندازه گیری کنید. با نرخ عبور یک سوزن در طول مشابه مقایسه کنید.
3. **Hard.**یک کار ردیابی متغیر (X1 → X2 → X3 ، با 3 hops) را در 64k از پرکننده ها قرار دهید. دقت را در 3 مدل مرزی اندازه گیری کنید. طول استدلال موثر را در هر مدل گزارش دهید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## خواندن بیشتر

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) ریپو اصلی NIAH
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) معیار چند وظیفه
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) ارزیابی واقعی در زمینه های طولانی
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) سوزن سخت تر
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) استدلال در سنگ بخار
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) کاغذ تعصب عمق
