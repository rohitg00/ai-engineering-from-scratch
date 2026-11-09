# उन्नत आरएजी (चुनकना, पुनः रैंकिंग, हाइब्रिड खोज)

> मूल RAG शीर्ष-के सबसे समान टुकड़ों को प्राप्त करता है। यह सरल प्रश्नों के लिए काम करता है। यह मल्टी-हॉप तर्क, अस्पष्ट प्रश्नों और बड़े कॉर्पो के लिए टूट जाता है। उन्नत RAG 10 दस्तावेजों पर काम करने वाले डेमो और 10 मिलियन पर काम करने वाले सिस्टम के बीच अंतर है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11, Lesson 06 (RAG)
**Time:** ~90 minutes
**Related:**चरण 5 · 23 (RAG के लिए Chunking Strategies) सभी छह Chunking एल्गोरिदम को कवर करता है  पुनरावर्ती, अर्थपूर्ण, वाक्य, माता-पिता दस्तावेज़, देर से Chunking, संदर्भिक पुनर्प्राप्ति  वेक्टरा / मानव मानकों के साथ। यह पाठ शीर्ष पर बनाता हैः हाइब्रिड खोज, पुनः रैंक, क्वेरी परिवर्तन।

## सीखने के लक्ष्य

- दस्तावेज संरचना और संदर्भ को संरक्षित करने के लिए उन्नत टुकड़े टुकड़े करने की रणनीतियों (सिमेंटिक, पुनरावर्ती, माता-पिता-बच्चा) को लागू करना
- एक हाइब्रिड खोज पाइपलाइन का निर्माण करें जो बीएम 25 कीवर्ड को अर्थिक वेक्टर खोज और क्रॉस-एन्कोडर रीरैंकर के साथ मिलाता है
- अस्पष्ट या जटिल प्रश्नों पर पुनर्प्राप्ती में सुधार के लिए क्वेरी परिवर्तन तकनीक (HyDE, मल्टी-क्वेरी, स्टेप-बैक) लागू करें
- सामान्य RAG विफलताओं का निदान और समाधानः गलत टुकड़ा निकाला गया, संदर्भ में नहीं उत्तर, बहु-हॉप तर्क टूटना

## समस्या

आप पाठ 06 में एक बुनियादी RAG पाइपलाइन बनाया है. यह एक छोटे से corpus पर सीधे प्रश्नों के लिए काम करता है. अब इन कोशिश करेंः

**Ambiguous query**"पिछली तिमाही में राजस्व क्या था? " अर्थशास्त्र खोज राजस्व रणनीति, राजस्व अनुमानों और राजस्व वृद्धि पर सीएफओ के विचारों के बारे में टुकड़े देता है। सभी अर्थशास्त्र में "राजस्व" शब्द के समान हैं। कोई भी वास्तविक संख्या नहीं है। सही टुकड़ा कहता है "$47.2M in Q3 2025" but uses the word "earnings" instead of "revenue." The embedding model thinks "revenue strategy" is closer to the query than "Q3 earnings were $47.2M. "

**Multi-hop question**: "कौन सी टीम में ग्राहक संतुष्टि स्कोर में सबसे अधिक सुधार हुआ है?" इसके लिए प्रत्येक टीम के लिए संतुष्टि स्कोर ढूंढना, उनकी तुलना करना और अधिकतम की पहचान करना आवश्यक है। कोई भी टुकड़ा उत्तर नहीं रखता है। जानकारी टीम रिपोर्टों में बिखरी हुई है।

**Large corpus problem**आपके पास 2 मिलियन टुकड़े हैं। सही उत्तर टुकड़े # 1,847,293 में है। आपका शीर्ष 5 निकालना टुकड़े # 14, # 89,201, # 1,200,000, # 44, और # 901,333 खींचता है। एम्बेडिंग स्थान में बंद है, लेकिन कोई भी उत्तर नहीं है। इस पैमाने पर, निकटतम पड़ोसी खोज पर्याप्त त्रुटि पेश करती है कि प्रासंगिक परिणाम शीर्ष-के से बाहर धकेल दिए जाते हैं।

मूल RAG विफल रहता है क्योंकि वेक्टर समानता प्रासंगिकता के समान नहीं है। एक टुकड़ा उत्तर देने के लिए उपयोगी होने के बिना एक प्रश्न के समान अर्थपूर्ण रूप से हो सकता है। उन्नत आरएजी चार तकनीकों के साथ इस मुद्दे को संबोधित करता हैः हाइब्रिड खोज (कीवर्ड मिलान जोड़ें), पुनः रैंक (उम्मीदवारों को अधिक सावधानी से स्कोर करें), क्वेरी परिवर्तन (खोज से पहले क्वेरी को ठीक करें), और बेहतर चश्मांकन (सही ग्रेनेलरी में पुनर्प्राप्त करें) ।

