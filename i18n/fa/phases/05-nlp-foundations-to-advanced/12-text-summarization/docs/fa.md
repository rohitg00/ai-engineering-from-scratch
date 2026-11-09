# خلاصه متن

> سیستم های استخراج کننده به شما می گویند که سند چه می گوید. سیستم های تجریدی به شما می گویند که نویسنده چه می گفت. وظایف مختلف، دام های مختلف.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## مشکل

یک مقاله خبری 2000 کلمه ای در فید شما قرار می گیرد. شما نیاز به 120 کلمه دارید که آن را ضبط کند. شما می توانید سه جمله مهم را از مقاله (استخراج) انتخاب کنید یا محتوای خود را به کلمات خود (استخراج) دوباره بنویسید. هر دو را خلاصه سازی می نامند. آنها مشکلات کاملا متفاوت هستند.

خلاصه سازی استخراج یک مشکل رتبه بندی است.`k`. محصول همیشه گرامرکی است چون به معنای واقعی کلمه برداشته می شود. خطر عدم وجود محتوای توزیع شده در سراسر مقاله است.

خلاصه سازی تجزیتی یک مشکل تولید است. یک ترانسفارمر متن جدید را با توجه به ورودی تولید می کند. محصول روان و فشرده است اما ممکن است حقایق را که در منبع نبودند توهم دهد. خطر ساخت مطمئن است.

این درس هر دو را تقویت می کند، با حالت شکست هر یک از آنها مالک است.

## مفهوم

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**مقاله را به عنوان یک نمودار که در آن گره ها جمله و حواشی مشابه هستند، در نظر بگیرید. PageRank (یا چیزی شبیه به آن) را روی نمودار اجرا کنید تا جمله ها را با چگونگی ارتباط آنها با همه چیز دیگر امتیاز دهید. جمله های بالاترین امتیاز خلاصه هستند. پیاده سازی قانونی است.**TextRank**(Mihalcea و Tarau، 2004).

**Abstractive.**تنظیم دقیق یک ترانسفورماتور کدگذاری-دکودر (BART، T5، Pegasus) در جفت های خلاصه سند. در نتیجه، مدل سند را می خواند و از طریق توجه متقابل، رمز به رمز خلاصه را تولید می کند. Pegasus به ویژه از هدف پیش تمرین جمله شکاف استفاده می کند که آن را در خلاصه سازی بدون تنظیم دقیق عالی می کند.

ارزیابی با **ROUGE**(توانایی با توجه به یادآوری برای ارزیابی استنشاق) ROUGE-1 و ROUGE-2 نمره واحدگرام و بیگرام همپوشان. ROUGE-L نمره طولانی ترین دنباله مشترک را دارد. بالاتر بهتر است اما 40 ROUGE-L "خوب" و 50 "متفاوت" است.`rouge-score`بسته

```figure
summarize-collapse
```

## آن را بسازید

### مرحله 1: متنRank (استراکت)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

دو چیز ارزش نامگذاری را دارد. تابع شباهت از یکپارچه سازی کلمه استفاده می کند که متغیر اصلی TextRank است. کاسین متری TF-IDF نیز کار می کند. فاکتور خستگی 0.85 و تعداد تکرار پیش فرض PageRank هستند.

### مرحله 2: استخراج با BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-big-CNN در کورپوس CNN / DailyMail تنظیم شده است. این خلاصه های سبک خبری را از جعبه خارج می کند. برای دامنه های دیگر (مقالات علمی، گفتگوها، حقوقی) از نقطه بازرسی Pegasus مربوطه استفاده کنید یا اطلاعات هدف خود را تنظیم کنید.

### مرحله سوم: ارزیابی ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

بدونش "درخشش" و "درخشش" به عنوان کلمات مختلف و "ROUGE" به عنوان زیر شمار می شوند.

### فراتر از ROUGE (2026 ارزیابی خلاصه)

ROUGE برای بیست سال است که متریک خلاصه سازی غالب است و در سال 2026 به تنهایی کافی نیست. یک تجزیه و تحلیل متایی در مقیاس بزرگ از مقالات NLG نشان داد:

