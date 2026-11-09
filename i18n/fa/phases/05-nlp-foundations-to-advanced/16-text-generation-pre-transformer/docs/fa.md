# نسل متن قبل از ترانسفارمر ها  مدل های زبان N-gram

> اگه کلمه ای شگفت آور باشه مدلش خرابه. حیرانه بودن باعث شگفتی میشه. نرم کردن باعث می شه اعداد محدود باشند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## مشکل

قبل از ترانسفورماتورها، قبل از RNN ها، قبل از گنجانده شدن کلمات، یک مدل زبان کلمه بعدی را با شمارش میزان تکرار آن پس از کلمه قبلی پیش بینی می کرد.`n-1`کلمات. "قط" → "نشسته" 47 بار، "قط" → "پرید" 12 بار، "قط" → "چسب" 0 بار شمارش کنید. برای بدست آوردن توزیع احتمال عادی سازی کنید.

این یک مدل زبان n-gram است. این هر تشخیص دهنده گفتار، هر چکگر املا و هر سیستم ترجمه ماشین مبتنی بر عبارت را از سال 1980 تا 2015 اجرا کرد. هنوز هم زمانی که شما نیاز به مدل سازی زبان ارزان در دستگاه دارید اجرا می شود.

مشکل جالب این است که با گرام های ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن ن

## مفهوم

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### بازی پیش بینی

قبل از اینکه این دستگاه ها وجود داشته باشند، یک آزمایش تعریف کرد که یک مدل زبان چیست. حرف بعدی یک جمله انگلیسی را پوشش دهید. از کسی بخواهید تا حدس بزند، تا زمانی که درست کند. تعداد حدس را بنویسید. چند صد حرف تکرار کنید.

شمارش حدس ها معمولی نیست. آنها یک رمزگذاری مجدد بی ضرر متن هستند: ترتیب شمارش را به یک حدس دهنده دوم، یکسان تحویل دهید و آنها می توانند هر حرف را بازسازی کنند، زیرا در هر موقعیت دقیقاً می دانند که کدام حدس ها اول می آیند. پیام هایی که می توانید به رمز های کمتر رمزگذاری کنید، اطلاعات کمتری در هر رمز دارد، بنابراین آمار شمارش حدس ها سقف را بر روی انتروپی انگلیسی قرار می دهد.

شانون در سال 1951 اين را اجرا کرد و شماره اي داشت که هنوز هم در اين زمینه حاکم است. يک الفبا 27 سمبل (26 حرف به علاوه فضاي) ميتونه تحمل کنه`log2(27) ≈ 4.75`در این دوره، به طور کلی، یک مدل باید در یک خط به یک خط حرکت کند. با 100 حرف، انسان ها با 100 حرف از زمینه بین 0.6 تا 1.3 بیت در هر حرف حرکت می کنند. انگلیسی تقریباً سه چهارم حرکات اجباری است. ساختار یک مدل باید یاد بگیرد قبل از اینکه هر مدل بتواند یاد بگیرد اندازه گیری می شود.

هر مدل زبان از آن زمان یک بازیکن مکانیکی این بازی است، و هر شماره ارزیابی در این درس بازی به دست آمده است:

- **Cross-entropy loss**آموزش یک LM به معنای واقعی کلمه امتیاز آن را در بازی حدس می زند.
- **Perplexity**.`2^bits`(یا `e^nats`): عامل شاخه ای که هنوز با مدل پس از حدس زدن مواجه است. حدس یکسانی بیش از 27 سمبول، پیچیدگی 27 است؛ یک بازیکن 1 بیت در هر حرف، پیچیدگی 2 دارد.
- **Context length is the player's memory.**یک مدل تریگرام با دو توکن حافظه بازی می کند. یک ترانسفورماتور با 100K توکن بازی می کند. قوانین هرگز تغییر نکرده است. بازیکن بهتر شده است.