## अवधारणा

### हाइब्रिड खोजः अर्थ + कीवर्ड

अर्थपूर्ण खोज (वेक्टर समानता) अर्थ को समझने में अच्छा है। "मैं अपनी सदस्यता कैसे रद्द करूं?" "आपकी योजना को समाप्त करने के लिए कदम" से मेल खाता है, भले ही वे कोई शब्द साझा नहीं करते हैं। लेकिन यह सटीक मेल नहीं खाता है। "त्रुटि कोड E-4021" "E-4021" युक्त एक टुकड़े से मेल नहीं खा सकता है यदि एम्बेडिंग मॉडल इसे शोर के रूप में मानता है।

Keyword search (BM25) इसके विपरीत है. यह सटीक मैचों में उत्कृष्ट है. "E-4021" एकदम सही है. लेकिन "मेरी सदस्यता रद्द करें" शून्य परिणाम देता है यदि दस्तावेज़ कहता है "अपनी योजना समाप्त करें।"

हाइब्रिड खोज दोनों चलाता है, फिर परिणामों को मिलाता है।

**BM25**(बेस्ट मैचिंग 25) मानक खोजशब्द खोज एल्गोरिथ्म है। यह 1990 के दशक से खोज इंजन की रीढ़ की हड्डी रही है। सूत्रः

```
BM25(q, d) = sum over terms t in q:
    IDF(t) * (tf(t,d) * (k1 + 1)) / (tf(t,d) + k1 * (1 - b + b * |d| / avgdl))
```

जहां tf(t,d) दस्तावेज़ d में t की आवृत्ति है, IDF(t) दस्तावेज़ आवृत्ति का विपरीत है, ➡d यह दस्तावेज़ लंबाई है, avgdl औसत दस्तावेज़ लंबाई है, k1 आवृत्ति संतृत्ति को नियंत्रित करता है (पूर्वनिर्धारित 1.2), और b लंबाई सामान्यीकरण (पूर्वनिर्धारित 0.75) को नियंत्रित करता है।

सामान्य शब्दों मेंः BM25 दस्तावेजों को उच्चतर स्कोर करता है जब वे क्वेरी शब्द (विशेष रूप से दुर्लभ) होते हैं, लेकिन दोहराए गए शब्दों के लिए घटते रिटर्न के साथ। "राजस्व" शब्द के साथ एक दस्तावेज 50 गुना अधिक प्रासंगिक नहीं है।

### पारस्परिक रैंक फ्यूजन (आरआरएफ)

आपके पास दो रैंक सूची हैंः वेक्टर खोज से एक, BM25 से एक। आप उन्हें कैसे जोड़ते हैं? पारस्परिक रैंक फ्यूजन मानक दृष्टिकोण है।

```
RRF_score(d) = sum over rankings R:
    1 / (k + rank_R(d))
```

जहां k एक स्थिर (आमतौर पर 60) है जो शीर्ष रैंक वाले परिणाम को हावी होने से रोकता है।

वेक्टर खोज में #1 और BM25 में #5 पर रैंक किया गया एक दस्तावेज़ प्राप्त करता हैः 1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318

वेक्टर खोज में #3 और BM25 में #2 स्थान पर एक दस्तावेज़ प्राप्त करता हैः 1/(60+3) + 1/(60+2) = 0.0159 + 0.0161 = 0.0320

RRF स्वाभाविक रूप से दोनों संकेतों को संतुलित करता है। दोनों सूचियों में उच्च रैंक वाला एक दस्तावेज़ सबसे अच्छा स्कोर प्राप्त करता है। एक दस्तावेज़ जो एक सूची में #1 रैंक करता है लेकिन दूसरे से अनुपस्थित है, उसे मध्यम स्कोर मिलता है। यह मजबूत है क्योंकि यह रैंक का उपयोग करता है, कच्चे स्कोर नहीं, इसलिए दोनों प्रणालियों के बीच स्कोर वितरण में अंतर मायने नहीं रखता है।

### रैंक बदलना

