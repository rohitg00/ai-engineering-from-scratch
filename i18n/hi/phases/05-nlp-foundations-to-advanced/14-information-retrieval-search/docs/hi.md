# जानकारी प्राप्त करना और खोजना

> BM25 सटीक है लेकिन नाजुक है. घने एक विस्तृत जाल फेंकता है लेकिन कीवर्ड याद है. हाइब्रिड 2026 डिफ़ॉल्ट है. बाकी सब कुछ ट्यूनिंग है.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## समस्या

उपयोगकर्ता टाइप करता है "क्या होता है अगर कोई पैसा पाने के लिए झूठ बोलता है" और यह उम्मीद करता है कि वह उस कानून को ढूंढता है जो वास्तव में इसे कवर करता हैः "धारा 420 आईपीसी।" एक कीवर्ड खोज इसे पूरी तरह से याद करती है (कोई साझा शब्दावली नहीं) । एक अर्थपूर्ण खोज इसे याद करती है यदि एम्बेडिंग कानूनी पाठ पर प्रशिक्षित नहीं किए गए थे। वास्तविक खोज दोनों को संभालनी है।

आईआर प्रत्येक आरएजी प्रणाली, प्रत्येक खोज पट्टी, प्रत्येक डॉक्स साइट की धुंधली खोज के तहत पाइपलाइन है। उत्पादन में काम करने वाला 2026 वास्तुकला एक एकल विधि नहीं है। यह पूरक तरीकों की एक श्रृंखला है, प्रत्येक पिछले एक की विफलताओं को पकड़ता है।

यह सबक हर टुकड़े और नाम का निर्माण करता है जो हर पकड़ में विफल रहता है।

## अवधारणा

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

चार परतें, जो आप की जरूरत है चुनें.

1. **Sparse retrieval (BM25).**तेजी से, सटीक मैचों पर सटीक, अर्थशास्त्र पर भयानक एक उल्टा सूचकांक पर चलाएं. लाखों दस्तावेजों पर प्रति क्वेरी 10ms से नीचे. आपको विधान संदर्भ, उत्पाद कोड, त्रुटि संदेश, नामित संस्थाओं सही मिलता है।
2. **Dense retrieval.**वेक्टर में क्वेरी और दस्तावेज एन्कोड करें. निकटतम पड़ोसी खोज. पैराफ्रेसेस और अर्थिक समानता को कैप्चर करता है. एक वर्ण द्वारा भिन्न सटीक कीवर्ड मैचों को याद करता है। FAISS या वेक्टर DB के साथ प्रति क्वेरी 50-200ms।
3. **Fusion.**रैंक सूची को दुर्लभ और घने से मिलाएं। पारस्परिक रैंक फ्यूजन (आरआरएफ) आसान डिफ़ॉल्ट है क्योंकि यह कच्चे स्कोर (जो विभिन्न पैमाने में रहते हैं) को अनदेखा करता है और केवल रैंक पदों का उपयोग करता है। वजन फ्यूजन एक विकल्प है जब आप जानते हैं कि एक सिग्नल आपके डोमेन के लिए हावी है।
4. **Cross-encoder rerank.**फ्यूजन से शीर्ष-30 ले लो। क्रॉस-एन्कोडर चलाएं (एक साथ क्वेरी + दस्तावेज़, प्रत्येक जोड़ी को स्कोर करना) । शीर्ष-5 रखें। क्रॉस-एन्कोडर प्रति जोड़ी द्वि-एन्कोडर की तुलना में धीमे हैं लेकिन बहुत अधिक सटीक हैं। आप केवल शीर्ष-30 पर उन्हें चलाकर amortize करते हैं।

तीन-तरफा रिट्रीवल (बीएम25 + घने + सीखे हुए स्पेस जैसे SPLADE) 2026 में दो-तरफा बेंचमार्क से बेहतर है लेकिन सीखे हुए स्पेस सूचकांक के लिए बुनियादी ढांचे की आवश्यकता है। अधिकांश टीमों के लिए, दो-तरफा प्लस क्रॉस-एन्कोडर री-रैंक सबसे अच्छा स्थान है।

