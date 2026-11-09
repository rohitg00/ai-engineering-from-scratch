# قطعنامه مربوط به کوریفرنس

> "او به او زنگ زد. او جواب نداد. دکتر در ناهار بود". سه بار به دو نفر اشاره کرد و هیچ کس نامش را نگفت.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## مشکل

هر بار ذکر اپل از یک مقاله ۳۰۰ کلمه ای استخراج کنید. وقتی که مقاله می گوید "آپل". وقتی می گوید "شركت"، "آن ها"، "عظیم فناوری کوپرتینو" یا "کارگاه Jobs". بدون حل این ذکر به همان نهاد، لوله NER شما 60-۸۰ درصد از ذکر ها را از دست می دهد.

رزولوشن کورفرنس هر عبارت را که به یک نهاد دنیای واقعی مشابه اشاره دارد به یک خوشه پیوند می دهد. این چسب بین سطح سطح NLP (NER، تجزیه و تحلیل) و سیمنتک پایین (IE، QA، خلاصه، KG) است.

چرا در سال 2026 مهم است:

- خلاصه: "رئيس مديره اعلام کرد"... مقابل "تيم کوک اعلام کرد"...
- پاسخ به سوال "چه کسی را می خواند؟" نیاز به حل "شوی" دارد.
- استخراج اطلاعات: نمودار دانش با "PER1 Apple را تاسیس کرد" و "Jobs Apple را تاسیس کرد" به عنوان ورودی جداگانه اشتباه است.
- IE چند مستند: ادغام اشاره ها در میان مقالات در مورد یک رویداد، یک ارتباط اصلی بین اسناد است.

## مفهوم

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**ورودی: یک سند. خروجی: یک گروه بندی از ذکر (مدت) که هر گروه به یک نهاد اشاره دارد.

**Mention types.**

- **Named entity.**"تيم کوک"
- **Nominal.**"مديريت اجرایی" "شركت"
- **Pronominal.**"او"، "او"، "اون"، "اين"
- **Appositive.**"تيم کوک، مدیرعامل اپل"

**Architectures.**

1. **Rule-based (Hobbs, 1978).**با استفاده از قواعد گرامر، قطعنامه اسم های متمایز با درخت، خط پایه خوب، به طرز شگفت انگیزی سخت برای شکست در اسم های متمایز.
2. **Mention-pair classifier.**برای هر جفت ذکر$(m_i, m_j)$، پیش بینی می کنند که آیا آنها هسته ای هستند.
3. **Mention-ranking.**برای هر ذکر، سابقه کاندید را رتبه بندی کنید (از جمله "هیچ سابقه ای").
4. **Span-based end-to-end (Lee et al., 2017).**ترانسفورماتور کدر تمام دامنه های کاندید را تا حد حد حد طولانی شماره گذاری کنید نمره ها را ذکر کنید احتمال سابقه هر دامنه را پیش بینی کنید با طمع جمع کنید پیش فرض مدرن
5. **Generative (2024+).**به عنوان یک مدرک LLM: "هر اسم در این متن و پیشینه اش را لیست کنید".

**The evaluation metrics.**پنج متریک استاندارد (MUC، B3، CEAF، BLANC، LEA) زیرا هیچ یک از متریک ها کیفیت کلستر را ضبط نمی کنند. متوسط سه مورد اول را به عنوان CoNLL F1 گزارش کنید. حالت پیشرفته در سال 2026 در CoNLL-2012: ~83 F1.

**Known hard cases.**

- توضیحات مشخصی که به اشخاص مربوط است که صفحات قبلی را معرفی کرده اند.
- پلنگ آنافورا (" چرخ ها " → یک ماشین ذکر شده در گذشته).
- صفر آنافورا در زبان هایی مثل چینی و ژاپنی
- کاتافورا (نامگذاری قبل از مرجع): "وقتی**she**"در داخل رفتم، مری لبخند زد".

```figure
coref-links
```

## آن را بسازید

