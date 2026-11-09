# A/B Testing LLM Özellikleri  GrowthBook, Statsig ve Vibes Sorunu

> Geleneksel A/B testleri belirlenmez LLM için yapılmadı. Kritik fark: değerlendirme cevapları "model işi yapabilir mi?" A / B testleri "kullanıcılar umurunda mı?" cevapları; her ikisi de gereklidir; vibe kontrolleri ile teslimat bitti. 2026'da neyi test edeceğiz: hızlı mühendislik (sözleme), model seçimi (GPT-4 vs GPT-3.5 vs OSS; doğruluk vs maliyet vs gecikme), üretim parametreleri ( sıcaklık, üst-p). Gerçek durumlar: bir chatbot ödül modeli varianti +70% konuşma uzunluğu ve +30% tutumu sağladı; Nextdoor AI konu hattı deneyleri ödül fonksiyonunu geliştirdikten sonra +1% CTR verdi; Khan Academy Khanmigo gecikme vs. matematik doğruluğu eksisinde tekrarlandı. Platform bölünmesi: **Statsig**(OpenAI tarafından Eylül 2025'te 1.1 milyar dolara satın alındı)  sıralı test, CUPED, tümü bir. **GrowthBook** açık kaynaklı, depo doğası, Bayesian + Frequentist + Sequential motorları, CUPED, SRM kontrolleri, Benjamini-Hochberg + Bonferroni düzeltmeleri. depona SQL tercihlerine göre seçersiniz ve "OpenAI tarafından satın alınması" kuruluşunuz için önemli mi.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Değerlendirme değerlerini ("model işi yapabilir mi") ve A/B testlerini ("kullanıcılar umurunda mı") ayırt edin.
- Üç test edilebilir ekseni (sürekli, model, parametreler) sayın ve her bir için metrik seçin.
- CUPED, sıralı test ve Benjamini-Hochberg çoklu karşılaştırma düzeltmelerini açıklayın.
- Depo-SQL duruşuna ve kurumsal satın alma tutumuna göre Statsig veya GrowthBook'u seçin.

## Sorun

Bir sistem uyarısını elle ayarladınız. Daha iyi hissettiriyor. Gönderirsiniz. Değişiklikler gürültüyle değişir. Metrikleri suçluyorsunuz. Yoksa yeni bir model gönderdiniz ve dönüşüm hareket etmedi.

Evals, modelin etiketlenen bir set üzerinde bir görev yapabileceğini ve yapamayacağını cevaplar. Kullanıcıların çıkışa tercih ettiğini cevaplamaz. Sadece kontrol edilen bir çevrimiçi deney buna cevap verir ve deneyin yeterli gücü varsa, belirlenmeci olmayanı kontrol eder ve birden fazla karşılaştırma için düzeltir.

## Anlaşım

### Evals vs A/B testleri

**Evals** çevrimdışı, etiketlenen set, yargıç (rubrik veya yargıç olarak veya insan olarak). Cevap: "Bu sabit dağıtımda çıkış doğru / yararlı / güvenli mi?"

**A/B test** online, canlı kullanıcılar, rastgele. Cevap: "Yeni variant önemli olan kullanıcı seviyesindeki ölçüyü değiştiriyor mu?"

Her ikisi de gereklidir. Evals, maruz kalma öncesi gerilemeleri yakalar; A/B, ürün etkisini sonrasında doğruluyor.

### Neyi test edelim

1. **Prompt engineering** kelime, sistem-sürekli yapı, örnekler.
2. **Model selection** GPT-4 vs GPT-3.5-Turbo vs Llama-OSS. Metrik: doğruluk (iş) + maliyet/ talep + gecikme P99. Çoklu hedef.
3. **Generation parameters** sıcaklık, üst-p, max_tokens. Metrik: görev-specifik (çıkış çeşitliliği vs. belirleme).

### CUPED  değişkenlik azaltımı

Kontrol edilen deneyler, deneyden önceki verileri kullanarak. Dönem öncesi varyansiyonu, sonrası varyansiyonu karşılaştırmadan önce geri çevir. Tipik varyansiyon azaltımı: 30-70%.

Uygulama: Statsig ve GrowthBook uygulaması.

### Sıralama testleri

