# Kırmızı Takım Araçlama  Garak, Llama Gardiyan, PyRIT

> 2026'da üç üretim aracı kırmızı takım yığınına çerçeveye girer. Llama Guard (Meta)  Llama-3.1-8B sınıflandırıcısı, 14 MLCommons tehlike kategorisi üzerinde ince ayarlanmıştır; 2025 Llama Guard 4 Llama 4 Scout'tan kesilmiş bir 12B doğuştan multimodal sınıflandırıcıdır. Garak (NVIDIA)  Halüsinasyon, veri sızıntısı, hızlı enjeksiyon, toksisite ve jailbreaks için statik, dinamik ve uyarlayıcı araştırmalarla açık kaynaklı LLM hassaslık tarayıcısı. PyRIT (Microsoft)  Crescendo, TAP ve derin sömürü için özel dönüştürücü zincirleri ile çok yönlü kırmızı takım kampanyaları. Llama Guard 3 Meta'nın "Llama 3 Herd of Models" (arXiv:2407.21783); Llama Guard 3-1B-INT4 arXiv:2411.17713; Garak'ın github.com/NVIDIA/garak'daki sondarchitektüründe belgelendirilir. Bu araçlar, 2026 yılındaki kırmızı ekip araştırmaları (Deneyim 12-15), ve dağıtım (Deneyim 17+) arasındaki üretim arayüzüdür.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Güvenlik yığınında Llama Guard 3/4'ün konumunu açıklayın: giriş sınıflandırıcısı, çıkış sınıflandırıcısı veya her ikisi de.
- MLCommons'un 14 tehlike kategorisini ve açık olmayan bir risk kategorisini (Kod Anlatıcısı İstifadesi) belirtin.
- Garak'ın sondası mimarisini anlat: sondlar, dedektörler, harneleri.
- PyRIT'in çok dönüşlü kampanya yapısını ve Garak araştırmaları ile nasıl birleştirildiğini açıklayın.

## Sorun

Ders 12-15 saldırı yüzeyini sunar. Üretim dağıtımları tekrarlanabilir, ölçeklenebilir değerlendirme gerektirir. 2026 yılında üç araç hakim olur: Llama Guard (savunma sınıflandırıcısı), Garak (skaner), PyRIT (kampanyası orkestrasyonu). Her biri kırmızı takım yaşam döngüsünün farklı bir katmanını hedef alır.

## Anlaşım

### Llama Gardiyanı (Meta)

Llama Guard 3, MLCommons AILuminate 14 kategorisi üzerinde giriş/çıkan sınıflandırması için ince ayarlanmış Llama-3.1-8B modeli:
- Şiddetli suçlar, şiddetli olmayan suçlar, cinsel ilişki, CSAM, hakaret
- Uzman tavsiye, gizlilik, IP, ayrımcılıktan uzak silahlar, nefret
- İntihar/kendine zarar vermek, cinsel içerik, seçimler, kod yorumcularının kötüye kullanımı

8 dil destekler. Kullanım: LLM'den önce (girin moderasyonu), LLM'den sonra (çıkan moderasyonu) veya her ikisinden sonra yerleştir.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, mobil CPU'da ~ 30 token/s) kuantüze edge varianıdır.

Llama Guard 4 (April 2025) 12B, doğuştan multimodal, Llama 4 Scout'tan kesilmiştir.

### Garak (NVIDIA)

Açık kaynaklı güvenlik açığı tarayıcısı.
- **Probes.**Halüsinasyon, veri sızması, hızlı enjeksiyon, toksisite, jailbreak için saldırı jeneratörleri.
- **Detectors.**Beklenen başarısızlık modlarına karşı puanlama sonuçları  toksik, sızmış, hapsedilmiş.
- **Harnesses.**Sonda-detektor çiftlerini yönet, kampanyalar yürüt, raporlar oluştur.

TrustyAI, Garak'ı Llama-Stack kalkanlarıyla (Prompt-Guard-86M giriş sınıflandırıcısı, Llama-Guard-3-8B çıkış sınıflandırıcısı) en-to-end kalkanlı hedef değerlendirmesi için entegre eder. Dönem tabanlı puanlama (TBSA) ikili geçiş / başarısızlığı değiştirir.

### PyRIT (Microsoft)

