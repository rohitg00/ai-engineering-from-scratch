# إضافة نماذج  الغوص العميق لعام 2026

> Word2Vec أعطاك متجه لكل كلمة. النماذج الحديثة التضمين تعطيك متجه لكل مرور، عبر اللغة، مع مشاهد نادرة، كثيفة، ومعدة المتجهات، حجم مناسب لمؤشرك. اختيار الخطأ و RAG الخاص بك يسترد الشيء الخطأ.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## المشكلة

نظام RAG الخاص بك يستعيد الممر الخطأ 40٪ من الوقت. الجاني نادرا ما يكون قاعدة بيانات المتجهات أو المشاركة.

اختيار إضافة في عام 2026 يعني اختيار خمسة محور:

1. **Dense vs sparse vs multi-vector.**متجه واحد لكل مرسلة أو واحد لكل رمز أو كيس متوزن من الكلمات
2. **Language coverage.**ما زالت النماذج الإنجليزية الواحدة اللغة تفوز في المهام الإنجليزية فقط. النماذج متعددة اللغات تفوز عندما تكون الجسمات مختلطة.
3. **Context length.**512 رمز مقابل 8,192 مقابل 32,768  والقدرة الفعالة الحقيقية غالبا ما تكون 60-70% من الحد الأقصى الإعلان.
4. **Dimension budget.**3 072 يطفون بدقة كاملة = 12 كيلوبايت لكل متجه. عند 100 مليون متجه، التخزين 1300 دولار / شهر. تخفيض ماتريوشكا هذا 4x.
5. **Open vs hosted.**الوزن المفتوح يعني أنك تتحكم في السطح والبيانات المضيفة يعني أنك تتبادل السيطرة على آخر مرة

هذه الدروس تسمي التنازلات حتى تتمكن من اختيار الأدلة، وليس على أي شيء كان شعبيا الربع الماضي.

## المفهوم

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**متجه واحد لكل مرسل (عادةً 384-3،072 بعد). تشابه الكوسينوس يرتب المرسلات من خلال القربة التموية.`text-embedding-3-large`, وضع BGE-M3 كثيف, Voyage-3. اختيار افتراضي.

**Sparse embeddings.**نمط SPLADE. المحول يتنبأ بوز لكل رمز لغة، ثم يخرج الصفر من معظمها. النتيجة هي متجه نادر في الحجم. يلتقط مطابقة لغوية (مثل BM25) ولكن مع أوزان مصطلحات تعلم. قوية على الأسئلة الكلمات الرئيسية الثقيلة.

**Multi-vector (late interaction).**كولبرتف2، جينا كولبرت. متجه واحد لكل رمز. تسجيل مع ماكس سيم: لكل رمز استفسار، العثور على رمز وثيقة أكثر مماثلة، وجمع النتائج. أكثر تكلفة لتخزين وتسجيل، ولكن يفوز على استفسارات طويلة ومؤسسات محددة للمنطقة.

**BGE-M3: all three at once.**النموذج الواحد يخرج نماذج كثيفة ونادرة ومعدة المتجهات في نفس الوقت. يمكن استفسار كل منها بشكل مستقل. تسجل الندب عبر المجموع الموزن. افتراض 2026 عندما تريد المرونة من نقطة تفتيش واحدة.

**Matryoshka Representation Learning.**تم تدريبها حتى تشكل أول أبعاد N للنقل إدمجًا مستقلًا مفيدًا. قم بتقليص نقلة 1.536 طولًا إلى 256 ضوءًا وتدفع دقة ~ 1% لإنقاذ التخزين 6 ×. يدعمها OpenAI text-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+.

### قائمة الـ MTEB تقول قصة جزئية

مقياس إضافة نصية ضخمة  56 مهمة عبر 8 أنواع مهام عند الإطلاق (2022) ، تم توسيعها إلى 100 مهمة + في MTEB v2. في أوائل عام 2026 ، تتحسن التقاطع (67.71 MTEB-R). يؤدي المكثف الإضافة v4 بشكل عام (65.2 MTEB). يؤدي BGE-M3 إلى اللغة متعددة الوزن المفتوحة (63.0).