रिट्रीवल (वेक्टर, कीवर्ड या हाइब्रिड हो) तेज़ लेकिन अस्पष्ट है। यह द्वि-एन्कोडर का उपयोग करता हैः क्वेरी और प्रत्येक दस्तावेज़ को स्वतंत्र रूप से एम्बेड किया जाता है, फिर तुलना की जाती है। एम्बेडमेंट को एक बार गणना की जाती है और कैश किया जाता है। यह लाखों दस्तावेजों तक स्केल करता है।

रैंकिंग क्रॉस-एन्कोडर का उपयोग करती हैः क्वेरी और एक उम्मीदवार दस्तावेज़ को एक मॉडल में एक साथ खिलाया जाता है जो प्रासंगिकता स्कोर का उत्पादन करता है। मॉडल दोनों पाठों को एक साथ देखता है और उनके बीच बारीक- बारीक बातचीत को कैप्चर कर सकता है। एक क्रॉस-एन्कोडर यह समझ सकता है कि "Q3 में कमाई क्या थी? "एक टुकड़े के लिए बहुत प्रासंगिक है जिसमें "Q3 में $ 47.2M" है, भले ही एक द्वि-एन्कोडर कनेक्शन को याद कर दिया गया हो।

व्यापारः क्रॉस-एन्कोडर द्वि-एन्कोडर की तुलना में 100-1000 गुना धीमी होती है क्योंकि वे क्वेरी-दस्तावेज जोड़े को संयुक्त रूप से संसाधित करते हैं। आप एक मिलियन दस्तावेजों के लिए क्रॉस-एन्कोडर स्कोर की पूर्व-गणना नहीं कर सकते। समाधानः एक बड़ा उम्मीदवार सेट (हाइब्रिड खोज से शीर्ष-50) प्राप्त करें, फिर अंतिम शीर्ष-5 प्राप्त करने के लिए क्रॉस-एन्कोडर के साथ फिर से रैंक करें।

```mermaid
graph LR
    Q["Query"] --> H["Hybrid Search"]
    H --> C50["Top 50 candidates"]
    C50 --> RR["Cross-Encoder Reranker"]
    RR --> C5["Top 5 final results"]
    C5 --> P["Build prompt"]
    P --> LLM["Generate answer"]
```

सामान्य पुनर्गठन मॉडल (2026 लाइनअप):
- Cohere Rerank 3.5: प्रबंधित एपीआई, बहुभाषी, मिश्रित कॉर्पो पर सर्वश्रेष्ठ रिकॉल लाभ
- यात्रा पुनः रैंक-2.5: प्रबंधित एपीआई, होस्ट किए गए विकल्पों में सबसे कम विलंबता
- Jina-Reranker-v2 बहुभाषीः ओपन-वेट, 100+ भाषाएं
- bge-reanker-v2-m3: खुले वजन, मजबूत बेसलाइन
- क्रॉस-एन्कोडर/ms-marco-MiniLM-L-6-v2: ओपन-वेट, प्रोटोटाइप के लिए CPU पर चलता है
- ColBERTv2 / Jina-ColBERT-v2: देर से बातचीत बहु-वेक्टर रैंकर  $O(\text{tokens})$नहीं$O(\text{docs})$अंक प्राप्त करने के समय

### क्वेरी परिवर्तन

कभी-कभी समस्या पुनर्प्राप्ति नहीं है बल्कि स्वयं प्रश्न है। "नई नीति परिवर्तन के बारे में यह क्या था?" एक भयानक खोज प्रश्न है। इसमें कोई विशिष्ट शब्द नहीं हैं। एम्बेडिंग अस्पष्ट है। कोई भी पुनर्प्राप्ति प्रणाली इससे सही दस्तावेज नहीं पा सकती है।

**Query rewriting**एक LLM इस प्रकार कर सकता हैः

```
User: "What was that thing about the new policy change?"
Rewritten: "Recent policy changes and updates"
```

**HyDE (Hypothetical Document Embeddings)**: प्रश्न के साथ खोज करने के बजाय, एक परिकल्पनात्मक उत्तर उत्पन्न करें, इसे एम्बेड करें, और समान वास्तविक दस्तावेजों की खोज करें।

```
Query: "What is the refund policy for enterprise?"
Hypothetical answer: "Enterprise customers are eligible for a full refund
within 60 days of purchase. Refunds are pro-rated based on the remaining
subscription period and processed within 5-7 business days."
```