یک واحد تغییر مسیر: امتیاز بازی در هر حرف در بیت (`log2`), در حالی که فرمول های n-گرام زیر به هر کلمه نشان دهنده در nats (log طبیعی)  و از زمان پیچیدگی `e^H`در ناتس برابر`2^H`در بایت، دو دیدگاه در واحد های مختلف اندازه گیری یکسان هستند.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`. درست کردن`n`(معمولا 3 برای تریگرام، 4 برای 4 گرم)

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**هر n-گرام که در آموزش دیده نشده است احتمال صفر را به دست می آورد. یک مطالعه در سال 2007 در مورد کورپوس براون نشان داد که حتی یک مدل 4 گرم نیز 30٪ از 4 گرم را در آموزش دیده است. شما نمی توانید بدون صاف کردن در هر متن واقعی ارزیابی کنید.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**به هر شماره 1 اضافه کنيد، ساده و وحشتناک در مورد اتفاقات نادر
2. **Good-Turing.**تشکيل مجدد جرم احتمالي از حوادث فرکانسي بالاتر به حوادث نامرئي بر اساس فرکانسي فرکانسي ها
3. **Interpolation.**ترکیب تخمین های n-گرام، (n-1)-گرام و غیره با وزن های تنظیم پذیر.
4. **Backoff.**اگر n-گرام صفر را شمارش کند، به (n-1)-گرام برگردید. Katz backoff این را عادی می کند.
5. **Absolute discounting.**تخفیف ثابت را از دست بدهیم`D`از همه شمارش ها به غيب بازميگيريم
6. **Kneser-Ney.**تخفیف مطلق و یک انتخاب هوشمندانه برای مدل درجه پایین: استفاده از * احتمال ادامه* (چه تعداد زمینه ای یک کلمه در آن ظاهر می شود) به جای فرکانس خام.

بینش "کنیسر نی" عمیق است. "سان فرانسيسکو" يه بيگرام معموليه Unigram "فرانسیسکو" بیشتر پس از "سان". Naive مطلق تخفیف "فرانسیسکو" احتمال unigram بالا (چون شمارش بالا است) می دهد. کنسر نی متوجه می شود که "فرانسیسکو" تنها در یک زمینه ظاهر می شود و احتمال ادامه آن را به همین ترتیب کاهش می دهد. نتیجه: یک بیگرام رمان که با "فرانسیسکو" پایان می یابد احتمال مناسب را می گیرد.

**Evaluation: perplexity.**نماد احتمال منفی منفی در هر کلمه در یک مجموعه تست انجام شده. پایین تر بهتر است. یک پیچیدگی 100 به این معنی است که مدل به همان اندازه گیج کننده است که می تواند از میان 100 کلمه به طور یکسان انتخاب کند.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## آن را بسازید

### مرحله اول: شمارش تگرام

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

ورودی یک لیست از جملات توکن شده است. محصول شمارش n-گرام و شمارش زمینه است. `<s>`و`</s>`حدود جمله ها هستند.

### مرحله دوم: صاف کردن لپلائز

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

به هر شمارش 1 اضافه کن، اما به طور بیش از حد به حوادث ناشناخته، وزن می دهد و به حوادث نادر شناخته شده نیز آسیب می رساند.

### مرحله سوم: کنسر نی (برگام، بینگرا)

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

سه قسمت متحرک`continuation_prob`این کلمه در چند زمینه مختلف ظاهر می شود؟ (ابتكار کنسر نی).`lambda_prev`این مقدار از وزن بازخوردی است که با تخفیف آزاد شده است. احتمال نهایی عبارت است از اصطلاح اصلی تخفیف شده به علاوه مدت ادامه وزن شده.

### مرحله 4: تولید متن با نمونه گیری

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

نمونه گیری متناسب با احتمال. همیشه در هر دانه محصول متفاوتی را می دهد. برای تولید شبیه به چراغ، آرگماکس را در هر مرحله (طمع) انتخاب کنید و یک دکمه تصادفی کوچک (طمرات) اضافه کنید.

### مرحله 5: مشکوک بودن

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

برای Brown corpus، یک مدل KN 4 گرم خوب تنظیم شده به طور پیچیده در حدود 140 می رسد. یک ترانسفورماتور LM در همان مجموعه آزمایش 15-30 می رسد. شکاف حدود 10 برابر است. این شکاف دلیل حرکت میدان است.

## ازش استفاده کن

- **Classical NLP teaching.**واضح ترين تعرضي به نرمي، MLE و حيرانگي که ميتوني داشته باشي
- **KenLM.**کتابخانه تولید n-gram. به عنوان یک بازسنجی در سیستم های گفتار و MT استفاده می شود که در آن تاخیر کم اهمیت دارد.
- **On-device autocomplete.**مدل های تریگرام در کیبورد
- **Baselines.**همیشه قبل از اعلام LM عصبی خوب، یک پیچیدگی LM n-gram را محاسبه کنید. اگر ترانسفورماتور شما KN را با حاشیه گسترده ای نبرداند، چیزی اشتباه است.

## -باده

پس از`outputs/prompt-lm-baseline.md`:

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

## تمرینات

1. **Easy.**یک تریگرام LM را روی یک 1000 جمله شیکسپیر تمرین کنید. 20 جمله تولید کنید. آنها در سطح محلی قابل قبول اما در سطح جهانی غیرمسلسل خواهند بود. این دیمو قانونی است.
2. **Medium.**در مقایسه با Laplace، باید متوجه شوید که کنلکسیت KN 30 تا 50 درصد کمتر است.
3. **Hard.**ایجاد یک اصلاح کننده امجادی تریگرام: با توجه به یک کلمه اشتباه و زمینه آن، اصلاحات را ایجاد کنید و با احتمال زمینه در LM رتبه بندی کنید. بر اساس کورپوس امجادی Birkbeck (عام) ارزیابی کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## خواندن بیشتر

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) آزمایش بازی حدس زدن که هدف را تعریف می کند هر مدل زبان هنوز هم بهینه سازی می کند.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) درمان کاینونیک از LM n-گرام و نرم کردن.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) کاغذی که کنسر نی را بهترین نرمگر n-گرام قرار داد
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) کاغذ KN اصلی
- [KenLM](https://kheafield.com/code/kenlm/) تولید سریع n-gram LM، هنوز در سال 2026 برای برنامه های حساس به تاخیر استفاده می شود.
