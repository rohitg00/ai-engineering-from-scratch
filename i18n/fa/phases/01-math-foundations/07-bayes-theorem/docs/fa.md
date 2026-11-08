# نظریه بیز

> احتمال به آنچه انتظار دارید بستگی دارد. نظریه ی بیز به آنچه یاد می گیرید بستگی دارد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability Fundamentals)
**Time:** ~75 minutes

## اهداف یادگیری

- استفاده از نظریه بیز برای محاسبه احتمالات بعدی از پیشینه ها، احتمالات و شواهد
- یک طبقه بندی کننده متن بیز ساده را از ابتدا با نرم کردن Laplace و محاسبه فضای ثبت بسازید
- مقایسه تخمین MLE و MAP و توضیح دهید که چگونه MAP با تنظیم L2 مطابقت دارد
- پیاده سازی به روز رسانی بیزیان متوالی با استفاده از پیشینه های کنجوجات بتا-بینومیال برای آزمایش A / B

## مشکل

آزمایش پزشکی 99 درصد درست است، شما مثبت هستید چه شانس هایی دارید که واقعاً این بیماری را داشته باشید؟

اکثر مردم می گویند 99 درصد. پاسخ واقعی بستگی به اینکه بیماری چقدر نادر است دارد. اگر 1 نفر از هر 10 هزار نفر مبتلا باشد، نتیجه مثبت تنها 1% احتمال بیمار شدن را به شما می دهد. 99 درصد دیگر نتایج مثبت هشدارهای نادرستی از افراد سالم هستند.

این یک سوال فریب نیست. این نظریه ی بیز است. هر فیلتر اسپام، هر تشخیص پزشکی، هر مدل یادگیری ماشین که عدم اطمینان را مقداری می کند، از این استدلال دقیق استفاده می کند. شما با یک باور شروع می کنید. شما شواهد را می بینید. شما به روز می شوید.

اگر سیستم های ML را بدون درک این کار بسازید، نتایج مدل را اشتباه تفسیر می کنید، محدودیت های بد را تعیین می کنید و پیش بینی های بیش از حد مطمئن را ارسال می کنید.

## مفهوم

### از احتمال مشترک تا بایز

شما از درس 06 می دانید که احتمال مشروط:

```math
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
```

و همتقالي:

```math
P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}
```

هر دو عبارت یک عدد مشترک دارند: $P(A \text{ and } B)$. آنها را برابر کنید و تنظیم مجدد:

```math
\begin{aligned}
P(A \text{ and } B) &= P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A) \\[4pt]
&\text{Therefore:} \\[4pt]
P(A \mid B) &= \frac{P(B \mid A) \cdot P(A)}{P(B)}
\end{aligned}
```

اين نظریه بايز است. چهار مقدار، يک معادله

### چهار قسمت

| Part | Name | What it means |
|------|------|---------------|
| $P(A \mid B)$ | Posterior | Your updated belief about $A$ after seeing evidence $B$ |
| $P(B \mid A)$ | Likelihood | How probable the evidence $B$ is if $A$ is true |
| $P(A)$ | Prior | Your belief about $A$ before seeing any evidence |
| $P(B)$ | Evidence | Total probability of seeing $B$ under all possibilities |

مدت اثبات$P(B)$شما می توانید با استفاده از قانون احتمال کامل آن را گسترش دهید:

```math
P(B) = P(B \mid A) \cdot P(A) + P(B \mid \text{not } A) \cdot P(\text{not } A)
```

### نمونه آزمایش پزشکی

یک بیماری در هر ۱۰ هزار نفر را تحت تاثیر قرار می دهد. تست ۹۹٪ دقیق است (۹۹٪ از بیماران را می گیرد، ۱٪ از زمان مثبت دروغین می دهد).