कल्पनात्मक उत्तर को एम्बेड करें और इसके समान वास्तविक दस्तावेजों की खोज करें। अंतर्ज्ञानः कल्पनात्मक उत्तर वास्तविक उत्तर के लिए अंतरिक्ष को एम्बेड करने में मूल प्रश्न की तुलना में अधिक निकट रहता है। प्रश्नों और उत्तरों की अलग-अलग भाषाई संरचनाएं हैं। कल्पनात्मक उत्तर उत्पन्न करके, आप एम्बेड में "प्रश्न स्थान" और "उत्तर स्थान" के बीच अंतर को पुल बनाते हैं।

HyDE पुनर्प्राप्ति से पहले एक LLM कॉल जोड़ता है। यह 500-2000ms द्वारा विलंबता बढ़ाता है। जब कच्चे क्वेरी पर पुनर्प्राप्ति की गुणवत्ता खराब होती है तो यह इसके लायक है।

### माता-पिता-बच्चा के बीच घनघोरता

मानक टुकड़े टुकड़े करने से एक समझौता हो जाता हैः सटीक निकासी के लिए छोटे टुकड़े, पर्याप्त संदर्भ के लिए बड़े टुकड़े। माता-पिता-बच्चे के टुकड़े करने से यह समझौता समाप्त हो जाता है।

जब एक छोटा सा टुकड़ा निकाला जाता है, तो प्रॉम्प्ट के लिए अपना मूल टुकड़ा (512 टोकन) लौटाएं। छोटा टुकड़ा क्वेरी से सटीक रूप से मेल खाता है। मूल टुकड़ा LLM के लिए एक अच्छा उत्तर उत्पन्न करने के लिए पर्याप्त संदर्भ प्रदान करता है।

```mermaid
graph TD
    P["Parent chunk (512 tokens)<br/>Full section about refund policy"]
    C1["Child chunk (128 tokens)<br/>Standard plan: 30-day refund"]
    C2["Child chunk (128 tokens)<br/>Enterprise: 60-day pro-rated"]
    C3["Child chunk (128 tokens)<br/>Processing time: 5-7 days"]
    C4["Child chunk (128 tokens)<br/>How to submit a request"]

    P --> C1
    P --> C2
    P --> C3
    P --> C4

    Q["Query: enterprise refund?"] -.->|"matches child"| C2
    C2 -.->|"return parent"| P
```

"इंटरप्राइज रिफंड?" क्वेरी सही ढंग से बच्चे भाग C2 से मेल खाती है। लेकिन प्रॉम्प्ट पूर्ण माता-पिता भाग P प्राप्त करता है, जिसमें प्रसंस्करण समय और सबमिशन प्रक्रिया के बारे में आसपास के संदर्भ शामिल हैं।

### मेटाडेटा फ़िल्टरिंग

वेक्टर सर्च करने से पहले, मेटाडेटा के अनुसार कॉर्पस को फ़िल्टर करेंः तिथि, स्रोत, श्रेणी, लेखक, भाषा। यह खोज स्थान को कम करता है और अप्रासंगिक परिणामों को रोकता है।

"पिछले महीने सुरक्षा नीति में क्या बदलाव हुआ है?" केवल सुरक्षा श्रेणी में पिछले 30 दिनों के दस्तावेजों की खोज करनी चाहिए। मेटाडेटा फ़िल्टरिंग के बिना, आप पूरे कॉर्पस की खोज करते हैं और एक 2 साल पुराना सुरक्षा दस्तावेज प्राप्त कर सकते हैं जो अर्थिक रूप से समान होता है।

उत्पादन आरएजी सिस्टम प्रत्येक टुकड़े के साथ मेटाडेटा संग्रहीत करते हैंः स्रोत दस्तावेज़, निर्माण तिथि, श्रेणी, लेखक, संस्करण। वेक्टर डेटाबेस समानता खोज से पहले मेटाडेटा द्वारा पूर्व-फिल्टरिंग का समर्थन करते हैं, जो पैमाने पर प्रदर्शन के लिए महत्वपूर्ण है।

### मूल्यांकन

आपने एक RAG प्रणाली बनाई है. आप कैसे जानते हैं कि यह काम करता है? तीन मापः

**Retrieval relevance (Recall@k)**प्रश्न संख्या 47 में है, क्या भाग 47 शीर्ष 5 में दिखाई देता है?

**Faithfulness**यदि प्राप्त टुकड़ों में "60 दिन की वापसी विंडो" और मॉडल में "90 दिन की वापसी विंडो" लिखा है, तो यह एक निष्ठा विफलता है। मॉडल सही संदर्भ होने के बावजूद भ्रम में है।

