# Capstone 08  Regulated Vertical için üretim RAG Chatbot

> Harvey, Glean, Mendable ve LlamaCloud, 2026'da aynı üretim şeklini kullanıyor. Görüntüler için docling veya Unstructured ve ColPali ile içebilirsiniz. Hibrit arama. Bge-Renker-v2-gemma ile yeniden sıralama. 60 ila 80% hit oranıyla hızlı önbelleğe girerek Claude Sonnet 4.7 ile sentezle. Llama Gardiyası 4 ve NeMo Gardiyası. Langfuse ve Phoenix'e dikkat edin. 200 sorunun altın setiyle RAGAS'la puan al. Yasal, klinik, sigorta alanında bir tane yapın ve son taş altın set, kırmızı takım ve sürükleme desti geçiyor.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## Sorun

Yönetim alanı RAG (yasal sözleşmeler, klinik deneme protokolleri, sigorta politikaları) 2026'da en çok gönderilen üretim şeklidir çünkü ROI açık ve tehlikeler somut. Harvey (Allen & Overy) yasal olarak inşa etti. Developer-docs gibi bir şey. Glean, kurumsal aramaları kapsar. Şekil: yüksek sadakatli içmek, yeniden sıralama ile hibrid almak, sitasyon uygulanması ve hızlı önbelleğe girmek, birden fazla güvenlik katmanı ile korumak ve sürekli sürükleme izlemek.

Zor kısmı model değil. Yönetim kurumlarına bağlı uyumluluk (HIPAA, GDPR, SOC2), alıntı seviyesindeki denetleme, maliyet kontrolü (sürekli önbelleğe girme oranı yüksek olduğunda 60-90% indirim alır), RAGAS sadakat yoluyla halüsinasyon tespit ve kaynak belgeleri indeksi yetişmeden güncellediğinde sürükleme tespitidir. Bu kap taşı, tümünü 200 soru altın bir setiyle göndermenizi ve yanında kırmızı takım bir süitiyle.

## Anlam

Bu boru hattının iki tarafı var.**Ingestion**: docling veya Unstructured yapılandırılmış belgeler analiz eder; ColPali görsel olarak zengin olanları ele alır; parçalar özetler, etiketler ve rol tabanlı erişim etiketleri alır. vektörler pgvector + pgvector scale (50M vektörlerden aşağı) veya Qdrant Cloud'a girer; nadir BM25 yan yana çalışır. **Conversation**LangGraph belleği ve çok dönüşü işliyor; her sorgu hibrit geri alımı çalıştırıyor, bge-reranker-v2-gemma-2b ile sıralamaktadır, Claude Sonnet 4.7 ile sentezlenir (sürekli kaydedilmiş), Llama Guard 4 ve NeMo Guardrails üzerinden çıkış gönderir ve sitasyonla demirlenmiş bir cevap gönderir.

Değerlendirme yığınının dört katmanı vardır.**Golden set**Doğru olması için 200 soru/ cevabı ile etiketlenmiş. **Red team**(Hapishanede kaçışlar, PII çıkarma girişimleri, alan dışı sorular) güvenlik için. **RAGAS**Sadakat / cevap doğruluğu / bağlam doğruluğu için otomatik olarak dönüştürülür. **Drift dashboard**(Arize Phoenix) Haftalık geri alım kalitesi ve halüsinasyon puanını izliyor.

Çabuk önbelleğe geçirme maliyet levhasıdır. Claude 4.5+ ve GPT-5+ önbelleğe geçirme sistemini destekler + alınmış bağlam. 60-80% isabet oranında, sorgu başına maliyet 3-5 kat düşer. Pipeline yüksek önbelleğe ulaşmak için sabit önlemler için tasarlanmalıdır.

## Mimarlık

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## Yüküm