### مرحله اول: کورفرنس عصبی پیش از آموزش (AllenNLP / spaCy- تجربی)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

در یک سند طولانی تر، چیزی شبیه به این می آید:
- کلستر اول: [آپل، شرکت، آن]
- گروه دوم: [پروژه های جدید، آنها]

### مرحله دوم: حل کننده اسم استیاد مبتنی بر قوانین (تدريس)

ببین`code/main.py`برای اجرای فقط یک برنامه:

1. ذکر استخراج: نام نهاد ها (مجموعه های بزرگ) ، نامگذاری (بحث دقیق) ، توضیحات مشخص ("X").
2. برای هر اسم، به ذکرات قبلی K نگاه کنید و آنها را با:
   - توافق جنسیت/عدد (هوریستیک)
   - بازیابی اخیر (تکلیف نزدیک تر)
   - نقش نحوی (موضوعات ترجیح داده می شود)
3. بالاترين نمره رو با هم وصل کن

با مدل های عصبی رقابت نمی کند اما فضای جستجو و تصمیمات لازم را که یک مدل آخر به آخر می گیرد را نشان می دهد.

### مرحله سوم: استفاده از LLM برای کورفرنس

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

دو حالت شکست برای مشاهده. اول، LLM بیش از حد ادغام ("او" و "او" به دو نفر متفاوت اشاره می کند). دوم، LLM به طور ساکت ذکر در اسناد طولانی را رها می کند. همیشه با چک های معاوضه مدت تأیید می کند.

### مرحله 4: ارزیابی

اسکریپت استاندارد conll-2012 MUC، B3، CEAF-φ4 را محاسبه می کند و متوسط را گزارش می کند. برای ارزیابی داخلی، با دقت سطح زمان شروع کنید و از مجموعه آزمایش یادداشت شده خود یاد بگیرید، سپس F1 را با لینک ذکر کنید.

## دام ها

- **Singleton explosion.**بعضی سیستم ها هر ذکر را به عنوان یک دسته خاص خود گزارش می دهند. B3 نرم است. MUC این را مجازات می کند. همیشه هر سه متریک را بررسی کنید.
- **Pronouns in long context.**عملکرد 15 F1 در اسناد بیش از 2000 توکن کاهش می یابد.
- **Gender assumptions.**قوانین جنسیتی سختکده شده در مورد مرجعین غیر دوگانه، سازمان ها، حیوانات نقض می کنند. از مدل های آموخته یا نمره خنثی استفاده کنید.
- **LLM drift on long docs.**یک تماس API نمی تواند به طور قابل اعتماد ذکرات دسته بندی در بیش از 50 پاراگراف باشد. از پنجره سلایدی + ادغام استفاده کنید.

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

الگوی ادغام که در سال 2026 منتشر می شود: NER را ابتدا اجرا کنید، coref را اجرا کنید، coref را به نهادهای NER ادغام کنید. وظایف پایین تر به یک نهاده در هر نهاده، نه یک نهاده در هر اشاره ای می پردازند.

## -باده

پس از`outputs/skill-coref-picker.md`:

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## تمرینات

1. **Easy.**حل کننده مبتنی بر قاعده را اجرا کنید`code/main.py`در پنج پاراگراف دستکاری، دقت اشاره- لینک را با حقیقت اصلی اندازه گیری کنید.
2. **Medium.**از مدل هسته عصبی پیش از آموزش در یک مقاله خبری استفاده کنید. کلستر ها را با یادداشت های دستی خود مقایسه کنید. کجا شکست خورد؟
3. **Hard.**یک خط لوله NER با هسته های بهبود یافته بسازید: اول NER، سپس از طریق کلستر های اصلی ادغام شود. بهبود پوشش شرکت در مقابل NER فقط در 100 مقاله را اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## خواندن بیشتر

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) فصل کتاب درس سنت
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) پایه ای از آخر به آخر
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) آموزش قبل از تمرین که باعث بهبود مغز می شود.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) شاخص مرجع
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) کلاسیکی مبتنی بر قواعد
