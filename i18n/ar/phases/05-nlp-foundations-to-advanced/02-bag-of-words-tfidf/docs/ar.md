# كيس الكلمات، TF-IDF، ومعرفة النص

> أقرأ أولاً، فكر في ذلك لاحقاً، فـ"تـف-إيدف" لا تزال تفوق على التكليد في المهام المحددة جيداً في عام 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## المشكلة

النموذج يحتاج الأرقام لديك سلسلة

كل خط أنابيب NLP يجب أن يجيب على نفس السؤال. كيف نغير تدفق الطول المتغير من الرموز إلى متجه حجم ثابت يمكن أن يستهلك المصنف. وكانت أول إجابة الحقل هبطت على الأكثر غباء التي تعمل. عد الكلمات. صنع متجه.

هذا المتجه قد حمل أكثر من النموذج النووي الإنتاجية من أي نموذج إضافة. مرشحات البريد الإلكتروني، تصنيفات الموضوعات، اكتشاف شذوذ السجلات، تصنيف البحث (قبل BM25) ، الموجة الأولى من تحليل المشاعر، العقد الأول من المعايير الأكاديمية لـ NLP. 2026 الممارسين لا يزالون يصلون إليه أولاً في مهام التصنيف الضيقة. إنه سريع ويمكن تفسيره، وغالبًا ما لا يمكن التمييز بينه وبين نموذج تضمين معايير 400 م على المهام التي يكون فيها وجود الكلمات هو ما يهم.

هذه الدروس تبني كيس الكلمات، ثم TF-IDF، من الصفر. ثم تظهر scikit-تعلم القيام بنفس الشيء في ثلاث خطوط. ثم أسماء وضع الفشل الذي يجعلك تصل إلى التوابل.

## المفهوم

**Bag of Words (BoW)**يرمي النظام. لكل وثيقة، عد عدد مرات ظهور كل كلمة في المفردات. طول المتجه هو حجم المفردات. الموقف `i`هو عدد الكلمات`i`. . .

**TF-IDF**كلمة تظهر في كل وثيقة غير معلومية، لذلك قم بتخفيض حجمها. كلمة نادرة في جميع أنحاء الجسم ولكن متكررة في وثيقة واحدة هي إشارة، لذلك قم بتخفيض حجمها.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

أين`TF`هو تردد المصطلح في الوثيقة، `df`هو تردد الوثيقة (كم عدد الوثائق التي تحتوي على الكلمة) ،`N`هي الوثائق الكاملة.`log`يحتفظ بالوزن المحدد للكلمات المتاحة في كل مكان.

الخصائص الرئيسية: كل منهما ينتج متجهات نادرة مع محور يمكن تفسيرها. يمكنك النظر إلى أوزان المصنف المدرب وقراءة الكلمات التي تدفع الوثيقة نحو كل فئة. لا يمكنك القيام بذلك مع إدراج BERT 768 بعد.

```figure
bow-tfidf
```

## بناءها

### الخطوة الأولى: بناء المفردات

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

المدخل: قائمة بالوثائق المضمونة (أي مؤشر على مستوى الكلمة سوف يفعل ذلك ؛ `code/main.py`في هذا الدروس يستخدم متغير بسيط من الحروف الصغيرة).`{word: index}`إضافة ثابتة يعني كلمة مؤشر 0 هو أول كلمة ترى في الوثيقة الأولى. الاتفاقية تختلف؛ scikit-تعلم أنواع الأبجدية.

### الخطوة الثانية: حقيبة الكلمات

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

الصفوف هي وثائق، العمودات هي مؤشرات المفردات.`[i][j]`هو "كم مرة كلمة `j`يظهر في الوثيقة`i`الدكتور 1 لديه`cat`مرتين لأنه فعل ذلك`ran`صفر مرات لأنه لم يفعل.

### الخطوة الثالثة: تردد المصطلحات وتردد الوثائق

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

خدعتين لتسهيل تستحق الإسم`(n+1)/(d+1)`تجنب`log(x/0)`- التابعة`+1`يضمن كلمة في كل وثيقة لا يزال IDF 1 (ليس 0) ، مما يطابق افتراض scikit-learn.`log(N/df)`كلاهما يعمل، النسخة المُسطحة أكثر صداقتاً

### الخطوة الرابعة: TF-IDF

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

وثائق ثلاث، خمس كلمات في الكلمات (`the`،`cat`،`sat`،`dog`،`ran`)`the`يظهر في كل ثلاثة، لذلك جيش الدفاع الدولي منخفض.`dog`يظهر في واحد، لذلك قوات الدفاع الإسرائيلية عالية. مع مجموعة حقيقية من الآلاف من الكلمات، هذه المتجهات نادرة (معظم الإدخالات صفر). حتى في هذه اللعبة، الكلمات التمييزية تظهر.

