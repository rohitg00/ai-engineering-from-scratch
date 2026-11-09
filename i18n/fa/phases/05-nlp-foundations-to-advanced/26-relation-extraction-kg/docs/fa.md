# استخراج روابط و نمودار دانش ساخت

> NER موجودات را پیدا کرد. موجودی که آنها را به هم متصل می کند، آنها را لنگر کرد. استخراج رابطه حاشیه های بین آنها را پیدا می کند. نمودار دانش مجموعه گره ها، حاشیه ها و اصل آنها است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## مشکل

یک تحلیلگر می گوید: "تیم کوک در سال ۲۰۱۱ مدیر عامل اپل شد". چهار واقعیت:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

رابطه استخراج (RE) متن آزاد را به سه برابر ساختاری تبدیل می کند `(subject, relation, object)`جمع آوری در یک کورپوس و شما یک نمودار دانش را جمع آوری و سوال و شما یک زیربنای استدلال برای RAG، تجزیه و تحلیل، یا حسابرسی های انطباق را دارید.

مشکل 2026: LLM ها روابط را با شور و شوق استخراج می کنند. خیلی شور و شوق. آنها سه برابر را که متن منبع پشتیبانی نمی کند، هالوسین می کنند. بدون اصل، شما نمی توانید سه برابر واقعی را از داستان باورنکردنی تشخیص دهید. پاسخ 2026 این است که لوله های لنگر و تأیید به سبک AEVS است.

## مفهوم

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`روابط از یک اونتولوژی بسته (متون های ویکی دتا، FIBO، UMLS) یا مجموعه باز (به سبک OpenIE، هر چیزی می تواند انجام شود) می آیند.

**Three extraction approaches.**

1. **Rule / pattern-based.**الگوهای Hearst: "X مثل Y" → `(Y, isA, X)`. و رژکس دست ساختي . شکننده ، دقیق و قابل شرح
2. **Supervised classifier.**با توجه به دو ذکر موجود در یک جمله، رابطه را از یک مجموعه ثابت پیش بینی کنید. آموزش داده شده در TACRED، ACE، KBP. استاندارد 20152022.
3. **Generative LLM.**به مدل بگو که سه برابر اشعه بده، از جعبه خارج ميشه، به اصل نياز داره، يا تو هم تو هم تو هم تو هم تو هم تو هم هست

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**چارچوب فعلی کاهش توهم:

- **Anchor.**هر فاصله ی موجودی و فاصله ی عبارت های رابطه را با موقعیت های دقیق شناسایی کنید.
- **Extract.**تولید سه برابر به لنگر های لنگر متصل.
- **Verify.**هر عنصر سهگانه را با متن منبع مطابقت دهید؛ هر چیزی که پشتیبانی نمی شود را رد کنید.
- **Supplement.**یک گذرنامه پوشش تضمین می کند که هیچ فاصله لنگر شده ای از بین نرود.

توهم ها به شدت کاهش می یابند، نیاز به محاسبه بیشتر دارد اما قابل بررسی است.

**The open-vs-closed tradeoff.**

- **Closed ontology.**لیست خاصیت ثابت (به عنوان مثال، 11,000+ خاصیت ویکی پدیا). قابل پیش بینی. قابل جستجو. سخت برای اختراع.
- **Open IE.**هر جمله کلامي به رابطه تبديل ميشه يادگيري عالي دقت کم سوال کردن آشفتي

تولید KGs معمولا مخلوط می شوند: IE را برای کشف باز کنید، سپس روابط را به یک اونتولوژی بسته قبل از ادغام به نمودار اصلی، کانونیک کنید.

```figure
relation-triples
```

## آن را بسازید

### مرحله 1: استخراج مبتنی بر الگوی

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

ببین`code/main.py`نقشه های Hearst هنوز هم در خط لوله های خاص دامنه ارسال می شوند چون قابل رفع هستند.

### مرحله دوم: استخراج رابطه ی زیر نظر

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL یک استخراج کننده رابطه seq2seq مبتنی بر BART است: این به جای طبقه بندی جفت های موجودیت سه برابر تولید می کند. متن در، سه برابر می شود، با نام های رابطه گرفته شده از ویژگی های ویکی پدیا. رشته های رمزگذاری شده هنوز هم دارای REBEL هستند `<triplet>`،`<subj>`و`<obj>`نشانگرها، پس روی آنها تقسیم کنید (مانند پارسر کارت مدل) تا دریافت کنید `(subject, relation, object)`ضبط شده با داده های نظارت از راه دور، خط پایه با وزن باز استاندارد

### مرحله سوم: استخراج با استفاده از LLM با لنگر

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

هر زماني که به منبع برگردونم رو بررسي کن`text[start:end] != triple_entity`اين مرحله "تحقق" AEVS در شکل کمينش

### مرحله 4: به یک اونتولوژی بسته تبدیل شدن

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

کانونيك كردن اغلب 60-80% از كار مهندسي است بودجه براي آن

### مرحله 5: ایجاد یک نمودار کوچک و جستجو

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

این اتم هر سیستم RAG-over-KG است. آن را با ذخیره های سهگانه RDF (Blazegraph، Virtuoso) ، نمودار های خاصیت (Neo4j) یا ذخیره های نمودار افزوده متری مقیاس کنید.

## دام ها

- **Coreference before RE.**"او اپل را تاسیس کرد"  RE باید بداند که "او" کیست.
- **Entity canonicalization.**"آپل" و "آپل" باید به همان گره حل شوند. اولین نهاد متصل کننده (درس 25).
- **Hallucinated triples.**LLM ها سه برابر میشن که متن پشتیبانی نمی کنه.
- **Relation canonicalization drift.**روابط IE باز متناقض هستند ("در دنیا آمده،" "از" "آید،" "در آن بومی است"). سقوط به آدی های کانونیکی یا نمودار غیرقابل حل است.
- **Temporal errors.**"تیم کوک مدیرعامل اپل است"  درست است در حال حاضر، نادرست در سال 2005. بسیاری از روابط محدود به زمان هستند.`P580`زمان شروع`P582`زمان پایان در ویکی پدیا).
- **Domain mismatch.**متن حقوقی، پزشکی و علمی اغلب به مدل های RE دقیق و تنظیم شده نیاز دارد.

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

الگوی ادغام: NER → coref → یک نهاد پیوند → استخراج رابطه → نقشه برداری اونتولوژی → بار گراف. هر مرحله یک دروازه کیفیت بالقوه است.

## -باده

پس از`outputs/skill-re-designer.md`:

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## تمرینات

1. **Easy.**دستگاه استخراج الگوها رو اجرا کن`code/main.py`در 5 جمله مقاله خبری، دقت دست چک
2. **Medium.**با استفاده از REBEL (یا LLM کوچک) در جمله های مشابه مقایسه سه برابر کدام استخراج کننده دقیق تر است؟
3. **Hard.**خطوط خطوط AEVS را بسازید: استخراج با LLM + زمان های را با منبع تأیید کنید. میزان توهم قبل از بعد از مرحله تأیید در 50 جمله سبک ویکی پدیا اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## خواندن بیشتر

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) کاغذ نظارت از راه دور
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) SEQ2SEQ RE کار اسب
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) IE مشترک
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) طراحی تخفیف توهم در سال 2026
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) سوالات نمودار های کانونیکی
