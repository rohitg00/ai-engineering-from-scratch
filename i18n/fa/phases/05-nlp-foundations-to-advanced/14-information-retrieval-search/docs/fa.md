# بازیافت اطلاعات و جستجو

> BM25 دقیق اما شکننده است. کثافت شبکه گسترده ای می اندازد اما کلمات کلیدی را از دست می دهد. هیبرید پیش فرض 2026 است. همه چیز دیگر تنظیم می شود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## مشکل

کاربر می نویسد "چه اتفاقی می افتد اگر کسی برای کسب پول دروغ بگوید" و انتظار دارد که قانون اساسی را پیدا کند که در واقع این را پوشش می دهد: "قسم 420 IPC". یک جستجوی کلمات کلیدی کاملاً از آن غافل می شود (هیچ لغت مشترک نیست). یک جستجوی معنوی از آن غافل می شود اگر گنجانده شده در متن قانونی آموزش داده نشده باشد. جستجوی واقعی باید هر دو را اداره کند.

IR خط لوله در زیر هر سیستم RAG، هر بار جستجو، هر سایت مستند، جستجو مبهم است. معماری 2026 که در تولید کار می کند یک روش نیست. این یک زنجیره از روش های مکمل است، هر یک از آنها شکست های قبلی را می گیرد.

اين درس هر قطعه و اسم رو ميسازه که هر گرفتن شکست ميده

## مفهوم

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

چهار لایه، اونايي که نياز داري انتخاب کن

1. **Sparse retrieval (BM25).**سریع، دقیق در مطابقت دقیق، وحشتناک در معنویت، یک شاخص معکوس را اجرا کنید، زیر 10ms در هر جستجو در میلیون ها سند، شما را به ارجاع قانون، کد محصول، پیام های خطا، نام نهاد درست می دهد.
2. **Dense retrieval.**کد سوال و اسناد به ویکتورها. جستجوی نزدیکترین همسایه. پارافرز ها و شباهت معنوی را ضبط می کند. مطابقت دقیق کلمات کلیدی که با یک کاراکتر متفاوت هستند را از دست می دهد. 50-200ms برای هر سوال با FAISS یا DB ویکتور.
3. **Fusion.**ترکیب لیست های رتبه بندی شده از کمیاب و کثیف. فیوژن رتبه بندی متقابل (RRF) پیش فرض آسان است زیرا نمرات خام (که در مقیاس های مختلف زندگی می کنند) را نادیده می گیرد و فقط از موقعیت های رتبه استفاده می کند. فیوژن وزن شده یک گزینه است هنگامی که می دانید یک سیگنال برای دامنه شما تسلط دارد.
4. **Cross-encoder rerank.**30 درجه اول را از فیژن بگیرید. یک کراس کودر اجرا کنید (سوال + سند را با هم جمع کنید، هر جفت را امتیاز دهید). 5 درجه اول را نگه دارید. کراس کودر ها در هر جفت آهسته تر از دو کدرها هستند اما بسیار دقیق تر هستند. شما با اجرا کردن آنها در 30 درجه اول صرفاً از کراس کودر ها را از بین می برید.

بازیافت سه طرفی (BM25 + کثافت + فضای یادگیری مانند SPLADE) در شاخص های مرجع 2026 از دو طرفی بهتر است اما به زیرساخت برای شاخص های فضای یادگیری نیاز دارد. برای اکثر تیم ها، رتبه بندی مجدد دو طرفی و کدگذاری کراس نقطه خوش است.

```figure
gx-hybrid-retrieval
```

## آن را بسازید

### مرحله ی اول: BM25 از ابتدا

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

دو پارامتر که ارزش دانستنشون رو داره`k1=1.5`کنترل شتاب فرکانس اصطلاح؛ بالاتر به معنای وزن بیشتر در تکرار اصطلاح است. `b=0.75`0 طول سند را نادیده می گیرد، 1 به طور کامل عادی می شود. پیش فرض توصیه های رابرتسون از کاغذ اصلی هستند و به ندرت نیاز به تنظیم دارند.

### مرحله دوم: بازیافت کثافت با دو کدگذاری

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

L2 تعادل کند تا نقطه محصول برابر به cosine باشد.`all-MiniLM-L6-v2`برای بیشتر بازیافت انگلیسی، برای کار چندزبانی، استفاده کنید`paraphrase-multilingual-MiniLM-L12-v2`. براي دقت بالا`bge-large-en-v1.5`یا`e5-large-v2`. .

### مرحله سوم: ادغام درجه متقابل

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

.`k=60`ثابت از کاغذ اصلی RRF است.`k`سهم تفاوت رتبه ها را کاهش می دهد.`k`60 به طور پیش فرض منتشر شده و به ندرت نیاز به تنظیم دارد.

### مرحله 4: جستجوی هیبریدی + رتبه بندی مجدد

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