- Yedik: Unstructured.io veya yapılandırılmış belgeler için docling; ColPali görsel açıdan zengin PDF'ler için
- Vektör DB: pgvector + pgvectorscale 50M vektörler altında; Qdrant Cloud başka türlü
- Sparse: Tantivy BM25 saha ağırlıkları ile
- Orkestralama: LlamaIndex Çalışma akışları (sıkıştırma) + LangGraph (düşüşme)
- Yeniden sıralama: bge-renanker-v2-gemma-2b kendi kendine konutlandırılmış veya Voyage yeniden sıralama-2 konutlandırılmış
- LLM: Claude Sonnet 4.7 hızlı önbelleğe sahip; geri dönüş Llama 3.3 70B kendi kendine barındırılmış
- Eval: RAGAS 0.2 online, DeepEval halüsinasyon ve jailbreak için
- Gözlem: Langfuse kendi kendine oturumlandırılmış not satırı; Arize Phoenix sürüklenmek için
- Guardrails: Llama Guard 4 giriş/çıktı sınıflandırıcısı, NeMo Guardrails v0.12 politikası, Presidio PII scrub
- Uyum: parçalardaki rol tabanlı erişim etiketleri; GDPR/HIPAA için yargı yetkisi etiketleri

```figure
canary-rollout
```

## Yapın

1. **Ingestion.**Yapılandırılmamış veya dokling ile corpusunuzu inceler (1000-10000 belgeyi ciddi bir yapı için). Tarama / görsel ağır sayfalar için ColPali üzerinden yönlendirin. Özetler, rol etiketleri, yargı etiketi ile parçalar üretin.

2. **Index.**Denet yerleşimler (Voyage-3 veya Nomic-embed-v2) pgvector + pgvector ölçeğine. BM25 yan indeksi Tantivy üzerinden.

3. **Hybrid retrieve.**Önce rol+yurt yetkisi ile filtre; sonra paralel yoğun + BM25; karşılıklı sıra birleşimi ile birleşir; üst 20'e yeniden sıralamacı; üst 5'e senet.

4. **Synthesize with prompt caching.**Sistem istekleri + önbelleğe başlıklı statik politikalar; önbelleğe uzantı olarak bağlamı yeniden sıralama; önbelleğe girmeyen bir ek olarak kullanıcı sorusu.

5. **Guardrails.**Llama Guard 4 giriş üzerinde; NeMo Guardrails rayları alan dışı soruları veya politika yasak konuları engeller; Presidio çıkışta kazayla PII'yi temizler; alıntı uygulaması sonrası filtre.

6. **Golden set.**200 soru/ cevabı çiftleri, alan uzmanı tarafından ( yanıt, alıntı) ile etiketlenmiştir.

7. **Red team.**50 karşıtlıklı ipucu: hapishanede sızma (PAIR, TAP), PII'yi sızdırma girişimleri, alan dışı sızmalar, yargı alanları arası sızmalar.

8. **Drift dashboard.**Arize Phoenix, her hafta alıntı kalitesi (nDCG) izlemesini takip ediyor.

9. **Cost report.**Langfuse: prompt-caching hit rate, sorgu başına token, $/soru aşamaları.

## Kullan

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Gönder

`outputs/skill-production-rag.md`Yüklenme değerini açıklar. Uyumlulık etiketleri ile yerleştirilen, rubrika üzerinden geçen ve canlı sürükleme izleme ile gözlemlenen düzenlenmiş alanlı bir chatbot.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## Egzersizler

1. Farklı bir yargı alanında ikinci bir corpus parçası oluşturun (örneğin, HIPAA ve GDPR ile birlikte). 20 soru çapraz yargı alanı araştırmasında çapraz sızıntıların önlenmesini sağlayan rol + yargı alanı filtrelerini gösterin.

2. Bir haftalık üretim trafiği boyunca önbelleği kullanma oranını ölç. Hangi sorguların önbelleği kırdığını belirleyin. Yenilenme.

3. 10k jeton bir özet tamponu ile çok dönüşlü belleği ekleyin.

4. Claude Sonnet 4.7'i Llama 3.3 70B'ye değiştir.

5. "Kesin olmayan" bir mod ekleyin: Eğer en yüksek yeniden sıralamalı puanlar bir eşiğin altında ise, ajan cevap vermek yerine "İnançlı alıntılar yapmıyorum" der.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## Daha Fazla Okumak

- [Harvey AI](https://www.harvey.ai) Referans yasal üretim aşaması
- [Glean enterprise search](https://www.glean.com) Girişimsel ölçekte referans RAG
- [Mendable documentation](https://mendable.ai) geliştiriciler-doklar RAG referansı
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) Yönetilen içme
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) maliyet levha referansı
- [RAGAS 0.2 documentation](https://docs.ragas.io/) Kanonik RAG değerlendirme çerçevesini
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) Referans sürükleme gözlemlenebilirliği
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) 2026 güvenlik sınıflandırması
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Politika demiryolu çerçevesini
