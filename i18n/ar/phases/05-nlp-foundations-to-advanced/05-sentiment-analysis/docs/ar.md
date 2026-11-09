# تحليل المشاعر

> مهمة النمط النووي القنوني. معظم ما تحتاج إلى معرفته عن تصنيف النص الكلاسيكي يظهر هنا.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## المشكلة

"الطعام لم يكن جيداً" إيجابي أم سلبي؟

يبدو الشعور بسيطًا. قال أحد المراجعين إنهم أحبوا أو لم يحبوا شيئًا ما. وضع علامة على الجملة. السبب في أن الأمر أصبح مهمة NLP القنوني هو أن كل حالة سهلة المظهر تخفي واحدة صعبة. ينقل الرفض المعنى. يعكس الساركازم ذلك. "ليس سيئاً على الإطلاق" إيجابيًا على الرغم من كلمتين ذات رمز سلبي. تحمل الإموجيز إشارة أكثر من النص المحيط.`tight`في مراجعة الموسيقى مقابل `tight`في مراجعة الأزياء).

إن المشاعر هي مختبر عمل لـ NLP الكلاسيكي. إذا فهمت لماذا كل خط أساسي ساذج لديه وضع فشل محدد، فهمت لماذا تم اختراع كل نموذج أغنى. هذا الدروس يبني خط أساسي بايز ساذج من الصفر، ويضيف رجعة لوجستية، ويعطى الأسماء للطغيان التي تجعل مشاعر الإنتاج مشكلة درجة الامتثال.

## المفهوم

الشعور الكلاسيكي هو وصفة خطوتين

1. **Represent.**حول النص إلى متجه ميزة.
2. **Classify.**تطبيق نموذج خطي (Naive Bayes، رجعة اللوجستية، SVM) على الأمثلة الملصقة.

البشعري (بايز) هو أغبى نموذج يعمل افترض كل ميزة مستقلة بالنظر إلى العلامة التجارية`P(word | positive)`و`P(word | negative)`في الاستنتاج، ضرب الاحتمالات. افتراض الاستقلال "الساذج" خاطئ بشكل مضحك ومع ذلك النتائج قوية بشكل مذهل. السبب: مع ميزات النص النادرة والبيانات المتوسطة، يهتم المصنف حول أي جانب كل كلمة تميل نحو أكثر من كم.

التراجع اللوجستي يصلح افتراض الاستقلال. يتعلم وزن لكل ميزة، بما في ذلك الوزن السلبي. `not good`وذلك لا يمكن لـ (بايز) البديل أن يفعل ذلك لـ (بايز) لم يسمّه أبداً

```figure
sentiment-logits
```

## بناءها

### الخطوة الأولى: مجموعة بيانات صغيرة حقيقية

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

صغيرة على وجه الخصوص. العمل الحقيقي يستخدم عشرات الآلاف من الأمثلة (IMDb، SST-2، قطبية Yelp). الرياضيات هي نفسها.

### الخطوة الثانية: البديلة المتعددة من الصفر

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

التسهيل الإضافي (الألفا = 1.0) هو تسهيل لابلاس. بدونها، كلمة غير مرئية في فئة لديها احتمال صفر والسجل ينفجر. `alpha=0.01`هو شائع في الممارسة العملية. `alpha=1.0`هو الاختلالات التعليمية.

### الخطوة الثالثة: تراجع اللوجستية من الصفر

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

يُعتبر التنظيم L2 مهمًا هنا. ميزات النص نادرة؛ بدون L2 يتذكر النموذج أمثلة التدريب. ابدأ من `0.01`و التنسيق

### الخطوة الرابعة: إبطال التعامل (وضع الفشل)

فكر في "غير جيد" و "ليس سيئا"`{not, good}`و`{not, bad}`ويتعلم من أي شخص ظهر أكثر في التدريب.`not_good`و`not_bad`ويتعلمها بصفة مميزة، وهذا عادة ما يكون كافياً.

إصلاحات أكثر صرامة تعمل عندما لا يكون لديك الكبيرة:**negation scoping**. إضافة رموز التوقيت بعد كلمة سلبية مع `NOT_`حتى النقاط التالية.

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

الآن`good`و`NOT_good`المصفوف يمكن أن يوزنها على العكس. ثلاث خطوط من المعالجة المسبقة، دقة القياس قفزة على مقاييس الشعور.

### الخطوة 5: قياسات التقييم التي تهم

الدقة وحدها مضللة إذا كانت الفئات غير متوازنة. عادة ما تكون أعضاء المشاعر الحقيقية إيجابية بنسبة 70-80% أو سلبية بنسبة 70-80٪. يصبح تصنيف الأغلبية المستمرة دقة بنسبة 80% و غير قيمة.

