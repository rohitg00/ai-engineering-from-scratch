# مدل های گنجانده شده  غوطه ی عمیق 2026

> Word2Vec به شما یک ویکتور در هر کلمه داده است. مدل های مدرن گنجانده به شما یک ویکتور در هر گذرگاه، میان زبانی، با دید های نادر، کثافت و چند ویکتور، اندازه ای برای متناسب با شاخص شما. انتخاب اشتباه و RAG شما چیزی اشتباه را بازیابی می کند.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## مشکل

سیستم RAG شما ۴۰ درصد اوقات مسیر اشتباه را بازمی گیرد. گناهکار به ندرت پایگاه داده وکتور یا پرامپت است. این مدل گنجانده است.

انتخاب یک گنجانده در سال 2026 به معنای انتخاب در پنج محور است:

1. **Dense vs sparse vs multi-vector.**یک متری در هر متن، یا یک در هر نشانه، یا یک کیسه وزن کمی از کلمات.
2. **Language coverage.**مدل های انگلیسی یک زبان هنوز هم در وظایف انگلیسی برنده می شوند. مدل های چند زبانی وقتی که کارپوها مخلوط می شوند برنده می شوند.
3. **Context length.**512 توکن مقابل 8,192 در مقابل 32,768  و ظرفیت واقعی موثر اغلب 60-70% از حداکثر تبلیغ شده است.
4. **Dimension budget.**در 100 میلیون متری، ذخیره سازی 1300 دلار در ماه است. تراکم ماتریوشکا این مقدار را 4x کاهش می دهد.
5. **Open vs hosted.**وزن باز به معنی کنترل ستک و داده ها است. میزبان به معنی معامله کنترل برای همیشه آخرین است.

این درس نام تعدیل ها را می دهد تا شما بتوانید بر اساس شواهد، نه بر اساس آنچه که سه ماهه گذشته محبوب بود، انتخاب کنید.

## مفهوم

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**یک متری در هر گذرگاه (معمولا 384-3،072 ابعاد) . شباهت کوسین، گذرگاه ها را با نزدیک بودن معنوی رتبه بندی می کند. OpenAI `text-embedding-3-large`, حالت BGE-M3 , Voyage-3

**Sparse embeddings.**یک ترانسفارمر وزن برای هر نشانه لغت پیش بینی می کند، سپس صفر را از اکثر آنها خارج می کند. نتیجه یک ویکتور کمیاب اندازه است.

**Multi-vector (late interaction).**ColBERTv2، Jina-ColBERT. یک ویکتور در هر توکن. امتیاز با MaxSim: برای هر توکن جستجو، مشابه ترین توکن سند را پیدا کنید، امتیازات را جمع کنید. ذخیره و امتیاز گران تر است، اما در سوالات طولانی و کورپوس های خاص دامنه برنده می شود.

**BGE-M3: all three at once.**یک مدل واحد به طور همزمان نمایش های کثافت، نادر و چند متری را تولید می کند. هر یک می تواند به طور مستقل مورد بررسی قرار گیرد؛ امتیازات از طریق مبلغ وزن شده ترکیب می شوند. پیش فرض 2026 زمانی که شما از یک نقطه بازرسی انعطاف پذیری می خواهید.

**Matryoshka Representation Learning.**آموزش داده شده است تا اولین ابعاد N ویکتور یک ادغام مستقل مفید را تشکیل دهد. یک ویکتور 1.536-dim را به 256 dim کوتاه کنید و برای ذخیره سازی 6x با دقت ~ 1% پرداخت کنید. از طریق OpenAI text-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+ پشتیبانی می شود.

### جدول رتبه بندی MTEB داستان جزئی را می گوید

متنی های متنی شامل شده در متنی های متنی (MEB) در سال 2022, 56 کار در 8 نوع کار در راه اندازی (۲۰۲۲) گسترش یافته تا 100 + کار در MTEB v2. در اوایل سال 2026, Gemini Embedding 2 بالا بازیافت (67.71 MTEB-R). Cohere embed-v4 منجر به عمومی (65.2 MTEB). BGE-M3 منجر به آزاد وزن چندزبانی (63.0).

