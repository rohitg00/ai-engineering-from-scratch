# خلاصة النص

> الأنظمة الاستخراجية تخبرك بما قاله الوثيقة الأنظمة المجردة تخبرك بما كان المؤلف يقصده مهام مختلفة، مشاكل مختلفة

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## المشكلة

مقالة أخبار تضم 2000 كلمة تصل إلى تغذيتك. تحتاج إلى 120 كلمة التي تمسك بها. يمكنك إما اختيار الجمل الثلاث الأكثر أهمية من المقال (المستخلص) أو إعادة كتابة المحتوى بكلماتك (المجرد). كل منهما يسمى التجميع. إنها مشاكل مختلفة تماما.

الاختصار الاستخرجي هو مشكلة التصنيف`k`. إن الناتج هو دائماً صفرية لأنه يتم رفعها حرفياً. الخطر هو فقدان المحتوى الذي يتم توزيعه على جميع أنحاء المقال.

الموجات المختصرة هي مشكلة في التوليد. ينتج المحول نصًا جديدًا مشروطًا على المدخل. إن المخرجات متدفقة ومضغوطة ولكن قد تلهسون حقائق لم تكن في المصدر. الخطر هو التصميم الثقي.

هذا الدرس يبني على كليهما، مع وضع الفشل لكل واحد يمتلك.

## المفهوم

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**تعامل المقال على أنه رسوم بيانية حيث العقدة هي الجمل والحوافز هي التشابهات. قم بتشغيل PageRank (أو شيء مماثل) على الرسم البياني لتحديد الجمل حسب مدى ارتباطها بكل شيء آخر. الجمل التي تحصل على أعلى درجات هي الملخص. التنفيذ القنوني هو **TextRank**(Mihalcea و Tarau، 2004).

**Abstractive.**ضبط محول مبرمجة مبرمجة (BART ، T5 ، Pegasus) على أزواج المستندات الموجزة. عند الاستنتاج ، يقرأ النموذج المستند ويولد الموجزة الموجزة عبر الانتباه. يستخدم Pegasus بشكل خاص هدف التدريب المسبق لعبارة الفجوة مما يجعله ممتازًا في التجميع دون الكثير من التضبط المضيء.

التقييم مع **ROUGE**(تدقيق متجه إلى التذكر لتقييم النقاش). ROUGE-1 و ROUGE-2 نقاط التداخل بين واحد المخطط والبيجرام. ROUGE-L علامات أطول التالي الشائع. أعلى هو أفضل ولكن 40 ROUGE-L هو "جيد" و 50 هو "مستثنائي". كل ورقة تقرير كل ثلاثة. استخدم `rouge-score`الحزمة

```figure
summarize-collapse
```

## بناءها

### الخطوة الأولى: النص (المخرج)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

اثنين من الأشياء التي تستحق الإسم. تستخدم وظيفة التشابه تداخل الكلمات المعتادة في السجل ، وهو التنوع الأصلي من TextRank. يعمل كوسين متجهات TF-IDF أيضًا. عامل التخفيف 0.85 وعدد التكرار هي الافتراضات القابلة لصفحة.

### الخطوة الثانية: التجريد مع BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

يتم ضبط BART-big-CNN على جهاز CNN / DailyMail. فإنه ينتج ملخصات في نمط الأخبار خارج الصندوق. بالنسبة للمناطق الأخرى (الأوراق العلمية، الحوار، القانونية) ، استخدم نقطة تفتيش Pegasus المقابلة أو ضبط بياناتك المستهدفة.

### الخطوة الثالثة: تقييم ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

لا يُمكنك استخدام كلمة "جري" و "جري" ككلمات مختلفة و "روج" ككلمات أقل

### خارج ROUGE (2026 تقييم الموجب)

كانت ROUGE المقياس المهيمن لـ20 عامًا ، وهي غير كافية بمفردها في عام 2026 ، وقد أظهر تحليل كبير لملفات NLG:

- **BERTScore**(مثل التضمين السياسي) اكتسب أرضاً حتى عام 2023 ويتم الإبلاغ عنه الآن إلى جانب ROUGE في معظم ورقات التجميع.
- **BARTScore**يعامل التقييم كإنتاج: قم بتقييم الموجة الموجة على مدى احتمالية تخصيصها من قبل المختصين بالبرنامج من قبل المختصين بمصدر.
- **MoverScore**(مسافة Earth Mover على التوابل السياقية) وصلت إلى المركز الأعلى في مقاييس التجميع في عام 2025 لأنه يحتوي على تداخل معنوي أفضل من ROUGE.
- **FactCC**و**QA-based faithfulness**كانت شائعة في الفترة من 2021 إلى 2023، والآن غالباً ما يتم استبدالها بـ **G-Eval**(سلسلة استشارات GPT-4 التي تسجل التماسك والاتساق والسريعة والسطح مع التفكير السلسلة).
- **G-Eval**وتتطابق نهجات القاضي في الجامعة مع الحكم البشري في 80% من الأحيان عندما يتم تصميم الروايات بشكل جيد.

توصية الإنتاج: تقرير ROUGE-L للمقارنة القديمة، ورقم BERTScore للتداخل التدريجي، G-Eval للتماسك والحقائق. تحسّن ضد 50-100 ملخص بشري.

### الخطوة الرابعة: مشكلة الواقعية

الموجبات الجامعية هي عرضة للهلوسة. الموجبات الجامعية تحمل خطر الهلوسة أقل بكثير لأن المخرج يتم رفعها حرفيا من المصدر، على الرغم من أنها لا تزال يمكن أن تضلل إذا كانت الجملة المصدرية غير سياقية أو قديمة أو اقتباس خارج النظام. هذا هو السبب الوحيد الأكبر أنظمة الإنتاج لا تزال تفضل طرق الاستخراج للمحتوى المجاور للالتزام.

أنواع الهلوسة للكشف عن:

- **Entity swap.**المصدر يقول "جون سميث" و المختصر يقول "جون براون".
- **Number drift.**المصدر يقول "25,000". الموجب يقول "25 مليون".
- **Polarity flip.**المصدر يقول "رفضت العرض" و المختصر يقول "قبل العرض"
- **Fact invention.**المصدر لا يذكر الرئيس التنفيذي، الموجز يقول أن الرئيس التنفيذي وافق

تقييمات النهج التي تعمل:

- **FactCC.**مصنف ثنائي مدرب على التواصل بين الجملة المصدرة والجملة الملخصة. يتوقع حقيقية / غير واقعية.
- **QA-based factuality.**اطلب من نموذج QA أسئلة تجيبها في المصدر. إذا كان الموجب يدعم إجابات مختلفة، علامة.
- **Entity-level F1.**مقارنة الكيانات المسموح بها في المصدر مقابل الموجة. الكيانات الموجودة فقط في الموجة المشتبه بها.

بالنسبة لأي شيء يواجه المستخدم حيث تُعتبر الحقيقة مهمة (اخبار، طبية، قانونية، مالية) ، فإن الاستخراج هو الاختيار الأكثر أماناً. يحتاج الامتصاص إلى فحص حقيقية في الحلقة.

## استخدمها

"مجموعة 2026"

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

غالبا ما تغلب LLM ذات السياق الطويل على النماذج المتخصصة في عام 2026 عندما لا تكون الحساب قيوداً. التنازل هو التكلفة والتكاثر ؛ وتعطى النماذج المتخصصة نتائج أكثر استناداً.

## أرسله

إبقوا`outputs/skill-summary-picker.md`:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## التمارين

1. **Easy.**قم بتشغيل مقالة النص على 5 مقالات أخبار. مقارنة العبارات الثلاثة الأولى لموجز مرجعي. قم بعد ROUGE-L. يجب أن ترى 30-45 ROUGE-L على مقالات على شكل CNN / DailyMail.
2. **Medium.**تنفيذ الواقعية على مستوى الكيان: استخراج الكيانات المسمى من المصدر والملخص (spaCy) ، استدعاء حسابي لكيانات المصدر في الملخص ودقة الكيانات المملحة مقابل المصدر. الدقة العالية والدقة المنخفضة تعني آمنة ولكن موجزة؛ الدقة المنخفضة تعني الكيانات الهلوسة.
3. **Hard.**مقارنة BART-Great-CNN مع LLM (Claude أو GPT-4) على 50 مقالة CNN / DailyMail. تقرير ROUGE-L، والوقائع (بحسب الكيان F1) والتكلفة لكل ملخص. وثيقة حيث يفوز كل واحد.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## المزيد من القراءة

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) الورقة الكنسية الاستخراجية
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461)ورقة "بارت"
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) بيغاسوس والهدف من الجملة الفارغة.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/)ورق حمراء
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661)ورقة المشهد الواقعية
