# Soruların Yanıtlanması Sistemleri

> Üç sistem modern bilgi akimiyetini şekillendirdi. Ekstraktif bulma alanları. Arama ile güçlendirilmiş belgelere yerleştirildi. Geliştirici cevaplar üretildi. Her modern AI asistanı üçün bir karışımıdır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## Sorun

Bir kullanıcı "İlk iPhone ne zaman piyasaya sürüldü?" diye yazar ve "29 Haziran 2007" diye bekler. "Apple'ın tarihi uzun ve çeşitli". değil. "2007" diye değil.

Son on yılda üç mimarlık, kaliteyi yönetiyor.

- **Extractive QA.**Cevabı içeren bilinen bir soru ve bir pasaj verildiğinde, pasajda cevap aralığının başlangıç ve son indekslerini bul. SQuAD kanonik referans ölçüsüdür.
- **Open-domain QA.**Geçit verilmiyor. Önce ilgili geçitleri alın, sonra bir cevap çıkarın veya oluşturun. Bu gün RAG boru hattının temel taşıdır.
- **Generative / Closed-book QA.**Büyük bir dil modeli parametrik hafızasından cevap verir.

2026'daki eğilim hibriddir: en iyi birkaç pasajı geri almak, sonra da bu pasajlarda yerleşik bir cevap vermesi için bir jeneratif model oluşturmak. Bu RAG, ve ders 14 geri alım yarısını derinlemesine kapsar. Bu ders, QA yarısını oluşturur.

## Anlaşım

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**Bir transformatörle birlikte soru ve geçiş kodlayın (BERT ailesi). Cevabın başlangıç ve son belirtiler indeksi tahmin eden iki başı eğitiniz. Kayıp geçerli pozisyonlar üzerinde çapraz entropi. Çıkış geçiden bir uzaktır. Asla halüsinasyon yapmaz (konstrüksiyonla), asla geçiş cevaplayamayacak soruları ele almaz (konstrüksiyonla).

**Retrieval-augmented (RAG).**İki aşamada. Birincisi, bir retriever üstü bulur.`k`Bir kitapçıkta bir bölümden bir bölüm bulunur. İkincisi, bir okuyucu (ekstraktif veya jeneratif) bu bölümleri kullanarak cevap üretir. Retriever-okuyucu bölünmesi her birinin bağımsız olarak eğitilmesine ve değerlendirilmesine izin verir. Modern RAG genellikle aralarında bir reranker ekler.

**Generative.**Sadece dekodörlü bir LLM (GPT, Claude, Llama) öğrenilen ağırlıklardan cevaplar verir. İzleme adımları yoktur. Genel bilgiye mükemmel, nadir veya son gerçeklerde felaketli. Halüsinasyon oranı eğitim öncesi verilerdeki gerçek sıklığı ile ters olarak ilişkilidir.

```figure
qa-span
```

## Yapın

### Adım 1: önceden eğitilmiş bir model ile ekstraksiyonsal QA

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

`deepset/roberta-base-squad2`Bu program, cevaplanamayan sorular içeren SQuAD 2.0 üzerinde eğitim almıştır.`question-answering`pipeline, modelin sıfır puanı kazanırsa bile en yüksek puan alanı gönderir  *not* otomatik olarak boş bir cevap gönderir. Açık bir " cevap verilmemesi " davranışını elde etmek için geç `handle_impossible_answer=True`Pipeline çağrısına: Pipeline, yalnızca sıfır puan her zaman puanı aşırsa boş bir cevap verir.`score`Her iki taraftan da.

### Adım 2: Arama ile artırılmış bir boru hattı (sket)

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

İki aşamalı boru hattı. Dense retriever (Sentence-BERT) anlamlı benzerlik ile ilgili pasajlar bulur. Ekstraktif okuyucu (RoBERTa-SquAD) top pasajlardan cevap aralığını çekir. Küçük korpuslarda çalışır.

### Adım 3: RAG ile üreticidir

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

