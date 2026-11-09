# موضوع النموذج  LDA و BERTopic

> LDA: المستندات هي مزيج من المواضيع، والمواضيع هي توزيع على الكلمات. BERTopic: مجموعة المستندات في مساحة التضمين، المجموعات هي المواضيع. نفس الهدف، تفكير مختلف.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## المشكلة

لديك 10 آلاف تذكرة دعم العملاء، 50 ألف مقالة أخبار، أو 200 ألف تغريدة. تحتاج إلى معرفة ما هو المجموعة دون قراءتها. ليس لديك علامات على الفئات. أنت لا تعرف حتى كم فئة موجودة.

وذلك بدون إشراف، أعطيه مجموعة صغيرة من المواضيع المتماسكة، و، لكل وثيقة، توزيع على تلك المواضيع.

تتهيمن عائلتان خوارزمية. يعامل LDA (2003) كل وثيقة كمزيج من المواضيع الخفية وكل موضوع كموزع على الكلمات. التوصل هو بايسي. لا يزال يُنتج في الإنتاج حيث تحتاج إلى تفويضات موضوعية مزيجة الأعضاء وتوزيعات احتمالية مستوى الكلمات يمكن تفسيرها.

برتوبيك (2020) يرمز الوثائق مع برت، ويقلل من الامتعداد مع UMAP، ويقوم بتجميعها مع HDBSCAN، ويستخرج كلمات الموضوع عن طريق TF-IDF القائمة على الفئة. فاز في النص القصير، وسائل التواصل الاجتماعي، وأي شيء حيث يشبه التشابه الدلالي أكثر من تداخل الكلمات. يحصل مستند واحد على موضوع واحد، وهو قيود للمحتوى الطويل.

هذه الدروس تبني على الحدس لكل منهما والاسم الذي يجب أن تختاره للجسم المعين.

## المفهوم

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**كل موضوع هو توزيع على الكلمات. كل وثيقة هو مزيج من الموضوعات. لتوليد كلمة في وثيقة، عينة موضوع من مزيج الوثيقة، ثم عينة كلمة من توزيع هذا الموضوع. العكس الإستدلال: مع العطاء الكلمات الملاحظة، استدلال توزيع الموضوع لكل وثيقة وتوزيع الكلمات لكل موضوع. استدلال غيبز المنهار أو Bayes التغيرات يقوم بالحساب.

إنتاج LDA الرئيسي:

- `doc_topic`: المصفوفة `(n_docs, n_topics)`، كل سطر يصل إلى 1 (مزيج الموضوع في الوثيقة).
- `topic_word`: المصفوفة `(n_topics, vocab_size)`, كل سطر يصل إلى 1 (توزيع الكلمات للموضوع).

**BERTopic pipeline.**

1. ترميز كل وثيقة مع محول جملة (مثل: `all-MiniLM-L6-v2`) 384 متجهات
2. خفض الأبعاد مع UMAP إلى ~ 5 أبعاد. إضافة BERT عالية جداً من التسمم للتجميع.
3. مجموعة مع HDBSCAN. على أساس الكثافة، تنتج مجموعات ذات الحجم المتغير وملف "غير متوقع".
4. لكل مجموعة، قم بحساب TF-IDF القائم على الفئة عبر وثائق الكتلة لاستخراج الكلمات الرئيسية.

إنتاج هو موضوع واحد لكل وثيقة (بضافة علامة خارجية -1). اختياريًا ، عضوية ناعمة عبر متجه الاحتمالات في HDBSCAN.

```figure
topic-drift
```

## بناءها

### الخطوة الأولى: LDA عبر scikit-learn

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

ملاحظة: تم إزالة الكلمات المتوقفة، فلتر min_df و max_df مصطلحات نادرة ومنتشرة، CountVectorizer (ليس TfidfVectorizer) لأن LDA تتوقع العد الخام.

### الخطوة الثانية: BERTopic (إنتاج)

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