- **BERTScore**(مثل بودن گنجانده شدن زمینه) تا سال 2023 به وجود آمد و اکنون در کنار ROUGE در اکثر مقالات خلاصه گزارش شده است.
- **BARTScore**ارزیابی را به عنوان نسل می شناسد: خلاصه را با توجه به احتمال اینکه یک BART پیش از آموزش به آن به منبع اختصاص داده است، ارزیابی می کند.
- **MoverScore**(سافره زمین در مورد گنجانده های زمینه ای) در سال 2025 به نقطه ی بالای معیارهای خلاصه سازی رسید زیرا تعادل معنوی را بهتر از ROUGE ضبط می کند.
- **FactCC**و**QA-based faithfulness**در سال های 2021-2023 رایج بودند، اما اکنون اغلب توسط **G-Eval**(یک زنجیره سریع GPT-4 که همبستگی، ثبات، روان بودن، ارتباط با استدلال زنجیره ای فکر را ارزیابی می کند).
- **G-Eval**و رویکردهای مشابه LLM-قاضیان با قضاوت انسانی مطابقت دارند ~ 80% از زمان زمانی که Rubrics به خوبی طراحی شده است.

توصیه های تولید: گزارش ROUGE-L برای مقایسه قدیمی، BERTScore برای تعادل معنوی، G-Eval برای همبستگی و واقعیت.

### مرحله چهارم: مشکل واقعیت

خلاصه های انتزاعی به توهم آسیب می رسانند. خلاصه های انتزاعی خطر توهم بسیار کمتری را دارند زیرا تولید به طور لفظی از منبع برداشته می شود، اگرچه اگر جمله های منبع غیرمنطقی، قدیمی یا نقل قول نشده باشند، هنوز هم می توانند گمراه کننده باشند. این تنها دلیل اصلی است که سیستم های تولید هنوز روش های انتزاعی را برای محتوای در نزدیکی مطابق ترجیح می دهند.

انواع توهم ها را به نام ببرید:

- **Entity swap.**منبع ميگه "جان اسمت" خلاصه ميگه "جان براون".
- **Number drift.**منبع ميگه 25 هزار. خلاصه ميگه 25 ميليون.
- **Polarity flip.**منبع ميگه "تاقديم رو رد کرد" خلاصه ميگه "تاقيد رو قبول کرد"
- **Fact invention.**منبع از مدیرعامل صحبت نميکنه خلاصه ميگه مدیرعامل موافقت کرد

ارزیابی به این روش ها می پردازد:

- **FactCC.**یک طبقه بندی کننده دوگانه آموزش دیده در ارتباط بین جمله منبع و جمله خلاصه. پیش بینی های واقعی / غیر واقعی.
- **QA-based factuality.**از یک مدل سوالات QA که پاسخ های آن در منبع وجود دارد، بپرسید. اگر خلاصه پاسخ های مختلف را پشتیبانی می کند، نشان دهید.
- **Entity-level F1.**مقایسه ی نام نهاد های موجود در منبع با خلاصه.

برای هر چیزی که به کاربر در آن واقعیت اهمیت دارد (اخبار، پزشکی، قانونی، مالی) ، استخراج کننده ایمن تر است. استخراج کننده نیاز به بررسی واقعیت در حلقه دارد.

## ازش استفاده کن

دسته 2026:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

LLM ها با زمینه طولانی اغلب مدل های تخصصی را در سال 2026 شکست می دهند، زمانی که محاسبات محدودیت نیست. معامله هزینه و قابلیت بازیافت است؛ مدل های تخصصی نتایج سازگار تری را می دهند.

## -باده

پس از`outputs/skill-summary-picker.md`:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## تمرینات

1. **Easy.**در 5 مقاله خبری TextRank اجرا کنید. سه جمله برتر را با خلاصه ای مرجع مقایسه کنید. ROUGE-L را اندازه گیری کنید. شما باید 30-45 ROUGE-L را در مقالات سبک CNN / DailyMail مشاهده کنید.
2. **Medium.**واقعیت در سطح نهاد ها را اجرا کنید: استخراج نام نهاد ها از منبع و خلاصه (spaCy) ، بازپس گرفتن حساب شده از نهاد های منبع در خلاصه و دقت نهاد های خلاصه در برابر منبع. دقت بالا و بازپس گرفتن کم به معنای امن اما خلاصه است؛ دقت کم به معنای نهاد های توهم یافته است.
3. **Hard.**مقایسه BART-big-CNN با LLM (Claude یا GPT-4) در 50 مقاله CNN / DailyMail. گزارش ROUGE-L، واقعیت (به لحاظ شرکت F1) و هزینه هر خلاصه. سند جایی که هر یک برنده است.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## خواندن بیشتر

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) کاغذ کاینونیک استخراج
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) کاغذ BART
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) پیگاسوس و هدف "جواب شکافی"
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) کاغذ قرمز
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) مقاله واقعیت های چشم انداز