```figure
gx-hybrid-retrieval
```

## इसे बनाओ

### चरण 1: BM25 खरोंच से

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

दो मापदंडों को जानना लायक है।`k1=1.5`टर्म-फ्रीक्वेंसी संतृप्ति को नियंत्रित करता है; उच्च का अर्थ है टर्म पुनरावृत्ति पर अधिक वजन। `b=0.75`0 दस्तावेज़ की लंबाई को अनदेखा करता है, 1 पूरी तरह से सामान्य करता है। डिफ़ॉल्ट रॉबर्टसन के मूल पेपर से सिफारिशें हैं और शायद ही कभी ट्यूनिंग की आवश्यकता होती है।

### चरण 2: एक द्वि-संकेतक के साथ घने पुनर्प्राप्ति

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

L2 सामान्यीकरण एम्बेडिंग तो बिंदु उत्पाद cosine के बराबर है। `all-MiniLM-L6-v2`384dim, तेज, और अधिकांश अंग्रेजी निकालने के लिए पर्याप्त मजबूत है। बहुभाषी काम के लिए, उपयोग `paraphrase-multilingual-MiniLM-L12-v2`. उच्चतम सटीकता के लिए,`bge-large-en-v1.5`या `e5-large-v2`. .

### चरण 3: पारस्परिक रैंक विलय

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

`k=60`निरंतर मूल आरआरएफ पेपर से आता है। उच्च `k`रैंक अंतर का योगदान कम करता है; कम `k`60 प्रकाशित डिफ़ॉल्ट है और शायद ही कभी ट्यूनिंग की जरूरत है।

### चरण 4: हाइब्रिड खोज + पुनः रैंक

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

तीन चरणों का निर्माण किया गया। BM25 लेक्सिकल मैचों का पता लगाता है। घने अर्थपूर्ण मैचों का पता लगाता है। RRF स्कोर कैलिब्रेशन की आवश्यकता के बिना दोनों रैंकिंग को मिलाता है। क्रॉस-एन्कोडर क्वेरी-डॉकमेंट जोड़े के साथ शीर्ष-30 को फिर से स्कोर करता है, जो दु-एन्कोडर को याद किए गए बारीक-बीट प्रासंगिकता को कैप्चर करता है। शीर्ष-5 रखें।

### चरण 5: मूल्यांकन

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

विशेष रूप से RAG के लिए, **Recall@k**आपके पाठक जवाब नहीं दे सकते हैं अगर सही passage नहीं है प्राप्त सेट में.

डिबगिंग टिपः असफल क्वेरी के लिए, दुर्लभ और घने रैंकिंग में अंतर करें। यदि एक सही दस्तावेज़ पाता है और दूसरा नहीं करता है, तो आपके पास एक शब्दावली असंगतता (फिक्सः गायब आधा जोड़ें) या अर्थहीन अस्पष्टता (फिक्सः बेहतर एम्बेडिंग या एक रीरेंकर) है।

## इसका प्रयोग करें

2026 स्टैकः

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

आप जो भी चुनते हैं, मूल्यांकन के लिए बजट। एंड-टू-एंड आरएजी सटीकता का बेंचमार्क करने से पहले बेंचमार्क रिकवरी को याद रखें। एक पाठक यह नहीं तय कर सकता कि रिट्रीवर ने क्या चूक गया।

### 2026 उत्पादन आरएजी से कठिन सीखे गए पाठ