الفلتر على`Topic != -1`يُسقط خزنة BERTopic الخارقة (الوثائق التي لم تتمكن HDBSCAN من تجميعها). `min_topic_size`يسيطر على الحد الأدنى من حجم الكلاستر HDBSCAN؛ المكتبة الافتراضية BERTopic هو 10. هذا المثال يحددها إلى 15 صراحة لمدى الدروس. بالنسبة للمستندات أكثر من 10,000، زيادة إلى 50 أو 100.

### الخطوة الثالثة: التقييم

كل منهجين يخرجون كلمات موضوعية. السؤال هو ما إذا كانت هذه الكلمات متطابقة.

- **Topic coherence (c_v).**يجمع بين NPMI (المعلومات المتبادلة المنظمة من الناحية النقطية) من أزواج الكلمات العليا على سياقات النافذة المنزلقة ، ويجمع النتائج إلى متجهات الموضوع ، ويقارن تلك المتجهات عبر شبكة الكوزين. أعلى هو أفضل. استخدام `gensim.models.CoherenceModel`مع`coherence="c_v"`. . .
- **Topic diversity.**جزء من الكلمات الفريدة بين كلمات الرئيسية لجميع الموضوعات. أعلى هو أفضل (المواضيع لا تتداخل).
- **Qualitative inspection.**اقرأ الكلمات الرئيسية لكل موضوع هل يسمون شيئا حقيقيا؟ الحكم البشري لا يزال خط الدفاع الأخير.

## متى لا تختار أي

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

أكبر اعتبار عملي هو طول الوثيقة. إضافة BERT تقصص؛ LDA تعتبر العمل على أي طول. بالنسبة للوثائق أطول من سياق نموذج الإضافة، إما قطعة + جمع أو استخدام LDA.

## استخدمها

"مجموعة 2026"

- **BERTopic.**افتراضية للنص القصير وأي شيء يهم في التعريف
- **`gensim.models.LdaModel`.**طراز LDA كلاسيكي للإنتاج، ناضج، اختبر في المعركة.
- **`sklearn.decomposition.LatentDirichletAllocation`.**-إلى التجارب
- **NMF.**عاملة المصفوفات غير السلبية بديل سريع لـ LDA، جودة مقارنة على النص القصير.
- **Top2Vec.**تصميم مشابه لبرتوبيك. مجتمع أصغر ولكن جيد في بعض المعايير.
- **FASTopic.**أحدث وأسرع من برتوبيك على الكوربوس الكبيرة جدا.
- **LLM-based labeling.**إشغلي أي مجموعة، ثم اطلب من نموذج لإسم كل مجموعة.

## أرسله

إبقوا`outputs/skill-topic-picker.md`:

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

## التمارين

1. **Easy.**تطبيق LDA مع 5 مواضيع على مجموعة بيانات 20 مجموعة الأخبار. طبع أفضل 10 كلمات لكل موضوع. وضع علامة على كل موضوع يدويا. هل وجد الخوارزمية الفئات الحقيقية؟
2. **Medium.**تطبيق BERTopic على نفس مجموعة الفرعية 20 مجموعة أخبار. مقارنة عدد المواضيع المكتسبة، الكلمات الرئيسية، والاتساق النوعي ضد LDA. أي من الفئات الحقيقية تظهر بشكل أكثر نظافة؟
3. **Hard.**احسب التماسك c_v لكل من LDA و BERTopic على جسمك. قم بتشغيل كل من 5، 10، 20، 50 موضوعًا. تراكم التماسك مقابل عدد الموضوعات. أبلغ عن الطريقة الأكثر استقرارًا عبر عدد الموضوعات.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## المزيد من القراءة

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf)- ورقة الـ "إل دي اي"
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) ورقة BERTopic
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf)-الورقة التي تقدمت (سي) وأصدقاء
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) المرجحات الإنتاجية. أمثلة ممتازة.
