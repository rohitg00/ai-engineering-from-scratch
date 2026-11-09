# تحلیل احساسات

> وظیفه NLP کانونیک. بیشتر آنچه که شما باید در مورد طبقه بندی متن کلاسیک بدانید در اینجا نشان داده شده است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## مشکل

"مأكولات خوب نبود" مثبت يا منفی؟

یک نظرسنجی گفت که چیزی را دوست دارند یا دوست ندارند. جمله را برچسب بزنید. دلیل آن که این کار به عنوان وظیفه NLP قانونی تبدیل شد این است که هر مورد ساده به نظر می رسد یک مشکل را پنهان می کند. انکار معنای را تغییر می دهد. سارکسم آن را معکوس می کند. "هیچ چیز بد نیست" با وجود دو کلمه کد منفی مثبت است. ایموجی ها سیگنال بیشتری نسبت به متن اطراف دارند.`tight`در نظرسنجی موسیقی در مقابل`tight`در بررسی مد)

احساس یک آزمایشگاه کار برای NLP کلاسیک است. اگر شما درک کنید که چرا هر خط پایه ساده دارای یک حالت شکست خاص است، شما درک می کنید که چرا هر مدل غنی تر اختراع شد. این درس یک خط پایه بیز ساده را از ابتدا ایجاد می کند، بازپسین لجستیک را اضافه می کند و تله هایی را نام می دهد که باعث می شود احساسات تولید یک مشکل درجه مطابقت باشد.

## مفهوم

احساس کلاسیک دو مرحله ای است.

1. **Represent.**متن را به یک ویکتور ویژگی تبدیل کنید.
2. **Classify.**یک مدل خطی (Naive Bayes، بازپسین لوژیستیک، SVM) را بر روی نمونه های برچسب گذاری مناسب کنید.

ساده ترين مدل هاي بايز که جواب ميده فرض کن هر ویژگی مستقل باشه`P(word | positive)`و`P(word | negative)`در نتیجه، احتمالات را چند برابر کنید. فرض استقلال "سخن" به طرز خنده دار اشتباه است و با این حال نتایج به طرز شگفت انگیز قوی است. دلیل: با ویژگی های متن کمیاب و داده های متوسط، طبقه بندی کننده در مورد اینکه هر کلمه به کدام طرف تمایل دارد بیشتر از چقدر اهمیت می دهد.

بازپسین لوژیستیک فرض استقلال را اصلاح می کند. وزن هر ویژگی را از جمله وزن منفی یاد می گیرد. `not good`باکس ساده نمی تواند این کار را برای بیگرام هایی که هرگز برچسب گذاری نکرده است انجام دهد.

```figure
sentiment-logits
```

## آن را بسازید

### مرحله اول: یک مجموعه داده کوچک واقعی

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

به طور خاص کوچک است. کار واقعی از ده ها هزار مثال استفاده می کند (IMDb، SST-2, قطب یلپ). ریاضیات یکسان است.

### مرحله دوم: بيايس بيگانه از ابتدا

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

صاف کردن اضافی (آلفا=1.0) ، صاف کردن Laplace است. بدون آن، یک کلمه ناشناخته در یک کلاس احتمال صفر دارد و سوابق انفجار می کند. `alpha=0.01`در عمل معمول است.`alpha=1.0`این افتضاح تدریس است.

### مرحله سوم: بازپسین لوژیستی از صفر

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

L2 تنظیم در اینجا مهم است. ویژگی های متن کمیاب هستند؛ بدون L2 مدل نمونه های آموزش را به یاد می آورد.`0.01`و آهنگ

### مرحله 4: رد کنترل (موود شکست)

"خوب نيست" و "بد نيست" رو در نظر بگير`{not, good}`و`{not, bad}`و از هر کسي که بیشتر در آموزش ظاهر شد ياد ميگيرد`not_good`و`not_bad`و آن ها را به صورت مشخصی یاد می گیرد.

يه روش خام تر که وقتي که بيگرام ندارين درست ميشه:**negation scoping**. علامت های پیشگویی بعد از کلمه رد کردن با `NOT_`تا آخرين خط بندي

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

حالا`good`و`NOT_good`در این مرحله، در حال بررسی این ویژگی ها، در نظر گرفته می شود که در حال بررسی، در نظر گرفته می شود که آیا این ویژگی ها دارای ویژگی های مختلف هستند.

### مرحله 5: معیارهای ارزیابی که اهمیت دارند

درست بودن به تنهایی در صورتی که کلاس ها متوازن نباشند گمراه کننده است. معمولاً احساسات واقعی 70-80% مثبت یا 70-80% منفی هستند. یک طبقه بندی کننده اکثریت ثابت 80٪ درست و بی ارزش است. گزارش هر یک از موارد زیر:

- **Per-class precision and recall.**یک جفت در هر کلاس، آنها را به طور ماکرو متوسط کنید تا یک عدد واحد پیدا کنید که تعادل کلاس را رعایت کند.
- **Macro-F1 (primary metric for imbalanced data).**متوسط نمرهاي ف1 در هر کلاس، با وزن مساوي. اين را به جاي دقت استفاده كنيد وقتي کلاس ها غير متوازن باشند.
- **Weighted-F1 (alternative).**همان طور که ماکرو اما با توجه به فرکانس کلاس وزن شده است. گزارش در کنار ماکرو-F1 زمانی که عدم تعادل خود دارای معنی تجاری است.
- **Confusion matrix.**شمارش خام. همیشه قبل از اعتماد به هر متریک اسکالر، بررسی کنید؛ این نشان می دهد که مدل کدام زوج کلاس را اشتباه می کند.
- **Per-class error samples.**پنج پیش بینی اشتباه در هر کلاس را بکشید. آنها را بخوانید. هیچ چیزی جایگزین خواندن اشتباهات واقعی نیست.

برای داده های شدید عدم تعادل (> 95-5 نسبت) گزارش کنید**AUROC**و**AUPRC**AUPRC نسبت به طبقه اقلیت حساس تر است، که معمولاً به آن اهمیت می دهید (سپیم، تقلب، احساسات نادر).

**Common bug to avoid.**گزارش دادن میکروF1 به جای میکروF1 در داده های نامتناسب، تعداد را به نظر می رسد بالا است زیرا توسط کلاس اکثریت تحت سلطه قرار دارد. میکروF1 شما را مجبور می کند عملکرد کلاس اقلیت را ببینید.

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## ازش استفاده کن

سکیت-لرن اون رو در شش خط درست ميکنه

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

سه تا چيز براي توجه`stop_words=None`. انکار رو نگه مي داره`ngram_range=(1, 2)`به اون اضافه مي کنه`not good`تبدیل به یک ویژگی می شود (scikit-learn دو کلمه را با یک فضای متصل می کند). `sublinear_tf=True`این سه علامت تفاوت بین یک خط پایه 75 درصد دقیق و یک خط پایه 85 درصد دقیق در SST-2 است.

### چه زمانی باید یک ترانسفورماتور را پیدا کنیم

- . کشف سارکازم مدل هاي کلاسیک اينجا شکست خورده
- بازبینی های طولانی که احساسات در وسط مستند تغییر می کنند.
- احساس مبتنی بر جنبه ها. "کامرا عالی بود اما باتری وحشتناک بود". شما باید احساسات را به جنبه ها نسبت دهید. فقط ترانسفورمرها یا مدل های ساختاری تولید.
- زبان های غیر انگلیسی، منابع کم. BERT چندزبانی به شما یک خط پایه صفر شوت را رایگان می دهد.

اگر به هر کدام از موارد بالا نیاز دارید، به مرحله هفتم (ترانسفارمر عمیق) بروید. در غیر این صورت، بیز های نابغه یا بازپسین لوژیستیک در TF-IDF به علاوه بیگرام ها به علاوه مدیریت انکار، پایه تولید شما در سال 2026 است.

### تله بازتولید (بار دیگر)

آموزش مجدد مدل های احساسات معمول است. ارزیابی مجدد آنها نیست. اعداد دقیق گزارش شده در کاغذ ها از تقسیم های خاص، پردازش پیش از کار، توکن های خاص استفاده می کنند. اگر مدل جدید خود را با خط پایه مقایسه کنید بدون استفاده از خط لوله یکسان، دلتا های گمراه کننده خواهید داشت. همیشه خط پایه را در خط لوله خود بازسازی کنید، نه شماره کاغذ.

## -باده

پس از`outputs/prompt-sentiment-baseline.md`:

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## تمرینات

1. **Easy.**اضافه کردن`apply_negation`به عنوان یک مرحله پیش پردازش در خط لوله یادگیری scikit و اندازه گیری دلتا F1 بر روی یک مجموعه داده های کوچک احساس.
2. **Medium.**پیاده سازی بازپسین لوژیستیک با وزن کلاس (پاس)`class_weight="balanced"`در این حالت، یک اثر بر روی عدم تعادل کلاس 90-10 را اندازه گیری کنید.
3. **Hard.**یک آشکارگر سارکاسمی را با آموزش طبقه بندی کننده دوم بر روی باقی مانده های مدل احساسات بسازید. تنظیمات تجربی خود را مستند کنید. وقتی دقت شما کمتر از شانس است، خواننده را هشدار دهید (مستقیمیت شانس در سارکاسم کلاس 2 حدود 50٪ است و اکثر تلاش های اول در آنجا فرود می آیند).

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## خواندن بیشتر

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) بررسی پایه ای. طولانی، اما چهار بخش اول همه چیز کلاسیک را پوشش می دهد.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) روزنامه ای که نشان داد بیگرام + بیگام بیز ساده است سخت است که در متن کوتاه شکست بخوریم.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) اشاره به `CountVectorizer`،`TfidfVectorizer`، و هر دکمه ای که تنظیم کنی
