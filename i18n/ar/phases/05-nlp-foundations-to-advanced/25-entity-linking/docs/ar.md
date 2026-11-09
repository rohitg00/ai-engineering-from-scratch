# الكيانات ربط وتشابه

> وجدت "باريس". إن الكيان الذي يربط يقرر: باريس، فرنسا؟ باريس هيلتون؟ باريس، تكساس؟ باريس (الأمير الطرويجي) ؟ بدون ربط، يبقى جدول المعرفة غير واضح.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## المشكلة

جملة تقول: "الأردن ضرب الصحافة" "نير" الخاص بك تسمية "الأردن" كشخصي.

- مايكل جوردان (بالبالبال) ؟
- مايكل بي جوردان (الممثل) ؟
- مايكل أ. جوردان (أستاذ بيركلي ML  نعم، هذا الارتباك حقيقي في ورق ML) ؟
- الأردن (البلد) ؟
- (أردن) (اسم الأول عبراني) ؟

يصل الارتباط الكيان (EL) لكل مذكرة إلى مدخل فريد في قاعدة المعرفة: ويكيديا، ويكيبيديا، أو نطاق KB الخاص بك. وظائف فرعية:

1. **Candidate generation.**بالنظر إلى "جوردان"، أي إدخالات KB معقولة؟
2. **Disambiguation.**بالنظر إلى السياق، أي مرشح هو الصحيح؟

يمكن تعلم كلتا الخطوتين. كلتا الخطوتين مقارنة. خط الأنابيب المشترك ثابت منذ عقد  ما يتغير هو جودة المفصل.