### الگوی سه لایه

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

بیشتر دسته های تولید از سه تا استفاده می کنند.

```figure
gx-matryoshka
```

## آن را بسازید

### مرحله 1: خط اصلی  گنجانده های ضخیم با Sentence-BERT

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True`این مقدار را به اندازه یک نقطه برابر می کند.

### مرحله دوم: تراکم ماتریوشکا

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

پس از کوتاه کردن، دوباره عادی سازی کنید. Nomic v1.5، OpenAI text-3 و Voyage-4 آموزش دیده اند تا برای چند سطح اول این بدون ضرر است. مدل های غیر ماتریوشکا (در اصل Sentence-BERT) هنگام کوتاه شدن به شدت کاهش می یابد.

### مرحله سوم: چندکارایی BGE-M3

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

سه تا شاخص، يک تماس نتيجه

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

وزن ها رو به سمت دامنه ات تنظیم کن

### مرحله 4: ارزیابی MTEB در یک کار سفارشی

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

مدل های کاندیدای خود را بر روی زیر مجموعه ای * نماینده * اجرا کنید. تنها به رتبه بندی رتبه بندی اعتماد نکنید.

### مرحله 5: کوزین دستی از ابتدا

ببین`code/main.py`. متوسط Hashing Trick (تنها stdlib) . با ترانسفورماتور ها رقابت نمی کند، اما شکل را نشان می دهد: tokenise → vector → normalize → dot product.

## دام ها

- **Same model for query and doc.**برخی از مدل ها (Voyage، Jina-ColBERT) از کدگذاری غیرمتماسی استفاده می کنند.
- **Missing prefix.** `bge-*`مدل ها نیاز دارند`"Represent this sentence for searching relevant passages: "`اگه فراموش کردي، 3-5 تا نقطه فاصله ي يادداشت رو از دست بده
- **Over-trimming Matryoshka.**1,536 → 256 معمولاً امن است. 1,536 → 64 نیست. بر اساس مجموعه ارزیابی خود تایید کنید.
- **Context truncation.**اکثر مدل ها به طور خاموشی ورودی ها را در طول حداکثر طول خود کوتاه می کنند. اسناد طولانی نیاز به شکستن دارند (به درس 23 نگاه کنید).
- **Ignoring latency tail.**نمرات MTEB تاخیر p99 را پنهان می کند. یک مدل 600M ممکن است مدل 335M را 2 امتیاز بیشتر کند اما هزینه 3x بیشتر در هر سوال است.

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

مدل 2026: با BGE-M3 یا متن-3 بزرگ شروع کنید، در دامنه خود با MTEB ارزیابی کنید، اگر یک مدل خاص دامنه بیش از 3 امتیاز برنده شود، عوض کنید.

## -باده

پس از`outputs/skill-embedding-picker.md`:

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## تمرینات

1. **Easy.**100 جمله رو با  رمزگذاری کن`bge-small-en-v1.5`در کمترین حد (384) ، سپس در ماتریوشکا 128، کاهش MRR را در 10 سوال اندازه گیری کنید.
2. **Medium.**با 500 قسمت از دامنه شما مقایسه کنید که کدام یک از آنها در recall@10 برنده می شود؟ آیا فیوژن RRF بهترین حالت تک تک را شکست می دهد؟
3. **Hard.**MTEB را با سه مدل کاندید در دو وظیفه برتر دامنه خود اجرا کنید. نمره MTEB را گزارش کنید، تاخیر p99 در یک دسته 100 سوال و سوالات $ / 1 میلیون. یکی از بهترین Pareto را انتخاب کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## خواندن بیشتر

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) کاغذ دو کدر
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) ورق رتبه بندی
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) مدل سه حالت یکپارچه
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) هدف آموزش در سطح پله
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) تعامل دیر در تولید
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) رتبه بندی زنده
