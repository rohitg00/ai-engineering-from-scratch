# کوله کلمات، TF-IDF و نمایش متن

> اول حساب کن بعد فکر کن TF-IDF هنوز در سال 2026 از برنامه های کاربردی در وظایف مشخصه بر میگیره

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## مشکل

مدل به شماره ها نیاز داره تو رشته ای داری

هر خط لوله NLP باید به همان سوال پاسخ دهد. چگونه یک جریان متغیر طول از توکن ها را به یک ویکتور اندازه ثابت تبدیل کنیم که یک طبقه بندی کننده می تواند مصرف کند. اولین پاسخ که میدان روی آن فرود آمد احمق ترین پاسخ بود که کار می کند. کلمات را بشمارید. ویکتور بسازید.

این بردار بیش از هر مدل ادغام تولید NLP را حمل کرده است. فیلترهای اسپام، طبقه بندی کننده های موضوع، تشخیص ناهنجاری در روزنامه، رتبه بندی جستجو (پیش از BM25) ، اولین موج تجزیه و تحلیل احساسات، اولین دهه معیارهای NLP دانشگاهی. در سال 2026 تمرین کنندگان هنوز در وظایف طبقه بندی باریک به آن دست می یابند. این سریع، قابل تفسیر و اغلب از یک مدل 400M-پارامتر در کار هایی که حضور کلمه مهم است، قابل تشخیص است.

این درس از ابتدا کلمه ها را می سازد، سپس TF-IDF را از نو می سازد، سپس نشان می دهد که scikit-learn در سه خط همان کار را انجام می دهد، سپس حالت شکست را نام می دهد که باعث می شود شما به دنبال گنجاندن ها باشید.

## مفهوم

**Bag of Words (BoW)**برای هر سند، شمارش کنید که چند بار هر کلمه در ذخایر لغات ظاهر می شود. طول بردار اندازه ذخایر لغات است. موقعیت `i`تعداد کلمه ها`i`. .

**TF-IDF**یک کلمه که در هر سند ظاهر می شود غیر اطلاعاتی است، پس آن را کاهش دهید. یک کلمه نادر در سراسر corpus اما مکرر در یک سند است سیگنال، پس آن را افزایش دهید.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

کجا`TF`در این سند فرکانس اصطلاح است.`df`فرکانس سند (چه تعداد اسناد حاوی کلمه است) است.`N`این اسناد کل هستند.`log`وزن رو به کلمات همه جا محدود مي کنه

ویژگی اصلی: هر دو متری نادر با محور های قابل تفسیر تولید می کنند. شما می توانید به وزن یک طبقه بندی کننده آموزش دیده نگاه کنید و بخوانید که کدام کلمات یک سند را به سمت هر کلاس فشار می دهند. شما نمی توانید این کار را با یک ورودی BERT 768 بعدی انجام دهید.

```figure
bow-tfidf
```

## آن را بسازید

### مرحله ی اول: ساختن لغت

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