## المفهوم

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**نظراً للشكل السطحي للذكور ("الأردن") ، ابحث عن المرشحين في مؤشر مستعار. قاموس ويكيبيديا مستعار تغطي معظم الكيانات المسمى: "JFK" → جون F. كينيدي ، جاكلين كينيدي ، مطار JFK ، JFK (فيلم). يعود المؤشر النموذجي 10-30 مرشحًا لكل ذكر.

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`يعمل بشكل جيد، سريع، لا تدريب.
2. **Embedding-based (ESS / REL / Blink).**إشعار إشعار + سياق. إشعار وصف كل مرشح. اختيار ماكس كوسين. افتراضية 2020-2024.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**فك اسم الكيانات القنوني للشخصية رمزية عن طريق رمزية. مقيدة إلى ثلاثية من أسماء الكيانات الصالحة بحيث يتم ضمان أن تكون الخروج هو معرف KB صالح.

**End-to-end vs pipeline.**النماذج الحديثة (ELQ، BLINK، ExtEnD، GENRE) تعمل على NER + توليد مرشح + عدم التوضيح في مرور واحد. لا تزال أنظمة خطوط الأنابيب تهيمن في الإنتاج لأنك يمكنك تبادل المكونات.

### القياسين

- **Mention recall (candidate gen).**ذكر جزء من الذهب حيث يظهر إدخال KB الصحيح في قائمة المرشحين. الأرضية لخط الأنابيب بأكمله.
- **Disambiguation accuracy / F1.**مع المرشحين الصحيحين، كم مرة يكون أول واحد صحيحاً.

دائماً أبلغ عن كليهما، نظام مع 99٪ عدم التوضيح على 80٪ من المرشحين استدعاء هو 80٪ خط الأنابيب.

```figure
gx-entity-linking
```

## بناءها

### الخطوة 1: بناء مؤشر مستعار من إعادة توجيهات ويكيبيديا

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

بيانات ويكيبيديا الاسم الأولي: ~ 18M (اسم الأولي، كيان) أزواج. تنزيل من Wikidata dumps. تخزين كإندكس معاكس.

### الخطوة الثانية: التشويش القائم على السياق

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

التداخل جاكارد هو لعبة. استبدل بنفسية كوسين على التوابل (انظر `code/main.py`الخطوة 2 بالنسبة لنسخة المحول).

### الخطوة الثالثة: القائمة على التثبيت (طريقة BLINK)

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

في وقت المؤشر، إدراج كل كيان KB مرة واحدة. في وقت الاستفسار، إدراج الذكر + السياق مرة واحدة، نقطة-المنتج ضد مجموعة المرشحين، اختيار أقصى.

### الخطوة الرابعة: ربط الكيانات التوليدية (المفهوم)

تقوم GENRE بتفكيك عبارة عنوان ويكيبيديا الكيان حرفاً بعد حرف. يضمن التفكيك المحدود (انظر الدروس 20) أن يتم إصدار عناوين صالحة فقط. التكامل الوثيق مع محاولة مدعومة بـ KB. النسخة الحديثة هي REL-GEN و LLM-prompted EL مع إصدار مهيكلي.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

المزدوجة مع قائمة بيضاء (الخطوط الخفيفة `choice`), هذا هو أبسط خط أنابيب إلكترونية يتم إرسالها في عام 2026.

### الخطوة 5: تقييم على AIDA-CoNLL

AIDA-CoNLL هو مقياس قياسي للقيمة المرجعية: 1,393 مقالة رويترز، 34k ذكرات، وكيانات ويكيبيديا.`P@1`) ومعدل الكشف عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة عن النتائج الناتجة الناتجة عن النتجة الناتجة الناتجة عن النتجة الناتجة الناتجة عن النتجة الناتجة الناتجة عن النتجة الناتجة الناتجة عن النتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة الناتجة عن الناتجة الناتجة الناتجة الناتجة الناتجة الناتية.

## الفخاخ

- **NIL handling.**بعض الذكرات ليست في KB (كيانات ناشئة، أشخاص غير معروفين). يجب أن تنبأ الأنظمة NIL بدلا من تخمين الكيان الخطأ. قياس بشكل منفصل.
- **Mention boundary errors.**يفتقد NER في الأعلى من المياه المنتشرة إلى المدة القصيرة ("بنك أمريكا" مع علامة "بنك" فقط). ينخفض استدعاء EL.
- **Popularity bias.**أنظمة تدرب تتوقع الكيانات المتكررة بشكل مفرط. ذكر "مايكل الأول الأردن" في ورقة ML غالبا ما يربط بالكرة السلة الأردن.
- **Cross-lingual EL.**تذكيرات الخرائط في النص الصيني إلى كيانات ويكيبيديا الإنجليزية. يتطلب مرموزًا متعدد اللغات أو خطوة ترجمة.
- **KB staleness.**الشركات الجديدة، الأحداث، الناس ليسوا في القمامة في فيكيبيديا العام الماضي. أنابيب الإنتاج تحتاج إلى حلقة تحديث.

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

نمط الإنتاج الذي يتم شحنه في عام 2026: NER → coref → EL على كل مذكرة → انهيار مجموعات إلى كيان واحد من الكيانات القنونية لكل مجموعة.

## أرسله

إبقوا`outputs/skill-entity-linker.md`:

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

## التمارين

1. **Easy.**تنفيذ مُختلفة الأسبق+المستوى في `code/main.py`على 10 ذكرات غامضة (باريس والأردن وأبل) ، علامة يدوية على الكيان الصحيح. قياس الدقة.
2. **Medium.**إشعار 50 ذكرات غامضة مع محول جملة. دمج وصف كل مرشح. مقارنة التضارب القائم على التضارب مع تعكس سياق جاكارد.
3. **Hard.**قم ببناء نطاق كوب لمجموعة 1 كيلومتر (مثل الموظفين + المنتجات في شركتك). قم بتنفيذ NER + EL من نهاية إلى آخر. قم بقياس الدقة واستدعاء 100 جملة متأخرة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## المزيد من القراءة

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) النهج الأساسي السابق+المستوى.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814)-الفرس العمل القائم على التثبيت
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) EL تولدي مع تشفير مقيد.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf)ورقة المراجعة
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) مجموعة الإنتاج المفتوحة
