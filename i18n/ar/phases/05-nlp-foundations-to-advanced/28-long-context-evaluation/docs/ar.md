# تقييم طويل الأمد  NIAH، RULER، LongBench، MRCR

> إم بي إن 3 برو يعلن 10 مليون رمز من السياق. عند 1 مليون رمز، يقل MRCR 8-عبرة إلى 26.3٪. الإعلان ≠ قابل للاستخدام. تقييم السياق الطويل يخبرك القدرة الفعلية للنموذج الذي تقوم بتسليم عليه.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## المشكلة

لديك عقد من 200 صفحة. يدعي النموذج سياق 1M-token. تقوم بتثبيت العقد وتسأل: "ما هي شفرة الإنتهاء؟" يرد النموذج  ولكن يجيب من صفحة الغلاف لأن شفرة الإنتهاء تقع في عمق 120k tokens، بعد ما يشارك فيه النموذج في الواقع.

هذه هي الفجوة بين القدرة على السياق عام 2026، وتقول الصفحات التفصيلية 1M أو 10M. الواقع يقول 60-70% من ذلك يمكن استخدامه، و"مستعمل" يعتمد على المهمة.

- **Retrieval (single needle in haystack):**تقريباً مثالية حتى الحد الأقصى المعلن عنه في الطرازات الحدودية
- **Multi-hop / aggregation:**يحتضر بشكل حاد أكثر من ~ 128k على معظم الطرازات.
- **Reasoning over dispersed facts:**أول مهمة تفشل

تقييم السياق الطويل يقيس هذه المحاور. هذه الدروس تعطي أسماء المعايير، ما يقيس كل منها في الواقع، وكيفية بناء اختبار الإبرة المخصصة لمجالك.

## المفهوم

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**ضع حقيقة ("الكلمة السحرية هي الأناناس") على عمق مدير في سياق طويل. اطلب من النموذج استرداده. مسح عمق × طول. مقياس السياق الطويل الأصلي. نماذج الحدود الآن تثبت هذا؛ وهو خط أساسي ضروري ولكن ليس كافيا.

**RULER (Nvidia, 2024).**13 نوع من المهام عبر 4 فئات: الاسترداد (مفتاح واحد / متعدد مفتاح / متعدد قيمة) ، تتبع متعددة المكالمات (متابعة المتغيرات) ، والتكامل (تكرار الكلمات الشائعة) ، QA. طول السياق المثبط (4k إلى 128k +). يكشف عن نماذج تشبع NIAH ولكن تفشل على متعددة المكالمات. في إصدار 2024, فقط نصف من 17 نموذج يدعي 32k + سياق حافظ على الجودة في 32k.

**LongBench v2 (2024).**503 سؤال متعدد الاختيار، 8k-2M سياق الكلمات، ست فئات المهام: QA واحد الوثيقة، QA متعددة الوثيقة، التعلم الطويل في السياق، الحوار الطويل، إعادة التأهيل، البيانات المهيكلة الطويلة. معيار الإنتاج للسلوك في العالم الحقيقي في السياق الطويل.

**MRCR (Multi-Round Coreference Resolution).**تعريف متعدد التحولات على مقياس، 8 إبرة، 24 إبرة، 100 إبرة، تعرض عدد الحقائق التي يمكن أن تتلاعب بها نموذج قبل أن تتدهور الاهتمام.

**NoLiMa.**الإبرة والسؤال لا يتداخلون بشكل حرفي؛ الاستعراض يتطلب خطوة واحدة من التفكير المفصلي.

**HELMET.**يُحاكم العديد من الوثائق، يُطرحُ سؤالًا من أيّ أحد، يُختبر الاهتمام المنتخب.

**BABILong.**يضع سلاسل التفكير في حبات القش غير ذات صلة يختبر التفكير في حبة القش وليس مجرد الاستيلاء

### ما الذي يجب الإبلاغ عنه

