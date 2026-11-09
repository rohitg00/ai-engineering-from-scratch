# विषय मॉडलिंग  एलडीए और बीईआरटॉपिक

> LDA: दस्तावेज विषयों का मिश्रण हैं, विषय शब्दों पर वितरण हैं। BERTopic: दस्तावेज क्लस्टर एम्बेडिंग स्पेस में, क्लस्टर विषय हैं। एक ही लक्ष्य, अलग-अलग विघटन।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## समस्या

आपके पास 10,000 ग्राहक सहायता टिकट, 50,000 समाचार लेख, या 200,000 ट्वीट हैं। आपको यह जानने की जरूरत है कि संग्रह क्या है, इसे पढ़ने के बिना। आपके पास श्रेणियां नहीं हैं। आप यह भी नहीं जानते कि कितनी श्रेणियां मौजूद हैं।

विषय मॉडलिंग के बिना इसका जवाब देता है. इसे एक corpus दें, एक छोटे से सुसंगत विषयों का एक सेट वापस प्राप्त करें और, प्रत्येक दस्तावेज़ के लिए, उन विषयों पर एक वितरण।

दो एल्गोरिथम परिवार हावी हैं। LDA (2003) प्रत्येक दस्तावेज़ को लटेंट विषयों के मिश्रण के रूप में और प्रत्येक विषय को शब्दों पर वितरण के रूप में व्यवहार करता है। इन्फेरेंस बेयसियन है। यह अभी भी उत्पादन में जहाज करता है जहां आपको मिश्रित सदस्यता विषय असाइनमेंट और स्पष्ट शब्द-स्तर की संभावना वितरण की आवश्यकता होती है।

BERTopic (2020) BERT के साथ दस्तावेजों को एन्कोड करता है, UMAP के साथ आयामता को कम करता है, HDBSCAN के साथ क्लस्टर करता है, और वर्ग-आधारित TF-IDF के माध्यम से विषय शब्दों को निकालता है। यह छोटे पाठ, सोशल मीडिया और किसी भी चीज़ पर जीतता है जहां शब्द ओवरलैप से अधिक अर्थिक समानता मायने रखती है। एक दस्तावेज़ एक विषय प्राप्त करता है, जो लंबे रूप की सामग्री के लिए एक सीमा है।

यह सबक दोनों के लिए अंतर्ज्ञान और नामों का निर्माण करता है कि किसी दिए गए कॉर्पस के लिए कौन सा चुनना है।

## अवधारणा

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**प्रत्येक विषय शब्दों पर एक वितरण है। प्रत्येक दस्तावेज़ विषयों का मिश्रण है। एक दस्तावेज़ में एक शब्द उत्पन्न करने के लिए, दस्तावेज़ के मिश्रण से एक विषय का नमूना लें, फिर उस विषय के वितरण से एक शब्द का नमूना लें। इन्फेरेंस इसे उलट देता हैः दिए गए अवलोकन किए गए शब्दों को देखते हुए, प्रत्येक दस्तावेज़ पर विषय वितरण और विषय पर शब्द वितरण का अनुमान लगाएं। गिर गया गिब्स नमूना या वैरिएशनल बेयज़ गणित करता है।

कुंजी एलडीए आउटपुटः

- `doc_topic`: मैट्रिक्स `(n_docs, n_topics)`, प्रत्येक पंक्ति का योग 1 (दस्तावेज के विषय मिश्रण) है।
- `topic_word`: मैट्रिक्स `(n_topics, vocab_size)`, प्रत्येक पंक्ति का योग 1 (विषय के शब्द वितरण) है।

**BERTopic pipeline.**

1. प्रत्येक दस्तावेज़ को वाक्य ट्रांसफार्मर से एन्कोड करें (जैसे, `all-MiniLM-L6-v2`) 384 आयामी वेक्टर।
2. UMAP के साथ आयाम को ~ 5 आयाम तक कम करें। BERT एम्बेडेड क्लस्टरिंग के लिए बहुत अधिक गहरे हैं।
3. HDBSCAN के साथ क्लस्टर। घनत्व आधारित, चर आकार के क्लस्टर और एक "बाह्य" लेबल का उत्पादन करता है।
4. प्रत्येक क्लस्टर के लिए, शीर्ष शब्दों को निकालने के लिए क्लस्टर के दस्तावेजों पर वर्ग आधारित TF-IDF की गणना करें।

आउटपुट प्रति दस्तावेज़ एक विषय है (और -1 आउटलियर लेबल) । वैकल्पिक रूप से, एचडीबीएससीएएन के संभावना वेक्टर के माध्यम से एक नरम सदस्यता।

```figure
topic-drift
```

## इसे बनाओ

### चरण 1: Sikit-learn के माध्यम से LDA

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

नोटः स्टॉपवर्ड हटाए गए, min_df और max_df दुर्लभ और सर्वव्यापी शब्दों को फ़िल्टर करते हैं, CountVectorizer (TfidfVectorizer नहीं) क्योंकि LDA कच्चे गिनती की उम्मीद करता है।