**Answer correctness**यह अंत-से-अंत मीट्रिक है। यह पुनर्प्राप्ति गुणवत्ता और उत्पादन गुणवत्ता को जोड़ता है।

एक सरल निष्ठा जांचः उत्पन्न उत्तर में प्रत्येक दावे को लें और सत्यापित करें कि यह प्राप्त टुकड़ों में (सारांश में) दिखाई देता है। यदि उत्तर में किसी भी प्राप्त टुकड़े में नहीं एक तथ्य होता है, तो यह संभवतः भ्रम है।

```mermaid
graph TD
    subgraph "Evaluation Framework"
        Q["Test questions<br/>+ expected answers<br/>+ relevant doc IDs"]
        Q --> Ret["Retrieval evaluation<br/>Recall@k: are right<br/>docs retrieved?"]
        Q --> Faith["Faithfulness evaluation<br/>Is answer grounded<br/>in retrieved docs?"]
        Q --> Correct["Correctness evaluation<br/>Does answer match<br/>expected answer?"]
    end
```

```figure
agentic-rag-loop
```

## इसे बनाओ

### चरण 1: BM25 कार्यान्वयन

```python
import math
from collections import Counter

class BM25:
    def __init__(self, k1=1.2, b=0.75):
        self.k1 = k1
        self.b = b
        self.docs = []
        self.doc_lengths = []
        self.avg_dl = 0
        self.doc_freqs = {}
        self.n_docs = 0

    def index(self, documents):
        self.docs = documents
        self.n_docs = len(documents)
        self.doc_lengths = []
        self.doc_freqs = {}

        for doc in documents:
            words = doc.lower().split()
            self.doc_lengths.append(len(words))
            unique_words = set(words)
            for word in unique_words:
                self.doc_freqs[word] = self.doc_freqs.get(word, 0) + 1

        self.avg_dl = sum(self.doc_lengths) / self.n_docs if self.n_docs else 1

    def score(self, query, doc_idx):
        query_words = query.lower().split()
        doc_words = self.docs[doc_idx].lower().split()
        doc_len = self.doc_lengths[doc_idx]
        word_counts = Counter(doc_words)
        score = 0.0

        for term in query_words:
            if term not in word_counts:
                continue
            tf = word_counts[term]
            df = self.doc_freqs.get(term, 0)
            idf = math.log((self.n_docs - df + 0.5) / (df + 0.5) + 1)
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_dl)
            score += idf * numerator / denominator

        return score

    def search(self, query, top_k=10):
        scores = [(i, self.score(query, i)) for i in range(self.n_docs)]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]
```

### चरण 2: पारस्परिक रैंक विलय

```python
def reciprocal_rank_fusion(ranked_lists, k=60):
    scores = {}
    for ranked_list in ranked_lists:
        for rank, (doc_id, _) in enumerate(ranked_list):
            if doc_id not in scores:
                scores[doc_id] = 0.0
            scores[doc_id] += 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return fused
```

### चरण 3: हाइब्रिड खोज पाइपलाइन

```python
def hybrid_search(query, chunks, vector_embeddings, vocab, idf, bm25_index, top_k=5, fusion_k=60):
    query_emb = tfidf_embed(query, vocab, idf)
    vector_results = search(query_emb, vector_embeddings, top_k=top_k * 3)
    bm25_results = bm25_index.search(query, top_k=top_k * 3)
    fused = reciprocal_rank_fusion([vector_results, bm25_results], k=fusion_k)
    return fused[:top_k]
```

### चरण 4: सरल रीरैंक

उत्पादन में, आप एक क्रॉस-एन्कोडर मॉडल का उपयोग करेंगे। यहाँ हम एक रीरेंकर बनाते हैं जो शब्द ओवरलैप, शब्द महत्व और वाक्यांश मिलान का उपयोग करके क्वेरी-दस्तावेज प्रासंगिकता को स्कोर करता है।

