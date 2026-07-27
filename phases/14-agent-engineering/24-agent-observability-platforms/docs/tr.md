# Agent Observability: Langfuse, Phoenix, Opik

> Üç açık kaynaklı agent observability platformu 2026'ya hakimdir. Langfuse (MIT) — 6 milyonun üzerinde kurulum/ay, izleme + prompt yönetimi + değerlendirmeler + oturum tekrarı. Arize Phoenix (Elastic 2.0) — derin agent'ye özgü değerlendirmeler, RAG alaka düzeyi, AçıkInference otomatik enstrümantasyon. Comet Opik (Apache 2.0) — otomatik prompt optimizasyonu, korkuluklar, LLM-yargıç halüsinasyon tespiti.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 23 (OTel GenAI)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- En iyi üç açık kaynaklı agent observability platformunu ve lisanslarını adlandırın.
- Her birinin en güçlü olduğu şeyi ayırt edin: Langfuse (prompt mgmt + oturumlar), Phoenix (RAG + otomatik enstrümantasyon), Opik (optimizasyon + korkuluklar).
- Kuruluşların %89'unun neden 2026 yılına kadar agent observability'ye sahip olduğunu bildirdiğini açıklayın.
- Yüksek Lisans-yargıç değerlendirmesiyle stdlib izlemeden kontrol paneline giden bir ardışık düzen uygulayın.

## Sorun

OTel GenAI (Ders 23) size şemayı verir. Yayılmaları alan, değerlendirmeleri çalıştıran, prompt sürümleri depolayan ve regresyonları ortaya çıkaran bir platforma hâlâ ihtiyacınız var. Üç yarışmacının her biri yaşam döngüsünün farklı bölümlerini vurguluyor.

## Konsept

### Langfuse (MIT)

- Ayda 6 milyondan fazla SDK yüklemesi, 19 binden fazla GitHub yıldızı.
- Özellikler: izleme, sürüm oluşturma + oyun alanı ile prompt yönetimi, değerlendirmeler (yargıç olarak Yüksek Lisans, kullanıcı geri bildirimi, özel), oturum tekrarları.
- Haziran 2025: Eskiden ticari olan modüller (yargıç olarak Yüksek Lisans, açıklama kuyrukları, prompt deneyler, Oyun Alanı) MIT altında açık kaynaklıydı.
- En güçlüsü: sıkı prompt-yönetim döngüsüyle uçtan uca observability.

### Arize Phoenix (Elastik Lisans 2.0)

- Daha derin agent'ye özgü değerlendirme: iz kümeleme, anormallik tespiti, RAG için erişim uygunluğu.
- Yerel AçıkInference otomatik enstrümantasyon.
- Üretim için yönetilen Arize AX ile eşleşir.
- prompt sürüm oluşturma yok — daha geniş platformların yanında bir sürüklenme/davranışsal-regresyon aracı olarak konumlandırılmış.
- Şunlar için en güçlüsü: RAG alaka düzeyi, davranışsal sapma, anormallik tespiti.

### Opik Kuyruklu Yıldızı (Apache 2.0)

- A/B denemeleri aracılığıyla otomatik prompt optimizasyonu.
- Korkuluklar (PII redaksiyonu, güncel kısıtlamalar).
- Yüksek Lisans-yargıç halüsinasyon tespiti.
- Comet'in kendi ölçümünden Benchmark: Opik günlükleri + değerlendirmeleri 23,44 saniyede, Langfuse 327,15 saniyede (~14x boşluk) — satıcının benchmark'lerini yön verici olarak alın.
- En güçlü olduğu alanlar: optimizasyon döngüsü, otomatik deneyler, korkuluk uygulaması.

### Sektör verileri

