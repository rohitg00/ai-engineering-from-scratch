# ارزیابی LLM  RAGAS، DeepEval، G-Eval

> مطابقت دقیق و F1 معادلات معنوی را از دست می دهند. بررسی انسانی مقیاس نمی گیرد. LLM به عنوان قاضی پاسخ تولید است  با کالیبراسیون کافی برای اعتماد به تعداد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## مشکل

سیستم RAG شما جواب ميده: "29 ژوئن 2007".
اونم: "29 ژوئن 2007"
نمره درست مسابقه 0. نمره F1 ~75 درصد.

حالا با ۱۰ هزار مورد آزمایش ضرب کنید. با هر تغییر در بازیافت کننده، کنده، پرامپ، یا مدل ضرب کنید. شما به یک ارزیابی کننده نیاز دارید که معنی را درک کند، در مقیاس ارزان تر اجرا کند، در مورد بازپسین دروغ نگفته و حالت های شکست مناسب را نشان می دهد.

سال 2026 سه چارچوبی دارد که مالک این مشکل هستند.

- **RAGAS.**بازیافت-تقييم نسل افزوده. چهار متریک RAG (وفاداری، پاسخ-مرتبط، دقت-مناظر، بازپس گرفتن زمینه) با پس زمینه NLI + LLM-قاضیان. با حمایت از تحقیقات، سبک وزن.
- **DeepEval.**آزمون برای مدرک کارشناسی ارشد G-Eval، تکمیل کار، توهم، متریک تعصب CI/CD-native
- **G-Eval.**یک روش (و یک متریک DeepEval): LLM به عنوان قاضی با زنجیره تفکر، معیارهای سفارشی، نمره 0-1.

هر سه تکیه بر قانون استعدادي به عنوان قاضي. این درس حس رو برای روش و لایه اعتماد اطرافش ایجاد می کنه.

## مفهوم

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**یک متریک جامد را با یک LLM جایگزین کنید که نتایج را با توجه به یک Rubric نشان می دهد.`(query, context, answer)`، به قاضي LLM اطلاع بده: "در مورد وفاداری 0-1 امتیاز بده".

چرا کار می کند: LLM ها قضاوت انسانی را با یک بخش کوچکی از هزینه تخمین می زنند.$0.003 per scored case enables 1000-sample regression eval runs for under $۵.

چرا به طور خاموشي شکست مي خوره:

1. **Judge bias.**داوران پاسخ های طولانی تر را ترجیح می دهند، پاسخ های خانواده مدل خود را، پاسخ هایی که با سبک سریع مطابقت دارند.
2. **JSON parsing failures.**امتیاز بد JSON → NaN → خاموش از مجموعه خارج شده است. کاربران RAGAS این درد را می دانند. دروازه با try/except + حالت شکست صریح.
3. **Drift over model versions.**ارتقاء قاضي هر اندازه يي رو عوض ميکنه.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**یک معیار سفارشی تعریف کنید: "آیا پاسخ منبع صحیح را ذکر می کند؟" چارچوب به طور خودکار به مراحل ارزیابی زنجیره ای فکر گسترش می یابد، سپس نمره 0-1. برای ابعاد کیفیت خاص دامنه مناسب RAGAS پوشش نمی دهد.

**Calibration.**هرگز به نمره ی قاضی خام اعتماد نکنید تا زمانی که ارتباط با برچسب های انسانی داشته باشید. 100 مثال دست نوشته را اجرا کنید. قاضی پلاوت مقابل انسان. rho Spearman را محاسبه کنید. اگر rho < 0.7 باشد، rubric قاضی شما نیاز به کار دارد.

```figure
n5-judge-gauge
```

## آن را بسازید

### مرحله 1: وفاداری به NLI (نویس RAGAS)

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

پاسخ را به ادعاهای اتمی تجزیه کنید. NLI هر ادعایی را با زمینه باز یافت شده بررسی کنید. وفاداری = کسری پشتیبانی شده.

### مرحله دوم: ارتباط پاسخ

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

اگر پاسخ به سوالات متفاوت از سوال پرسیده شده باشد، اهمیت آن کاهش می یابد.

### مرحله 3: متریک سفارشی G-Eval

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

مراحل ارزیابی، Rubric هستند. مراحل صریح پایدارتر از پیام های ضمنی "نمره 0-1" هستند.

### مرحله 4: دروازه CI

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

به عنوان یک فایل پیتست ارسال کنید، هر رابطه عمومی را اجرا کنید، بلاک در بازپسین ها ادغام می شود.

### مرحله 5: ارزیابی اسباب بازی از ابتدا

ببین`code/main.py`. فقط مقربات وفاداری (تپای پاسخ دادن به مطالب با زمینه) و ارتباط (تپای پاسخ دادن به نشانه ها با نشانه های سوال) است.

## دام ها

- **No calibration.**یه قاضی که نسبت 0.3 به برچسب های انسانی داره، شوریه.
- **Self-evaluation.**با استفاده از همان LLM برای تولید و قضاوت نمره ها را 10-20% افزایش می دهد. برای قاضی از یک خانواده مدل متفاوت استفاده کنید.
- **Positional bias in pairwise judging.**قاضيان اولين گزینه رو که پيش مياد ترجيح مي دهند هميشه ترتيب رو تصادفي کنين و هر دو رو اجرا کنين
- **Raw aggregate hides failures.**نمره متوسط 0.85 اغلب 5 درصد شکست های فاجعه بار را پنهان می کند. همیشه به کوانتيل پایین نگاه کنید.
- **Golden dataset rot.**مجموعه های ارزیابی بدون نسخه ای که در طول زمان حرکت می کنند مقایسه طولاني را شکسته اند. مجموعه داده ها را با هر تغییر برچسب کنید.
- **LLM cost.**در مقیاس، قاضي ميگه هزينه ي زير بر ميگيره. از ارزان ترين مدل استفاده کن که با حد ترازگي مطابقت داره. GPT-4o-mini، کلاود هايکو، مسترايل- کوچولو.

## ازش استفاده کن

دسته 2026:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

دسته بندی های معمول: RAGAS برای نظارت، DeepEval برای CI، G-Eval برای ابعاد جدید. سه مورد را اجرا کنید؛ آنها به طور مفید متفق نیستند.

## -باده

پس از`outputs/skill-eval-architect.md`:

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

## تمرینات

1. **Easy.**از RAGAS در 10 نمونه RAG با توهم های شناخته شده استفاده کنید.
2. **Medium.**دستي 50 تا جواب سوالي 0-1 براي درستگي نمره با G-Eval اندازه گيري اسپيرمن rho بين قاضي و انسان
3. **Hard.**با DeepEval يه گيتر بيشترين IC بسازيد. عمداً بازگير كننده را بازگير کنيد. بازگير شکست گيتر را بررسي کنيد. از طریق بازرسي حد دست کم 10 درصد هشدار به سمت پایین تر اضافه كنيد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## خواندن بیشتر

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) روزنامه راگاس
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) کاغذ G-Eval
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) بسته تولید باز
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) تعصب، کالیبراسیون، محدودیت
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) چارچوبی متحد که RAGAS، DeepEval، Phoenix را یکپارچه می کند.
