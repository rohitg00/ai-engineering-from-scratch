# استرداد المعلومات والبحث

> BM25 دقيقة ولكن هشة، فهي تلقي شبكة واسعة لكن تفوت الكلمات الرئيسية، الهجينة هي الاختيار الافتراضي لعام 2026. كل شيء آخر يُصنّف.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## المشكلة

يكتب المستخدم "ما يحدث إذا كذب شخص ما للحصول على المال" ويوقع العثور على القانون الذي يغطي ذلك بالفعل: "القسم 420 IPC". يفتقد بحث الكلمات الرئيسية إلى ذلك بالكامل (لا يوجد مفردة مشتركة). يفتقد بحث معنوي إذا لم يتم تدريب التوابع على النص القانوني. يجب على البحث الحقيقي التعامل مع كليهما.

إن IR هو خط الأنابيب تحت كل نظام RAG، كل شريط بحث، كل موقع وثائق البحث المضطرب. الهندسة المعمارية 2026 التي تعمل في الإنتاج ليست طريقة واحدة. إنها سلسلة من الطرق التكميلية، كل واحدة من الصادرة على فشل من قبل.

هذه الدروس تبني كل قطعة وأسماء تفشل كل صيد

## المفهوم

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

أربعة طبقات اختر تلك التي تحتاجها

1. **Sparse retrieval (BM25).**سريع، دقيق في المقابلة الدقيقة، رهيب في التعريفات، إدراج مؤشر معاكس، تحت 10ms لكل استفسار على ملايين الوثائق، يحصل لك إشارات القانون، رموز المنتج، رسائل الخطأ، الكيانات المسمى الحق.
2. **Dense retrieval.**تشكيل استفسار وثائق إلى متجهات. بحث القريب القريب. تسجل المقاطع والتشابهات النطاقية. تفتقد مطابقات كلمات رئيسية دقيقة تختلف عن حرف واحد. 50-200ms لكل استفسار مع FAISS أو متجهات DB.
3. **Fusion.**دمج القوائم المتصنفة من النادرة والكثيفة. الاندماج المتبادل للرتبة (RRF) هو الافتراض السهل لأنه يتجاهل النتائج الخام (التي تعيش في مقياسات مختلفة) ويستخدم فقط مواقف الرتب. الاندماج الموزن هو خيار عندما تعرف إشارة واحدة تهيمن على مجالك.
4. **Cross-encoder rerank.**خذ العلوي 30 من الاندماج. تشغيل مُشفّر متقاطع (سؤال + وثيقة معاً، تسجيل كل زوج). حافظ على العلوي 5. المُشفّر المتقاطع أبطأ لكل زوج من المُشفّر الثنائي ولكن أكثر دقة بكثير. يمكنك إيقاف التكلفة عن طريق تشغيله فقط على العلوي 30.

الاسترداد الثلاثي (BM25 + كثافة + متعلمة-المتفرقة مثل SPLADE) يتفوق على المتفرقة في مقاييس 2026 ولكن يحتاج إلى البنية التحتية لمؤشرات المتفرقة المتعلمة. بالنسبة لمعظم الفرق ، فإن إعادة ترتيب المتفرقة بالإضافة إلى المترجمات المتقاطعة هي نقطة الراحة.

```figure
gx-hybrid-retrieval
```

## بناءها

### الخطوة الأولى: BM25 من الصفر

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

هناك مُعايير تستحق المعرفة`k1=1.5`يسيطر على الاكتفاء في تردد المدى؛ أعلى يعني المزيد من الوزن على تكرار المدى. `b=0.75`يسيطر على التطبيع على الطول؛ 0 يتجاهل طول الوثيقة، 1 يطبيع بشكل كامل. التوصيات الافتراضية هي توصيات روبرتسون من الورقة الأصلية ونادرا ما تحتاج إلى ضبط.

### الخطوة الثانية: استرداد كثيف مع جهاز تشفير ثنائي

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

L2 تعاديل التوابل حتى النقطة المنتج يساوي كوسين. `all-MiniLM-L6-v2`هو 384 عمق، سريع، وقوي بما فيه الكفاية لمعظم الاستخدامات الإنجليزية.`paraphrase-multilingual-MiniLM-L12-v2`.للمحاسبة الدقيقة القصوى`bge-large-en-v1.5`أو`e5-large-v2`. . .

### الخطوة الثالثة: الاندماج المتبادل

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

- نعم`k=60`المستمر يأتي من ورقة RRF الأصلية. أعلى `k`يُسطح مساهمة الفروق في الرتب ؛ أقل `k`60 هي النشرة الافتراضية المنشورة ونادرا ما تحتاج إلى ضبط.

### الخطوة الرابعة: البحث الهجري + إعادة التصنيف

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

