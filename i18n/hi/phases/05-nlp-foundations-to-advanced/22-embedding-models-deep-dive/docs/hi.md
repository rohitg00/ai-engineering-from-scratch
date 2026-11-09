# मॉडल्स को एम्बेड करना  2026 गहरी गोताखोरी

> Word2Vec ने आपको एक शब्द के लिए एक वेक्टर दिया। आधुनिक एम्बेडिंग मॉडल आपको एक मार्ग के लिए एक वेक्टर देते हैं, क्रॉस-लिंग्वेज, दुर्लभ, घने और बहु-वेक्टर दृश्यों के साथ, आपके सूचकांक के अनुरूप आकार। गलत चुनें और आपका RAG गलत चीज प्राप्त करता है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## समस्या

आपका RAG प्रणाली गलत मार्ग को 40% समय में प्राप्त करता है. दोषी शायद ही कभी वेक्टर डेटाबेस या प्रॉम्प्ट है. यह एम्बेडिंग मॉडल है.

2026 में एक एम्बेडिंग का चयन करने का मतलब पांच अक्षों पर चुनना हैः

1. **Dense vs sparse vs multi-vector.**एक वेक्टर प्रति passage, या एक प्रति टोकन, या शब्दों का एक दुर्लभ वजन बैग.
2. **Language coverage.**एक भाषाई अंग्रेजी मॉडल अभी भी केवल अंग्रेजी कार्यों पर जीतते हैं। बहुभाषी मॉडल तब जीतते हैं जब कॉर्पो मिश्रित होते हैं।
3. **Context length.**512 टोकन बनाम 8,192 बनाम 32,768  और वास्तविक प्रभावी क्षमता अक्सर विज्ञापन अधिकतम का 60-70% होती है।
4. **Dimension budget.**3,072 पूर्ण परिशुद्धता पर तैरता है = 12 KB प्रति वेक्टर। 100M वेक्टर पर, भंडारण $ 1,300 / महीने है। मैट्रियोशका ट्रंकशन इसे 4x काटता है।
5. **Open vs hosted.**ओपन-वेट का मतलब है कि आप स्टैक और डेटा को नियंत्रित करते हैं. होस्ट किया गया का मतलब है कि आप हमेशा नवीनतम के लिए नियंत्रण का आदान-प्रदान करते हैं।

इस पाठ में बाजी के नाम दिए गए हैं ताकि आप सबूतों पर ध्यान दे सकें, पिछले तिमाही में जो भी लोकप्रिय था, उस पर नहीं।

## अवधारणा

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**एक वेक्टर प्रति मार्ग (आमतौर पर 384-3,072 आयाम) । कॉसिन समानता सेमंटिक निकटता के आधार पर मार्गों को रैंक करती है।`text-embedding-3-large`, BGE-M3 घने मोड, यात्रा-3। डिफ़ॉल्ट विकल्प।

**Sparse embeddings.**SPLADE शैली. एक ट्रांसफार्मर प्रत्येक शब्दकोश टोकन के लिए एक वजन का अनुमान लगाता है, फिर उनमें से अधिकांश को शून्य करता है। परिणाम आकार का एक दुर्लभ वेक्टर है। शब्दकोश में मिलान (जैसे BM25) को कैप्चर करता है, लेकिन सीखने वाले शब्द वजन के साथ। कुंजीशब्द भारी प्रश्नों पर मजबूत।

**Multi-vector (late interaction).**ColBERTv2, Jina-ColBERT. प्रति टोकन एक वेक्टर. MaxSim के साथ स्कोर करनाः प्रत्येक क्वेरी टोकन के लिए, सबसे समान दस्तावेज़ टोकन खोजें, स्कोर को योग करें. भंडारण और स्कोर करने के लिए अधिक महंगा है, लेकिन लंबे क्वेरी और डोमेन-विशिष्ट कॉर्पो पर जीतता है।

**BGE-M3: all three at once.**एकल मॉडल एक साथ घने, दुर्लभ और बहु-वेक्टर प्रतिनिधित्व करता है। प्रत्येक को स्वतंत्र रूप से क्वेरी किया जा सकता है; स्कोर वजन योग के माध्यम से फ्यूज। जब आप एक चेकपॉइंट से लचीलापन चाहते हैं तो 2026 डिफ़ॉल्ट।

**Matryoshka Representation Learning.**वेक्टर के पहले N आयामों को एक उपयोगी स्टैंडअलोन एम्बेडिंग के रूप में प्रशिक्षित किया गया है। 1,536-dim वेक्टर को 256 dim में काटें और 6x भंडारण बचत के लिए ~ 1% सटीकता का भुगतान करें। OpenAI पाठ-3, कोहरे 4, यात्रा-4, जिना v5, मिथुन एम्बेडिंग 2, नोमिक v1.5+ द्वारा समर्थित।

### एमटीईबी की रैंकिंग बोर्ड आंशिक कहानी बताती है