- **Per-class precision and recall.**زوج واحد لكل فئة، ووسعهم الكلي للحصول على رقم واحد يحترم توازن الفئة.
- **Macro-F1 (primary metric for imbalanced data).**متوسط درجات الفئة الفئة، مع الوزن المتساوى. استخدم هذا بدلاً من الدقة عندما تكون الفصول غير متوازنة.
- **Weighted-F1 (alternative).**نفس ماكرو ولكن معدل من خلال تردد الفئة. تقرير إلى جانب ماكرو-F1 عندما يكون عدم التوازن نفسه له معنى عمل.
- **Confusion matrix.**العد الخام. دائما تحقق قبل الثقة أي مقياسية المتعددة؛ فإنه يكشف عن أي زوج من الفئات النموذج يخلط.
- **Per-class error samples.**سحب 5 توقعات خاطئة لكل فئة وقرأها لا شيء يحل محل القراءة الأخطاء الفعلية

بالنسبة للبيانات التي لا توازن لها بشكل كبير (نسبة 95-5) ، تقرير **AUROC**و**AUPRC**بدلاً من الدقة، فإن AUPRC أكثر حساسية تجاه الطبقة الأقلية، وهو ما يهمك عادة (البريد الإلكتروني والاحتيال والشعور النادر).

**Common bug to avoid.**الإبلاغ عن الفئة الصغيرة F1 بدلاً من الفئة الكبرى F1 على البيانات غير المتوازنة يعطي رقم يبدو عالياً لأنه يهيمن عليه فئة الأغلبية.

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

## استخدمها

سيكيت-ليرن يفعل ذلك في ستة سطر، صحيح.

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

ثلاثة أشياء يجب ملاحظتها`stop_words=None`يحتفظ بالنساء`ngram_range=(1, 2)`يضيف الكلمات الكبيرة لذلك`not good`يصبح ميزة (تجمع الكلمات مع مساحة). `sublinear_tf=True`هذه العلامات الثلاثة هي الفرق بين خط أساسي دقيق بنسبة 75% و 85٪ دقيق في SST-2.

### متى يجب الوصول إلى محول

- اكتشاف السخرية النماذج الكلاسيكية تفشل هنا
- مراجعات طويلة حيث يغير المشاعر في منتصف الوثيقة
- "الكاميرة كانت رائعة لكن البطارية كانت رهيبة" عليك أن تعطي المشاعر إلى الجوانب.
- لغات غير الإنجليزية ذات موارد قليلة. BERT متعددة اللغات تعطيك خط أساسية صفر إطلاق مجانا.

إذا كنت بحاجة إلى أي من المذكور أعلاه، فانتقل إلى المرحلة 7 (غوص العميقة للمتحولات). وإلا، فإن البغاء البايز أو التراجع اللوجستي على TF-IDF بالإضافة إلى البيغرامات بالإضافة إلى التعامل مع السلب هو خط أساسي لإنتاجك لعام 2026.

### فخ التكرار (مرة أخرى)

إعادة تدريب نماذج المشاعر هو روتين. إعادة تقييمها ليس كذلك. استخدام أرقام الدقة التي تم الإبلاغ عنها في الورق تقسيمات محددة، وتعالج مسبقا محددة، وتعلامات محددة. إذا قارنت نموذجك الجديد إلى خط أساسي دون استخدام خط الأنابيب المتطابق، فسوف تحصل على دلتا مضللة. دائما إعادة تشكيل خط الأساس على خط الأنابيب الخاص بك، وليس رقم الورق.

## أرسله

إبقوا`outputs/prompt-sentiment-baseline.md`:

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

## التمارين

1. **Easy.**إضافة`apply_negation`كخطوة من قبل المعالجة في خط التعلم المتحكم في التعلم و قياس دلتا F1 على مجموعة بيانات الحساسية الصغيرة.
2. **Medium.**تنفيذ تراجع اللوجستية الموزن حسب الفئة (موافقة `class_weight="balanced"`لتحقيق التوازن المختلف في فئة 90-10
3. **Hard.**قم ببناء كاشف السخرية عن طريق تدريب مصنف ثان على بقايا نموذج المشاعر. وثيقة إعدادك التجريبي. حذر القارئ عندما تكون دقةك أقل من فرصة (مستوى الاحتمال على السخرية من فئة 2 هو ~ 50% ، ومعظم المحاولات الأولى تهبط هناك).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## المزيد من القراءة

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html)-البحث الأساسي طويل، لكن الأقسام الأربعة الأولى تغطي كل شيء كلاسيكي.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) الصحيفة التي أظهرت الكبيرة + البديلة بايز من الصعب أن تضرب على النص القصير.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) إشارة إلى `CountVectorizer`،`TfidfVectorizer`وكل زر ستقوم بتحسينه