```math
\begin{aligned}
P(\text{sick}) &= 0.0001 \quad \text{(prior: disease is rare)} \\
P(\text{positive} \mid \text{sick}) &= 0.99 \quad \text{(likelihood: test catches it)} \\
P(\text{positive} \mid \text{healthy}) &= 0.01 \quad \text{(false positive rate)} \\[6pt]
P(\text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) + P(\text{positive} \mid \text{healthy}) \cdot P(\text{healthy}) \\
&= 0.99 \cdot 0.0001 + 0.01 \cdot 0.9999 \\
&= 0.000099 + 0.009999 \\
&= 0.010098 \\[6pt]
P(\text{sick} \mid \text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) / P(\text{positive}) \\
&= 0.99 \cdot 0.0001 / 0.010098 \\
&= 0.0098 \\
&= 0.98\%
\end{aligned}
```

کمتر از ۱ درصد. پیش رو غالب است. وقتی یک بیماری نادر است، حتی آزمایش های دقیق هم اغلب مثبت دروغین را تولید می کنند. به همین دلیل است که پزشکان آزمایش های تأیید را دستور می دهند.

### نمونه فیلتر اسپام

شما يه ایمیلي که شامل کلمه "لوتر" هستي دریافت مي كنيد.

```math
\begin{aligned}
P(\text{spam}) &= 0.3 \quad \text{(30\% of email is spam)} \\
P(\text{"lottery"} \mid \text{spam}) &= 0.05 \quad \text{(5\% of spam emails contain "lottery")} \\
P(\text{"lottery"} \mid \text{not spam}) &= 0.001 \quad \text{(0.1\% of legitimate emails contain "lottery")} \\[6pt]
P(\text{"lottery"}) &= 0.05 \cdot 0.3 + 0.001 \cdot 0.7 \\
&= 0.015 + 0.0007 \\
&= 0.0157 \\[6pt]
P(\text{spam} \mid \text{"lottery"}) &= 0.05 \cdot 0.3 / 0.0157 \\
&= 0.955 \\
&= 95.5\%
\end{aligned}
```

یک کلمه احتمال را از 30 درصد به 95 درصد تغییر می دهد. یک فیلتر اسپام واقعی باایز را در صدها کلمه همزمان اعمال می کند.

### بیز ساده: فرض استقلال

بیز ساده این را به ویژگی های متعدد گسترش می دهد با فرض اینکه همه ویژگی ها به صورت مشروط مستقل به دلیل کلاس هستند:

```math
P(\text{class} \mid \text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n) = \frac{P(\text{class}) \cdot P(\text{feature}_1 \mid \text{class}) \cdot P(\text{feature}_2 \mid \text{class}) \cdots P(\text{feature}_n \mid \text{class})}{P(\text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n)}
```

بخش "سخن" فرض استقلال است. در متن، رخ دادن کلمات مستقل نیستند ("نوی" و "یارک" مرتبط هستند). اما فرضیه به طرز شگفت انگیزی در عمل کار می کند زیرا طبقه بندی کننده فقط نیاز به رتبه بندی کلاس ها دارد، نه تولید احتمالات کالیبر شده.

از آنجا که نامگذاری برای همه کلاس ها یکسان است، می توانید آن را رد کنید و فقط شمارنده ها را مقایسه کنید:

```math
\text{score}(\text{class}) = P(\text{class}) \cdot \prod_i P(\text{feature}_i \mid \text{class})
```

کلاس با بالاترين نمره رو انتخاب کن

### تخمین احتمال حداکثر (MLE)

چطوري اينو ميگي؟$P(\text{feature} \mid \text{class})$از اطلاعات آموزش؟

```math
P(\text{"free"} \mid \text{spam}) = \frac{\text{number of spam emails containing "free"}}{\text{total spam emails}}
```

این MLE است: ارزش های پارامتر را انتخاب کنید که داده های مشاهده شده را بیشتر احتمال می دهند. شما عملکرد احتمال را حداکثر می کنید، که برای شمارش های متمایز به فرکانس نسبی کاهش می یابد.

مشکل: اگر یک کلمه در هنگام آموزش هرگز در اسپم ظاهر نشود، MLE احتمال صفر را به آن می دهد. یک کلمه ناشناخته کل محصول را می کشد. این را با نرم کردن Laplace حل کنید:

```math
P(\text{word} \mid \text{class}) = \frac{\text{count}(\text{word}, \text{class}) + 1}{\text{total\_words\_in\_class} + \text{vocabulary\_size}}
```

اضافه کردن 1 به هر شمارش تضمین می کند که هیچ احتمالی هرگز صفر نیست.

کلمه ای که هرگز در هیچ پیام آموزشی ظاهر نشده در لغات نیست.`predict`ازش تخطي ميکنه، چون هيچ مدرکي براي هر دو کلاس نميدونه

### حداکثر یک پس از (MAP)

MLE پرسید: چه پارامتر هایی را حداکثر می کند $P(\text{data} \mid \text{parameters})$؟

نقشه می پرسد: چه پارامتر هایی حداکثر می شوند $P(\text{parameters} \mid \text{data})$؟

با نظاره بازي:

```math
P(\text{parameters} \mid \text{data}) \propto P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})
```

MAP یک پیش فرض را بر روی پارامترهای خود اضافه می کند. اگر شما معتقدید پارامترها باید کوچک باشند، شما آن را به عنوان پیش فرض که مقادیر بزرگ را مجازات می کند، کدگذاری می کنید. این مشابه تنظیم L2 در ML است. مجازات "خرز" در بازگشت ریج به معنای واقعی کلمه یک پیش فرض گاوسی در وزنه ها است.

| Estimation | Optimizes | ML equivalent |
|------------|-----------|---------------|
| MLE | $P(\text{data} \mid \text{params})$ | Unregularized training |
| MAP | $P(\text{data} \mid \text{params}) \cdot P(\text{params})$ | L2 / L1 regularization |

### بیزیان و فرکانست: تفاوت عملی

فرکانت شناسان پارامترها را به عنوان نامعلوم ثابت می دانند. آنها می پرسند: "اگر این آزمایش را بارها تکرار کنم، چه اتفاقی می افتد؟"

بهایسی ها به پارامترها به عنوان توزیع نگاه می کنند. آنها می پرسند: "با توجه به آنچه من مشاهده کرده ام، من در مورد پارامترها چه باور دارم؟"

برای ساخت سیستم های ML، تفاوت عملی:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Output | Point estimate | Distribution over values |
| Uncertainty | Confidence intervals (about procedure) | Credible intervals (about parameter) |
| Small data | Can overfit | Prior acts as regularization |
| Computation | Usually faster | Often requires sampling (MCMC) |

اکثر تولید ML فرکانس است (SGD، تخمین های نقطه). روش های بیزیایی در زمانی که نیاز به عدم اطمینان معیاری (قراردارهای پزشکی، سیستم های حیاتی ایمنی) یا زمانی که داده ها کمیاب است (تعلم چند شوت، شروع سرد) ، روشن می شوند.

### چرا تفکر بیزی برای ML مهم است

ارتباط عمیق تر از تشبيه است:

**Priors are regularization.**یک پیش از گاوسی در وزن L2 تنظیم است. یک پیش از Laplace L1 است. هر بار که یک اصطلاح تنظیم را اضافه می کنید، شما یک بیانیه بیزیایی در مورد آنچه که انتظار دارید از مقادیر پارامتر دارید، می کنید.

**Posteriors are uncertainty.**یک احتمال پیش بینی شده به شما چیزی در مورد اینکه مدل در این تخمین چقدر مطمئن است نمی گوید. روش های بیزیان به شما توزیع می دهند: "من فکر می کنم$P(\text{spam})$بین 0.8 تا 0.95 است".

**Bayes updates are online learning.**پس از امروز به قبل فردا می شود. وقتی مدل شما داده های جدید را می بیند، به جای آموزش مجدد از ابتدا، باورهای خود را به طور تدریجی به روز می کند.

**Model comparison is Bayesian.**معیارهای اطلاعات بیزیانی (BIC) ، احتمال حاشیه ای و عوامل بیزیانی همه از استدلال بیزیانی برای انتخاب بین مدل ها بدون بیش از حد مناسب استفاده می کنند.

