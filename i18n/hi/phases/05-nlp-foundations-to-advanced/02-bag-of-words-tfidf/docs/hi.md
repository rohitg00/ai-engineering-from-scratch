# शब्दों का बैग, TF-IDF, और पाठ प्रतिनिधित्व

> पहले गिनें, बाद में सोचें। 2026 में TF-IDF अभी भी अच्छी तरह से परिभाषित कार्यों पर एम्बेडमेंट को हराता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## समस्या

मॉडल को संख्याओं की जरूरत है.

प्रत्येक एनएलपी पाइपलाइन को एक ही प्रश्न का उत्तर देना है. हम टोकन की एक चर लंबाई की धारा को एक निश्चित आकार के वेक्टर में कैसे बदल सकते हैं जिसे एक वर्गीकरणकर्ता उपभोग कर सकता है। क्षेत्र पर पहला उत्तर सबसे मूर्ख था जो काम करता है। शब्दों की गिनती करें। एक वेक्टर बनाएं।

उस वेक्टर ने किसी भी एम्बेडिंग मॉडल की तुलना में अधिक उत्पादन एनएलपी ले लिया है। स्पैम फ़िल्टर, विषय वर्गीकरण, लॉग विसंगतियों का पता लगाना, खोज रैंकिंग (बीएम25 से पहले), भावना विश्लेषण की पहली लहर, शैक्षणिक एनएलपी बेंचमार्क का पहला दशक। 2026 अभ्यर्थियों को अभी भी संकीर्ण वर्गीकरण कार्यों पर पहले इसके लिए पहुंचना है। यह 400M-पैरामीटर एम्बेडिंग मॉडल से तेज, व्याख्या योग्य और अक्सर अपरिभाषित है, जहां शब्द उपस्थिति ही मायने रखती है।

इस पाठ में शब्दों का बैग बनाया गया है, फिर TF-IDF, खरोंच से। फिर यह दिखाता है कि scikit-learn तीन पंक्तियों में ऐसा ही करता है। फिर विफलता मोड का नाम दिया गया है जो आपको एम्बेडमेंट्स के लिए पहुंचता है।

## अवधारणा

**Bag of Words (BoW)**प्रत्येक दस्तावेज़ के लिए, गणना करें कि प्रत्येक शब्दावली शब्द कितनी बार दिखाई देता है। वेक्टर लंबाई शब्दावली का आकार है। स्थिति `i`शब्द की गिनती है `i`. .

**TF-IDF**एक शब्द जो हर दस्तावेज़ में दिखाई देता है, सूचनात्मक नहीं है, इसलिए इसे कम करें। एक शब्द जो पूरे कॉर्पस में दुर्लभ है लेकिन एक ही दस्तावेज़ में अक्सर होता है, वह संकेत है, इसलिए इसे बढ़ाएं।

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

कहाँ`TF`दस्तावेज़ में शब्द आवृत्ति है, `df`दस्तावेज़ आवृत्ति (शब्द में कितने डॉक्स हैं),`N`यह कुल दस्तावेज है।`log`हर जगह मौजूद शब्दों के लिए वजन को सीमित रखता है।

मुख्य गुणः दोनों व्याख्या योग्य अक्षों के साथ दुर्लभ वेक्टर उत्पन्न करते हैं। आप प्रशिक्षित वर्गीकरणकर्ता के वजन को देख सकते हैं और पढ़ सकते हैं कि कौन से शब्द प्रत्येक वर्ग की ओर दस्तावेज़ को धक्का देते हैं। आप 768 आयामी BERT एम्बेडिंग के साथ ऐसा नहीं कर सकते हैं।

```figure
bow-tfidf
```

## इसे बनाओ

### चरण 1: शब्दावली का निर्माण करें

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