ثلاثة مراحل مؤلفة. BM25 يجد مطابقات لغوية. يجد مطابقات سمانية كثيفة. RRF يدمج التصنيفات الثنائية دون الحاجة إلى تصفية النتيجة. يقوم جهاز التشفير عبر التشفير بإعادة تسجيل أفضل 30 باستخدام أزواج الوثائق الاستفسارية معاً، مما يلتقط أهمية حبة دقيقة لم يتم إغلاق جهاز التشفير الثنائي. حافظ على الـ 5 الأولى.

### الخطوة 5: التقييم

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

وبالتحديد لـ RAG**Recall@k**من الجهاز الاحتياطي هو الأهم رقم. القارئ الخاص بك لا يمكن أن تجيب إذا كان المقطع الصحيح ليس في مجموعة استرداد.

نصيحة إزالة الأخطاء: بالنسبة للطلبات الفاشلة، فلتختلف في التصنيف النادر والكثيف. إذا وجد أحد الوثائق الصحيحة والآخر لا، لديك عدم مطابقة المفردات (تصحيح: إضافة النصف المفقود) أو غموضة معنوية (تصحيح: إدخال أفضل أو إعادة ترتيب).

## استخدمها

"مجموعة 2026"

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

أياً كان ما تختارينه، ميزانية للتقييم. استرداد الموازين قبل استرجاع دقة RAG من نهاية إلى نهاية. القارئ لا يستطيع إصلاح ما غاب عن الاسترداد.

### الدروس التي اكتسبت بجد من 2026 الإنتاج RAG

- **80% of RAG failures trace to ingestion and chunking, not the model.**الفريق يقضي أسابيع في تبادل الـ "إل إل إم" وتحسين الإشارات بينما يسترد البحث بشكل هادئ السياق الخطأ في كل استفسار ثالث
- **Chunking strategy matters more than chunk size.**تقسيمات الحجم الثابتة تكسر الجداول والرموز والرؤوس المضمنة. إن إدراك الجملة هو الافتراض الافتراضي؛ والجزء المستند إلى التعريف أو القانون الدولي يُكافئ عن الوثائق التقنية واليدويات المنتجة.
- **Parent-doc pattern.**استرداد قطع صغيرة "الطفل" للحصول على دقة. عندما يظهر العديد من الأطفال من نفس القسم الوالد، قم بتبادل الكتل الوالدية للحفاظ على السياق. هذا يرفع جودة الإجابة باستمرار دون إعادة التدريب.
- **k_rerank=3 is usually optimal.**كل جزء إضافي من الماضي يضيف تكلفة رمزية وتخفيف توليد دون رفع جودة الإجابة. إذا كان k=8 لا يزال أفضل من k=3 بالنسبة لك، فإن المرتبة المُجددة غير فعالة.
- **HyDE / query expansion.**توليد إجابة افتراضية من السؤال، تضمين ذلك، استرداد. سيلوي الفجوة بين الأسئلة القصيرة والوثائق الطويلة. مفتوحة رفع الدقة دون تدريب.
- **Context budget under 8K tokens.**ضربات متسقة عند هذا الحد يعني أن عتبة إعادة المرتبة متخففة جداً
- **Version everything.**الإشارات، قواعد التجزئة، نموذج التضمين، إعادة التصنيف. أي تجرف يخسر صامتة جودة الإجابة. بوابات المعلوماتية على الوفاء، دقة السياق، ومعدل السؤال غير المطلوب قبل أن يراه المستخدمون.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**على مقارنات 2026، وخاصةً بالنسبة للمسائل التي تربط الأسماء المناسبة مع التعريفات. إرسالها عندما تدعم البنية التحتية مؤشرات SPLADE.

يقلل تصميم الاسترداد المناسب من الهلوسات بنسبة 70-90٪ وفقاً لقياسات الصناعة عام 2026. تأتي معظم مكاسب أداء RAG من أفضل الاسترداد ، وليس من ضبط النموذج.

## أرسله

إبقوا`outputs/skill-retrieval-picker.md`:

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

## التمارين

1. **Easy.**تنفيذ`hybrid_search`في مجموعة من 500 وثيقة اختبار 20 استفسار مقارنة التذكير في 5 بين BM25 فقط، كثافة فقط، وهيبريد
2. **Medium.**إضافة حساب MRR. لكل استفسار اختبار مع وثيقة صحيحة معروفة، العثور على رتبة الوثيقة الصحيحة في BM25، والرتبات الكثيفة، والهجرية. إبلاغ MRR لكل.
3. **Hard.**قم بتحسين مبرمجة كثيفة على نطاقك باستخدام MultipleNegativesRankingLoss (متحولات الحكم). قم ببناء مجموعة تدريبية من 500 زوج من أزواج الملفات. قم بمقارنة استدعاءات قبل وبعد التحسين.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## المزيد من القراءة

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) العلاج النهائي بـ BM25.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR، المُشفّر الثنائي القنوني.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720)-المتعلمة-المتفردة التي تغلق الفجوة مع كثافة.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)ورق RRF
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) استرداد التفاعل المتأخر.