در این مرحله، دو مرحله تشکیل شده است. BM25 مطابقت های لغوی را پیدا می کند. کثافت مطابقت های معنوی را پیدا می کند. RRF هر دو رتبه را بدون نیاز به کالیبراسیون نمره ای ترکیب می کند. کراس کدگر با استفاده از زوج های اسناد جستجو با هم 30 درجه برتر را دوباره به دست می آورد، که ارتباط ذخیر را به دست می آورد. دو کدگر را از دست داده است.

### مرحله 5: ارزیابی

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

به طور خاص براي RAG**Recall@k**در مورد این سوال، شما می توانید پاسخ دهید که اگر متن صحیح در مجموعه بازیافت نشده باشد.

نکته ی حذف خطا: برای سوالات شکست خورده، رتبه بندی های کمیاب و کثیف را متمایز کنید. اگر یکی سند صحیح را پیدا کند و دیگری نباشد، شما یک نامناسب لغت (صلاح: نیمی از گمشده را اضافه کنید) یا یک عدم وضوح معنوی (صلاح: گنجانده های بهتر یا یک رتبه بندی مجدد) دارید.

## ازش استفاده کن

دسته 2026:

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

هرچه انتخاب کنید، بودجه برای ارزیابی. بازیافت معیار قبل از مقایسه دقت RAG پایان به پایان. یک خواننده نمی تواند آنچه را که بازیافت کننده از دست داده است را اصلاح کند.

### درس های سخت گرفته شده از تولید 2026 RAG

- **80% of RAG failures trace to ingestion and chunking, not the model.**تیم ها هفته ها برای تبادل LLM و تنظیم پیام ها صرف وقت می کنند در حالی که بازیافت به آرامی هر سوم سوال، زمینه اشتباه را به ارمغان می آورد.
- **Chunking strategy matters more than chunk size.**تقسیم بندی اندازه ثابت جداول، کد و سرنخ های سرپوش را شکسته است. آگاهانه از جمله پیش فرض است؛ شکستن مبتنی بر سیمانیک یا LLM برای اسناد فنی و دستورالعمل های محصول سود می برد.
- **Parent-doc pattern.**برای دقت، قطعات کوچک "بچه" را بازیافت کنید. هنگامی که چندین کودک از همان بخش والدین ظاهر می شوند، برای حفظ زمینه در بلوک والدین تغییر دهید. این به طور مداوم کیفیت پاسخ را بدون آموزش مجدد افزایش می دهد.
- **k_rerank=3 is usually optimal.**هر بخش اضافی گذشته که هزینه توکن و تاخیر تولید را بدون افزایش کیفیت پاسخ اضافه می کند. اگر k=8 هنوز برای شما بهتر از k=3 است، رتبه بندی مجدد عملکرد کمتری دارد.
- **HyDE / query expansion.**از سوال جواب فرضی تولید کنید، آن را وارد کنید، بازپس بگیرید. شکاف عبارت بین سوالات کوتاه و اسناد طولانی را می پراید. بدون آموزش، بلند کردن دقیق رایگان.
- **Context budget under 8K tokens.**ضربه هاي ثابت در اين حد به اين معناست که حد بازيابي خيلي لوله
- **Version everything.**پیام ها، قوانین شکاف، مدل گنجاندن، رینکر. هر حرکت به طور خاموش کیفیت پاسخ را شکسته است. دروازه های CI بر روی وفاداری، دقت زمینه و نرخ سوالات بدون پاسخ مانع بازپسین قبل از اینکه کاربران آنها را ببینند.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**در سال 2026، به ویژه برای سوالات که اسم های مناسب را با معنویات مخلوط می کند. ارسال کنید.

طراحی مناسب بازیابی موجب کاهش هالوسیناسیون ها به ۷۰-۹۰ درصد بر اساس اندازه گیری های صنعت ۲۰۲۶ می شود. اکثر افزایش عملکرد RAG از بازیابی بهتر، نه تنظیم دقیق مدل ناشی می شود.

## -باده

پس از`outputs/skill-retrieval-picker.md`:

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## تمرینات

1. **Easy.**اجرا`hybrid_search`در یک مجموعه 500 سند، 20 سوال تست کنید. 5 سوال را با BM25 فقط، فقط کثافت و هیبرید مقایسه کنید.
2. **Medium.**برای هر سوال تست با یک سند صحیح شناخته شده، رتبه ی مستند صحیح را در رتبه بندی های BM25، کثافت و هیبرید پیدا کنید. برای هر یک از آن ها MRR را گزارش کنید.
3. **Hard.**یک کدگر کثیف را در دامنه خود با استفاده از MultipleNegativesRankingLoss (ترانسفارمر های حس) تنظیم کنید. مجموعه ای از آموزش از 500 جفت اسناد جستجو را بسازید. قبل و پس از تنظیم دقیق یادآوری را مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## خواندن بیشتر

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) درمان نهایی BM25
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR، دو کدگر کاینونیک
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) بازیافتگر کم کم که شکاف را با کثافت می پوشاند
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) کاغذ RRF
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) بازیافت دیر تعامل
