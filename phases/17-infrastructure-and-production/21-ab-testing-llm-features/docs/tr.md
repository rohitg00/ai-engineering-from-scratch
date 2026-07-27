# A/B Testi Yüksek Lisans Özellikleri — GrowthBook, Statsig ve Vibes Problemi

> Geleneksel A/B testi, deterministik olmayan LLM'ler için tasarlanmamıştır. Kritik ayrım: değerlendirmeler "model işi yapabilir mi?" sorusunu yanıtlar. A/B testleri "kullanıcıların umurunda mı?" sorusunu yanıtlıyor Her ikisi de gereklidir; Vibe çeklerinde gönderim bitti. 2026'da test edilmesi gerekenler: prompt mühendislik (ifadeler), model seçimi (GPT-4 vs GPT-3.5 vs OSS; doğruluk vs maliyet vs gecikme), üretim parametreleri (sıcaklık, en yüksek puan). Gerçek durumlar: Bir chatbot ödül modeli çeşidi, +%70 görüşme süresi ve +%30 kalıcılık sağladı; Nextdoor AI konu satırı deneyleri, ödül işlevi iyileştirmesinden sonra +%1 TO sağladı; Khan Academy Khanmigo, gecikme ve matematik doğruluğu ekseninde yinelendi. Platform ayrımı: **Statsig** (Eylül 2025'te OpenAI tarafından 1,1 milyar dolara satın alındı) — sıralı test, CUPED, hepsi bir arada. **GrowthBook** — açık kaynak, depoda yerel, Bayesian + Frequentist + Sıralı motorlar, CUPED, SRM kontrolleri, Benjamini-Hochberg + Bonferroni düzeltmeleri. Ambar-SQL tercihine ve "OpenAI tarafından edinilme"nin kuruluşunuz açısından önemli olup olmadığına göre seçim yaparsınız.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak sıralı test simülatörü)
**Önkoşullar:** Aşama 17 · 13 (Observability), Aşama 17 · 20 (Aşamalı Deployment)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Değerlendirmeleri ("model işi yapabilir mi") A/B testlerinden ("kullanıcıların umrunda mı") ayırın.
- Test edilebilir üç ekseni (prompt, model, parametreler) numaralandırın ve her biri için ölçüyü seçin.
- CUPED, sıralı testler ve Benjamini-Hochberg çoklu karşılaştırma düzeltmelerini açıklayın.
- Depo-SQL duruşuna ve kurumsal satın alma duruşuna göre Statsig veya GrowthBook'u seçin.

## Sorun

prompt sistemini elle ayarladınız. Daha iyi hissettiriyor. Sen gönder. Dönüşüm gürültüyle değişir. Ölçüyü suçluyorsun. Veya yeni bir model gönderdiniz ve dönüşüm değişmedi; modelin kalitesi mi düştü yoksa değişiklik tespit edilemeyecek kadar mı küçüktü? Bilmiyorsun çünkü A/B olmadan gönderim yaptın.

Değerlendirmeler, modelin etiketli bir kümede bir görevi yapıp yapamayacağını yanıtlar. Kullanıcıların çıktıyı tercih edip etmediğine cevap vermiyorlar. Yalnızca kontrollü bir çevrimiçi deney buna yanıt verir ve yalnızca deneyin yeterli güce sahip olması durumunda, determinizmi kontrol eder ve çoklu karşılaştırmaları düzeltir.

## Konsept

### Evals ve A/B testleri

**Değerlendirmeler** — çevrimdışı, etiketli set, yargıç (puan anahtarı veya yargıç veya insan olarak LLM). Cevap: "Bu sabit dağıtımda çıktı doğru/yararlı/güvenli mi?"

**A/B testi** — çevrimiçi, canlı kullanıcılar, rastgele. Yanıt: "Yeni değişken, önemli olan kullanıcı düzeyindeki metriği taşıyor mu?"

Her ikisi de gerekli. Değerlendirmeler maruz kalmadan önce gerilemeleri yakalar; A/B sonrasında ürünün etkisini doğrular.

### Ne test edilmeli

1. **Prompt mühendisliği** — ifadeler, sistem-prompt yapısı, örnekler. Metrik: görev başarısı, kullanıcıyı elde tutma, maliyet/talep.
2. **Model seçimi** — GPT-4 ile GPT-3.5-Turbo ve Llama-OSS karşılaştırması. Metrik: doğruluk (görev) + maliyet/istek + gecikme P99. Çok amaçlı.
3. **Üretim parametreleri** — sıcaklık, en yüksek sıcaklık, max_tokens. Metrik: göreve özgü (çıktı çeşitliliği vs determinizm).

### CUPED — varyans azaltma

Deney Öncesi Verileri Kullanan Kontrollü Deneyler. Dönem sonrasını karşılaştırmadan önce dönem öncesi varyansı regrese edin. Tipik sapma azalması: %30-70. Etkili örnek boyutu ücretsiz olarak artar.

Uygulama: Hem Statsig hem de GrowthBook uygulanır.

### Sıralı test

Klasik A/B sabit örnek boyutunu varsayar. Sıralı testler ("gözetle ve karar ver") tekrarlanan bakışlar altında yanlış pozitiflik oranını kontrol eder. Her zaman geçerli sıralı prosedürler (mSPRT, Howard'ın güven dizileri), net kazananları erkenden durdurmanıza olanak tanır.

### Çoklu karşılaştırma düzeltmeleri

%95 güvenle 20 A/B testi çalıştırmak şans eseri bir yanlış pozitif üretir. Bonferroni düzeltmesi test başına α'yı sıkılaştırır; Benjamini-Hochberg yanlış keşif oranını kontrol ediyor. GrowthBook her ikisini de uygular.

### SRM — örnek oranı uyuşmazlığı

Atama karması, kullanıcıları varyantlara rastgele dağıtır. Eğer 50/50 bölünme 47/53 sağlıyorsa, bir şeyler bozuktur; SRM kontrolü bunu işaretler. Her iki platform da uygular.

### Statsig vs GrowthBook

**İstatistikler**:
- OpenAI tarafından 1,1 milyar dolara (Eylül 2025) satın alındı. Barındırılan, SaaS.
- Sıralı testler, CUPED, uzatılmış popülasyonlar.
- Hepsi bir arada: özellik işaretleri + deneme + observability.
- En uygun: Ekip zaten paket halinde bir ürün istiyor ve OpenAI'nin sahipliğini umursamıyor.

**Büyüme Kitabı**:
- Açık kaynak (MIT); depoda yerel (doğrudan Snowflake/BigQuery/Redshift'ten okur).
- Çoklu motorlar: Bayesian, Frequentist, Sıralı.
- CUPED, SRM, Bonferroni, BH düzeltmeleri.
- Kendi kendine barındırılan veya yönetilen bulut.
- En uygun: depo-SQL mağazası, veri ekibi metrik katmanını kontrol ediyor, OSS istiyor.

### Determinizmsizlik gücü karmaşıklaştırır

Aynı prompt farklı çıktılar üretir. Geleneksel güç hesaplamaları IID gözlemlerini varsayar. LLM'nin determinizm dışı olması durumunda, etkili örnek boyutu nominalden daha düşüktür. Gerekli numune boyutunu güvenlik marjı olarak ~1,3-1,5x ile çarpın.

### Gerçek vaka sonuçları

- Chatbot ödül modeli çeşidi: +%70 konuşma süresi, +%30 elde tutma.
- Nextdoor konu satırları: Ödül işlevi iyileştirmesinden sonra +%1 TO.
- Khan Academy Khanmigo: yinelemeli gecikme ve matematik doğruluğu ticareti.

### Anti-desen: titreşimlerle gönderim

Her kıdemli mühendis, A/B olmadan "daha iyi hissettirdiği" için gönderilen bir özelliğin adını söyleyebilir. Çoğu, ekibin aylardır fark etmediği ürün metriklerini geriletti. A/B zorlama işlevidir.

### Hatırlamanız gereken sayılar

- Statsig, OpenAI tarafından satın alındı: 1,1 milyar dolar, Eylül 2025.
- GrowthBook: açık kaynak MIT; Bayesian + Frequentist + Sıralı.
- CUPED varyans azalması: %30-70.
- Yüksek Lisans determinizm dışı → +%30-50 numune boyutu tamponu.

## Kullan onu

`code/main.py`, sabit ve sıralı sınırlarla sıralı bir A/B testini simüle eder. Sıralılığın erken durmanıza nasıl olanak sağladığını gösterir.

## Gönderin

Bu ders `outputs/skill-ab-plan.md`'yi üretir. Özellik değişikliği, iş yükü, temel, seçim platformu, kapılar, örnek boyutu göz önüne alındığında.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Temel %3'lük dönüşümle beklenen %5'lik bir artış için, %80'lik güç için örnek boyutu nedir?
2. Sağlık hizmetleri düzenlemelerine tabi bir şirket içi müşteri için Statsig veya GrowthBook'u seçin.
3. Çözümlenen bildirim başına maliyet açısından GPT-4 ve GPT-3.5'i test eden bir A/B tasarlayın. Birincil metrik, korkuluk metriği, ikincil nedir?
4. Kanaryanız geçer ancak A/B -%1,2 dönüşüm gösterir. Gönderim yapıyor musunuz? Yükseltme kriterlerini yazın.
5. Post varyansının %60'ı kadar bir ön döneme CUPED uygulayın. Etkin örnek boyutu artışını hesaplayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Değerlendirme | "çevrimdışı test" | Model kapasitesinin etiketli küme değerlendirmesi |
| A/B testi | "deney" | Kullanıcılar üzerinde canlı rastgele karşılaştırma |
| KUPALI | "farklılığın azaltılması" | Varyansı azaltmak için dönem öncesi regresyon |
| Sıralı test | "peek-ok testi" | Erken durdurmaya izin veren her zaman geçerli prosedür |
| Çoklu karşılaştırma | "aile hatası" | Çok sayıda test yapmak hatalı pozitif sonuçları artırır |
| Bonferroni | "sıkı düzeltme" | α'yı test sayısına bölün |
| Benjamini-Hochberg | "BH FDR" | Yanlış keşif oranı kontrolü, daha az ihtiyatlı |
| SRM | "kötü bölünme" | Örnek oranı uyumsuzluğu; ödev hatası |
| İstatistik | "OpenAI'ye ait" | Ticari hepsi bir arada, satın alma 2025 |
| Büyüme Kitabı | "OSS olanı" | MIT depoya özgü platform |
| mSPRT | "sıralı olasılık oranı testi" | Klasik sıralı prosedür |

## Daha Fazla Okuma

- [GrowthBook — Yapay Zeka A/B Testi Nasıl Yapılır](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Prompt'lerin Ötesinde: Veriye Dayalı Yüksek Lisans Optimizasyonu](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig ve GrowthBook karşılaştırması](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng ve ark. — KUPALI](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Güven Dizileri](https://arxiv.org/abs/1810.08240)