Klasik A/B, sabit örnek boyutunu varsayır. Sıralama testleri ("bakıp karar") tekrarlanan bakışlar altında yanlış pozitif oranı kontrol eder. Her zaman geçerli sıralı prosedürler (mSPRT, Howard'ın güven sırası) net kazanıcıları erken durdurmanıza izin verir.

### Çoklu karşılaştırma düzeltmeleri

%95 güvenle 20 A/B testi yapılması tesadüf olarak bir yanlış pozitif üretir. Bonferroni düzeltmesi test başına α'yı sıkılaştırır; Benjamini-Hochberg yanlış keşif oranını kontrol eder. GrowthBook her ikisini de uyguluyor.

### SRM  örnek oranı eşleşmezliği

Görev hash kullanıcıları varyasyonlara rastgeleleştirir. 50/50 bölünme 47/53'ü verirse, bir şey kırılır  SRM kontrolü onu işaretler.

### Statsig vs. GrowthBook

**Statsig**- ...
- OpenAI tarafından 1.1 milyar dolarlık bir fiyatla satın alındı (Eylül 2025).
- Sıralama testleri, CUPED, dayanıklı popülasyonlar.
- Tüm birer: özellik bayrakları + deney + gözlemlenme.
- En iyi uygulama: Takım zaten bir paketli ürün istiyor, OpenAI'nin sahipliği umurunda değil.

**GrowthBook**- ...
- Açık kaynaklı (MIT); depo-dev (Snowflake/BigQuery/Redshift'ten doğrudan okur).
- Çoklu motorlar: Bayesian, Frequentist, Sequential.
- CUPED, SRM, Bonferroni, BH düzeltmeleri.
- Kendi kendine barındırma veya yönetilen bulut.
- En iyi uygunluk: deposu SQL dükkanı, veri ekibi metrik katmanı kontrol ediyor, OSS istiyor.

### Kararlılıktan uzak olmak güçleri karmaşıklaştırır

Aynı prompt farklı çıkışlar üretir. Geleneksel güç hesaplamaları IID gözlemlerini varsayır. LLM belirlemeciliği ile, etkili örnek boyutu nominalden daha düşüktür.

### Gerçek dava sonuçları

- Chatbot ödül modeli varianti: +70% konuşma uzunluğu, +30% tutma.
- Sonraki konu çizgileri: Ödül fonksiyonunun geliştirilmesinden sonra %1 + CTR.
- Khan Academy Khanmigo: İteratif gecikme karşı matematik doğruluk ticareti.

### Anti-pattern: vibes üzerinde nakliye

Her üst düzey mühendis, gönderilen bir özelliğin adını verebilir çünkü "A/B olmadan daha iyi hissettiriyor". Çoğu ürün ölçümleri, takım aylarca fark etmedi. A/B zorlayıcı fonksiyon.

### Hatırlamalısın numaralar

- Statsig, OpenAI tarafından satın alındı: 1.1 milyar dolar, Eylül 2025.
- GrowthBook: açık kaynaklı MIT; Bayesian + Frequentist + Sequential.
- CUPED değişkenlik azaltımı: 30-70%.
- LLM belirlenmezliği → +30-50% örnek boyut tamponu.

```figure
mx-sequential-test
```

## Kullan

`code/main.py`sabit ve sıralı sınırlar ile bir dizi A/B testi simüle eder.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-ab-plan.md`Özellik değişikliği, iş yükü, başlangıç çizgisi, platform seçimi, kapılar, örnek boyutu göz önüne alındığında.

## Egzersizler

1. Çık .`code/main.py`% 5 yükseltme için, başlangıç değerinde % 3 dönüşüm ile, % 80 güç için hangi örnek boyutu?
2. Sağlık hizmetleri ile düzenlenen bir yerleşim müşteri için Statsig veya GrowthBook'u seçin.
3. GPT-4 vs GPT-3.5'i çözülmüş bilet fiyatına test eden bir A/B tasarlayın.
4. Kanarya geçiyor ama A/B %1,2 dönüşüm gösterir.
5. CUPED'i, dönem öncesi bir değişkenle uygulayın ve bu değişkenlik dönem sonrası değişkenliğin %60'ını açıklar (sıkram korelasyon 0,6).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Eval | "offline test" | Labeled-set evaluation of model capability |
| A/B test | "experiment" | Live randomized comparison on users |
| CUPED | "variance reduction" | Pre-period regression to reduce variance |
| Sequential test | "peek-ok test" | Always-valid procedure allowing early stop |
| Multiple comparison | "the family error" | Running many tests inflates false positives |
| Bonferroni | "tight correction" | Divide α by number of tests |
| Benjamini-Hochberg | "BH FDR" | False-discovery-rate control, less conservative |
| SRM | "bad split" | Sample ratio mismatch; assignment bug |
| Statsig | "OpenAI owned" | Commercial all-in-one, acquired 2025 |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | Classical sequential procedure |

## Daha Fazla Okumak

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