```figure
bayes-update
```

## آن را بسازید

### مرحله ی ۱: تابع نظریه ی بایز

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### مرحله دوم: طبقه بندی کننده بیز ساده

```python
import math
from collections import defaultdict

class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(lambda: defaultdict(int))
        self.class_word_totals = defaultdict(int)
        self.vocab = set()

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def predict(self, document):
        words = [word for word in document.lower().split() if word in self.vocab]
        total_docs = sum(self.class_counts.values())
        vocab_size = len(self.vocab)
        best_class = None
        best_score = float("-inf")
        for cls in self.class_counts:
            score = math.log(self.class_counts[cls] / total_docs)
            for word in words:
                count = self.word_counts[cls].get(word, 0)
                total = self.class_word_totals[cls]
                score += math.log((count + self.smoothing) / (total + self.smoothing * vocab_size))
            if score > best_score:
                best_score = score
                best_class = cls
        return best_class
```

احتمالات ثبت جلوگیری از جریان پایین. ضرب بسیاری از احتمالات کوچک باعث تولید اعداد بسیار کوچک برای نقطه شناور می شود. جمع کردن احتمالات ثبت ثابت و ریاضی معادل است.

### مرحله 3: آموزش در داده های اسپم

```python
train_docs = [
    "win free money now",
    "free lottery ticket winner",
    "claim your prize today free",
    "urgent offer free cash",
    "congratulations you won free",
    "meeting tomorrow at noon",
    "project update attached",
    "can we schedule a call",
    "quarterly report review",
    "lunch on thursday sounds good",
    "team standup notes attached",
    "please review the pull request",
]

train_labels = [
    "spam", "spam", "spam", "spam", "spam",
    "ham", "ham", "ham", "ham", "ham", "ham", "ham",
]

classifier = NaiveBayes()
classifier.train(train_docs, train_labels)

test_messages = [
    "free money waiting for you",
    "meeting rescheduled to friday",
    "you won a free prize",
    "please review the attached report",
]

for msg in test_messages:
    print(f"  '{msg}' -> {classifier.predict(msg)}")
```

### مرحله چهارم: احتمالات آموخته شده را بررسی کنید

```python
def show_top_words(classifier, cls, n=5):
    vocab_size = len(classifier.vocab)
    total = classifier.class_word_totals[cls]
    probs = {}
    for word in classifier.vocab:
        count = classifier.word_counts[cls].get(word, 0)
        probs[word] = (count + classifier.smoothing) / (total + classifier.smoothing * vocab_size)
    sorted_words = sorted(probs.items(), key=lambda x: x[1], reverse=True)
    for word, prob in sorted_words[:n]:
        print(f"    {word}: {prob:.4f}")

print("\nTop spam words:")
show_top_words(classifier, "spam")
print("\nTop ham words:")
show_top_words(classifier, "ham")
```

## ازش استفاده کن

کشتی های سکیت-علم آماده تولید پیاده سازی ساده بایز:

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_docs)
clf = MultinomialNB()
clf.fit(X_train, train_labels)

X_test = vectorizer.transform(test_messages)
predictions = clf.predict(X_test)
for msg, pred in zip(test_messages, predictions):
    print(f"  '{msg}' -> {pred}")
