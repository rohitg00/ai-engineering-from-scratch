# إنتاج النص قبل أن يتم تحويل اللغة  نموذجات اللغة N-gram

> إذا كانت الكلمة مفاجئة، فإن النموذج سيء، والحيرة تجعل المفاجأة رقم، والسلم يبقيه محدود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## المشكلة

قبل المحولات، قبل RNNs، قبل التوابل الكلمة، تمت توقعات نموذج اللغة الكلمة التالية عن طريق احتساب عدد المرات التي تلتها السابقة `n-1`عد "الكات" → "جلوس" 47 مرة، "الكات" → "قفز" 12 مرة، "الكات" → "الثلاجة" 0 مرة. عادي للحصول على توزيع الاحتمالات.

هذا نموذج لغة n-gram. لقد عمل كل متعرف على الكلام، كل فحص الأحرف، وكل نظام ترجمة الآلة القائم على العبارات من عام 1980 إلى عام 2015.

المشكلة المثيرة للاهتمام هي ما يجب القيام به حول n-غرامات غير مرئية. النموذج الخام القائم على العد يخصص احتمال صفر لأي شيء لم يراه ، وهو كارثي لأن الجمل طويلة وكل جملة طويلة تقريبًا تحتوي على تسلسل غير مرئي على الأقل. خمسين عامًا من البحث المُسطح قد حَل ذلك. تسطيح كنيسر-ني هو النتيجة ، وتورث التعلم العميق الحديث تقاليدها التجريبية.

## المفهوم

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### لعبة التنبؤ

قبل وجود أي من هذه الآلات، كان هناك تجربة تحدد ما هو نموذج اللغة. تغطي الحرف التالي من الجملة الإنجليزية. اطلب من شخص ما أن يحدد ذلك، تخمين واحد في كل مرة، حتى يحصلون عليه بشكل صحيح. اكتب عدد الخمين. كرر لعدة مئات من الحروف.

حسابات الاحتمالات ليست أمراً بسيطاً. إنها إعادة تشفير النص دون خسائر: سلم سلسلة الاحتمالات إلى شخص آخر، متطابق ويمكن أن يعيد بناء كل حرف، لأنه في كل موقف يعرف بالضبط أي تخمينات تأتي أولاً. رسالة يمكنك إعادة تشفيرها في عدد أقل من الرموز تحمل معلومات أقل لكل رمز، لذلك تضع إحصاءات حسابات الاحتمالات سقفًا على إنجليزية.

شانون) قام بإجراء هذا في عام 1951) و حصل على رقم لا يزال يحكم الحقل.`log2(27) ≈ 4.75`بيتات لكل حرف. المُخمنون البشريون مع 100 حرف من السياق وصلوا بين 0.6 و1.3 بيتات لكل حرف. اللغة الإنجليزية هي حوالي ثلاثة أرباع التحركات القسرية. تم قياس الهيكل الذي يجب أن يتعلمه النموذج قبل أن يتمكن أي نموذج من تعلمه.

كل نموذج لغوي منذ ذلك الحين هو لاعب ميكانيكي لهذه اللعبة، وكل رقم تقييم في هذه الدروس هو اللعبة التي تم تسجيلها:

- **Cross-entropy loss**هو متوسط عدد البيتات التي يحتاجها النموذج لكل رمز. تدريب LM هو حرفيا تقليل درجة له في لعبة التخمين.
- **Perplexity**هو`2^bits`(أو `e^nats`): عامل التفرق الذي لا يزال يواجه النموذج بعد تخميناته. تخمين موحد على 27 رمزا هو الارتباك 27؛ لاعب 1 بت لكل حرف لديه الارتباك 2.
- **Context length is the player's memory.**نموذج التريغرام يلعب مع رموز الذاكرة اثنين. محول يلعب نفس اللعبة مع رموز 100K. القواعد لم تتغير أبدا. أصبح اللاعب أفضل.