- **Advertised context window.**رقم ورقة التفاصيل
- **Effective retrieval length.**تمرّة NIAH عند عتبة معينة (مثل 90%).
- **Effective reasoning length.**المجموعة أو المجموعة تتجاوز هذا العد.
- **Degradation curve.**الدقة مقابل طول السياق، رسمياً لكل نوع من المهام.

اثنين من الأرقام لصفحة التفاصيل الخاصة بك: فعالة الاستخدام وفعالة التفكير. عادة ما يكون فعالية التفكير 25-50٪ من النافذة الإعلانية.

```figure
gx-niah-decay
```

## بناءها

### الخطوة الأولى: إرسال NIAH المخصص لمجالك

انظر`code/main.py`العظم:

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

تفتيش`depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`رسم خريطة الحرارة هذه بطاقة NIAH لنموذج الهدف الخاص بك

### الخطوة الثانية: إصدار متعدد الإبر

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

الأسئلة مثل "ما هي الكلمات السحرية الثلاثة؟" تتطلب استرداد كل ثلاثة. النجاح من الإبرة الواحدة لا يتوقع النجاح من الإبرات المتعددة.

### الخطوة الثالثة: تعقب المتغيرات متعددة المكالمات (طريقة RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

الإجابة تتطلب سلسلة ثلاث مهام، وغالبا ما تنخفض دقة النماذج الحدوديّة عند 128 ألف إلى 50-70٪ هنا.

### الخطوة الرابعة: LongBench v2 على كومة

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

تقرير دقة لكل فئة، النتائج الإجمالية تخفي اختلافات كبيرة في مستوى المهمة.

## الفخاخ

- **NIAH-only evaluation.**إمتلاك نياح بنقود 1 مليون لا يعني شيئاً عن التسلل المتعدد دائماً إنجاز رولر أو اختبار متعدد التسلل المخصص
- **Uniform depth sampling.**العديد من التنفيذات فقط عمق الاختبار = 0.5 . عمق الاختبار = 0 ، 0.25 ، 0.5 ، 0.75 ، 1.0  تأثير "المفقود في الوسط" حقيقي.
- **Lexical overlap with filler.**إذا شاركت الإبرة الكلمات الرئيسية مع المملأ، يصبح الاستعراض طفيفاً. استخدم الإبر غير المتداخلة على شكل NoLiMa.
- **Ignoring latency.**تستغرق إرسال إشارة 1M 30-120 ثانية لتشغيلها مسبقاً.
- **Vendor-self-reported numbers.**OpenAI، Google، Anthropic كل تنشر نتائجها الخاصة دائماً إعادة تشغيل بشكل مستقل على قضية الاستخدام الخاصة بك

## استخدمها

"مجموعة 2026"

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

قاعدة عامة للإنتاج: لا تثق أبداً في نافذة سياقية حتى يكون لديك مهمة التفكير في NIAH + 1 في الطول المقصود.

## أرسله

إبقوا`outputs/skill-long-context-eval.md`:

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

## التمارين

1. **Easy.**قم ببناء NIAH مع 3 عمقات (0.25, 0.5, 0.75) × 3 أطول (1k, 4k, 16k). قم بتشغيل أي نموذج. معدل مرور اللقطة كخريطة حرارة 3 × 3.
2. **Medium.**إضافة نوع 3 إبر. قياس استرداد كل 3 في كل طول. مقارنة مع معدل مرور الإبر في نفس الطول.
3. **Hard.**قم ببناء مهمة تتبع المتغيرات (X1 → X2 → X3 ، مع 3 هوبات) مدمجة في 64k من الملفات. قم بقياس الدقة عبر 3 نماذج الحدود. قم بتقرير طول التفكير الفعال لكل نموذج.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## المزيد من القراءة

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack)الـ "الـ"NIAH الـ"مُؤلفة الأصلية"
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) مقياس الموازنة المتعددة المهام.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) تقييم العالم الحقيقي في السياق الطويل.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666)الإبر الصعبة
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149)التفكير في كومة الخشب
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)ورقة التحيز العميق