```

همان الگوریتم. CountVectorizer به کار می رود توکن سازی و ساخت لغات. MultinomialNB به کار می رود صاف کردن و احتمال ثبت نام در داخل. نسخه شما از ابتدا همان کار را در 40 خط انجام می دهد.

## -باده

کلاس NaiveBayes که در اینجا ساخته شده است، کل خط تولید را نشان می دهد: توکن سازی، تخمین احتمال با صاف کردن Laplace، پیش بینی فضای ثبت.`code/bayes.py`از انتها به انتها بدون وابستگی فراتر از کتابخانه استاندارد پایتون اجرا می شود. پورت تایپ اسکریپت در `code/bayes.ts`فقط با استفاده از کتابخانه استاندارد Node

### پیشاپیش های متقابل

وقتی پیش و عقب به یک خانواده توزیع تعلق دارند، پیش رو به نام "مجموعه" نامیده می شود. این باعث می شود که به روز رسانی بیزیایی به صورت الجبری پاک باشد - شما یک شکل بسته بدون ادغام عددی دریافت می کنید.

| Likelihood | Conjugate Prior | Posterior | Example |
|-----------|----------------|-----------|---------|
| Bernoulli | $\text{Beta}(a, b)$ | $\text{Beta}(a + \text{successes}, b + \text{failures})$ | Coin flip bias estimation |
| Normal (known variance) | $\text{Normal}(\mu_0, \sigma_0)$ | Normal(weighted mean, smaller variance) | Sensor calibration |
| Poisson | $\text{Gamma}(a, b)$ | $\text{Gamma}(a + \text{sum of counts}, b + n)$ | Modeling arrival rates |
| Multinomial | $\text{Dirichlet}(\alpha)$ | $\text{Dirichlet}(\alpha + \text{counts})$ | Topic modeling, language models |

چرا این مهم است: بدون پیشینه های همبستگی، شما نیاز به نمونه گیری مونت کارلو یا نتیجه گیری متغیر برای نزدیک شدن به پسینه دارید. با پیشینه های همبستگی، شما فقط دو عدد را به روز می کنید.

توزیع بتا رایج ترین مخلوط قبلی در عمل است. $\text{Beta}(a, b)$این نشان دهنده اعتقاد شما در مورد یک پارامتر احتمال است.$a/(a+b)$بزرگترين$a+b$، توزیع بیشتر متمرکز (امیدوار) است.

موارد ویژه ای از قبل:
- $\text{Beta}(1, 1)$شما درباره پارامتر نظر نداري
- $\text{Beta}(10, 10)$شما به شدت معتقدید که پارامتر نزدیک به 0.5 است.
- $\text{Beta}(1, 10)$= به سمت 0 منحرف شده. شما فکر می کنید پارامتر کوچک است.

قانون تازه اي خيلي ساده است:

```math
\begin{aligned}
\text{Prior:} \quad & \text{Beta}(a, b) \\
\text{Data:} \quad & s \text{ successes}, f \text{ failures} \\
\text{Posterior:} \quad & \text{Beta}(a + s, b + f)
\end{aligned}
```

نه تکامل، نه نمونه برداری، فقط اضافه کردن

### به روز رسانی بعید

نتیجه گیری بیزیایی به طور طبیعی دنباله دار است. پس از امروز به قبل فردا می شود. این نحوه یادگیری سیستم های واقعی بدون پردازش مجدد تمام داده های تاریخی است.

مثال مشخصی: تخمین اینکه آیا یک سکه عادلانه است.

**Day 1: No data yet.**
از شروع به$\text{Beta}(1, 1)$-از يه پيشواي يونيفورم
- متوسط قبلی: 0.5
- پیشینه در عرض [0, 1]

**Day 2: Observe 7 heads, 3 tails.**
$\text{Posterior} = \text{Beta}(1 + 7, 1 + 3) = \text{Beta}(8, 4)$
- متوسط بعد: $8/12 = 0.667$
- شواهد نشان می دهد که سکه به سمت سر ها منحرف شده است

**Day 3: Observe 5 more heads, 5 more tails.**
از پسر ديروز به عنوان پيشر امروز استفاده کن
$\text{Posterior} = \text{Beta}(8 + 5, 4 + 5) = \text{Beta}(13, 9)$
- متوسط بعد: $13/22 = 0.591$
- داده های جدید متعادل تخمین را به سمت 0.5

```mermaid
graph LR
    A["Prior<br/>Beta(1,1)<br/>mean = 0.50"] -->|"7H, 3T"| B["Posterior 1<br/>Beta(8,4)<br/>mean = 0.67"]
    B -->|"becomes prior"| C["Prior 2<br/>Beta(8,4)"]
    C -->|"5H, 5T"| D["Posterior 2<br/>Beta(13,9)<br/>mean = 0.59"]