- **80% of RAG failures trace to ingestion and chunking, not the model.**टीमों ने LLM के आदान-प्रदान और सुसंगत संकेतों के लिए सप्ताह बिताए जबकि पुनर्प्राप्ति हर तीसरे क्वेरी में चुपचाप गलत संदर्भ लौटाता है। पहले चश्मा को ठीक करें।
- **Chunking strategy matters more than chunk size.**फिक्स्ड साइज स्प्लिट टेबल, कोड और नेस्टेड हेडर तोड़ते हैं। वाक्य-जागरूक डिफ़ॉल्ट है; अर्थशास्त्र या एलएलएम-आधारित चंकिंग तकनीकी दस्तावेजों और उत्पाद पुस्तिकाओं के लिए भुगतान करता है।
- **Parent-doc pattern.**सटीकता के लिए छोटे "बच्चे" टुकड़े निकालें। जब एक ही माता-पिता अनुभाग से कई बच्चे दिखाई देते हैं, तो संदर्भ को बनाए रखने के लिए माता-पिता ब्लॉक में स्विच करें। यह लगातार बिना पुनर्व्यवस्थापन के उत्तर गुणवत्ता को बढ़ाता है।
- **k_rerank=3 is usually optimal.**यदि k=8 आपके लिए k=3 से बेहतर है, तो रीरेंकर खराब प्रदर्शन कर रहा है।
- **HyDE / query expansion.**प्रश्न से एक परिकल्पनात्मक उत्तर उत्पन्न करें, इसे एम्बेड करें, प्राप्त करें. छोटे प्रश्नों और लंबे दस्तावेजों के बीच वाक्यांश अंतर को पुल करता है. बिना प्रशिक्षण के मुफ्त सटीकता लिफ्ट।
- **Context budget under 8K tokens.**उस सीमा पर लगातार हिट का मतलब है कि पुनर्व्यवस्थापक की सीमा बहुत ढीली है।
- **Version everything.**प्रॉम्प्ट्स, चश्मांकन नियम, एम्बेडिंग मॉडल, रीरेंकर। कोई भी बहाव चुपचाप उत्तर की गुणवत्ता को तोड़ता है। आईसी निष्ठा, संदर्भ सटीकता और उत्तर रहित प्रश्न दर पर प्रवेश करता है।
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**2026 में बेंचमार्क पर, विशेष रूप से सही संज्ञाओं को अर्थशास्त्र के साथ मिलाकर क्वेरी के लिए। जब बुनियादी ढांचे SPLADE सूचकांक का समर्थन करता है तो इसे भेजें।

2026 के उद्योग माप के अनुसार सही पुनर्प्राप्ति डिजाइन भ्रामकता को 70-90% तक कम करता है। अधिकांश आरएजी प्रदर्शन लाभ बेहतर पुनर्प्राप्ति से आते हैं, न कि मॉडल सूक्ष्म समायोजन से।

## इसे भेजें

`outputs/skill-retrieval-picker.md`:

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

## व्यायाम

1. **Easy.**कार्यान्वयन`hybrid_search`500 दस्तावेजों के एक कॉर्पस पर ऊपर। परीक्षण 20 प्रश्नों। केवल BM25, घने केवल और हाइब्रिड के बीच 5 पर याद करने की तुलना करें।
2. **Medium.**एमआरआर गणना जोड़ें. एक ज्ञात सही दस्तावेज़ के साथ प्रत्येक परीक्षण क्वेरी के लिए, BM25, घने और हाइब्रिड रैंकिंग में सही दस्तावेज़ की रैंक खोजें। प्रत्येक के लिए एमआरआर रिपोर्ट करें।
3. **Hard.**MultipleNegativesRankingLoss (सन्देश ट्रांसफार्मर) का उपयोग करके अपने डोमेन पर एक घने एन्कोडर को ठीक से ट्यून करें। 500 क्वेरी-दस्तावेज जोड़े से एक प्रशिक्षण सेट बनाएं। पूर्व और बाद के ठीक-ट्यून को याद करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## आगे पढ़ना

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) अंतिम BM25 उपचार।
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) डीपीआर, कैनोनिक द्वि-संकेतक।
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) सीखे-अवकाश रिट्रीवर जो घने के साथ अंतर को बंद करता है।
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) आरआरएफ पेपर।
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) देर से बातचीत के बाद प्राप्ति।