इनपुटः टोकन दस्तावेजों की सूची (किसी भी शब्द स्तर टोकन करने वाला करेगा; `code/main.py`इस पाठ में सरल लघु अक्षर संस्करण का उपयोग किया जाता है।`{word: index}`निर्दिष्ट करें. स्थिर सम्मिलन क्रम का अर्थ है शब्द सूचकांक 0 पहला शब्द है जो पहले दस्तावेज़ में देखा जाता है। सम्मेलन भिन्न होता है; scikit-learn क्रमशः वर्णमाला में क्रमबद्ध होता है।

### चरण 2: शब्दों का बैग

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

पंक्तियाँ दस्तावेज हैं, स्तंभ शब्दावली सूचकांक हैं।`[i][j]`है "कई बार शब्द `j`दस्तावेज़ में दिखाई देता है `i`. " डॉ 1 ने कहा है `cat`दो बार क्योंकि यह किया है. डॉ 0 है`ran`शून्य बार क्योंकि यह नहीं किया।

### चरण 3: शब्द आवृत्ति और दस्तावेज आवृत्ति

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

दो चिकनाई युक्तियाँ नाम देने लायक हैं।`(n+1)/(d+1)`से बचता है`log(x/0)`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`+1`यह सुनिश्चित करता है कि प्रत्येक दस्तावेज़ में एक शब्द में अभी भी आईडीएफ 1 (न 0) है, जो scikit-learn के डिफ़ॉल्ट के अनुरूप है। अन्य कार्यान्वयन कच्चे `log(N/df)`दोनों काम करते हैं; चिकनी संस्करण अधिक अनुकूल है।

### चरण 4: TF-IDF

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

तीन दस्तावेज, पांच शब्दावली शब्द (`the`,`cat`,`sat`,`dog`,`ran` ).`the`सभी तीन में दिखाई देता है, तो इसके IDF कम है। `dog`एक में दिखाई देता है, इसलिए इसकी आईडीएफ उच्च है। हजारों शब्दों की एक वास्तविक शब्दावली के साथ, ये वेक्टर दुर्लभ हैं (अधिकतर प्रविष्टियां शून्य हैं) । यहां तक कि इस खिलौने में, भेदभावपूर्ण शब्द पॉप।

### चरण 5: L2-सूची को सामान्य बनाएं

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

सामान्यीकरण के बिना, एक लंबा दस्तावेज़ एक बड़ा वेक्टर प्राप्त करता है और समानता स्कोर पर हावी होता है। L2 सामान्यीकरण प्रत्येक दस्तावेज़ को इकाई हाइपरस्फीयर पर रखता है। पंक्तियों के बीच कॉसिन समानता अब सिर्फ एक बिंदु उत्पाद है।

## इसका प्रयोग करें

स्किट-लर्न उत्पादन संस्करण जहाजों।

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

`CountVectorizer`एक कॉल में टोकन, शब्दावली और बोड करता है। `TfidfVectorizer`आईडीएफ वजन और एल 2 सामान्यीकरण जोड़ता है। दोनों ही दुर्लभ मैट्रिक्स लौटाते हैं। 100k दस्तावेजों के लिए, घने संस्करण स्मृति में फिट नहीं होता है; वर्गीकरणकर्ता घने की मांग तक घने रहते हैं।

बटन जो सब कुछ बदलते हैंः

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### जब TF-IDF अभी भी जीतता है (2026 तक)

- स्पैम का पता लगाना, विषय लेबलिंग, लॉग विसंगति चिह्नित करना शब्द उपस्थिति ही मायने रखती है, अर्थिक बारीकियां नहीं।
- कम डेटा व्यवस्था (सैकड़ों लेबल वाले उदाहरण) TF-IDF प्लस लॉजिस्टिक रेग्रिशन में पूर्व-प्रशिक्षण लागत नहीं है।
- जहां भी लटेंसी मायने रखती है, TF-IDF प्लस एक रैखिक मॉडल माइक्रोसेकंड में जवाब देता है। ट्रांसफार्मर के माध्यम से एक दस्तावेज़ एम्बेड करने में 10-100ms लगते हैं।
- सिस्टम जो अपने भविष्यवाणियों की व्याख्या करना चाहिए वर्गीकरण के गुणांक की जांच करें शीर्ष सकारात्मक शब्द कारण हैं।

### जब TF-IDF विफल हो जाता है

अर्थशास्त्र दृष्टिहीनता की विफलता. इन दो दस्तावेजों पर विचार करेंः

- "फिल्म बिल्कुल अच्छा नहीं था। "
- "फिल्म उत्कृष्ट था।

एक नकारात्मक समीक्षा है. एक सकारात्मक है. उनके TF-IDF ओवरलैप ठीक है.`{the, movie, was}`एक शब्द के बैग वर्गीकरण करने वाले को याद रखना होगा कि शब्द`not`निकट`good`यह पर्याप्त डेटा पर यह सीख सकता है, लेकिन कभी भी एक मॉडल के रूप में gracefully कि वाक्यविन्यास समझता है.

IMDb समीक्षाओं पर प्रशिक्षित एक BoW मॉडल को कोई पता नहीं है कि क्या करना है `Zoomer-approved`यदि यह टोकन प्रशिक्षण में कभी दिखाई नहीं दिया। उपशब्द एम्बेडमेंट (पाठ 04) इस को संभालते हैं। TF-IDF नहीं कर सकता।

### हाइब्रिडः TF-IDF भारित एम्बेड

मध्य-डेटा वर्गीकरण के लिए 2026 व्यावहारिक डिफ़ॉल्टः शब्द एम्बेडेड पर ध्यान के रूप में TF-IDF वजन का उपयोग करें।

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

आप एम्बेडमेंट से अर्थ क्षमता प्राप्त करते हैं, और TF-IDF से दुर्लभ शब्द जोर देते हैं। वर्गीकरणकर्ता pooled vector पर ट्रेन करता है। यह अपने आप में या तो भावना, विषय और इरादे वर्गीकरण के लिए बेहतर प्रदर्शन करता है लगभग 50k लेबल उदाहरणों के नीचे।

## इसे भेजें

`outputs/prompt-vectorization-picker.md`:

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

## व्यायाम

1. **Easy.**कार्यान्वयन`cosine_similarity(doc_vec_a, doc_vec_b)`L2 मानकीकृत TF-IDF आउटपुट पर जाँच करें कि समान दस्तावेजों को 1.0 और असंगत-वाक्य भंडार दस्तावेजों को 0.0 स्कोर मिलता है।
2. **Medium.**जोड़ें `n-gram``bag_of_words`. पैरामीटर `n`उत्पन्न करता है गणना से अधिक `n`- ग्राम. यह परीक्षण करें.`n=2`पर`["the", "cat", "sat"]`के लिए बिग्राम गणना उत्पन्न करता है `["the cat", "cat sat"]`. .
3. **Hard.**ग्लोवे 100 डी वेक्टरों का उपयोग करके ऊपर TF-IDF-weighted-embedded hybrid का निर्माण करें (एक बार डाउनलोड करें, कैश करें) । 20 न्यूजग्रुप डेटासेट पर साधारण TF-IDF और साधारण औसत-पूल एम्बेडेड के साथ वर्गीकरण सटीकता की तुलना करें। रिपोर्ट जो कहाँ जीतता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## आगे पढ़ना

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) कैनोनिक एपीआई संदर्भ, प्लस प्रत्येक बटन पर नोट्स।
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) कागज जिसने TF-IDF को एक दशक के लिए डिफ़ॉल्ट बनाया।
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026 में यह निर्णय लें कि पुरानी विधि कब और क्यों जीतती है।
