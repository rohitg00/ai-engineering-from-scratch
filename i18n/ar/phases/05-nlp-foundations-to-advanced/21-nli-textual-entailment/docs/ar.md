# إضفاء اللغة الطبيعية  إضافة نصية

> "t يتضمن h" يعني قراءة بشرية t قد تخلص h صحيح. NLI هي مهمة التنبؤ بالتضامن / التناقض / المحايد. مملة على السطح، تحمل الحمل في الإنتاج.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## المشكلة

لقد صنعت مخططاً، لقد أنتج مخططاً، كيف تعرف أن المخطط لا يحتوي على الهلوسة؟

لقد صنعت جهاز دردشة أجاب "نعم" كيف تعرف أن الإجابة مدعومة بالمرحلة التي تم استردادها؟

يجب أن تصنف 10 آلاف مقالة أخبار حسب الموضوع لا توجد لديك علامات تدريب

كل هذه المشاكل الثلاثة تتراجع إلى إدلاء اللغة الطبيعية. يسأل NLI: نظراً للاستباقات `t`وفرضية`h`، هو`h`المترتبة على`t`هل تتناقض أو محايدة (غير مرتبطة) ؟

- **Hallucination check:** `t`= الوثيقة المصدرة`h`لا تعني التشوهات
- **Grounded QA:** `t`= الممر المُسترد ،`h`لا تَتَأَخّر = التَصَوُّر.
- **Zero-shot classification:** `t`= الوثيقة`h`= علامة شفهية ("هذا عن الرياضة").

مهمة واحدة، ثلاثة استخدامات إنتاجية، ولهذا السبب كل إطار تقييم RAG يرسل نموذج NLI تحت الغطاء.

## المفهوم

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t``h`" القطة على السجادة " يعني " هناك قطة "
- **Contradiction.** `t`- نعم`h`" القطة على السجادة " تتناقض مع " لا يوجد قطة "
- **Neutral.**لا يوجد استنتاج على أي حال " القط على المجادلة " هو محايد إلى " القط جائع "

**Not logical entailment.**إن إنجلترا هي * إستنتاج لغة طبيعي * ما يستنبيه قراء إنسان نموذجي وليس منطق صارم. "جون سار كلبه" يتضمن "جون لديه كلب" في إنجلترا، ولكن منطق الدرجة الأولى الصارمة لن يعترف بذلك إلا إذا كنت تصف حيازة.

**Datasets.**

- **SNLI**(2015). 570 ألف زوج من الملاحظات البشرية، أسمائ الصورة كمنشآت.
- **MultiNLI**(2017). 433 ألف زوج عبر 10 أنواع.
- **ANLI**(2019). NLI المعارضة. كتب البشر أمثلة مصممة خصيصًا لفك النماذج الحالية. أصعب.
- **DocNLI, ConTRoL**(202021). المواقع طويلة المستندات. اختبارات استنتاج متعدد الهوب والطول.

**The architecture.**مُرمّع محول (BERT، RoBERTa، DeBERTa) يقرأ `[CLS] premise [SEP] hypothesis [SEP]`- المُؤمنون`[CLS]`تمثل تغذية 3 طريقات منخفضة. تدريب على MNLI، تقييم على مستوى المعايير المتبقية، الحصول على دقة 90٪ + على أزواج في التوزيع.

**Zero-shot via NLI.**مع إعطاء وثيقة وتسميات المرشحين، حول كل ملصق إلى فرضية ("هذا النص هو عن الرياضة"). حساب احتمالية التأثير لكل منهما. اختيار أقصى. هذه هي الآلية وراء Hugging Face `zero-shot-classification`خط الأنابيب

```figure
nli-router
```

## بناءها

### الخطوة الأولى: تشغيل نموذج NLI مدرب مسبقًا

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

لإنتاج NLI، `facebook/bart-large-mnli`و`MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`"ديبرتا-ف3" تصل إلى أعلى قائمة اللائحة

### الخطوة الثانية: تصنيف الصفر

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

القالب هو "هذا المثال حول {تسمة}." حسب الافتراض. تخصيص مع `hypothesis_template`لا توجد بيانات تدريب مطلوبة لا توضيحات دقيقة تعمل خارج الصندوق

### الخطوة الثالثة: التحقق من الوفاء لـ RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

هذا هو جوهر ولاء راغاس. تقسيم الجواب المولود إلى مطالبات ذرية. تحقق من كل مطالبة مع السياق المسترد. تقرير الجزء الذي ينطوي عليه.

### الخطوة الرابعة: تصنيف NLI المُقَمَّر يدوياً (المفهوم)

انظر`code/main.py`لعبة فقط: يتم مقارنة المبدأ والفرضية عن طريق التداخل اللغوي + اكتشاف الرفض. لا تنافس مع نماذج المحول  ولكن يظهر شكل المهمة: نصين داخل، علامة 3 طريق خارج، الخسارة = التدخل المتقاطع على `{entail, contradict, neutral}`. . .

## الفخاخ

- **Hypothesis-only shortcuts.**يمكن للنماذج التنبؤ بالعلامة على افتراض وحده عند ~ 60% على SNLI لأن "لا"، "لا"، "لا" تتصل مع التناقض. نقطة أساسية قوية للكشف عن تسرب العلامة.
- **Lexical overlap heuristic.**تتجاوز "هورستيكا الفرقة" ("كل فرقة متضمنة") SNLI ولكنها تفشل في HANS/ANLI. استخدم معايير معارضة.
- **Document-length degradation.**تستخدم نماذج NLI ذات جملة واحدة 20+ F1 في أماكن طويلة المستندات. استخدم نماذج تدرب على DocNLI للسياق الطويل.
- **Zero-shot template sensitivity.**"هذا المثال حول {تسمية}" مقابل "{تسمية}" مقابل "الموضوع هو {تسمية}" يمكن أن تذبذب دقة بنسبة 10+ نقاط. ضبط القالب.
- **Domain mismatch.**تتدرب MNLI على اللغة الإنجليزية العامة. يحتاج النص القانوني والطبي والعلمي إلى نماذج NLI محددة للمجال (مثل SciNLI ، MedNLI).

## استخدمها

"مجموعة 2026"

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

نمط 2026: NLI هو شريط ملصق لفهم النص. عندما تحتاج إلى "هل يدعم A B؟" أو "هل يتناقض A B؟"

## أرسله

إبقوا`outputs/skill-nli-picker.md`:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## التمارين

1. **Easy.**أركض`facebook/bart-large-mnli`على 20 ثلاثية مصنوعة يدوياً (موقع ، فرضية ، ملصق) تغطي كل ثلاث فئات. قياس الدقة. إضافة فخ "الترتيبات السرية" المتناقضة ("لم أكل الكعكة" مقابل "أكل الكعكة") ومعرفة ما إذا كان يتحطم.
2. **Medium.**مقارنة نموذج الصفر الصارخ `"This text is about {label}"`ضد`"The topic is {label}"`و`"{label}"`في 100 عنوانات أخبار "إج نيوز" تقرير تحرك دقة
3. **Hard.**قم ببناء معاكس الوفاء بالمركز الراعي: تدمير المطالبات الذرية + NLI لكل المطالبة. تقييم على 50 إجابة تم إنشاؤها من قبل الركز الراعي مع سياق ذهب. قياس معدلات الإيجابية الخاطئة والسلبية الخاطئة مقابل علامات اليد.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## المزيد من القراءة

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) متعددة الأرقام
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) مقياس النتائج من ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classifier.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654)- حصان عمل 2026
