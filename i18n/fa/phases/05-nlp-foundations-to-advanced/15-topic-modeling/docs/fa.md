# مدل سازی موضوع  LDA و BERTopic

> LDA: اسناد ترکیبی از موضوعات هستند، موضوعات توزیع در کلمات هستند. BERTopic: اسناد در فضای گنجانده شده، کلستر ها موضوعات هستند. هدف مشابه، تجزیه های مختلف.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## مشکل

شما ۱۰ هزار بلیط پشتیبانی مشتری، ۵۰ هزار مقاله خبری یا ۲۰۰ هزار توییتر دارید. شما باید بدون خواندن آن بدانید که مجموعه در مورد چه چیزی است. شما دسته بندی ندارید. شما حتی نمی دانید که چند دسته وجود دارد.

مدل سازی موضوع بدون نظارت پاسخ می دهد. یک کورپوس به آن بدهید، مجموعه ای کوچک از موضوعات منسجم را به دست آورید و برای هر سند، توزیع بر روی این موضوعات.

دو خانواده الگوریتم غالب هستند. LDA (2003) هر سند را به عنوان ترکیبی از موضوعات پنهان و هر موضوع را به عنوان توزیع بر روی کلمات می شناسد. تعبیر بائیس است. هنوز هم در تولید در جایی که شما نیاز به اختصاص موضوعات عضویت مخلوط و توزیع احتمالات سطح کلمه توضیح می دهید.

BERTopic (2020) اسناد را با BERT رمزگذاری می کند، ابعاد را با UMAP کاهش می دهد، با HDBSCAN را جمع می کند و کلمات موضوعی را از طریق TF-IDF مبتنی بر کلاس استخراج می کند. در متن کوتاه، رسانه های اجتماعی و هر چیزی که شباهت معنوی بیش از کتمان کلمات اهمیت دارد، برنده می شود. یک سند یک موضوع را دریافت می کند، که محدودیت برای محتوای طولانی است.

این درس برای هر دو تا حس و نام ایجاد می کند که کدام یک را برای یک جسم خاص انتخاب کنیم.

## مفهوم

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**هر موضوع توزیع در کلمات است. هر سند ترکیبی از موضوعات است. برای تولید یک کلمه در یک سند، نمونه یک موضوع از ترکیب سند، سپس نمونه یک کلمه از توزیع موضوع است. برداشت این را معکوس می کند: با توجه به کلمات مشاهده شده، توزیع موضوع در هر سند و توزیع کلمه در هر موضوع را نتیجه می دهد. نمونه گیری گیبز یا بیز متغیر را انجام می دهد.

خروجی کلیدی LDA:

- `doc_topic`: ماتریکس`(n_docs, n_topics)`, هر ردیف به 1 (مکس موضوعی در سند) مربوط می شود.
- `topic_word`: ماتریکس`(n_topics, vocab_size)`, هر ردیف به 1 (توزيع کلمه موضوع) مربوط می شود.

**BERTopic pipeline.**

1. هر سند را با یک ترانسفورماتور جملات رمزگذاری کنید (به عنوان مثال ، `all-MiniLM-L6-v2`) 384 متری طول
2. با UMAP ابعاد را به ~5 ابعاد کاهش دهید. گنجانده های BERT برای دسته بندی بیش از حد کم هستند.
3. کلستر با HDBSCAN. مبتنی بر چگالی، کلسترهای اندازه متغیر و برچسب "غیر معمولی" را تولید می کند.
4. برای هر کلستر، TF-IDF مبتنی بر کلاس را بر روی اسناد کلستر محاسبه کنید تا کلمات اصلی را استخراج کنید.

محصول یک موضوع در هر سند است (به علاوه یک برچسب خارج از -1). به طور اختیاری، عضویت نرم از طریق متری احتمال HDBSCAN.

```figure
topic-drift
```

## آن را بسازید

### مرحله ی اول: LDA از طریق scikit-learn

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

توجه: کلمات توقف حذف شده، min_df و max_df اصطلاحات نادر و همه جا وجود دارد را فیلتر می کنند، CountVectorizer (نه TfidfVectorizer) زیرا LDA انتظار شمارش خام را دارد.