```python
def rerank(query, candidates, chunks):
    query_words = set(query.lower().split())
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "what", "how",
                  "why", "when", "where", "do", "does", "for", "of", "in", "to",
                  "and", "or", "on", "at", "by", "it", "its", "this", "that",
                  "with", "from", "be", "has", "have", "had", "not", "but"}
    query_terms = query_words - stop_words

    scored = []
    for doc_id, initial_score in candidates:
        chunk = chunks[doc_id].lower()
        chunk_words = set(chunk.split())

        term_overlap = len(query_terms & chunk_words)

        query_bigrams = set()
        q_list = [w for w in query.lower().split() if w not in stop_words]
        for i in range(len(q_list) - 1):
            query_bigrams.add(q_list[i] + " " + q_list[i + 1])
        bigram_matches = sum(1 for bg in query_bigrams if bg in chunk)

        position_boost = 0
        for term in query_terms:
            pos = chunk.find(term)
            if pos != -1 and pos < len(chunk) // 3:
                position_boost += 0.5

        rerank_score = (
            term_overlap * 1.0
            + bigram_matches * 2.0
            + position_boost
            + initial_score * 5.0
        )
        scored.append((doc_id, rerank_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored
```

### चरण 5: हाइडे (अनुमानित दस्तावेज़ एम्बेड)

```python
def hyde_generate_hypothesis(query):
    templates = {
        "what": "The answer to '{query}' is as follows: Based on our documentation, {topic} involves specific policies and procedures that define how the process works.",
        "how": "To address '{query}': The process involves several steps. First, you need to initiate the request. Then, the system processes it according to the defined rules.",
        "default": "Regarding '{query}': Our records indicate specific details and policies related to this topic that provide a comprehensive answer."
    }
    query_lower = query.lower()
    if query_lower.startswith("what"):
        template = templates["what"]
    elif query_lower.startswith("how"):
        template = templates["how"]
    else:
        template = templates["default"]

    topic_words = [w for w in query.lower().split()
                   if w not in {"what", "is", "the", "how", "do", "does", "a", "an",
                                "for", "of", "to", "in", "on", "at", "by", "and", "or"}]
    topic = " ".join(topic_words) if topic_words else "this topic"

    return template.format(query=query, topic=topic)


def hyde_search(query, chunks, vector_embeddings, vocab, idf, top_k=5):
    hypothesis = hyde_generate_hypothesis(query)
    hypothesis_emb = tfidf_embed(hypothesis, vocab, idf)
    results = search(hypothesis_emb, vector_embeddings, top_k)
    return results, hypothesis
```

### चरण 6: माता-पिता-बच्चा के बीच घनघोरता

```python
def create_parent_child_chunks(text, parent_size=200, child_size=50):
    words = text.split()
    parents = []
    children = []
    child_to_parent = {}

    parent_idx = 0
    start = 0
    while start < len(words):
        parent_end = min(start + parent_size, len(words))
        parent_text = " ".join(words[start:parent_end])
        parents.append(parent_text)

        child_start = start
        while child_start < parent_end:
            child_end = min(child_start + child_size, parent_end)
            child_text = " ".join(words[child_start:child_end])
            child_idx = len(children)
            children.append(child_text)
            child_to_parent[child_idx] = parent_idx
            child_start += child_size

        parent_idx += 1
        start += parent_size

    return parents, children, child_to_parent
```

### चरण 7: वफादारी का मूल्यांकन

```python
def evaluate_faithfulness(answer, retrieved_chunks):
    answer_sentences = [s.strip() for s in answer.split(".") if len(s.strip()) > 10]
    if not answer_sentences:
        return 1.0, []

    grounded = 0
    ungrounded = []
    context = " ".join(retrieved_chunks).lower()

    for sentence in answer_sentences:
        words = set(sentence.lower().split())
        stop_words = {"the", "a", "an", "is", "are", "was", "were", "and", "or",
                      "to", "of", "in", "for", "on", "at", "by", "it", "this", "that"}
        content_words = words - stop_words
        if not content_words:
            grounded += 1
            continue

        matched = sum(1 for w in content_words if w in context)
        ratio = matched / len(content_words) if content_words else 0

        if ratio >= 0.5:
            grounded += 1
        else:
            ungrounded.append(sentence)

    score = grounded / len(answer_sentences) if answer_sentences else 1.0
    return score, ungrounded


def evaluate_retrieval_recall(queries_with_relevant, retrieval_fn, k=5):
    total_recall = 0.0
    results = []

    for query, relevant_indices in queries_with_relevant:
        retrieved = retrieval_fn(query, k)
        retrieved_indices = set(idx for idx, _ in retrieved)
        relevant_set = set(relevant_indices)
        hits = len(retrieved_indices & relevant_set)
        recall = hits / len(relevant_set) if relevant_set else 1.0
        total_recall += recall
        results.append({
            "query": query,
            "recall": recall,
            "hits": hits,
            "total_relevant": len(relevant_set)
        })

    avg_recall = total_recall / len(queries_with_relevant) if queries_with_relevant else 0
    return avg_recall, results
```