### النمط الثلاثي

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

معظم مجموعات الإنتاج تستخدم كل ثلاثة

```figure
gx-matryoshka
```

## بناءها

### الخطوة 1: خط الأساس  التوابل الكثيفة مع Sentence-BERT

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

`normalize_embeddings=True`يجعل نسبة النقطة مساوية لتشابه الكوسينات.

### الخطوة الثانية: تخفيض المطروشكا

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

إعادة التطبيع بعد التقطيع. يتم تدريب Nomic v1.5 ، OpenAI text-3 ، و Voyage-4 بحيث يكون هذا بلا خسائر في المستويات القليلة الأولى. تتدهور النماذج غير الماتريوشكا (السلسلة الأصلية-BERT) بشكل حاد عند التقطيع.

### الخطوة الثالثة: وظائف متعددة من BGE-M3

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

ثلاثة مؤشرات، مكالمة استنتاج واحدة.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

أجهز الوزن على مستوى الخاص بك.

### الخطوة 4: تقييم MTEB على مهمة مخصصة

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

قم بتشغيل نماذج المرشحين الخاصة بك على مجموعة فرعية * ممثلة * لا تثق في رتبة قائمة الرتبة فقط  مهمة مجالك.

### الخطوة 5: كوسينات مُصوّرة يدوياً من الصفر

انظر`code/main.py`. متوسط إدخالات حركة الهشينغ (stdlib فقط). ليس منافساً مع إدخالات المحولات، ولكنه يظهر الشكل: tokenize → vector → normalize → product dot.

## الفخاخ

- **Same model for query and doc.**بعض النماذج (Voyage، Jina-ColBERT) تستخدم تشفير غير متماثل  استفسار وثيقة تمر عبر مسارات مختلفة. تحقق دائمًا من بطاقة النموذج.
- **Missing prefix.** `bge-*`النماذج تحتاج`"Represent this sentence for searching relevant passages: "`3- 5 نقطة إعادة التذكر الفجوة إذا نسيت
- **Over-trimming Matryoshka.**1536 → 256 عادةً آمن، 1536 → 64 ليس كذلك. تأكدي على مجموعة تقييمك.
- **Context truncation.**معظم النماذج تخفض المدخلات بصمت على طولها القصوى. تحتاج الأدلة الطويلة إلى التجزئة (انظر الدروس 23).
- **Ignoring latency tail.**تسجيلات MTEB تخفي تأخر p99. قد يتغلب نموذج 600M على نموذج 335M بنسبة نقطتين ولكن تكلفة 3x أكثر لكل استفسار.

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

نمط 2026: ابدأ بـ BGE-M3 أو النص-3 الكبير، قم بتقييم النطاق الخاص بك مع MTEB، قم بتبادل النموذج إذا فاز نموذج محدد النطاق بأكثر من 3 نقاط.

## أرسله

إبقوا`outputs/skill-embedding-picker.md`:

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

## التمارين

1. **Easy.**قم بتشفير 100 جملة مع `bge-small-en-v1.5`عند التخفيف الكامل (384) ، ثم عند ماتريوشكا 128.
2. **Medium.**مقارنة BGE-M3 كثيفة، نادرة، وكولبرت على 500 مقطع من مجال الخاص بك. من يفوز على التذكر@10؟ هل الاندماج RRF يضرب أفضل وضع واحد؟
3. **Hard.**إدارة MTEB على ثلاثة نماذج مرشحة في مهماتك الأولى 2 المجال. تقرير MTEB درجة، p99 تأخير على 100 مجموعة من الأسئلة، و 1 مليون دولار الأسئلة. اختر واحد Pareto-أفضل.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## المزيد من القراءة

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084)ورقة المُفرقَمَاتِ الثنائية
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316)ورقة الرقم
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) نموذج ثلاثي الموضة الموحد.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) هدف تدريب درجات الأبعاد.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) التفاعل المتأخر في الإنتاج.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) ترتيبات حية
