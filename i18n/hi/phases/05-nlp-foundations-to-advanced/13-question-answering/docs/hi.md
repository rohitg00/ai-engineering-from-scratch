# प्रश्नों के उत्तर देने की प्रणाली

> तीन प्रणालियों ने आधुनिक क्यूए को आकार दिया। निष्कर्षण में पाया गया विस्तार। पुनर्प्राप्ति-बढ़ता हुआ उन्हें दस्तावेजों में जमीनी बनाया गया। जनरेटिव ने उत्तर उत्पन्न किए। प्रत्येक आधुनिक एआई सहायक तीनों का मिश्रण है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## समस्या

एक उपयोगकर्ता टाइप करता है "पहला iPhone कब लॉन्च हुआ था? " और "29 जून 2007" की उम्मीद करता है। "ऐप्पल का इतिहास लंबा और विविध है।" "2007" नहीं। बिना किसी वाक्य के अलग-थलग बैठे। एक सीधा, जमीनी, सही उत्तर।

पिछले दशक में तीन वास्तुकलाओं ने QA पर हावी रहा है।

- **Extractive QA.**किसी प्रश्न और उस पाठ को देखते हुए जो उत्तर में है, उस पाठ में उत्तर अवधि के प्रारंभ और अंत सूचकांक खोजें। SQuAD कैनोनिक बेंचमार्क है।
- **Open-domain QA.**यह मार्ग नहीं दिया गया है। पहले प्रासंगिक मार्ग को प्राप्त करें, फिर निकालें या एक उत्तर उत्पन्न करें। यह आज हर आरएजी पाइपलाइन की आधारशिला है।
- **Generative / Closed-book QA.**एक बड़े भाषा मॉडल अपनी पैरामीटर मेमोरी से जवाब देता है। कोई पुनर्प्राप्ति नहीं। निष्कर्ष में सबसे तेज, तथ्यों पर कम विश्वसनीय।

2026 में प्रवृत्ति हाइब्रिड हैः सबसे अच्छे कुछ अंशों को पुनर्प्राप्त करें, फिर उन अंशों में जमीनी रूप से उत्तर देने के लिए एक जनरेटिव मॉडल को प्रेरित करें। यह आरएजी है, और पाठ 14 आधा गहराई से पुनर्प्राप्त को कवर करता है। यह पाठ QA आधा बनाता है।

## अवधारणा

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**प्रश्न को एन्कोड करें और ट्रांसफार्मर (BERT परिवार) के साथ एक साथ passage को encode करें। दो सिरों को प्रशिक्षित करें जो उत्तर के प्रारंभ और अंत टोकन सूचकांक की भविष्यवाणी करते हैं। हानि वैध पदों पर क्रॉस-एंट्रोपी है। आउटपुट passage से एक अवधि है। कभी भी भ्रम (निर्माण द्वारा), कभी भी प्रश्नों को संभालने के लिए नहीं गुजरता है जो उत्तर (निर्माण द्वारा) नहीं दे सकते हैं।

**Retrieval-augmented (RAG).**पहले, एक रिट्रीवर शीर्ष को पाता है-`k`एक आरएजी अक्सर एक रेंकर जोड़ता है उनके बीच एक रिट्रीवर-रीडर विभाजन प्रत्येक को स्वतंत्र रूप से प्रशिक्षित और मूल्यांकन करने की अनुमति देता है।

**Generative.**एक केवल डिकोडर-एलएलएम (जीपीटी, क्लाउड, लामा) सीखने वाले वजन से जवाब देता है। कोई पुनर्प्राप्ति कदम नहीं। सामान्य ज्ञान पर उत्कृष्ट, दुर्लभ या हालिया तथ्यों पर विनाशकारी। प्रैक्टिस डेटा में तथ्यों की आवृत्ति के साथ भ्रम की दर विपरीत रूप से संबद्ध है।

```figure
qa-span
```

## इसे बनाओ