واحد واحد لتحويل المسار: تسجيلات اللعبة لكل حرف في بيت (`log2`), بينما الصيغة n-غرام أدناه تسجل لكل كلمة رمز في ناتس (سجل طبيعي)  ومنذ الارتباك `e^H`في الأرقام المتساوية`2^H`في البيت، فإن المشاهدين هما نفس القياس في وحدات مختلفة.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`- إصلاح`n`(عادة 3 للاستعمال الثلاثي، 4 للاستعمال الثلاثي)

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**أي ن-جرام لا يظهر في التدريب يحصل على احتمال صفر. وجدت دراسة عام 2007 على برون كوربوس أن حتى نموذج 4 جرام كان لديه 30٪ من 4 جرام غير مرئية في التدريب. لا يمكنك تقييم على أي نص حقيقي دون تسطيع.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**إضافة واحد لكل عدّة بسيط، فظيع في الأحداث النادرة
2. **Good-Turing.**أعيد توزيع كتلة الاحتمالات من الأحداث ذات التردد العالي إلى غير المرئية بناءً على تردد التردد
3. **Interpolation.**الجمع بين n-gram، (n-1)-gram، وما إلى ذلك، التقديرات مع الوزن المتناسب.
4. **Backoff.**إذا كان عدد n-gram 0، انخفض إلى (n-1) -gram. كاتز بيكوف يطبق هذا.
5. **Absolute discounting.**خفض خصم ثابت `D`من كل العدد، إعادة توزيع إلى الغيب.
6. **Kneser-Ney.**تخفيض مطلق بالإضافة إلى خيار ذكي لنموذج النظام الأدنى: استخدام * احتمال الاستمرار* (كم من السياقات تظهر كلمة) بدلاً من التردد الخام.

إنّ رؤية (كنيسر-نيي) عميقة. "سان فرانسيسكو" هي لغة كبيرة شائعة. يظهر اللوحة الواحدة "فرانسيسكو" في الغالب بعد "سان". تخفيضات متساوية مطلقة تعطي "فرانسيسكو" احتمالية واحدة عالية (لأن العدد مرتفع). يلاحظ كنيسر-ني أن "فرانسيسكو" يظهر في سياق واحد فقط ويقلل من احتمال استمرارها وفقًا لذلك. النتيجة: الكلام الكبير الذي ينتهي بـ "فرانسيسكو" يحصل على احتمال المناسب منخفض.

**Evaluation: perplexity.**معدل احتمالات السجل السلبي المتوسط لكل كلمة على مجموعة اختبار مستمرة. أقل هو أفضل. معدل الارتباك من 100 يعني أن النموذج مشوش كما سيكون اختيار متساوية بين 100 كلمة.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## بناءها

### الخطوة الأولى: حسابات الأربعية

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

المدخل هو قائمة من الجمل المرموزة. الخروج هو عدد n-جرام والحسابات السياقية. `<s>`و`</s>`هذه حدود الجملة

### الخطوة الثانية: تسطيح اللابلاست

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

إضافة 1 لكل عدّة، يُسطح لكن يُفرض الكثير من الكتلة على الأحداث غير المرئية، ويحطّم الأحداث النادرة المعروفة أيضاً.

### الخطوة الثالثة: كنيسر-ني (بيغرام، متقاطع)

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

ثلاثة أجزاء متحركة`continuation_prob`يحتوي على "كم من السياقات المختلفة التي تظهر فيها هذه الكلمة؟" (ابتكار كنيسر-نيي). `lambda_prev`هي الكتلة التي تم تحريرها من خلال الخصم، تستخدم لوزن الخلف. الاحتمال النهائي هو الحد الأساسي المخصوم بالإضافة إلى الحد المثقل المتابع.

### الخطوة الرابعة: إنتاج النص مع أخذ العينات

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

أخذ العينات متناسبة مع الاحتمال. يعطي دائماً نتائج مختلفة لكل بذرة. لإنتاج شبيه بالشعاع البحثي، اختر argmax في كل خطوة (طموح) واضافة زر عشوائي صغير (درجة الحرارة).

### الخطوة 5: الارتباك

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

أقل هو أفضل. بالنسبة لـ Brown corpus، نموذج KN المنسق بشكل جيد من 4 غرامات يصل إلى معقدة حوالي 140. محول LM يصل إلى 15-30 على نفس مجموعة الاختبار. الفجوة حوالي 10x. هذا الفجوة هو السبب في أن الحقل انتقل.

## استخدمها

- **Classical NLP teaching.**أوضح تعرض للطفولة، و MLE، والتحيرات التي يمكنك الحصول عليها.
- **KenLM.**المكتبة الإنتاجية n-gram. تستخدم كمسجل في النظم الكلامية و MT حيث تقل التأخير.
- **On-device autocomplete.**نماذج التريغرام في لوحة المفاتيح
- **Baselines.**دائماً احسب معقدة LM n-جرام قبل إعلان LM عصبي الخاص بك جيدة. إذا لم تحولك يفوق KN بحافة واسعة، هناك شيء خاطئ.

## أرسله

إبقوا`outputs/prompt-lm-baseline.md`:

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## التمارين

1. **Easy.**قم بتدريب ثلاثية الأبعاد على مجموعة شكسبير من 1000 جملة، وخلق 20 جملة ستكون معقولة محلياً ولكن غير متماسكة عالمياً. هذه هي التجربة القنونية.
2. **Medium.**قم بتنفيذ الارتباك لنموذج KN الخاص بك على شيكسبير المزدوج. مقارنة مع Laplace. يجب أن ترى KN أقل الارتباك بنسبة 30-50٪.
3. **Hard.**بناء مُصحّح حجة التراكم: مع إعطاء كلمة خاطئة وتحديدها، تولّد تصحيحات وتصنيف حسب احتمالية السياق تحت المُصطلح. تقييم على مجموعة التراكم البيركبك (عامة).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## المزيد من القراءة

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf)تجربة اللعبة التي تحدد الهدف كل نموذج لغة لا يزال يُحسن.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) العلاج القنوني لـ n-gram LM والسطح.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739)الورقة التي تسوية كنيسر-ني كأفضل n-جرام سلاسة.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) ورق KN الأصلي
- [KenLM](https://kheafield.com/code/kenlm/) إنتاج سريع n-gram LM، لا يزال يستخدم في 2026 للتطبيقات الحساسة بالتكسّف.
