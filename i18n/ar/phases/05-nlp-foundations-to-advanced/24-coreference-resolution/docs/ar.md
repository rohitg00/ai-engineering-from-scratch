# قرار الإستشارة

> "لقد اتصلت به، لم يرد، كان الطبيب في الغداء". ثلاثة إشارات إلى شخصين ولا يُذكر أحد اسمه.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## المشكلة

استخراج كل ذكر عن شركة آبل من مقالة من 300 كلمة. سهل عندما تقول المقال "آبل". صعب عندما تقول "الشركة" "هم" "عملاق تكنولوجيا كوبرطينو" أو "شركة العمل". دون حل هذه الذكرات إلى نفس الكيان، فإن خط أنابيب NER الخاص بك يفوت 60-80% من الذكرات.

يربط قرار Coreference كل تعبير يشير إلى نفس الكيان في العالم الحقيقي إلى مجموعة واحدة. وهو اللصق بين NLP على مستوى السطح (NER ، التحليل) والمعنى التدريجي (IE ، QA ، التجميع ، KG).

لماذا يهم في عام 2026:

- الموجز: "المدير التنفيذي أعلن... " vs "تيم كوك أعلن... "
- الإجابة على السؤال: "من اتصلت؟" تتطلب حل "هي".
- استخراج المعلومات: الرسم البياني المعرفة مع "PER1 أسس آبل" و "العمل أسس آبل" كمدخلات منفصلة خاطئة.
- المستندات المتعددة: دمج الذكرات عبر المقالات حول نفس الحدث هو إشارة أساسية عبر الوثائق.

## المفهوم

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**المدخل: وثيقة. الخروج: مجموعة من الذكرات (المناطق) حيث يشير كل مجموعة إلى كيان واحد.

**Mention types.**

- **Named entity.**"تيم كوك"
- **Nominal.**"المدير التنفيذي" "الشركة"
- **Pronominal.**"هو" "هي" "هم" "إنه"
- **Appositive.**"تيم كوك، الرئيس التنفيذي لأبل،"

**Architectures.**

1. **Rule-based (Hobbs, 1978).**القرار المُستند إلى الشجرة المُحاكمة باستخدام قواعد اللغة، خط أساسي جيد، صعب بشكل مدهش على التفاصيل.
2. **Mention-pair classifier.**لكل زوج من الذكرات$(m_i, m_j)$، يتوقع ما إذا كانوا أساسيين.
3. **Mention-ranking.**لكل ذكر، رتب المرشح سابقات (بما في ذلك "لا سابقة"). اختر أعلى.
4. **Span-based end-to-end (Lee et al., 2017).**مُرمّع مُحول. قم بإعداد جميع المُرشّحين إلى حدّ طولٍ. توقع النتائج. توقع احتمالات سابقة لكلّ مُميز. قم بتجميعها بمهارةٍ. الوضع الافتراضي الحديث.
5. **Generative (2024+).**إعطاء ماجستير في العلوم: "أدراج كل اسم في هذا النص والسلفه". يعمل بشكل جيد على الحالات السهلة، ويتعاطى مع الوثائق الطويلة والإشارات النادرة.

**The evaluation metrics.**خمس مقاييس قياسية (MUC، B3، CEAF، BLANC، LEA) لأن لا يوجد مقاييس واحدة تسجل جودة التجميع. قم بتقديم متوسط الثلاثة الأولى كـ CoNLL F1.

**Known hard cases.**

- وصفات محددة تشير إلى الكيانات التي تم إدخالها في الصفحات السابقة.
- "الجلود" → سيارة ذكرت سابقًا.
- صفر التشويق في لغات مثل الصينية واليابانية.
- كاتافورا (النموذج قبل المرجح): "عندما **she**دخلت، ابتسمت ماري".

```figure
coref-links
```

## بناءها

### الخطوة الأولى: التوجيه العصبي المسبق للتدريب (ألن ن ل ب / spaCy- تجربي)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

في وثيقة أطول، تحصل على شيء مثل:
- الكluster 1: [Apple، الشركة، هو]
- المجموعة الثانية: [المنتجات الجديدة، هي]

### الخطوة الثانية: حلل اللقب القائم على القواعد (التدريس)

انظر`code/main.py`لتنفيذ القرارات القصوى فقط:

1. ذكرات الاستخراج: الكيانات المسمى (المتوسطة الرأسمالية) ، المسميات (البحث المباشر) ، والوصف المحدد ("الX").
2. لكل اسم، انظر إلى الذكرات السابقة من K و قم بتسجيلها:
   - اتفاقية الجنس/الرقم (الهيورستيكية)
   - الاخيرة (الربح القريب)
   - الدور النقدي (المواضيع المفضلة)
3. ربط أعلى مستوى من السجلات

ليس منافساً مع النماذج العصبية، لكنه يظهر مساحة البحث والقرارات التي يجب أن يتخذها النموذج من نهاية إلى نهاية.

### الخطوة الثالثة: استخدام الـ LLM للإحساس

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

وضعين فشلين لمشاهدة. أولاً، LLM أكثر من الاندماج ("هُو" و "هِي" يشير إلى شخصين متميزين). ثانياً، LLM يلقي صامتًا الذكرات في الوثائق الطويلة. تأكيد دائمًا مع التحقق من التكافؤ.

### الخطوة الرابعة: التقييم

يقوم النص القياسي conll-2012 بحساب MUC، B3، CEAF-φ4 ويعطي متوسط. لتحقيق تقييم داخلي، ابدأ بدقة مستوى فترة التداول واستدعاء مجموعة الاختبار الملاحظة، ثم أضف ربط ذكر F1.

## الفخاخ

- **Singleton explosion.**بعض الأنظمة تقرير كل ذكر كعبارة خاصة به B3 هو متساهل MUC يعاقب هذا دائما تحقق كل المقاييس الثلاثة
- **Pronouns in long context.**أداء تقليل 15 ف1 على الوثائق التي تزيد عن 2000 رمزاً
- **Gender assumptions.**القواعد المقررة للجنس تنتهك المرجحين غير الثنائيين والمنظمات والحيوانات.
- **LLM drift on long docs.**لا يمكن لمكالمة API واحدة أن تذكّر بثقة مجموعة عبر 50 فقرة أو أكثر. استخدم نافذة الزرعة + مزج.

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

نمط التكامل الذي سيتم إرساله في عام 2026: تشغيل NER أولاً، تشغيل coref، دمج coref clusters إلى كيانات NER.

## أرسله

إبقوا`outputs/skill-coref-picker.md`:

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

## التمارين

1. **Easy.**إشغيل القرار القائم على القواعد في `code/main.py`على 5 فقرات مصنوعة يدوياً. قياس دقة الإشارة-الصلة مقابل الحقيقة الأرضية.
2. **Medium.**استخدم نموذج عصبي مدرب مسبقًا في مقالة أخبارية، قارن المجموعات مع ملاحظاتك اليدوية الخاصة. أين فشلت؟
3. **Hard.**بناء خط أنابيب NER محسنة: أولاً NER، ثم دمج عبر مجموعات أساسية. قياس تحسين تغطية الكيانات مقابل NER فقط على 100 مقالة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## المزيد من القراءة

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) فصل كتاب دراسي كانوني
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) نهاية إلى نهاية على أساس التدفق
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529)التدريب المسبق الذي يحسن القلب
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) المعيار المرجعي
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064)القواعد القياسية