```

ترتیب مشاهدات مهم نیست.$\text{Beta}(1,1)$با تمام 12 سر و 8 دم به یکباره به روز رسانی شده$\text{Beta}(13, 9)$-- همان نتیجه. به روز رسانی تسلسل و به روز رسانی دسته به طور ریاضی معادل است. اما به روز رسانی تسلسل به شما اجازه می دهد در هر مرحله تصمیم گیری بدون ذخیره سازی داده های خام.

این پایه ی یادگیری آنلاین در سیستم های تولید ML است. نمونه گیری تامپسون برای غلو، سیستم های توصیه افزایشی و آشکارسازان نارسایی جریان همه از این الگوی استفاده می کنند.

### ارتباط با تست A/B

تست A/B نتیجه گیری بیزیایی در حال پنهان شدن است.

تنظیم: شما دو رنگ دکمه را آزمایش می کنید. ویرانت A (زرق) و ویرانت B (سبز). می خواهید بدانید کدام یک بیشتر کلیک می کند.

آزمایش بیزیانی A/B:

1. **Prior.**از شروع به$\text{Beta}(1, 1)$برای هر دو نوع، هیچ تفضل قبلی وجود ندارد.
2. **Data.**گزینه A: 50 کلیک از 1000 بازدید، گزینه B: 65 کلیک از 1000 بازدید
3. **Posteriors.**
   - A: $\text{Beta}(1 + 50, 1 + 950) = \text{Beta}(51, 951)$. متوسط = 0.051
   - ب: $\text{Beta}(1 + 65, 1 + 935) = \text{Beta}(66, 936)$. متوسط = 0.066
4. **Decision.**حساب کردن$P(B > A)$-- احتمال اینکه نرخ تبدیل واقعی B بالاتر از A باشد.

محاسبات$P(B > A)$اما مونت کارلو باعث می شه که ساده باشه

```
1. Draw 100,000 samples from Beta(51, 951)  -> samples_A
2. Draw 100,000 samples from Beta(66, 936)  -> samples_B
3. P(B > A) = fraction of samples where B > A
```

اگه$P(B > A) > 0.95$، شما نوع B را ارسال می کنید. اگر بین 0.05 تا 0.95 باشد، شما اطلاعات را جمع آوری می کنید. اگر$P(B > A) < 0.05$، شما نوع " آ " رو کشتي ميکنيد

مزایای تست A/B فرکانس:
- شما یک بیانیه احتمال مستقیم دریافت می کنید: "فرصت ۹۷٪ وجود دارد که B بهتر باشد"
- هيچ اشتباه در ارزش p، هيچ "مهميت رد فرضيه صفر"
- شما می توانید هر زمان نتایج را بدون افزایش نرخ مثبت دروغین بررسی کنید (هیچ "مشکل در جستجوی")
- شما می توانید دانش قبلی را شامل کنید (به عنوان مثال، آزمایش های قبلی نشان می دهد نرخ تبدیل معمولا 3-8٪ است)

| Aspect | Frequentist A/B | Bayesian A/B |
|--------|----------------|--------------|
| Output | p-value | $P(B > A)$ |
| Interpretation | "How surprising is this data if A=B?" | "How likely is B better than A?" |
| Early stopping | Inflates false positives | Safe at any point (given a well-chosen prior and correctly specified model) |
| Prior knowledge | Not used | Encoded as Beta prior |
| Decision rule | $p < 0.05$ | $P(B > A) > \text{threshold}$ |

## تمرینات

1. **Multiple tests.**یک بیمار دو بار در آزمایش های مستقل مثبت (هر دو 99٪ دقیق، شیوع بیماری 1 در 10،000) است.$P(\text{sick})$بعد از هر دو تست از پسین تست اول به عنوان پیشین تست دوم استفاده کنید

2. **Smoothing impact.**دسته بندی اسپام را با ارزش های صاف کردن 0.01، 0.1، 1.0 و 10.0 اجرا کنید. احتمالات کلمات بالا چگونه تغییر می کند؟ با صاف کردن=0 و کلمه ای که فقط در ژامون ظاهر می شود چه اتفاقی می افتد؟

3. **Add features.**کلاس NaiveBayes را گسترش دهید تا از طول پیام (قصر/طول) به عنوان یک ویژگی در کنار شمارش کلمات استفاده شود. تخمین $P(\text{short} \mid \text{spam})$و$P(\text{short} \mid \text{ham})$از داده های آموزش و آن را به نمره پیش بینی بکشید.

4. **MAP by hand.**با توجه به داده های مشاهده شده (۷ سر در ۱۰ فلپ سکه) تخمین MAP از تعصب را با استفاده از یک$\text{Beta}(2,2)$قبل از این، آن را با تخمین MLE مقایسه کنید ($7/10$)

### اشاره ها

**Exercise 1.**تماس بگیرید`bayes`بعد از تست 1، یک بار پس از تست 1، پس از آن دوباره با پس از آن به عنوان پیش رو تماس بگیرید.`sequential_bayes(prior, likelihood, false_positive_rate, 2)`باید مقدار مشابهی داشته باشد، نزدیک به 0.5

**Exercise 2.**یکی بساز`NaiveBayes(smoothing=s)`برای هر مقدار، آن را بر اساس همان داده ها آموزش دهید و چاپ کنید`top_words`با صاف کردن 0، کلمه ای که هرگز در اسپام ظاهر نمی شود احتمال 0 را می گیرد، بنابراین تاریخش تعریف نشده است.

**Exercise 3.**شمارش کنید که چه تعداد پیام های اسپم و خمیر کوتاه هستند، با تعداد پیام ها در هر کلاس تقسیم کنید و به نمره در `predict`. چک کنید که دو احتمال برای هر کلاس به 1 اضافه می شود

**Exercise 4.**با یک$\text{Beta}(\alpha, \beta)$قبل از این، تخمین MAP $\frac{h + \alpha - 1}{n + \alpha + \beta - 2}$. بذارش$h = 7$،$n = 10$; نتیجه باید بین MLE (0.7) و حالت قبلی (0.5) باشد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Prior | "My initial guess" | $P(\text{hypothesis})$ before observing evidence. In ML: the regularization term. |
| Likelihood | "How well the data fits" | $P(\text{evidence} \mid \text{hypothesis})$. How probable the observed data is under a specific hypothesis. |
| Posterior | "My updated belief" | $P(\text{hypothesis} \mid \text{evidence})$. The prior multiplied by the likelihood, then normalized. |
| Evidence | "The normalizing constant" | $P(\text{data})$ across all hypotheses. Ensures the posterior sums to 1. |
| Naive Bayes | "That simple text classifier" | A classifier that assumes features are independent given the class. Works well despite the false assumption. |
| Laplace smoothing | "Add-one smoothing" | Adding a small count to every feature to prevent zero probabilities from unseen data. |
| MLE | "Just use the frequencies" | Choose parameters that maximize $P(\text{data} \mid \text{parameters})$. No prior. Can overfit with small data. |
| MAP | "MLE with a prior" | Choose parameters that maximize $P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})$. Equivalent to regularized MLE. |
| Log-probability | "Work in log space" | Using $\log(P)$ instead of $P$ to avoid floating-point underflow when multiplying many small numbers. |
| False positive | "A wrong alarm" | The test says positive, but the true state is negative. Drives the base rate fallacy. |

## خواندن بیشتر

- [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM)- توضیح بصری با نمونه آزمایش پزشکی
- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf)- بیز ساده و ارتباط آن با مدل های تبعیض آمیز
- [Think Bayes](https://greenteapress.com/wp/think-bayes/)- کتاب رایگان، آمار بیزی با کد پایتون
- [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)- اجرای تولید و زمان استفاده از هر نوع