ورودی: لیست اسناد توکن شده (هر توکنر سطح کلمه ای انجام خواهد داد؛ `code/main.py`در این درس از یک نوع کوچک ساده استفاده می شود.`{word: index}`دستور قرار دادن ثابت به معنی کلمه شاخص 0 اولین کلمه در اولین سند دیده می شود. کنوانسیون متفاوت است؛ scikit-learn انواع الفبا.

### مرحله دوم: کوله کلمات

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

صف ها اسناد هستند، ستون ها شاخص های لغات هستند.`[i][j]`"چه چند بار کلمه`j`در سند ظاهر شده`i`. "دکتر 1 داره`cat`دو بار چون اينکارو کرد دکتر0 هم`ran`صفر بار چون اينکارو نکرد

### مرحله سوم: فرکانس اصطلاح و فرکانس سند

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

دو ترفند ساده کننده که ارزش نام دادن رو داره`(n+1)/(d+1)`ازش اجتناب می کنه`log(x/0)`. پشت سرش`+1`تضمین می کند که یک کلمه در هر سند هنوز IDF 1 (نه 0) را داشته باشد، مطابق با پیش فرض scikit-learn.`log(N/df)`هر دو کار ميکنن، نسخه نرم تر دوستانه تر است.

### مرحله 4: TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

سه سند، پنج کلمه صوتی (`the`،`cat`،`sat`،`dog`،`ran`)`the`در هر سه مورد ظاهر شده، پس ارتش اسرائيلي کم است.`dog`در این بازی، کلمات تبعیض آمیز ظاهر می شوند. حتی در این اسباب بازی، کلمات تبعیض آمیز ظاهر می شوند.

### مرحله 5: صف های L2- عادی سازی

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

بدون نرمال سازی، یک سند طولانی تر یک ویکتور بزرگتر می گیرد و نمرات شباهت را تسلط می دهد. نرمال سازی L2 هر سند را در هیپر اسپیر واحد قرار می دهد. شباهت کوسین بین ردیف ها اکنون فقط یک محصول نقطه ای است.

## ازش استفاده کن

"سکیت-لرن" نسخه تولیدي رو ارسال ميکنه

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer`توکن ها، لغات و BoW را در یک تماس انجام می دهد.`TfidfVectorizer`اضافه کردن وزن IDF و نرمال سازی L2 هر دو ماتریس های ضخیم را باز می کنند. برای 100k اسناد، نسخه ضخیم در حافظه قرار نمی گیرد؛ تا زمانی که طبقه بندی کننده نیاز به ضخیم است، ضخیم باقی بماند.

گره هایی که همه چیز رو تغییر می دهند:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### وقتی TF-IDF هنوز برنده است (از سال 2026)

- تشخیص اسپام، برچسب گذاری موضوع، علامت گذاری نامعقولات ثبت نام. حضور کلمه مهم است؛ تفاوت معنوی مهم نیست.
- رژیم های داده های کم ( صدها نمونه با برچسب) TF-IDF به علاوه بازپسین لوژیستیک هیچ هزینه ای پیش از آموزش ندارد.
- در هر جا که تاخیر مهم است TF-IDF به علاوه یک مدل خطی پاسخ در مایکرو ثانیه است. ادغام یک سند از طریق یک ترانسفورماتور 10-100ms طول می کشد.
- سیستم هایی که باید پیش بینی های خود را توضیح دهند، معادلات طبقه بندی کننده را بررسی کنند، کلمات مثبت بالا دلیل هستند.

### وقتی TF-IDF شکست خورده است

شکست کور بودن معنوی. به این دو سند فکر کنید:

- "فلم اصلاً خوب نبود"
- "فلم فوق العاده بود".

یکی از آنها بررسی منفی است یکی مثبت و TF-IDF آنها همپوشیده دقیقا`{the, movie, was}`. يه دسته بندي با كلمات بايد يادش بگيره كه کلمه`not`نزدیک`good`می تواند از داده های کافی یاد بگیرد، اما هرگز به اندازه یک مدل که نحوی را درک می کند، زیبا نیست.

شکست دیگر: کلمات خارج از ذخایر لغات در نتیجه گیری. یک مدل BoW که در بررسی های IMDb آموزش دیده است، نمی داند چه کاری با آن انجام دهد.`Zoomer-approved`اگر این توکن هرگز در آموزش ظاهر نشد. گنجانده شدن زیرکلمه (درسی 04) این کار را انجام می دهد. TF-IDF نمی تواند.

### افزونه های ترکیبی: گنجانده شده با وزن TF-IDF

پیش فرض عملی برای طبقه بندی داده های متوسط 2026: استفاده از وزن TF-IDF به عنوان توجه نسبت به گنجانده شدن کلمات.

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

شما از گنجانشی های شامل شده ظرفیت معنایی و تاکید بر کلمات نادر از TF-IDF دریافت می کنید. طبقه بندیگر بر روی ویکتور جمع شده ترن می کند. این به تنهایی برای طبقه بندی احساسات، موضوع و قصد در زیر حدود 50 هزار مثال برچسب گذاری شده بهتر است.

## -باده

پس از`outputs/prompt-vectorization-picker.md`:

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## تمرینات

1. **Easy.**اجرا`cosine_similarity(doc_vec_a, doc_vec_b)`در L2 استاندارد شده TF-IDF output. بررسی کنید که اسناد یکسان نمره 1.0 و اسناد لغت های قطع نمره 0.0 است.
2. **Medium.**اضافه کردن`n-gram`حمایت از`bag_of_words`. پارامتر`n`تولید می کند شمارش بیش از `n`-گرام ها، امتحان کن`n=2`در`["the", "cat", "sat"]`تولید می کند تعداد بزرگ برای `["the cat", "cat sat"]`. .
3. **Hard.**با استفاده از متری GloVe 100d (یک بار دانلود، کش) ، ترکیبی با TF-IDF و شامل شده های متوسط ساده در مجموعه داده های 20 Newsgroups را بسازید. گزارش کنید که کدام یک برنده می شود.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## خواندن بیشتر

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) مرجع API کانونیک، به علاوه یادداشت ها در هر دکمه
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) کاغذی که TF-IDF را یک دهه پیش از پرداخت قرار داد.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) در سال 2026 به عنوان یک روش قدیمی برنده می شویم و چرا.
