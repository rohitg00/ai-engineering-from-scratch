# Ajan Gözlem: Langfuse, Phoenix, Opik

> Langfuse (MIT)  6M+ yükler/ay, izleme + istintap yönetimi + değerlendirmeler + oturum tekrarlama. Arize Phoenix (Elastic 2.0)  derin ajan özelliği değerlendirmeler, RAG bağlamlılığı, OpenInference otomatik aletleştirme. Comet Opik (Apache 2.0)  otomatik istintap optimizasyonu, guardrails, LLM yargıç halüsinasyon tespit.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## Öğrenme Hedefleri

- Üç en iyi kendi kendine konutlanabilir ajan gözlemleme platformu ve lisanslarını isimlendirin ve hangisinin OSI açık kaynaklı olmadığını söyleyin.
- Her birinin en güçlü özelliklerini ayırt edin: Langfuse (sürekli mgmt + seanslar), Phoenix (RAG + otomatik aletleştirme), Opik (optimize + koruma).
- Neden% 89'u 2026 yılına kadar ajan gözlemlenebilirliği olduğunu bildirir?
- LLM yargıç değerlendirme ile bir stdlib izleme-dashboard borusu uygulamak.

## Sorun

OTel GenAI (Denev 23) size şema veriyor. Hala genişlikleri yedikleri, değerlendirmeleri çalıştıran, sürpriz sürümleri saklayan ve geri dönüşleri yüzeyleyen bir platform gerekiyor.

## Anlaşım

### Langfuse (MIT)

- 6M+ SDK yüklemeleri / ay, 19k+ GitHub yıldızları.
- Özellikler: izleme, sürümleme + oyun alanı ile hızlı yönetim, değerlendirmeler (LLM-as-judge, kullanıcı geri bildirimi, özel), oturum yeniden düzenlemeleri.
- Haziran 2025: Eskiden ticari modüller (LLM-as-a-judge, notasyon kuyrukları, hızlı deneyler, Oyun Alanı) MIT altında açık kaynaklı.
- En güçlü: Sonundan sonuna kadar gözlemlenebilirlik ve sıkı bir çabuk yönetim döngüsü.

### Arize Phoenix (Elastik Lisans 2.0)

- Daha derinlemesine ajan özel değerlendirme: iz kümeleri, anomali tespit, RAG için geri alınma derecesi.
- Doğal OpenInference otomatik aletleşmesi.
- Üretim için yönetilen Arize AX ile çiftler.
- Daha geniş platformlarla birlikte hareket/hırs-hırs-i geri dönüş aracı olarak konumlandırılan  hızlı bir sürümleme yok.
- RAG'ye göre en güçlü olan: RAG'ye göre, davranışsal sürükleme, anormallik tespiti.

### Komet Opik (Apache 2.0)

- A/B deneyleri ile otomatik hızlı optimizasyon.
- Koruma çemberleri (PII redaksiyonu, topikal kısıtlamalar).
- LLM yargıç halüsinasyon tespit.
- Comet'in kendi ölçümlerinden alınan referans: Opik logları + 23.44s vs Langfuse 327.15s'deki değerlendirmeler (~ 14x fark)  tedarikçi referanslarını yönlendirici olarak kabul ederler.
- En güçlü: optimizasyon döngüsü, otomatik deney, koruma koruma.

### Endüstri verileri

Maxim'e göre (2026 alan analizi): Organizasyonların %89'unun ajan gözlemliliği vardır; kalite sorunları en büyük üretim engelli (32%'si bunları belirtir).

### Bir tane seçmek

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### Bu kalıp yanlış gittiğinde

- **No eval strategy.**Değerlendirme olmadan izleme sadece pahalı bir tahtalama.
- **Self-rolled LLM-judge without grounding.**CRITIC model (Deneyim 05) uygulanır  hâkimler gerçekleri doğrultmak için dış araçlara ihtiyaç duyar.
- **Prompt versions not tied to traces.**Prud geri döndüğünde, onu yaratan uyarıya göre bölünemezsin.

```figure
wb-trace-ingest
```

## Yapın

`code/main.py`STDlib iz toplayıcı + LLM yargıç değerlendirici uyguluyor:

- GenAI şeklinde spanslar iç.
- Sessiyonlara göre gruplama, etiketlenmiş çalışmalar (güvenlik yolculukları, düşük güven değerlendirmeleri).
- Bir bölümde temsilci yanıtlarını notlayan bir yazılı LLM yargıç.
- Bir tabloya benzer bir özet: başarısızlık oranı, en büyük başarısızlık nedenleri, değer puanları dağılımı.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktı: Sessiyon başına değerlendirme puanları ve Langfuse/Phoenix/Opik'in gösterdiği eşleşen başarısızlık kategorisasyonu.

## Kullan

- **Langfuse**Kendi kendine barındırılmış veya bulut; tel üzerinden OTel veya SDK'leri.
- **Arize Phoenix**Kendi kendine barındırılmış; otomatik alet OpenInference.
- **Comet Opik**Kendi kendine barındırılmış veya bulut; otomatik optimizasyon döngüsü.
- **Datadog LLM Observability**- Evet. - Evet. - Evet.

## Gönder

`outputs/skill-obs-platform-wiring.md`bir platform seçer ve izler + değerlendirmeler + istekli sürümleri mevcut bir ajanı içine bağlar.

## Egzersizler

1. Bir hafta süren OTel izlerini Langfuse bulutuna aktarın.
2. Bölümünüz için bir LLM yargıç rubrik yazın (gerçek doğruluk, ton, kapsamın uygulanması). 50 iz üzerinde test.
3. Langfuse'nin sürüm sürümlerini Phoenix'in iz kümelerine karşılaştırın.
4. Opik'in güvenlik belgeleri oku, ajanlarından birine birinin güvenlik belgesini bağla.
5. Üçünü de işaretleyin, satıcı tarafından yayınlanan rakamları görmezden gelin, kendi rakamlarınızı ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## Daha Fazla Okumak

- [Langfuse docs](https://langfuse.com/) izleme, değerlendirme, acil mgmt
- [Arize Phoenix docs](https://docs.arize.com/phoenix) Otomatik aletleşme, sürükleme
- [Comet Opik](https://www.comet.com/site/products/opik/) Optimize + koruma
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) üçü de tüketen şema
