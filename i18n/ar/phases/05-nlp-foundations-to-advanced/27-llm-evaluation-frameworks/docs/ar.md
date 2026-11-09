# تقييم الجامعة  RAGAS، DeepEval، G-Eval

> المقابلة الدقيقة و F1 تفوت المساواة التفاصلية. لا يتحكم في حجم المراجعة البشرية. LLM-as-judge هو إجابة الإنتاج  مع تصحيح كافٍ للاعتماد على الرقم.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## المشكلة

نظامك الراغ يجيب: "29 يونيو 2007".
المرجع الذهبي هو: "29 يونيو 2007".
0 نقاط في الفوركس 1 75٪، إنسان سوف يسجل 100٪.

الآن ضرب بـ 10,000 حالة اختبار. ضرب مرة أخرى بـ كل تغيير في الرد، أو التجزئة، أو التسجيل، أو النموذج. تحتاج إلى مقدم تقييم يفهم المعنى، يعمل على نطاق رخيص، لا يكذب عن التراجع، و يظهر أوضاع الفشل الصحيحة.

2026 لديها ثلاثة إطار تملك هذه المشكلة.

- **RAGAS.**تقييم الجيل المُتعزز من الاسترداد. أربعة مقاييس RAG (الصدق، والسواب-التواصل، والدقة السياقية، والذكرى السياقية) مع خلفيات قضاة NLI + LLM. مدعومة بالبحث، خفيفة الوزن.
- **DeepEval.**اختبار للماهلة العليا G-Eval، إكمال المهام، الهلوسة، مقاييس التحيز CI/CD-أصل.
- **G-Eval.**طريقة (ومتريكة DeepEval): ماجستير في الدراسة كقاضي مع سلسلة من الفكر، معايير مخصصة، 0-1 درجة.

كلّ الثلاثة يعتمدون على القانون كقاضي، هذا الدروس يبني الحسّاسة للنهج وطبقة الثقة المحيطة به.

## المفهوم

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**استبدل المقياسات العادية بـ LLM الذي يسجل النتائج في عنوان معين.`(query, context, answer)`،سأطلب من القاضي LLM: "تجاوز 0-1 على الوفاء".

لماذا يعمل: تقريري القانون يقدر الحكم البشري بجزء صغير من التكلفة.$0.003 per scored case enables 1000-sample regression eval runs for under $5

لماذا يفشل بصمت:

1. **Judge bias.**القاضاة يفضلون إجابات أطول، إجابات من عائلتهم المثاليّة، إجابات تتطابق مع أسلوب التسجيل.
2. **JSON parsing failures.**سلبي JSON → NaN نسبة → مستبعد صامتًا من الجمع. مستخدمو RAGAS يعرفون هذا الألم. البوابة مع وضع فشل محاولة / باستثناء + صريح.
3. **Drift over model versions.**تحديث القاضي يغير كل مقياس تجميد نموذج القاضي + النسخة.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**حدد معيارًا مخصصًا: "هل يذكر الإجابة المصدر الصحيح؟" يتوسع الإطار تلقائيًا إلى خطوات تقييم سلسلة الأفكار ، ثم يصل إلى 0-1.

**Calibration.**لا تثق أبداً في درجة القضاة الخام حتى يكون لديك علاقة مع العلامات البشرية. قم بتشغيل 100 مثال معلّم يدوياً. القضاة المقصودة مقابل البشر. احسب rho Spearman. إذا rho < 0.7, تحتاج إلى عمل عنوان القضاة.

```figure
n5-judge-gauge
```

## بناءها

### الخطوة الأولى: الوفاء مع NLI (مثل RAGAS)

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` is any callable: prompt str -> generated str.
# Example: llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""Break this answer into simple factual claims (one per line):
{answer}
"""
    return llm(prompt).splitlines()


def faithfulness(answer: str, context: str, llm: LLM) -> float:
    claims = atomic_claims(answer, llm)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        result = nli({"text": context, "text_pair": claim})[0]
        entail = next((s for s in result if s["label"] == "entailment"), None)
        if entail and entail["score"] > 0.5:
            supported += 1
    return supported / len(claims)
```

تحلل الإجابة إلى ادعاءات ذرية. تحقق من كل ادعاء ضد السياق المسترد. الوفاء = الجزء المدعوم.

### الخطوة الثانية: أهمية الإجابة

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: any model implementing .encode(texts, normalize_embeddings=True) -> ndarray
# e.g., encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"Write {n} questions this answer could be the answer to:\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

