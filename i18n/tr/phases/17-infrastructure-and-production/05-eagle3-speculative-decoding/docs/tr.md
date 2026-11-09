# EAGLE-3 İsteğe bağlı Çözümleme

> Tahmin edici çözme, hızlı bir taslak modeli hedefli modelle eşleştirir. Özet K tokenleri önerir; hedef tek bir ilerileme ile doğrulanır; kabul edilen tokenler ücretsizdir. 2026 yılında EAGLE-3 üretim derecesi varyasyonudur. Genel sohbette kabul oranı alfa'yı 0.6-0.8 bantına itip, ham toponlar yerine hedef modelin gizli durumlarında bir taslak başını eğitir. Doğru soru "Taplama ne kadar hızlı" değil "Trafikimde alfa nedir?" Eğer alfa ~ 0.55'in altına düşerse, spekülatör çözme yüksek eşzamanlılıkta net negatif olur çünkü reddedilen her taslama ikinci hedef ileri geçiş maliyetini öder. Bu ders önce alfa ölçmeyi ve ikinci olarak bayrağı çevirmeyi öğretir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Üç nesil spekülatör kodlama yöntemini anlatın ve EAGLE-3'ün EAGLE-2'den ve klasik bir taslak modelinden neyi değiştirdiğini açıklayın.
- Kabul oranı alfa'yı tanımlayın, alfa ve K'den beklenen hızlandırmayı hesaplayın (çeft uzunluğu) ve hedef eşzamanlılığınız için kırılma oranı alfa'yı belirleyin.
- Spekülatör çözümü vLLM 2026'da neden seçme (devayla değil) olduğunu ve alfa ölçümsüz olarak açılmasının neden üretim karşıtı bir örneğe sahip olduğunu açıklayın.
- Bir ölçüm planı yazın: hangi referans değerini, hangi dağıtımını uyarır, hangi eşzamanlılık noktasını, hangi metrikleri kapatacak.

## Sorun

H100'de Llama 3.3 70B FP8 çalıştırılan bir H100'de, her dekode adımı HBM'den tüm ~70 GB ağırlıkları okur ve her diziye bir token gönderir. GPU hesaplama dekode sırasında neredeyse boştur.

Speküel dekodlama boşluğu kullanır. K aday tokenlerini ucuz bir taslak modeli ile oluşturun, sonra hedef modelden tüm K'yi tek bir ileri geçitle doğrulamalarını isteyin. Her doğrulanmış token etkin olarak ücretsizdir (hedef her şekilde yapmalıydı).

Klasik taslak model yaklaşımı aynı ailenin daha küçük bir modelini kullanır (Llama 3.2 1B taslak Llama 3.3 70B için). Çalışır ama kabul oranı orta  daha küçük model dağıtım hedeften farklıdır. EAGLE, sonra EAGLE-2, sonra EAGLE-3 bir hafif çekim başını hedefin iç durumlarına doğrudan yönlendirir. Böylece çekim dağıtımı hedefi çok daha yakından takip eder. Bu yüzden alfa, 0.4'ten EAGLE-3'e 0.6-0.8'e gidiyor.

Yaptığımız şey: EAGLE-3 2026'da vLLM'ye katılmayı seçti.`speculative_config`Alfa trafiğini ölçmeden onu açan takımlar, genellikle kuyruğun gecikmesini daha kötü, daha iyi görüyor.

## Anlaşım

### Spekülatör çözme aslında ne satın alır

Spec kodlaması olmadan, bir token maliyeti bir hedef ileri.`1 + K * alpha`Hızlandırma .`(1 + K * alpha) / (1 + epsilon)`Epsilon'un K=5, alfa=0.7 için,`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`Gerçek dünya rakamları 2-3 kat gruplanır çünkü alfa, üretim trafiğinde nadiren o kadar yüksek olur ve epsilon, yüksek seri büyüklüğünde büyür.

### Neden alfa önemli olan tek metrik?