### चरण 1: पूर्व प्रशिक्षित मॉडल के साथ निष्कर्षण QA

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2`यह SQuAD 2.0 पर प्रशिक्षित है, जिसमें उत्तरहीन प्रश्न शामिल हैं।`question-answering`पाइपलाइन उच्चतम स्कोरिंग अवधि वापस करता है भले ही मॉडल का शून्य स्कोर जीतता है  यह * नहीं * स्वचालित रूप से एक खाली उत्तर वापस करता है। स्पष्ट "कोई जवाब नहीं" व्यवहार प्राप्त करने के लिए, पास `handle_impossible_answer=True`पाइपलाइन कॉल के लिएः पाइपलाइन तब केवल तब एक खाली उत्तर देता है जब शून्य स्कोर प्रत्येक स्पैन स्कोर से अधिक होता है। हमेशा जांचें `score`किसी भी तरह से क्षेत्र.

### चरण 2: एक पुनर्प्राप्ति-वृद्धि पाइपलाइन (स्केच)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

दो चरणों की पाइपलाइन। घने रिट्रीवर (संज्ञा-BERT) सेमंटिक समानता द्वारा प्रासंगिक खंड ढूंढता है। निष्कर्षण पाठक (RoBERTa-SQuAD) संयुक्त शीर्ष खंडों से उत्तर अवधि खींचता है। छोटे कॉर्पोस पर काम करता है। एक मिलियन दस्तावेज़ कॉर्पोस के लिए, FAISS या वेक्टर डेटाबेस का उपयोग करें।

### चरण 3: RAG के साथ जनरेटिव

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

शीघ्रता पैटर्न मायने रखता है। संदर्भ में मॉडल को जमीन पर स्पष्ट रूप से कहकर और संदर्भ में पर्याप्त नहीं होने पर "मुझे नहीं पता" लौटाकर, भोले उत्तेजना की तुलना में पगडंडीकरण दरों को 40-60% तक कम करता है। अधिक परिष्कृत पैटर्न उद्धरण, आत्मविश्वास स्कोर और संरचित निष्कर्षण जोड़ते हैं।

### चरण 4: वास्तविक दुनिया को प्रतिबिंबित करने वाली मूल्यांकन

SQuAD का उपयोग करता है **Exact Match (EM)**और **token-level F1**. . EM सामान्यीकरण के बाद एक सख्त मैच है (कम अक्षर, पट्टी अंकन, हटाएं लेख)  या तो भविष्यवाणी बिल्कुल मेल खाती है या यह 0 स्कोर करता है। F1 का गणना भविष्यवाणी और संदर्भ के बीच टोकन ओवरलैप पर की जाती है और आंशिक क्रेडिट देती है। दोनों कम क्रेडिट पैराफ्रेसेसः "29 जून 2007" बनाम "29 जून, 2007" आमतौर पर 0 EM (ऑर्डर ब्रेक नॉर्मलाइजेशन) प्राप्त करता है लेकिन फिर भी ओवरलैप टोकन से पर्याप्त F1 कमाता है।

उत्पादन QA के लिएः

- **Answer accuracy**(LLM या मानव द्वारा मूल्यांकन किया गया, क्योंकि मीट्रिक अर्थिक समकक्षता को कैप्चर नहीं करते हैं।
- **Citation accuracy.**क्या उद्धृत अंश वास्तव में उत्तर का समर्थन करता है? स्वचालित रूप से उत्पन्न उद्धरणों और प्राप्त अंशों के बीच स्ट्रिंग मैच के साथ जांच करना तुच्छ है।
- **Refusal calibration.**जब उत्तर प्राप्त हुए पदों में नहीं होता है, तो क्या सिस्टम सही ढंग से कहता है "मुझे नहीं पता"? झूठी विश्वास दर मापें।
- **Retrieval recall.**पाठक का मूल्यांकन करने से पहले, मापें कि क्या रिट्रीवर शीर्ष में सही मार्ग प्राप्त करता है-`k`एक पाठक एक गायब खंड को ठीक नहीं कर सकता है।

### RAGAS: 2026 उत्पादन मूल्यांकन ढांचा

`RAGAS`यह आरएजी सिस्टम के लिए विशेष रूप से बनाया गया है और 2026 में शिपिंग डिफ़ॉल्ट है। यह सोने के संदर्भों की आवश्यकता के बिना चार आयामों का स्कोर करता हैः

- **Faithfulness.**क्या उत्तर में प्रत्येक दावे का स्रोत निकाले गए संदर्भ से है? एनएलआई आधारित निष्कर्ष द्वारा मापा गया। आपकी प्राथमिक पगडंडी मेट्रिक।
- **Answer relevance.**क्या उत्तर प्रश्न का उत्तर देता है? उत्तर से परिकल्पनात्मक प्रश्न उत्पन्न करके और वास्तविक प्रश्न की तुलना करके मापा जाता है।
- **Context precision.**प्राप्त टुकड़ों में से, वास्तव में कौन सा अंश प्रासंगिक था? कम सटीकता = शीघ्र में शोर।
- **Context recall.**क्या प्राप्त सेट में सभी आवश्यक जानकारी थी? कम याद = पाठक सफल नहीं हो सकता।

संदर्भ मुक्त स्कोरिंग आपको क्युरेट किए गए स्वर्ण उत्तरों के बिना लाइव उत्पादन ट्रैफ़िक पर मूल्यांकन करने की अनुमति देता है। एलएलएम-ए-ज्यूज स्तर खुले अंत वाले प्रश्नों के लिए शीर्ष पर जहां सटीक मैच मीट्रिक बेकार हैं।

`pip install ragas`. अपने रिट्रीवर + रीडर कनेक्ट करें. प्रति क्वेरी चार स्केलर प्राप्त करें. रिग्रेशन पर चेतावनी.

## इसका प्रयोग करें

2026 स्टैक।

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

2026 में निष्कर्षण क्यूए अप्रचलित है क्योंकि आरएजी एलएलएम के साथ अधिक मामलों को संभालता है। यह अभी भी संदर्भों में जहाज करता है जहां शाब्दिक उद्धरण की आवश्यकता होती हैः कानूनी अनुसंधान, नियामक अनुपालन, ऑडिट उपकरण।

## इसे भेजें

`outputs/skill-qa-architect.md`:

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## व्यायाम

1. **Easy.**10 विकिपीडिया खंडों पर SQuAD निष्कर्षण पाइपलाइन सेट करें। 10 प्रश्नों को हस्तनिर्मित करें। मापें कि उत्तर कितनी बार सही है। यदि खंड और प्रश्न साफ हैं तो आपको 7-9 सही देखना चाहिए।
2. **Medium.**एक अस्वीकृति वर्गीकरण जोड़ें। जब शीर्ष निकासी स्कोर एक सीमा से नीचे होता है (कहें 0.3 कॉसिन), पाठक को कॉल करने के बजाय "मुझे नहीं पता" लौटाएं। एक लंबे समय तक पकड़े जाने वाले सेट पर सीमा को ट्यून करें।
3. **Hard.**अपनी पसंद के 10,000 दस्तावेजों के कॉर्पस पर एक RAG पाइपलाइन बनाएं। आरआरएफ संलयन (पाठ 14 देखें) के साथ हाइब्रिड रिट्रीवल (BM25 + घने) लागू करें। हाइब्रिड चरण के साथ और बिना उत्तर सटीकता मापें। दस्तावेज जो प्रश्न प्रकार सबसे अधिक लाभान्वित हैं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## आगे पढ़ना

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) बेंचमार्क पेपर।
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) डीपीआर, QA के लिए कैनोनिक घने रिट्रीवर।
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) अखबार जो RAG नाम दिया था।
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) व्यापक आरएजी सर्वेक्षण।