मैसिव टेक्स्ट एम्बेडिंग बेंचमार्क  लॉन्च पर 8 कार्य प्रकारों में 56 कार्य (2022), MTEB v2 में 100+ कार्य तक विस्तारित। 2026 की शुरुआत में, Gemini Embedding 2 शीर्ष रिकवरी (67.71 MTEB-R) को बढ़ाता है। सहबद्ध एम्बेडिंग v4 सामान्य (65.2 MTEB) को ले जाता है। BGE-M3 ओपन-वेट बहुभाषी (63.0) को ले जाता है। रैंकिंग बोर्ड आवश्यक है लेकिन पर्याप्त नहीं  हमेशा अपने डोमेन पर बेंचमार्क करें।

### तीन स्तरीय पैटर्न

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

अधिकांश उत्पादन ढेरों में तीनों का उपयोग किया जाता है।

```figure
gx-matryoshka
```

## इसे बनाओ

### चरण 1: बेसलाइन  सैंटेंस-BERT के साथ घने एम्बेडेड

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

`normalize_embeddings=True`हमेशा सेट करें।

### चरण 2: मैट्रियोशका काटना

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

क्रंक करने के बाद पुनः सामान्यीकरण करें। Nomic v1.5, OpenAI पाठ-3, और Voyage-4 को प्रशिक्षित किया गया है ताकि यह पहले कुछ स्तरों के लिए नुकसान रहित हो। गैर-मैट्रियोश्का मॉडल (मूल वाक्य-BERT) क्रंक होने पर तेजी से गिरावट आती है।

### चरण 3: BGE-M3 बहुक्रियाशीलता

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

तीन सूचकांक, एक निष्कर्ष कॉल.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

अपने डोमेन पर वजन समायोजित करें।

### चरण 4: कस्टम कार्य पर MTEB मूल्यांकन

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

अपने उम्मीदवार मॉडल को *प्रतिनिधात्मक* उपसमूह पर चलाएं। केवल रैंक बोर्ड पर भरोसा न करें  आपका डोमेन मायने रखता है।

### चरण 5: हाथ से रोल किया गया कॉसीन खरोंच से

देखो`code/main.py`. औसत हैशिंग ट्रिक एम्बेडमेंट (stdlib-केवल) । ट्रांसफार्मर एम्बेडमेंट के साथ प्रतिस्पर्धी नहीं है, लेकिन आकार दिखाता हैः टोकन → वेक्टर → सामान्यीकरण → डॉट उत्पाद।

## फंदे

- **Same model for query and doc.**कुछ मॉडल (वॉएज, जिना-कोलबर्ट) असंबद्ध एन्कोडिंग का उपयोग करते हैं  क्वेरी और दस्तावेज़ विभिन्न पथों से गुजरते हैं। हमेशा मॉडल कार्ड की जांच करें।
- **Missing prefix.** `bge-*`मॉडल की आवश्यकता है`"Represent this sentence for searching relevant passages: "`3-5 अंक याद करने के अंतर अगर आप भूल जाते हैं.
- **Over-trimming Matryoshka.**1,536 → 256 आमतौर पर सुरक्षित है. 1,536 → 64 नहीं है. अपने मूल्यांकन सेट पर मान्य करें.
- **Context truncation.**अधिकांश मॉडल अपनी अधिकतम लंबाई पर इनपुट को चुपचाप काटते हैं। लंबे डॉक्स को चकमा देने की आवश्यकता होती है (पाठ 23 देखें) ।
- **Ignoring latency tail.**MTEB स्कोर p99 विलंबता छिपाने. एक 600M मॉडल 335M मॉडल से 2 अंक से अधिक हो सकता है लेकिन प्रति क्वेरी 3 गुना अधिक लागत.

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

2026 पैटर्नः BGE-M3 या पाठ-3-बड़े से शुरू करें, MTEB के साथ अपने डोमेन पर मूल्यांकन करें, यदि डोमेन-विशिष्ट मॉडल 3 अंक से अधिक जीतता है तो स्वैप करें।

## इसे भेजें

`outputs/skill-embedding-picker.md`:

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

## व्यायाम

1. **Easy.** के साथ 100 वाक्य एन्कोड`bge-small-en-v1.5`पूर्ण dim (384), फिर Matryoshka 128 पर। 10 प्रश्नों पर एमआरआर ड्रॉप मापें।
2. **Medium.**अपने डोमेन से 500 मार्गों पर BGE-M3 घने, दुर्लभ और कोल्बर्ट की तुलना करें। याद@10 पर कौन जीता? क्या आरआरएफ संलयन सबसे अच्छा एकल मोड से बेहतर है?
3. **Hard.**अपने शीर्ष 2 डोमेन कार्यों में तीन उम्मीदवार मॉडल पर MTEB चलाएं। MTEB स्कोर, 100 क्वेरी बैच पर p99 विलंबता, और $ 1M क्वेरी रिपोर्ट करें। Pareto-उत्तम एक चुनें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## आगे पढ़ना

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) द्वि-संकेतक कागज।
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) रैंकिंग बोर्ड पेपर।
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) एकीकृत तीन मोड मॉडल।
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) आयाम-शिखर प्रशिक्षण उद्देश्य।
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) उत्पादन में देर से बातचीत।
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) लाइव रैंकिंग।