### الخطوة 5: تعاديل الصفوف L2

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

بدون التطبيع، يحصل مستند أطول على متجه أكبر ويهيمن على درجات التشابه. يضع التطبيع L2 كل مستند على وحدات المضاربة. تشابه الكوزين بين الصفوف هو الآن مجرد نسبة نقطة.

## استخدمها

سيكيت-تعلم السفينة الإصدار الإنتاجي.

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

`CountVectorizer`يستخدم الـ Tokenization و المفردات و BoW في مكالمة واحدة`TfidfVectorizer`يضيف وزن الجيش الإسرائيلي وتطبيع L2. كل منهما يعيد المصفوفات الضعيفة. بالنسبة إلى 100k وثائق، النسخة الكثيفة لا تناسب في الذاكرة؛ البقاء ضئيلة حتى يطلب المصنف الكثافة.

القفز الذي يغير كل شيء:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### عندما لا يزال TF-IDF يفوز (من عام 2026)

- اكتشاف البريد الإلكتروني، وضع علامات على الموضوع، وضع علامات على شذوذ السجلات، وجود الكلمات هو ما يهم، لكن النونات الارضية لا.
- أنظمة بيانات منخفضة (مئات من الأمثلة المسموحة).
- في أي مكان يهم التأخير، TF-IDF بالإضافة إلى نموذج خطي يستجيب في ثوانٍ صغيرة، إدخال وثيقة عبر محول يستغرق 10-100 ثانية.
- أنظمة يجب أن تفسر توقعاتها، فحص معايير المصنف، الكلمات الإيجابية العليا هي السبب.

### عندما تفشل نظام التأمين التجاري

الفشل في العمى التفسيري، فكر في هذه الوثائق:

- "الفيلم لم يكن جيدا على الإطلاق".
- "كان الفيلم ممتازاً"

أحدهما هو مراجعة سلبية، والآخر إيجابية، التداخل بين الفئة التلفزيونية والفئة الدولية هو بالضبط`{the, movie, was}`. محترف تصنيف الكلمات يجب أن يتذكر هذه الكلمة`not`قريبة`good`يمكن أن تتعلم هذا على ما يكفي من البيانات، ولكن أبداً بجد مثل نموذج يفهم النص.

الفشل الآخر: كلمات خارج المفردات عند الاستنتاج. نموذج BoW المدرب على مراجعات IMDb لا يعرف ما الذي يجب فعله `Zoomer-approved`إذا لم تظهر هذه الرمزية في التدريب. تضمنت الكلمات الفرعية (المرحلة 04) تتعامل مع هذا. لا يمكن أن تقوم TF-IDF.

### الهجين: التوابل الموزعة TF-IDF

الاختيار العملي لعام 2026 لتصنيف البيانات المتوسطة: استخدام ثقيلات TF-IDF كاهتمام على تضمين الكلمات.

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

تحصل على القدرة التفاصلية من التوابع، وتأكيد الكلمات النادرة من TF-IDF. يقوم المصنف بتدريب على المتجه المجمع. هذا يتفوق بمفرده على الإحساس، الموضوع، والنية التصنيف تحت حوالي 50 ألف مثال معلّمة.

## أرسله

إبقوا`outputs/prompt-vectorization-picker.md`:

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

## التمارين

1. **Easy.**تنفيذ`cosine_similarity(doc_vec_a, doc_vec_b)`على إصدار L2 المعتاد TF-IDF. التحقق من أن الوثائق المتطابقة تسجل 1.0 و الوثائق المفصلة المفصلة تعادل 0.0.
2. **Medium.**إضافة`n-gram`دعم `bag_of_words`. المعلم`n`يُنتجُ العدّاتِ أكثر `n`-جرام، اختبر ذلك`n=2`على`["the", "cat", "sat"]`يُنتجُ عدد الكبيرة`["the cat", "cat sat"]`. . .
3. **Hard.**قم ببناء الهجين المضمن الموزن TF-IDF أعلاه باستخدام متجهات GloVe 100d (تنزيل مرة واحدة ، التخزين). مقارنة دقة التصنيف مع TF-IDF البسيطة والإضافة المتوسطة المجمعة البسيطة على مجموعة بيانات 20 Newsgroups. تقرير الذي يفوز أين.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## المزيد من القراءة

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) الإشارة القنونية لل API، بالإضافة إلى الملاحظات على كل زر.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) الورقة التي جعلت TF-IDF الاختيار المفقود لمدة عقد.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2)2026 عندما تنتصر الطريقة القديمة ولماذا