reddedilen tokenler kaybolmaz  ilk reddedilen token için ikinci bir hedef zorlar. Alfa'nın 0.4'e düştüğü bir iş yükünde, çekim ödemesi artı doğrulama artı yeniden çalıştırma ödenir. Yüksek eşzamanlılık (deyelim 256 eşzamanlı), dekodlama parti zaten "tek hedef" ve "target verify" arasındaki hafıza-bandwidth boşluğu küçülmeye yeterlidir. 2026 donanımlarının çoğunda alfa 0.55'in altında, spesifikasyon çözümü net negatif.

Alfa iş yüküne göre değişir. ShareGPT tarzındaki genel sohbette, ShareGPT'de eğitilmiş EAGLE-3 0.6-0.8'e ulaştı. Alan-specifik trafik (kod, tıbbi, hukuki) genel veri eğitimi alanı başkanının sayısı 0.4-0.6'a düşüyor. Alan-specifik bir taslak başını eğitmek, hedef inceleme ile karşılaştırıldığında hafif ve hızlı bir eğitim işidir. 7 · 16 ve 10 · 15 aşamaları daha yüksek değerlere (0,85 ve üstü) değerdir. Bu, çekimdeki eğitim verilerine uyan sohbet referansları için bir token oranları. Bu sayfadaki bantlarla plan yapın ve Alpha'yı kendi trafiğinizle ölçün.

### KİÇİN nesilleri bir bakışta

- **Classic draft model**Alfa 0.3-0.5. Altyapı basit  iki model yüklü, proje hedefe K ileri gidiyor.
- **EAGLE-1 (2024)**Alfa ~ 0,5 - 0,6 . Hedeflerin üstündeki küçük parametre.
- **EAGLE-2 (2025)**: adaptif taslak uzunluğu ve ağaç tabanlı taslaklar (bir hedef geçitinde birden fazla dalı doğrulayın). Alfa ~ 0.6-0.7. Daha karmaşık taslak programcı.
- **EAGLE-3 (2025-2026)**: Draft başı birden fazla hedef katman üzerinde eğitilmiştir (son değil), daha iyi bir uyum.

### 2026 üretim tarifi

1. Görevli model açık. Temel TTFT, ITL, hedef eşzamanlılıktan geçiş ölçülür.
2. EAGLE-3 taslakını vLLM üzerinden etkinleştir `speculative_config`- Benchmark'ı tekrar çalıştır.
3. Günlük kabul oranı alfa. vLLM V1 bunu  olarak bildirir.`spec_decode_metrics.accepted_tokens_per_request`Alfa elde etmek için istenen çekim uzunluğuna bölün.
4. Eğer alfa < 0,55 üretim trafiği dağılımında ise, spesifikasyonları çözmeyi engelle veya alanı özel bir EAGLE-3 taslakını çalıştırın.
5. P99 ITL'nin daha da kötüleşmediğini doğrulayın.

### Üretim sıkıntısı: P99 kuyruğu

P99'un ayarlanmaması durumunda daha da kötü olabilir. reddedilen taslaklar iki geçiş dizisini tetikler (taslak + doğrulama başarısızlığı + yeniden kaydırma). Tam parti altında, bu iki geçiş seriye edilir. P99 ITL'ye bak, P50 değil.

### EAGLE-3'ün zaten kullanıldığı yerler

Google 2025 yılında AI Özetlerinde spekülatör çözümü (aynı kalite, daha hızlı yanıt) yerleştirdi. vLLM V1 gemileri `speculative_config`SGLang, önleme ağır iş yükleri için önerilen taslak yolu olarak EAGLE-3'i destekler.

### Bir satırdaki matematikleri düzeltmek