Python Risk Identification Toolkit. Çok yönlü kırmızı takım kampanyaları.
- **Converters.**Bir tohum sorguyu dönüştürün  parafrase, kodlama, çevirme, rol oynatma.
- **Orchestrators.**Kampanyayı yürüt: Crescendo (eskalasiyon), TAP (branching), RedTeaming (sözlü döngü).
- **Scoring.**Yargıç olarak veya yargıç olarak sınıflandırıcı olarak.

PyRIT, Garak'ın ağır kuzeni. Garak binlerce tek dönüşlü sondayı yürütür; PyRIT, belirli başarısızlık modlarını kırmak için tasarlanmış derin çok dönüşlü kampanyaları yürütür.

### - Yığın.

Llama Guard'ı modelin her iki tarafına koyun. Geri dönüş için Garak'ı gece çalıştırın. Ön yayın kampanyaları için PyRIT çalıştırın. Bu 2026'da çoğu üretim dağıtımında varsayılan yapılandırma.

### Değerlendirme tuzağı

- **Judge identity.**Üç alet de bir LLM yargıçı kullanabilir; yargıç kalibrasyon sürücüleri ASR'leri (Denevi 12) rapor etti.
- **Probe staleness.**Garak araştırmacıları modellerin karşısında yapıştırıldığında yaşlanır. Adaptif araştırmacılar (PAIR şeklinde) statik araştırmacılardan daha yavaş yaşlanır.
- **Llama Guard FPR on benign content.**Erken Llama Guard sürümleri, aşırı derecede politik ve LGBTQ+ içeriği vardı; Llama Guard 3/4 kalibrasyonları geliştirildi ancak dağıtım başına kalibrlenmedi.

### Bu 18 fazaya uygun.

Ders 12-15 saldırı aileleri. Ders 16 üretim araçları. Ders 17 (WMDP) çift kullanım kabiliyetinin değerlendirilmesidir. Ders 18 bu araçları bir politika yapısına sarılan sınır güvenlik çerçeveleri.

```figure
al-guard-stack
```

## Kullan

`code/main.py`Oyuncak bir Llama Guard tarzı sınıflandırıcı ( anahtar kelime + 14 kategoride semantik özellikler), oyuncak bir Garak harnes (sonde-detektor döngüsü) ve PyRIT tarzı çok dönüştürücü zincir inşa eder.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-red-team-stack.md`- Uygulama tanımını göz önünde bulundurarak, üç araçtan hangisinin uygun olduğunu, her birinde neyi yapılandırması ve hangi gerileme kadenci çalıştırılması gerektiğini belirler.

## Egzersizler

1. Çık .`code/main.py`Llama-Guard tarzı sınıflandırıcısının tek dönüşlü ve çok dönüşlü saldırılarda algılama oranını karşılaştırın.

2. Yeni bir Garak sondeyi uygulayın: base64 kodlanmış zararlı bir taleb.

3. PyRIT tarzı dönüştürücü zincirini "Fransızca çevir, sonra parafrase" dönüştürücü ile uzatın.

4. Llama Guard 3'ün tehlike kategorileri listesini okuyun. Eğitim verilerinin gerçekçi bir şekilde yasal geliştiriciler içerikleri üzerinde yüksek yanlış pozitif oranlar ürettiği iki kategorinin belirlenmesi.

5. Garak ve PyRIT'in tasarım ilkelerini karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Llama Guard | "the classifier" | Fine-tuned Llama-3.1-8B/4-12B safety classifier with 14 hazard categories |
| Garak | "the scanner" | NVIDIA open-source vulnerability scanner; probes, detectors, harnesses |
| PyRIT | "the campaign tool" | Microsoft multi-turn red-team orchestrator; converters, orchestrators, scoring |
| Prompt-Guard | "the small classifier" | Meta's 86M prompt-injection classifier, paired with Llama Guard |
| TBSA | "tier-based scoring" | Garak's tier-based pass/fail replacing binary outcomes |
| Converter chain | "paraphrase + encode + ..." | PyRIT composition primitive for building multi-step attacks |
| MLCommons hazard categories | "the 14 taxonomies" | Industry-standard taxonomy Llama Guard targets |

## Daha Fazla Okumak

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) 8B sınıflandırıcısı
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) Kvantistik mobil sınıflandırıcı
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) tarayıcı repo ve belgeleri
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) kampanya araçları
