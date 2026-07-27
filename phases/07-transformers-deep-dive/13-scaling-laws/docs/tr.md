# Ölçekleme Kanunları

> 2020 Kaplan makalesi şunları söyledi: daha büyük model, daha düşük kayıp. 2022 Hoffmann makalesi şunu söylüyordu: Yetersiz antrenman yapıyordun. Hesaplama iki gruba (parametreler ve token'lar) gider ve bölünme açık değildir.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 7 · 05 (Tam Transformer), Aşama 7 · 07 (GPT)
**Süre:** ~45 dakika

## Sorun

C FLOP eğitim hesaplamasına sahip olduğunuzda ve en iyi modeli istediğinizde iki düğmeyle karşılaşırsınız:

1. **Kaç parametre (N)?** Daha büyük model, daha yüksek kapasite.
2. **Kaç eğitim tokens (D)?** Daha fazla veri, kapasitenin daha iyi kullanılması.

FLOP'lar yaklaşık olarak `6 × N × D` olarak ölçeklenir. N'yi yukarı ve D'yi aşağı veya D'yi yukarı ve N'yi aşağı itebilirsiniz. Hangisi daha iyi?

2022'den önce cevap "N'yi çok zorlayın" idi. GPT-3 (2020), ~300B tokens üzerinde eğitilen 175B parametreydi. Parametre başına yaklaşık 1,7 tokens'lik bir oran. Kaplan ölçeklendirme yasaları bunu destekledi.

Hoffmann ve ark. (2022), Chinchilla adı verilen küçük bir model ailesini eğitirken farklı bir şey buldu: optimal oran parametre başına **20 tokens**'ye daha yakın. GPT-3 10 kat daha az eğitilmişti. Chinchilla (70B param, 1,4T tokens), her benchmark üzerinde GPT-3'ü (175B, 300B tokens) 2,5 kat daha az inference maliyetle yendi.

2026, Chinchilla'nın dünyası; önemli bir değişiklikle. Llama 3 8B, parametre başına 1.875 token oranına karşılık gelen 15 trilyon token üzerinde eğitildi. Chinchilla idealini doksan dört kez geçti. Geniş ölçekte kullanılacak modeller için Inference maliyeti, eğitim maliyetinden daha önemlidir; bu nedenle, daha küçük bir konuşlandırılabilir ayak izi için aşırı eğitim (Chinchilla'dan sonra) 2026 varsayılanıdır.

## Konsept

![Chinchilla eğrileri: çeşitli N/D oranlarında kayıp ve hesaplama](../assets/scaling-laws.svg)

### Hoffmann yasası

Chinchilla makalesine göre kayıplar şöyle:

```
L(N, D) = A / N^α + B / D^β + E
```

- `N` = parametreler (embedding olmayan).
- `D` = eğitim token'ler.
- `α ≈ 0.34`, `β ≈ 0.28` (kabaca simetrik).
- `E ≈ 1.69`, indirgenemez kayıp tavanı.
- `A ≈ 406`, `B ≈ 411`.

Siz ölçeklendikçe iki terim birbirine karşı ticaret yapar. w.r.t türevini alın. Sabit hesaplamada (C = 6ND) `N` ve çöz:

```
N_opt ≈ 0.6 × (C/6)^0.5
D_opt ≈ 0.6 × (C/6)^0.5
D_opt / N_opt ≈ 20
```

Optimum hesaplama: parametre başına 20 tokens.

### Neden aşırı antrenman yapıyoruz?

Chinchilla-optimal, FLOP eğitimi başına eğitim kaybını en aza indirir. Ancak eğitim bedelini bir kez ödersiniz; inference sonsuza kadar maliyet.

Ayda trilyon token hizmet veren bir chatbot için inference toplam maliyete hakimdir. Lama'nın yaklaşımı: daha küçük, daha uzun antrenman yapın. 15T tokens'de 8B derinlemesine inference-optimize edilmiştir:

- Tüketici GPU'larına uyar.
- Gecikme 70B Chinchilla-optimumun çok küçük bir kısmıdır.
- Kalite çoğu görev için yeterince yakındır.

DeepMind'ın 2024 tarihli makalesi ("Aşırı antrenman yeni optimaldir") bunu resmileştirdi. inference ağırlıklı iş yükleri için doğru oran, sunum hacmine bağlı olarak parametre başına 100–500 tokens'ye yakındır.