### चरण 2: BERTopic (उत्पादन)

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

फ़िल्टर चालू है `Topic != -1`BERTopic के आउटलीयर बाल्ट को छोड़ देता है (दस्तावेज़ HDBSCAN क्लस्टर नहीं कर सका) । `min_topic_size`HDBSCAN के न्यूनतम क्लस्टर आकार को नियंत्रित करता है; BERTopic के पुस्तकालय डिफ़ॉल्ट 10 है। इस उदाहरण में यह पाठ के पैमाने के लिए स्पष्ट रूप से 15 पर सेट किया गया है। 10,000 से अधिक दस्तावेजों के लिए, 50 या 100 तक बढ़ाएं।

### चरण 3: मूल्यांकन

दोनों ही तरीकों से विषय के शब्द उत्पन्न होते हैं। प्रश्न यह है कि क्या ये शब्द एक दूसरे के साथ मेल खाते हैं।

- **Topic coherence (c_v).**स्लाइडिंग-विंडो संदर्भों पर शीर्ष शब्द जोड़े के NPMI (सामान्य बिंदु के अनुसार पारस्परिक जानकारी) को जोड़ता है, विषय वेक्टरों में स्कोर को एकत्र करता है, और कॉसिन समानता के माध्यम से उन वेक्टरों की तुलना करता है। उच्च बेहतर है। उपयोग `gensim.models.CoherenceModel`के साथ`coherence="c_v"`. .
- **Topic diversity.**सभी विषयों के शीर्ष शब्दों में अद्वितीय शब्दों का अंश। उच्च बेहतर है (विषय ओवरलैप नहीं करते हैं) ।
- **Qualitative inspection.**क्या वे किसी वास्तविक चीज़ का नाम देते हैं? मानव न्याय अभी भी रक्षा की आखिरी रेखा है।

## कौन सी चुनना है

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

सबसे बड़ा व्यावहारिक विचार दस्तावेज़ लंबाई है। BERT एम्बेडेड ट्रिंकट; LDA किसी भी लंबाई पर काम करता है। एम्बेडेड मॉडल के संदर्भ से अधिक लंबे दस्तावेजों के लिए, या तो टुकड़ा + संकलित या LDA का उपयोग करें।

## इसका प्रयोग करें

2026 स्टैकः

- **BERTopic.**संक्षिप्त पाठ और अर्थशास्त्र के लिए कोई भी मायने रखता है।
- **`gensim.models.LdaModel`.**उत्पादन के लिए क्लासिक एलडीए, परिपक्व, युद्ध-परीक्षण.
- **`sklearn.decomposition.LatentDirichletAllocation`.**प्रयोगों के लिए आसान एलडीए।
- **NMF.**गैर-नकारात्मक मैट्रिक्स फैक्टरिज़ेशन. एलडीए के लिए त्वरित विकल्प, लघु पाठ पर तुलनात्मक गुणवत्ता।
- **Top2Vec.**BERTopic के समान डिजाइन। छोटा समुदाय लेकिन कुछ बेंचमार्क पर अच्छा।
- **FASTopic.**बहुत बड़े कॉर्पो पर BERTopic से अधिक नया, तेज़।
- **LLM-based labeling.**किसी भी क्लस्टरिंग चलाएं, फिर प्रत्येक क्लस्टर का नाम देने के लिए एक मॉडल को पूछें।

## इसे भेजें

`outputs/skill-topic-picker.md`:

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

## व्यायाम

1. **Easy.**20 न्यूजग्रुप डेटासेट पर 5 विषयों के साथ फिट एलडीए। प्रत्येक विषय पर शीर्ष 10 शब्द प्रिंट करें। प्रत्येक विषय को हाथ से लेबल करें। क्या एल्गोरिथम ने वास्तविक श्रेणियां पाई हैं?
2. **Medium.**BERTopic को एक ही 20 न्यूजग्रुप उपसमूह पर फिट करें। खोजे गए विषयों की संख्या, शीर्ष शब्दों और गुणात्मक सुसंगतता की तुलना LDA के साथ करें। वास्तविक श्रेणियों में कौन सा अधिक साफ रूप से सतह पर आता है?
3. **Hard.**अपने कॉर्पस पर LDA और BERTopic दोनों के लिए c_v सुसंगतता की गणना करें। 5, 10, 20, 50 विषयों के साथ प्रत्येक को चलाएं। प्लॉट सुसंगतता बनाम विषय संख्या। विषय संख्याओं के बीच कौन सी विधि अधिक स्थिर है, इसकी रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## आगे पढ़ना

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) LDA पेपर।
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) BERTopic पेपर।
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) कागज जो सी_वी और दोस्तों को पेश किया।
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) उत्पादन संदर्भ। उत्कृष्ट उदाहरण।