## इसका प्रयोग करें

एक असली क्रॉस-कोडर के साथ पुनर्गठन के लिएः

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank_with_cross_encoder(query, candidates, chunks, top_k=5):
    pairs = [(query, chunks[doc_id]) for doc_id, _ in candidates]
    scores = reranker.predict(pairs)
    scored = list(zip([doc_id for doc_id, _ in candidates], scores))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]
```

कोहरे के प्रबंधित रेंकर के साथः

```python
import cohere

co = cohere.Client()

def rerank_with_cohere(query, candidates, chunks, top_k=5):
    docs = [chunks[doc_id] for doc_id, _ in candidates]
    response = co.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=docs,
        top_n=top_k
    )
    return [(candidates[r.index][0], r.relevance_score) for r in response.results]
```

वास्तविक LLM के साथ HyDE के लिएः

```python
import anthropic

client = anthropic.Anthropic()

def hyde_with_llm(query):
    response = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": f"Write a short paragraph that would be a good answer to this question. Do not say you don't know. Just write what the answer would look like.\n\nQuestion: {query}"
        }]
    )
    return response.content[0].text
```

Weaviate के साथ उत्पादन हाइब्रिड खोज के लिएः

```python
import weaviate

client = weaviate.connect_to_local()

collection = client.collections.get("Documents")
response = collection.query.hybrid(
    query="enterprise refund policy",
    alpha=0.5,
    limit=10
)
```

अल्फा पैरामीटर संतुलन को नियंत्रित करता हैः 0.0 = शुद्ध कीवर्ड (BM25), 1.0 = शुद्ध वेक्टर, 0.5 = समान वजन। अधिकांश उत्पादन प्रणालियों में 0.3 और 0.7 के बीच अल्फा का उपयोग किया जाता है।

## इसे भेजें

इस पाठ से उत्पन्न होता हैः
- `outputs/prompt-advanced-rag-debugger.md`-- आरएजी गुणवत्ता संबंधी समस्याओं का निदान और समाधान करने के लिए एक संकेत
- `outputs/skill-advanced-rag.md`-- हाइब्रिड खोज और पुनः रैंकिंग के साथ उत्पादन-ग्रेड आरएजी बनाने के लिए एक कौशल

## व्यायाम

1. नमूना दस्तावेजों पर BM25 बनाम वेक्टर खोज बनाम हाइब्रिड खोज की तुलना करें। 5 परीक्षण प्रश्नों में से प्रत्येक के लिए, रिकॉर्ड करें कि कौन सा दृष्टिकोण स्थिति # 1 में सबसे प्रासंगिक टुकड़ा लौटाता है। हाइब्रिड खोज को कम से कम 5 में से 3 पर जीत हासिल करनी चाहिए।

2. मेटाडेटा फ़िल्टर लागू करें. प्रत्येक दस्तावेज़ (सुरक्षा, बिलिंग, एपीआई, उत्पाद) में एक "श्रेणी" फ़ील्ड जोड़ें। वेक्टर खोज चलाने से पहले, केवल संबंधित श्रेणी में टुकड़े फ़िल्टर करें। "क्या एन्क्रिप्शन का उपयोग किया जाता है?" के साथ परीक्षण करें और सत्यापित करें कि यह केवल सुरक्षा-श्रेणी टुकड़े खोजता है।

3. पाठ 06 से सरल उत्पन्न फ़ंक्शन का उपयोग करके एक पूर्ण हाइडीई पाइपलाइन बनाएं। सभी 5 परीक्षण क्वेरी पर प्रत्यक्ष क्वेरी खोज और हाइडीई खोज के बीच पुनर्प्राप्ति गुणवत्ता (शीर्ष-3 प्रासंगिकता) की तुलना करें। हाइडीई को अस्पष्ट क्वेरी के लिए परिणामों में सुधार करना चाहिए।

4. नमूना दस्तावेजों पर माता-पिता-बच्चे के टुकड़े करने की रणनीति को लागू करें। child_size=30 और parent_size=100 का उपयोग करें। बच्चे के टुकड़ों के साथ खोजें लेकिन प्रॉम्प्ट में माता-पिता के टुकड़े लौटाएं। मानक टुकड़े करने के लिए उत्पन्न उत्तरों की तुलना chunk_size=50 से करें।

5. एक मूल्यांकन डेटासेट बनाएंः ज्ञात उत्तर टुकड़ों के साथ 10 प्रश्न। (ए) केवल वेक्टर खोज के लिए Recall@3, Recall@5, और Recall@10 मापें, (बी) केवल BM25, (सी) हाइब्रिड खोज, (डी) हाइब्रिड + पुनः रैंकिंग। परिणामों का सार बनाएं और पहचानें कि पुनर् रैंकिंग सबसे अधिक कहां मदद करती है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| BM25 | "Keyword search" | A probabilistic ranking algorithm that scores documents by term frequency, inverse document frequency, and document length normalization |
| Hybrid search | "Best of both worlds" | Running semantic (vector) and keyword (BM25) search in parallel, then merging results with rank fusion |
| Reciprocal Rank Fusion | "Merge ranked lists" | Combining multiple ranked lists by summing 1/(k + rank) for each document across all lists |
| Reranking | "Second pass scoring" | Using a more expensive cross-encoder model to re-score a candidate set from initial retrieval |
| Cross-encoder | "Joint query-document model" | A model that takes a query and document as a single input, producing a relevance score; more accurate than bi-encoders but too slow for full corpus search |
| Bi-encoder | "Independent embedding model" | A model that embeds queries and documents independently; fast because embeddings are precomputed, but less accurate than cross-encoders |
| HyDE | "Search with a fake answer" | Generate a hypothetical answer to the query, embed it, and search for real documents similar to it |
| Parent-child chunking | "Small search, big context" | Index small chunks for precise retrieval but return the larger parent chunk to provide sufficient context |
| Metadata filtering | "Narrow before searching" | Filtering documents by attributes (date, source, category) before running vector search to reduce the search space |
| Faithfulness | "Did it stay grounded" | Whether the generated answer is supported by the retrieved documents, as opposed to hallucinated from the model's training data |

## आगे पढ़ना

- रॉबर्टसन और सारगोसा, "द प्रोबाइलिस्टिक रिलेवेंस फ्रेमवर्कः BM25 एंड बियॉन्ड" (2009) - BM25 के लिए अंतिम संदर्भ, सूत्र के पीछे संभावनावादी नींव की व्याख्या
- कॉर्मक और अन्य, "रिस्पोकल रैंक फ्यूजन कॉन्डोर्सेट और व्यक्तिगत रैंक सीखने के तरीकों से बेहतर प्रदर्शन करता है" (2009) -- मूल आरआरएफ पेपर यह दिखाता है कि यह अधिक जटिल फ्यूजन विधियों को हराता है
- Gao et al., "प्रासंगिकता लेबल के बिना सटीक शून्य-शॉट घने पुनर्प्राप्ति" (2022) -- HyDE पेपर जो दिखाता है कि परिकल्पना दस्तावेज़ एम्बेडमेंट किसी भी प्रशिक्षण डेटा के बिना पुनर्प्राप्ति में सुधार करते हैं
- Nogueira & Cho, "BERT के साथ पासज री-रैंकिंग" (2019) -- दिखाया क्रॉस-एन्कोडर री-रैंकिंग BM25 के शीर्ष पर महत्वपूर्ण रूप से पुनर्प्राप्ति गुणवत्ता में सुधार करता है
- [Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines" (2023)](https://arxiv.org/abs/2310.03714)-- शीघ्र निर्माण और वजन चयन को पुनर्प्राप्ति पाइपलाइनों पर अनुकूलन समस्या के रूप में व्यवहार करता है; इसे "प्रोग्राम एलएलएम" के बजाय "प्रॉम्प्ट एलएलएम" के लिए पढ़ें।
- [Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" (Microsoft Research 2024)](https://arxiv.org/abs/2404.16130)-- ग्राफ्राग पेपरः इकाई-संबंध निष्कर्षण + क्वेरी-केंद्रित सारांश के लिए लीडेन समुदाय का पता लगाना; वैश्विक बनाम स्थानीय पुनर्प्राप्ति अंतर।
- [Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection" (ICLR 2024)](https://arxiv.org/abs/2310.11511)-- प्रतिबिंब टोकन के साथ आत्म-मूल्यांकन आरएजी; स्थैतिक पुनर्प्राप्त करने के बाद उत्पन्न एजेंटिक सीमा से परे।
- [LangChain Query Construction blog](https://blog.langchain.dev/query-construction/)-- प्राकृतिक भाषा के प्रश्नों को संरचित डेटाबेस प्रश्नों (टेक्स्ट-टू-एसक्यूएल, साइफर) में कैसे अनुवादित किया जाए।