### Ortaya çıkış ve pürüzsüzlük

İddia: Belirli yetenekler (aritmetik, çok adımlı akıl yürütme, düşünce zincirini takip etme) belirli bir ölçekte aniden "ortaya çıkıyor".

Schaeffer ve ark. (2023) bunun bir ölçüm olduğunu ileri sürmüştür artifact: ortaya çıkan metrikler, temeldeki logitlerdeki düzgün iyileşmeyi gizleyen süreksiz puanlamayı (tam eşleşme, eşikteki doğruluk) kullanır. Sürekli metrikler (çapraz entropi) düzgün eğriler gösterir.

2026'da fikir birliği şu: Sürekli kayıp yoluyla yapılan tahminler güvenilirdir. Benchmark atlayışlar çoğunlukla golcü artifact'lardır. Bütçeleri sürekli ölçümlere göre planlayın.

### 2026 resmi

Ölçeklendirme yasaları hala işliyor ancak:

| Faktör | Nasıl değiştirildi |
|--------|-------------|
| Veri kalitesi | "İyi" token'lerin (Phi tarzı) seçilmesi, eğrileri >2 kat etkili bilgi işlem oranında kaydırır |
| MEB | Toplam parametreler aktif FLOP'lardan ayrılır; aktif-FLOP başına ölçeklendirme yasaları |
| Eğitim sonrası | Bazı yetenekler (talimatları takip etme, kod) SFT+RLHF ile ön eğitimden daha fazla değişiyor |
| Çok modlu | Resim + metin token'ler birlikte ölçeklenir; modaliteye göre ayrı eğriler |
| Sentetik veriler | Modeller eğitim verilerini üretir; etkili bilgi işlem bileşimi |

Muon iyileştiricisi (Kimi Moonlight, 2024), eşleşen verilerde AdamW'a göre ~2 kat etkili hesaplama kazancı gösterdi. Bazı 2026 eğitim çalıştırmalarında varsayılan olarak Muon kullanılır. Ölçekleme yasasındaki mutlak sabiti değiştirir, şeklini değil.

```figure
scaling-laws
```

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Chinchilla kayıp denklemini uyguluyoruz ve çeşitli hesaplama bütçelerinin her birinde hesaplama açısından optimal `(N, D)` değerini çözüyoruz.

### Adım 1: Çinçilla kaybı

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

`L`'yi, sabit `C = 6ND`'de `(N, D)` üzerinde bir kontur olarak çizin. Minimumu bulun.

### Adım 2: işlem açısından optimal sınır

`1e17` ila `1e25` FLOP arasındaki bilgi işlem bütçeleri için, `6ND = C`'ye tabi kaybı en aza indiren `(N, D)`'yi bulun. `D/N ≈ 20` oranını doğrulayın.

### 3. Adım: Aşırı eğitim maliyeti