إذا كانت الإجابة تشير إلى أسئلة مختلفة عن تلك التي طرحت، فإن الصلة تنخفض.

### الخطوة 3: مقياس مخصص G-Eval

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="Correctness",
    criteria="The answer should be factually accurate and match the expected output.",
    evaluation_steps=[
        "Read the expected output.",
        "Read the actual output.",
        "List factual claims in the actual output.",
        "For each claim, mark supported or unsupported by the expected output.",
        "Return score = fraction supported.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="When was the first iPhone released?",
                   actual_output="June 29th, 2007.",
                   expected_output="June 29, 2007.")
metric.measure(test)
print(metric.score, metric.reason)
```

خطوات التقييم هي المادة الخطوات المفصلة أكثر استقرارًا من الإشارات الضمنية "نسبة 0-1".

### الخطوة الرابعة: بوابة المعلومات

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"faithfulness regression on {case.id}"
        rel.measure(case)
        assert rel.score >= 0.7, f"relevancy regression on {case.id}"
```

أرسل كملف فحص، قم بتشغيل كل عمل إعلامي، والجزء يدمج في التراجع

### الخطوة 5: تقييم الألعاب من الصفر

انظر`code/main.py`تقارب الوفاء (تداخل مطالبات الإجابة مع السياق) والسواب (تداخل رموز الإجابة مع رموز السؤال) فقط. لا تنتج. يظهر الشكل.

## الفخاخ

- **No calibration.**القضاة الذين لديهم ارتباط 0.3 مع علامات البشر هم ضجيج، يتطلبون إجراء تحديد التيار قبل الشحن.
- **Self-evaluation.**استخدام نفس الدرجة العليا لإنتاج وتحكم يضخم النتائج بنسبة 10-20٪. استخدم عائلة نموذجية مختلفة للقاضي.
- **Positional bias in pairwise judging.**القاضاة يفضلون الخيار الأول المقدم دائماً تعديل النظام وتشغيلها
- **Raw aggregate hides failures.**الدرجة المتوسطة 0.85 غالبا ما تخفي 5% الفشل الكارثي دائما تحقق من القسم السفلي
- **Golden dataset rot.**مجموعات تقييم غير المعدلة التي تتحرك عبر الزمن تقطع المقارنة الطولية.
- **LLM cost.**على المقياس، القضاة يسيطرون على التكلفة، استخدموا أرخص النموذج الذي يلبي عتبة التصفية، GPT-4o-ميني، كلود هايكو، ميسرال-صغير.

## استخدمها

"مجموعة 2026"

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

كومة نموذجية: RAGAS للمراقبة، DeepEval للمعرفة العلمية، G-Eval للأبعاد الجديدة. تشغيل الثلاثة؛ فإنها تختلف بشكل مفيد.

## أرسله

إبقوا`outputs/skill-eval-architect.md`:

```markdown
---
name: eval-architect
description: Design an LLM evaluation plan with calibrated judge and CI gates.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Given a use case (RAG / agent / generative task), output:

1. Metrics. Faithfulness / relevance / context-precision / context-recall + any custom G-Eval metrics with criteria.
2. Judge model. Named model + version, rationale for cost vs accuracy.
3. Calibration. Hand-labeled set size, target Spearman rho vs human > 0.7.
4. Dataset versioning. Tag strategy, change log, stratification.
5. CI gate. Thresholds per metric, regression-window logic, bottom-quantile alert.

Refuse to rely on a judge untested against ≥50 human-labeled examples. Refuse self-evaluation (same model generates + judges). Refuse aggregate-only reporting without bottom-10% surfacing. Flag any pipeline where judge upgrade lands without parallel baseline eval.
```

## التمارين

1. **Easy.**استخدموا RAGAS على 10 أمثلة RAG مع الهلوسات المعروفة. تحقق من وفاء المقاييس القبض على كل واحد.
2. **Medium.**الـ 50 ق ق ق يُجيبُ 0-1 على الصوابِ، النتيجة بـ G-Eval، قياسِ ريو (سبيرمان) بين القاضيِ والإنسان.
3. **Hard.**قم ببناء بوابة إعلامية معينة مع DeepEval، قم بتراجع الجهاز عن قصد، تحقق فشل البوابة، أضف إشعار القيود القاعدية من خلال التحقق من العدودي في أدنى 10%.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## المزيد من القراءة

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217)ورقة راغاس
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634)ورقة G-Eval
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) فتح سلسلة الإنتاج
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)التحيزات، التصفية، الحدود
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers)إطار موحد يدمج RAGAS، DeepEval، Phoenix.
