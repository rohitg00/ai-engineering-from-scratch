# ارتباط و عدم تشبه ی شرکت

> NER "پاریس" را پیدا کرد. "حساب مرتبط با تصمیم می گیرد: پاریس، فرانسه؟ پاریس هیلتون؟ پاریس، تگزاس؟ پاریس (امیر تروجان) ؟ بدون پیوند، نمودار دانش شما دوجنگ باقی می ماند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## مشکل

يه جمله ميگه: "اردن مطبوعات رو شکست داد" NER شما "اردن" رو به عنوان شخصي برچسب ميده

- مایکل جردن (بازبال بسکتبال) ؟
- مایکل بی جردن ( بازیگر) ؟
- مایکل آی جردن (استاد برکلی ML  بله، این سردرگمی در مقالات ML واقعی است) ؟
- اردن (دولت) ؟
- اردن (اسم اول عبراني) ؟

پیوند نهاد (EL) هر ذکر را به یک ورودی منحصر به فرد در پایگاه دانش حل می کند: ویکی پدیا، ویکی پدیا، DBpedia یا دامنه KB شما. دو وظیفه فرعی:

1. **Candidate generation.**با توجه به "جوردن"، کدام نوشته های KB قابل قبول هستند؟
2. **Disambiguation.**با توجه به شرایط، کدام کاندید مناسب است؟

هر دو مرحله قابل یادگیری هستند. هر دو مورد با سنجش مقایسه شده است. خط لوله ترکیبی برای یک دهه استوار است  چه تغییرات کیفیت یک مفسر است.

## مفهوم

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**با توجه به فرم سطح ذکر ("اردن") ، نامزدها را در یک شاخص نام مستعار جستجو کنید. لغات نام مستعار ویکی پدیا اکثر نهاد های نامگذاری شده را پوشش می دهد: "JFK" → جان F. کندی، جاکلین کندی، فرودگاه JFK، JFK (فلم). شاخص معمولی 10-30 نامزدها را برای هر ذکر می دهد.

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`خوب کار ميکنه، سريع و بدون آموزش
2. **Embedding-based (ESS / REL / Blink).**کد ذکر + زمینه. کد توصیف هر نامزد. انتخاب ماکس cosine. پیش فرض 2020-2024
3. **Generative (GENRE, 2021; LLM-based, 2023+).**نام کاینونیک موجودیت را توکن به توکن رمزگذاری کنید. محدود به یک سه نام معتبر موجودیت است بنابراین تولید تضمین شده یک ID KB معتبر است.

**End-to-end vs pipeline.**مدل های مدرن (ELQ، BLINK، ExtEnD، GENRE) NER + نسل کاندید + عدم تشبیهه را در یک گذر اجرا می کنند. سیستم های لوله کشی هنوز در تولید غالب هستند زیرا می توانید قطعات را عوض کنید.

### دو اندازه گیری

- **Mention recall (candidate gen).**بخش طلا در جایی که درج KB درست در لیست کاندید ها ظاهر می شود ذکر شده است.
- **Disambiguation accuracy / F1.**به نظر مي رسد که کانديداهای درست، چند بار اولين مورد درست قرار ميگيرند.

هميشه هر دو مورد رو گزارش کنين. يه سيستم با 99 درصد تشخيص در 80 درصد از بازغو نامزدي ها 80 درصد خط لوله اي است.

```figure
gx-entity-linking
```

## آن را بسازید

### مرحله ی اول: ایجاد یک شاخص نامگذاری از لینک های هدایت ویکی پدیا

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

داده های ویکی پدیا: ~ 18M (به نام، نهاد) جفت. دانلود از Wikidata dumps. ذخیره به عنوان شاخص معکوس.

### مرحله دوم: عدم تشبیهه مبتنی بر زمینه

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

جابجا شدن جکارد یک اسباب بازی است.`code/main.py`مرحله 2 برای نسخه ترانسفورماتور).

### مرحله 3: مبتنی بر ادغام (به سبک BLINK)

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

در زمان شاخص، هر موجود KB را یک بار دربرگیرید. در زمان جستجو، ذکر + زمینه را یک بار دربرگیرید، نقطه محصول در برابر مجموعه کاندیداها، انتخاب کنید.

### مرحله 4: ارتباط سازنده ی یک نهاد (فهام)

GENRE عنوان ویکی پدیا را از هر یک از شخصیت ها رمزنگاری می کند. رمزنگاری محدود (به درس 20) تضمین می کند که فقط عناوین معتبر می توانند تولید شوند. ادغام دقیق با یک TRie پشتیبانی شده از KB. نسل مدرن REL-GEN و LLM-prompted EL با تولید ساختار یافته است.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

با یک لیست سفید (تاریخ ها) ترکیب شده است`choice`), این ساده ترین خط لوله ایل است که در سال 2026 ارسال خواهد شد.

### مرحله 5: ارزیابی AIDA-CoNLL

AIDA-CoNLL معیار استاندارد EL است: 1,393 مقاله رویترز، 34k ذکر، ویکی پدیا.`P@1`) و نرخ تشخیص NIL خارج از KB

## دام ها

- **NIL handling.**برخی از ذکر ها در KB (حوادث نوظهور، افراد ناشناخته) وجود ندارد. سیستم ها باید NIL را پیش بینی کنند به جای حدس زدن موجودیت اشتباه. به طور جداگانه اندازه گیری می شود.
- **Mention boundary errors.**NER در جریان بالا مدت زمان جزئی را از دست می دهد ("بانک آمریکا" به عنوان "بانک" برچسب گذاری شده است).
- **Popularity bias.**سیستم های آموزش دیده از افراد مکرر بیش از حد پیش بینی می کنند. ذکر "مایکل I. جردن" در یک مقاله ML اغلب به جردن بسکتبال مرتبط است.
- **Cross-lingual EL.**نقشه برداری اشاره به متن چینی به نهاد های ویکی پدیا انگلیسی است. نیاز به یک کدگر چند زبانی یا یک مرحله ترجمه دارد.
- **KB staleness.**شرکت های جدید، رویدادها، مردم در ورودی ویکی پدیا سال گذشته نیستند. لوله های تولید نیاز به یک حلقه تازه دارند.

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

الگوی تولید که در سال 2026 ارسال می شود: NER → coref → EL در هر ذکر → گلستر های سقوط به یک واحد کانونیکی در هر گلستر. محصول: یک KB ID در هر واحد در سند، نه یک برای ذکر.

## -باده

پس از`outputs/skill-entity-linker.md`:

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## تمرینات

1. **Easy.**استفاده از "پیش از" و "باطری" در `code/main.py`در 10 ذکر مبهم (پاریس، اردن، اپل) ، دست نشان دادن موجود صحیح. اندازه گیری دقت.
2. **Medium.**50 ذکر متناقض را با یک ترانسفارمر جمله رمزگذاری کنید. توصیف هر نامزد را دربرگیرید. تفاوت مبهم مبتنی بر ادغام را با تعادل زمینه جکارد مقایسه کنید.
3. **Hard.**یک دامنه 1k-سائره KB (به عنوان مثال کارکنان + محصولات در شرکت خود) ایجاد کنید. NER + EL را از انتهای انتهای خود پیاده سازی کنید. دقت را اندازه گیری کنید و از 100 جمله طولانی بازپس بگیرید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## خواندن بیشتر

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) رویکردی اساسی پیش از زمینه
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) کار با پایه ی ادغام
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) EL تولید کننده با رمزگذاری محدود.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) مقالات مرجع
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) بسته تولید باز