10 kat daha küçük bir modeli eğitmek için ödediğiniz ekstra kaybı hesaplayın (optimum N'nin 1/10'u, optimum D'nin 10 katı). Karşılığında inference FLOP tasarrufunu (N ile orantılı) bildirir.

### 4. Adım: gerçek modellerle karşılaştırın

GPT-3, Chinchilla, Llama 3 8B, DeepSeek-V3 (aktif parametreler) için bilinen `(N, D)` çiftlerini ekleyin ve tahmin edilen ile rapor edilen kaybı karşılaştırın.

## Use It — Uygula

Bir sınır modelini kendi başınıza eğitmeniz pek mümkün değildir. Ancak ölçeklendirme yasaları size şunu söyler:

1. **İnce ayarınızın yeterli veriye sahip olup olmadığı.** Göreve özel verileriniz temel modelin parametresi başına 20 token'ın altındaysa, bir miktar kayıp tabanında doygunluk bekleyin.
2. **Daha büyük bir temel model seçilip seçilmeyeceği.** Bütçenizin tamamını inference için harcıyorsanız, daha küçük, daha uzun eğitimli bir modeli tercih edin.
3. **Getirilerin azaldığı yer.** 1000× Chinchilla optimalinin ötesinde, log kaybı değişiklikleri gürültüye dönüşür.

**2026'daki araştırma gidişatı:**

- **Veri kısıtlı rejim.** Web'de sınırlı sayıda yüksek kaliteli token (filtrelemeden sonra ~5–10 trilyon İngilizce) bulunur. Sınır ön eğitimi bu tavana yaklaşıyor. Sentetik veriler, çok dilli, çok modlu ve RLHF ölçekli fine-tuning bir sonraki kaldıraçlardır.
- **Hesaplama çarpanı püf noktaları.** Muon optimizasyonu, MoE, daha iyi veri iyileştirme — her biri asimptotu değil mutlak sabitleri kaydırır.
- **RL için ölçeklendirme yasaları.** Açık soru. İlk kanıtlar, RL örneklerinde kuvvet yasasını önermektedir, ancak ön eğitimden çok farklı üslere sahiptir.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-training-budget-estimator.md`. Beceri, hesaplama bütçesi, deployment kısıtlamaları ve hedef kaybı dikkate alınarak yeni bir eğitim çalıştırması için `(N, D, hours, GPU)`'yi seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. `1e20`, `1e22`, `1e24` işlem bütçeleri için Chinchilla-optimal `(N, D)` yazdırın. Gerçek model tablosuyla karşılaştırın.
2. **Orta.** Hoffmann hesaplama fonksiyonu olarak kayıp eğrisini uygulayın. Optimum hesaplama sınırı için grafik kaybı ve `log10(C)`. Yasanın, çapraz entropide bir sonraki 0,1'lik azalma için `>10^28` FLOP'a ihtiyacımız olacağını ne zaman öngördüğünü belirleyin.
3. **Zor.** Aynı dataset üzerinde eğitilmiş 5 küçük modele (100K ila 10M parametre) kendi ölçeklendirme yasanızı uygulayın. `α` ve `E`'yi tahmin edin. Üsleriniz yayınlanmış olanlarla ne kadar iyi eşleşiyor?

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Parametreler (N) | "Model boyutu" | embedding olmayan ağırlık sayımı; kapasiteyi belirler. |
| Tokens (D) | "Eğitim verileri" | Görülen eğitim token sayısı; Parametrelerin ne kadar iyi kullanıldığını belirler. |
| Hesapla (C) | "Harcanan FLOP'lar" | Standart bir transformer için yaklaşık olarak `6 × N × D`. |
| Çinçilla-optimal | "G/N ≈ 20" | Ön eğitimin FLOP başına kaybını en aza indiren oran. |
| Aşırı eğitim | "Geçmiş Çinçilla" | inference FLOP'tan tasarruf etmek için ekstra eğitim FLOP'ları harcayın; G/N >> 20. |
| İndirgenemez kayıp | "Zemin" | Ölçeklendirme kanununda `E` terimi; Verinin kendisinin entropisi. |
| Acil yetenek | "Ölçekte ani sıçramalar" | Genellikle golcü artifact; sürekli kayıp pürüzsüzdür. |
| Etkili bilgi işlem | "Eğitim verimliliği çarpanı" | Daha iyi veri/optimizasyon aracı/mimari bir FLOP'un ne kadar ileri gidebileceğini çoğaltır. |

## Daha Fazla Okuma

- [Kaplan ve ark. (2020). Sinir Dili Modelleri için Ölçekleme Yasaları](https://arxiv.org/abs/2001.08361) — ilk ölçeklendirme yasası makalesi; Yetersiz eğitimli.
- [Hoffmann ve ark. (2022). Hesaplama İçin Optimal Büyük Dil Modellerinin Eğitimi](https://arxiv.org/abs/2203.15556) — Chinchilla.
- [Schaeffer ve ark. (2023). Büyük Dil Modellerinin Ortaya Çıkan Yetenekleri Bir Serap mı?](https://arxiv.org/abs/2304.15004) — artifact ölçümü olarak ortaya çıkış.
- [Sardana, Frankle (2024). Chinchilla-Optimal'in Ötesinde: Dil Modeli Ölçeklendirme Yasalarında Inference'nin Hesaplanması](https://arxiv.org/abs/2401.00448) — Lama'nın aşırı eğitiminin neden iş yüküne uygun olduğu.
- [Ürdün ve ark. (2024). Muon: neural networks](https://kellerjordan.github.io/posts/muon/) cinsinden gizli katmanlar için bir optimize edici — 2x hesaplama çarpanı.