### مرحله دوم: BERTopic (پیدایش)

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

فیلتر روشن شده`Topic != -1`برترین های BERTopic را حذف می کند (دستنامه های HDBSCAN نمی توانند جمع شوند). `min_topic_size`کنترل حداقل اندازه کلستر HDBSCAN؛ پیش فرض کتابخانه BERTopic 10 است. این مثال آن را به طور صریح برای مقیاس درس به 15 تنظیم می کند. برای اسناد بیش از 10,000، افزایش به 50 یا 100.

### مرحله سوم: ارزیابی

هر دو روش کلمات موضوعی را تولید می کنند. سوال این است که آیا این کلمات همبستگی دارند.

- **Topic coherence (c_v).**NPMI (تعمیر شده اطلاعات متقابل نقطه) از زوج های کلمات برتر را در زمینه های پنجره های شیفتی ترکیب می کند، نمره ها را به متریزه های موضوع جمع می کند و از طریق شباهت کوسین این متری را مقایسه می کند. بالاتر بهتر است. استفاده کنید `gensim.models.CoherenceModel`با`coherence="c_v"`. .
- **Topic diversity.**بخش کوچکی از کلمات منحصر به فرد در میان کلمات اصلی همه موضوعات. بالاتر بهتر است (موضوع ها همپوش نمی شوند).
- **Qualitative inspection.**کلمات اصلی هر موضوع را بخوانید آیا آنها یک چیز واقعی را نام می دهند؟ قضاوت انسانی هنوز آخرین خط دفاع است.

## چه وقت انتخاب کن

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

بزرگترین ملاحظه عملی طول سند است. ادغام BERT کوتاه می شود؛ LDA به اندازه کار در هر طولی حساب می شود. برای اسناد طولانی تر از زمینه مدل ادغام، یا از قطعه + جمع یا LDA استفاده کنید.

## ازش استفاده کن

دسته 2026:

- **BERTopic.**پیش فرض برای متن کوتاه و هر چیزی که معنوی اهمیت دارد.
- **`gensim.models.LdaModel`.**LDA کلاسیک برای تولید، بالغ، جنگ آزموده.
- **`sklearn.decomposition.LatentDirichletAllocation`.**LDA آسان براي تجارب
- **NMF.**فاکتورهای ماتریکس غیر منفی، جایگزین سریع به LDA، کیفیت قابل مقایسه در متن کوتاه.
- **Top2Vec.**طراحی مشابه BERTopic. جامعه کوچکتر اما در برخی معیارها خوب است.
- **FASTopic.**تازه تر و سریعتر از برتوپيك در بدن هاي بزرگ
- **LLM-based labeling.**هر دسته بندی را اجرا کنید، سپس از یک مدل بخواهید که هر دسته را نام دهد.

## -باده

پس از`outputs/skill-topic-picker.md`:

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## تمرینات

1. **Easy.**LDA را با 5 موضوع در مجموعه داده های 20 گروه خبری مناسب کنید. 10 کلمه برتر را در هر موضوع چاپ کنید. هر موضوع را به دست برچسب بزنید. آیا الگوریتم دسته های واقعی را پیدا کرد؟
2. **Medium.**BERTopic را در همان 20 گروه خبری قرار دهید. تعداد موضوعات یافت شده، کلمات برتر و منسجمیت کوالیتی را با LDA مقایسه کنید. کدام دسته بندی واقعی را به طور تمیز تر ظاهر می کند؟
3. **Hard.**یکپارچگی c_v را برای هر دو LDA و BERTopic در کورپوس خود محاسبه کنید. هر یک را با 5, 10, 20, 50 موضوع اجرا کنید. یکپارچگی پلاوت در مقابل تعداد موضوع. گزارش دهید که کدام روش پایدارتر در میان تعداد موضوع است.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## خواندن بیشتر

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) روزنامه LDA
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) روزنامه BERTopic
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf)اون روزنامه که به "سوی" و دوستانش معرفی کرد
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) مرجع تولید. نمونه های عالی.