Maxim'e göre (2026 saha analizi): Kuruluşların %89'unda agent observability mevcuttur; Kalite sorunları üretimin önündeki en büyük engeldir (yanıt verenlerin %32'si bu sorunları dile getiriyor).

### Birini seçiyorum

| İhtiyaç | Seç |
|------|------|
| prompt yönetimiyle hepsi bir arada | Langfuse |
| Derin RAG değerlendirmesi + sapma | Phoenix |
| Otomatik optimizasyon + korkuluklar | Opik |
| Açık lisanslama, ELv2 yok | Langfuse (MIT) veya Opik (Apache 2.0) |
| Datadog / Yeni Relic entegrasyonu | Herhangi biri — hepsi OTel'i ihraç ediyor |

### Bu modelin yanlış gittiği yer

- **Değerlendirme stratejisi yok.** Değerlendirme olmadan izleme yalnızca pahalı bir günlük kaydıdır.
- **Kendi kendine yapılan yüksek lisans hakemi, temellendirme olmadan.** CRITIC modeli (Ders 05) geçerlidir - hakemlerin gerçekleri doğrulamak için harici araçlara ihtiyacı vardır.
- **Prompt sürümler izlere bağlı değil.** Prod gerilediğinde, buna neden olan prompt'yi ikiye bölemezsiniz.

## İnşa Et

`code/main.py` bir stdlib iz toplayıcı + Yüksek Lisans-yargıç değerlendiricisi uygular:

- GenAI şeklindeki açıklıkları alın.
- Oturuma göre gruplandırma, başarısız çalıştırmaları etiketleme (korkuluk gezileri, düşük güven değerlendirmeleri).
- Bir değerlendirme tablosuna göre agent yanıtı puanlayan, senaryolu bir Yüksek Lisans jürisi.
- Gösterge tablosu benzeri bir özet: başarısızlık oranı, en önemli başarısızlık nedenleri, değerlendirme puanı dağılımı.

Çalıştır:

```
python3 code/main.py
```

Çıktı: Langfuse/Phoenix/Opik'in göstereceğiyle eşleşen oturum başına değerlendirme puanları ve başarısızlık kategorizasyonu.

## Kullan onu

- **Langfuse** kendi kendine barındırılan veya bulut; OTel veya SDK'ları aracılığıyla bağlantı kurun.
- **Arize Phoenix** kendi kendine barındırılan; otomatik enstrümanı açInference.
- **Comet Opik** kendi kendine barındırılan veya bulut; otomatik optimizasyon döngüsü.
- **Datadog LLM Observability**, halihazırda Datadog çalıştıran karma operasyonlar+ML ekipleri için.

## Gönderin

`outputs/skill-obs-platform-wiring.md` bir platform seçer ve izleri + değerlendirmeleri + prompt sürümleri mevcut bir agent'ye bağlar.

## Egzersizler

1. Bir haftalık OTel izlerini Langfuse bulutuna aktarın (ücretsiz kullanım). Hangi oturumlar başarısız oldu? Neden?
2. Alanınız için bir Yüksek Lisans değerlendirme tablosu yazın (gerçek doğruluk, üslup, kapsam uyumu). 50 iz üzerinde test yapın.
3. Langfuse prompt versiyonunu Phoenix'in iz kümelemesiyle karşılaştırın. Bu size neyin daha hızlı kırıldığını söyler?
4. Opik'in korkuluk belgelerini okuyun. agent çalıştırmanızdan birine bir PII düzenleme korkuluğu bağlayın.
5. Benchmark derleminizdeki üç. Satıcı tarafından yayınlanan numaraları dikkate almayın; kendiniz ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| İzleme | "Açıklık toplayıcı" | OTel / SDK aralıklarını kullanın; oturuma göre dizin |
| Prompt yönetimi | "Prompt CMS" | İzlere bağlı sürümlendirilmiş prompt'ler |
| Hakim olarak Yüksek Lisans | "Otomatik değerlendirme" | Bir değerlendirme tablosuna göre ayrı LLM puanları agent çıktısı |
| Oturum tekrarı | "Oynatmayı izle" | Hata ayıklama için geçmiş çalıştırmalara göz atın |
| RAG alaka düzeyi | "Geri alma kalitesi" | Alınan içerik sorguyla eşleşiyor mu |
| Kümelenmeyi izleme | "Davranışsal gruplandırma" | Sapma tespiti için benzer işlemleri kümeleyin |
| Korkuluk uygulaması | "Günlük zamanındaki politika" | Günlüğe kaydedilen içerikte kişisel bilgiler/toksisite/kapsam kontrolleri |

## Daha Fazla Okuma

- [Langfuse docs](https://langfuse.com/) — izleme, değerlendirmeler, prompt yönetim
- [Arize Phoenix docs](https://docs.arize.com/phoenix) — otomatik enstrümantasyon, drift
- [Comet Opik](https://www.comet.com/site/products/opik/) — optimizasyon + korkuluklar
- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — üçünün de tükettiği şema