Beklenen hızlandırma: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`- Yapılandırma`S = 1`alfa için çözünür: `alpha_breakeven = verify_overhead / K`. Tipik verify_overhead ~0.15 ve K=5: `alpha_breakeven = 0.03`Bu durum, çürük dekod matematikidir. Yüksek eşzamanlılıklarda doğrulama üstü maliyetleri artıyor ve dekod partiyası zaten hafıza okumalarını sekanslar boyunca amortize eder, bu yüzden etkili alfa_breakeven pratikte ~0.45-0.55'e tırmanır.

### Tahmin edici şifrelemeyi ne zaman kullanmamak gerekir

- Batch-1 offline jenerasyonu, gecikme önemi olmayan.
- Çok kısa çıkışlar (50 token altında) Draft overhead ve verification cost baskın.
- Özel alanlar, alan eğitimi olmayan bir başlık.
- Her özellik çiftinin oluştuğunu varsayarak. Versiyonunuz için vLLM uyumluluk matrisini kontrol edin: v0.18.0 parçacık prefill ile uyumlu spekülasyonlu çözümü işaretler.

```figure
mx-speculative-tree
```

## Kullan

`code/main.py`K. bir dizi alfa değer ve taslak uzunlukları boyunca spekülasyonsal dekodlama ile ve olmadan bir dekodlama döngüsünü simüle eder. K. koparma alfa, ölçülen hızlanma ve kuyruğu davranışını yazdırırır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-eagle3-rollout.md`. Hedef model, trafik dağılımının açıklaması ve eşzamanlılık hedefi göz önüne alındığında, aşamalı bir EAGLE-3 dağıtım planı  referans tabanı üretir, yapılandırmayı, alfa ölçümünü, alfa >= 0.55, P99 ITL'yi etkinleştirir.

## Egzersizler

1. Çık .`code/main.py`K=5'te 2x hızlandırmak için hangi alfa'ya ihtiyacınız var? 3x hızlandırmak için?
2. Üretim trafiğinin %70 genel sohbet, %30 kod bölüştüğünü düşünün. Genel sohbet, ShareGPT'de eğitilmiş EAGLE-3 ile alfa 0.7'e ulaşır; kod alfa 0.4'e ulaşır.
3. VLLM oku `speculative_config`Doküman. Üç modun (Müzikli model, EAGLE, N-gram) adını verin ve vLLM versiyonunuzda her birinin hangi özellikleri oluşturduğunu kontrol edin.
4. EAGLE-3'i etkinleştirdikten sonra ortalama ITL'de %25 düşüş görüyorsunuz ama P99 ITL'de %15 artış var.
5. Llama 3.3 70B için EAGLE-3 çekim başlığının hafıza maliyetini hesaplayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | Propose K tokens with a cheap model, verify all K in one target forward |
| Acceptance rate alpha | "spec accept rate" | Fraction of draft tokens accepted by the target; the only metric that matters |
| Draft length K | "spec k" | How many tokens the draft proposes per target forward; typical 4-8 |
| Verify overhead epsilon | "spec overhead" | Extra cost to verify-and-reroll vs a plain target forward; grows with batch |
| EAGLE-3 | "latest EAGLE" | 2025-2026 variant; trains draft head on multiple target layers; alpha 0.6-0.8 on general chat |
| `speculative_config` | "vLLM spec config" | The explicit opt-in in vLLM V1; no default means no acceleration |
| N-gram spec decode | "N-gram draft" | GPU-side draft using N-gram lookups in the prompt; chunked-prefill-compatible |
| Break-even alpha | "no-op alpha" | Alpha at which spec decode gives zero speedup; watch this at production concurrency |
| Rejected-draft two-pass | "reroll cost" | Two target forwards when drafts reject; drives P99 tail |

## Daha Fazla Okumak

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) yetkili kaynak `speculative_config`V1'de parçalanmış prefill uyumluluğu.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) tam alan seti.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) orijinal EAGLE çekim başlığı formülasyonu.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) Adaptif taslaklar ve ağaçlar.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) Spekülatör çözme ile verimli LLM sistemi.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) Üretim başlatma kontrol listesi.
