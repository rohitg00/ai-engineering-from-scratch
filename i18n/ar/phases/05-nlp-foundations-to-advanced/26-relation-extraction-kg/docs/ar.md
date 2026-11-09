# العلاقات استخراج المعرفة الرسم البياني بناء

> وجدت NER الكيانات. ربط الكيان مقوّر لهم. استخراج العلاقة يجد الحواف بينهم. الرسم البياني المعرفة هو مجموع العقد والحواف ومصدرها.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## المشكلة

"تيم كوك أصبح الرئيس التنفيذي لأبل في عام 2011". أربعة حقائق:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

الإتصال استخراج (RE) يحول النص الحر إلى ثلاثية مهيكلة `(subject, relation, object)`. جمع عبر مجموعة و لديك رسم علم . جمع و استفسار و لديك أساس التفكير لـ RAG ، التحليلات ، أو مراجعات الامتثال .

مشكلة 2026: الـ LLM تستخرج العلاقات بحماس. حماسًا جدًا. إنها تحسس ثلاث مرات لا يدعمها النص المصدر. بدون المصل ، لا يمكنك التمييز بين الثلاث مرات الحقيقية والخيال المثالي. الجواب في 2026 هو أنقاذ وتحقق الأنابيب على طراز AEVS.

## المفهوم

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`. تأتي العلاقات من أونتولوجيا مغلقة (ممتلكات ويكيديتا، فيبو، أم إل إس) أو مجموعة مفتوحة (مثل OpenIE، أي شيء يمكن القيام به).

**Three extraction approaches.**

1. **Rule / pattern-based.**أنماط هيرست: "X مثل Y" → `(Y, isA, X)`بالإضافة إلى الـ (ريجكس) المصنوعة يدوياً، سريعة، دقيقة، قابلة للتفسير.
2. **Supervised classifier.**إعطاء ذكرتين كيان في جملة، توقع العلاقة من مجموعة ثابتة. تدرب على TACRED، ACE، KBP. معيار 20152022.
3. **Generative LLM.**اطلب من النموذج ان يخرج ثلاثيًا يعمل خارج الصندوق يحتاج إلى منشأ أو يحلم بالخردة التي تبدو معقولة

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**الإطار الحالي للتخفيف من الهلوسة:

- **Anchor.**تحديد كل فترة الكيانات و فترة العبارات العلاقة مع المواقع الدقيقة.
- **Extract.**توليد ثلاثيّات مرتبطة بـ"مدى المُؤَكّد".
- **Verify.**أرجح كل عنصر ثلاثي إلى النص المصدر؛ رفض أي شيء غير مدعوم.
- **Supplement.**مرسل تغطية يضمن عدم تساقط المُركب.

الهلوسات تنخفض بشكل حاد، يتطلب المزيد من الحسابات ولكنها قابلة للتدقيق

**The open-vs-closed tradeoff.**

- **Closed ontology.**قائمة خاصيات ثابتة (على سبيل المثال، 11,000+ خصائص ويكيديتا). متوقعة. قابل للتوقيع. صعب الاختراع.
- **Open IE.**أي عبارة شفهية تصبح علاقة ذكرى عالية، دقة منخفضة، فوضى في السؤال.

عادة ما يخلط KGs الإنتاج: فتح IE للاكتشاف، ثم تطبيق العلاقات على علم أونتولوجيا مغلق قبل الاندماج في الرسم البياني الرئيسي.

```figure
relation-triples
```

## بناءها

### الخطوة الأولى: استخراج القائم على النمط

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

انظر`code/main.py`أنماط (هيرست) لا تزال تسير في خطوط الأنابيب الخاصة بالمنطقة لأنها قابلة للتحليل

### الخطوة الثانية: استخراج العلاقة التالية

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL هو مستخرج علاقة seq2seq القائم على BART: فإنه يولد ثلاثي بدلاً من تصنيف أزواج الكيانات. النص في، ثلاثي خارج، مع أسماء العلاقة التي تم أخذها من خصائص ويكيديتا. السلاسل المفكورة لا تزال تحمل REBEL `<triplet>`،`<subj>`و`<obj>`علامات، حتى تقسيم على (كما يفعل محلل بطاقة النموذج) للحصول على `(subject, relation, object)`سجلات، تحسّن على بيانات الإشراف عن بعد، نقطة أساسية مع الوزن المفتوح

### الخطوة الثالثة: استخراج معتمد بالدرجة الأولى مع الركاب

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

تحقق من كل إطار عائد ضد المصدر، ورفض أي شيء حيث`text[start:end] != triple_entity`هذه خطوة "التحقق" من "أيه إيف إس" في شكلها الأدنى

### الخطوة الرابعة: التنظيم على أونتولوجيا مغلقة

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

التشريح غالباً ما يكون 60-80% من العمل الهندسي.

### الخطوة 5: قم ببناء الرسم البياني الصغير والسؤال

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

هذه هي ذرة كل نظام RAG-over-KG. قم بتقييمها باستخدام مخازن ثلاثية RDF (بلازيغراف ، فيرتويوسو) ، رسومات العقار (Neo4j) ، أو مخازن رسومات مضاعفة بالمتجهات.

## الفخاخ

- **Coreference before RE.**"لقد أسس آبل"  يجب أن يعرف ريه من هو "هو".
- **Entity canonicalization.**يجب أن يصل "آبل" و"آبل" إلى نفس العقدة. الكيان الذي يربط أولاً (المدرس 25).
- **Hallucinated triples.**الـ LLM يُصدّر ثلاث مرات لا يدعمها النص.
- **Relation canonicalization drift.**العلاقات المفتوحة IE غير متسقة ("ولد في،" "أتى من،" "من هو أصل"). انهيار إلى الهويات القنونية أو الرسم البياني لا يمكن التغلب عليه.
- **Temporal errors.**"تيم كوك هو الرئيس التنفيذي لشركة آبل"  صحيح الآن، خاطئ في عام 2005.`P580`وقت البدء`P582`وقت النهاية في ويكيديتا).
- **Domain mismatch.**تدرّب ريبل على ويكيبيديا. غالباً ما تحتاج النص القانوني والطبي والعلمي إلى نماذج RE المحددة على مستوى المجال.

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

نمط التكامل: NER → coref → كيان ربط → استخراج العلاقات → خريطة التخريط → حمولة الرسم البياني. كل مرحلة هي بوابة جودة محتملة.

## أرسله

إبقوا`outputs/skill-re-designer.md`:

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

## التمارين

1. **Easy.**أطلقوا إستخراج النمط`code/main.py`على 5 جملة من مقالات الأخبار.
2. **Medium.**استخدم REBEL (أو LLM صغير) على نفس الجملة. مقارنة ثلاث مرات. أي مستخرج لديه أدقية أعلى؟ التذكير الأعلى؟
3. **Hard.**بناء خط أنابيب AEVS: استخراج مع LLM + التحقق من التدفقات ضد المصدر. قياس معدل الهلوسة قبل مقابل بعد خطوة التحقق على 50 جملة على نمط ويكيبيديا.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## المزيد من القراءة

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf)ورقة الإشراف عن بعد
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf)-الفرس العامل
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) معدل المشترك
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) تصميم تخفيف الهلوسة عام 2026
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) استفسارات الرسم البياني القنوني.