Hızlı bir örneğe önem verir. Modele bağlamda yerleştirilmesini açıkça söylemek ve bağlam yetersiz olduğunda "Bilmiyorum" diyerek halüsinasyon oranlarını naif bir uyarı ile karşılaştırıldığında 40-60% azaltır. Daha karmaşık örnekler alıntılar, güven puanları ve yapılandırılmış çıkarma ekler.

### Dördüncü adım: Gerçek dünyayı yansıtan değerlendirme

SQuAD kullanımı **Exact Match (EM)**ve **token-level F1**- Evet . EM, normallaşmadan sonra sıkı bir eşleşme (büyük yazılar, çizgi noktalama, makale çıkarma)  ya tahmin tam olarak eşleşir ya da 0 puan alır. F1 tahmin ve referans arasındaki token örtüşmesi üzerinden hesaplanır ve kısmi kredi verir. Her iki kredi altındaki parafrasi: "29 Haziran 2007" vs "29 Haziran 2007" tipik olarak 0 EM (ordinal kesinti normallaşması) alır, ancak yine de üst üste gelen jetonlardan önemli bir F1 kazanır.

Üretim için QA:

- **Answer accuracy**(LLM veya insan tarafından değerlendirilmiş, çünkü ölçümler semantik eşdeğerliği yakalamamaktadır).
- **Citation accuracy.**İfadelenen pasaj gerçekten cevabı destekliyor mu?
- **Refusal calibration.**Cevap alınan bölümlerde bulunmadığında, sistem doğru bir şekilde "Bilmiyorum" der mi?
- **Retrieval recall.**Okuyucuyu değerlendirmeden önce, geri alıcıya en üst kısmına doğru geçiş sağlıyor mu ölçün.`k`Bir okuyucu kayıp bir pasajı düzeltemez.

### RAGAS: 2026 üretim değerlendirme çerçevesini

`RAGAS`RAG sistemleri için özel olarak inşa edilmiş ve 2026'da gemilerde standart olarak kullanılır. Altın referansların gereksiz olduğu dört boyutlu bir puan elde eder:

- **Faithfulness.**Cevabın her iddiası alınan bağlamdan geliyor mu?
- **Answer relevance.**Cevabın soruyu cevapladığını mı? Cevabın hipotetik soruları oluşturarak ve gerçek soruya karşılaştırarak ölçülür.
- **Context precision.**Alınan parçalardan hangi bölümü gerçekten önemli?
- **Context recall.**Alınan set tüm gerekli bilgileri içeriyor muydu? Düşük hatırlama = okuyucu başarılı olamaz.

Referanssız puanlama, canlı üretim trafiğini kurate altın cevaplar olmadan değerlendirmenizi sağlar.

`pip install ragas`Retriever + Reader'i bağlayın, her soruya 4 skalar alın.

## Kullan

2026'da.

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

Ekstraktif QA 2026'da modası kalmadı çünkü LLM ile RAG daha fazla dava ele alıyor.

## Gönder

- Kaydet .`outputs/skill-qa-architect.md`- ...

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

## Egzersizler

1. **Easy.**SQuAD çıkarım borusunu yukarıda 10 Wikipedia pasajına ayarlayın. El sanatı 10 soru. Cevabın ne kadar sık doğru olduğunu ölçün.
2. **Medium.**Bir reddetme sınıflandırıcısı ekleyin. En üst geri alınma puanı bir eğimden aşağı olduğunda (deyelim 0.3 cosine), okuyucuyu aramak yerine "Bilmiyorum" i geri verin. Eğimleri bir sürede tutunmuş bir set üzerinde ayarlayın.
3. **Hard.**Seçtiğiniz 10.000 belge korpusunda RAG boru hattı oluşturun. RRF füzyonu ile hibrit geri alımı (BM25 + yoğun) uygulayın (derse 14)

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## Daha Fazla Okumak

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) referans kağıdı.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR, QA için kanonik yoğun geri alıcı.
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)- RAG adını veren gazetede.
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) kapsamlı RAG araştırması.
