# Değerlendirme — FID, CLIP Puanı, İnsan Tercihi

> Her üretken model liderlik tablosunda FID, CLIP puanı ve insanların tercih ettiği bir alandaki kazanma oranı belirtilir. Her sayının kararlı bir araştırmacının oynayabileceği bir başarısızlık modu vardır. Arıza modlarını bilmiyorsanız, bir oyun koşusunda gerçek bir gelişme olduğunu söyleyemezsiniz.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 8 · 01 (Sınıflandırma), Aşama 2 · 04 (Değerlendirme Metrikleri)
**Süre:** ~45 dakika

## Sorun

Üretken bir model, *numune kalitesi* ve *koşullandırma uyumuna* göre değerlendirilir. İkisinin de kapalı form ölçüsü yoktur. Modelinizin 10.000 görüntü oluşturması gerekiyor; bir şeyin onlara numaralar vermesi gerekiyor; model aileleri, çözünürlükler ve mimariler arasındaki sayılara güvenmek zorundasınız. 2014-2026 zorlu mücadelesinden üç ölçüt kurtuldu:

- **FID (Fréchet Başlangıç Mesafesi).** Bir Inception ağının özellik alanındaki iki dağıtım (gerçek ve oluşturulan) arasındaki mesafe. Daha düşük olması daha iyidir.
- **CLIP puanı.** Oluşturulan görüntünün CLIP görüntüsü embedding ile prompt'nin CLIP metni embedding arasındaki kosinüs benzerliği. Daha yüksek daha iyidir. prompt bağlılığını ölçer.
- **İnsan tercihi.** Aynı prompt üzerinde iki modeli karşı karşıya getirin, insanların (veya GPT-4 sınıfı bir modelin) daha iyi olanı seçmesini sağlayın ve bir Elo puanı elde edin.

Ayrıca şunu göreceksiniz: IS (başlangıç puanı, büyük ölçüde kullanımdan kaldırıldı), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Her biri öncekinin bir başarısızlığını düzeltir.

## Konsept

![FID, CLIP ve tercih: üç eksen, farklı arıza modları](../assets/evaluation.svg)

### FID — örnek kalitesi

Heusel ve ark. (2017). Adımlar:

1. N adet gerçek görüntü ve N adet oluşturulan için Inception-v3 özelliklerini (2048-D) çıkarın.
2. Her havuza bir Gaussian yerleştirin: `μ_r, μ_g` ortalamasını ve `Σ_r, Σ_g` kovaryansını hesaplayın.
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`.

Yorum: Özellik uzayında iki çok değişkenli Gaussian arasındaki Fréchet mesafesi. Daha düşük = daha benzer dağılımlar.

Arıza modları:
- **Küçük N'ye önyargılıdır.** FID, özellik dağılımı üzerinden ortalama karedir — küçük N, kovaryansı olduğundan düşük tahmin eder, hatalı şekilde düşük FID verir. Her zaman N ≥ 10.000 kullanın.
- **Başlangıca bağımlı.** Inception-v3, ImageNet üzerinde eğitildi. ImageNet'ten uzak alanlar (yüzler, sanat, metin görselleri) anlamsız FID üretir. Etki alanına özgü bir özellik çıkarıcı kullanın.
- **Oyun.** Başlangıç'a önceden gereğinden fazla uyum sağlamak, görsel kalitede iyileşme olmaksızın düşük FID sağlar. CMMD ile çırpın (aşağıda).

### CLIP puanı — prompt uyum

Radford ve diğerleri. (2021). Oluşturulan bir görüntü için + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

Oluşturulan 30 bin görüntünün ortalaması → modeller arasında karşılaştırılabilir bir skaler değer.

Arıza modları:
- **CLIP'in kendi kör noktaları.** CLIP'in bileşimsel mantığı zayıftır ("mavi küre üzerinde kırmızı küp" çoğu zaman başarısız olur). Modeller, karmaşık prompt'leri gerçekten takip etmeden CLIP puanında iyi sıralanabilir.
- **Kısa prompt sapması.** Kısa prompt'lerin doğada daha fazla CLIP görüntüsü eşleşmesi vardır. Daha uzun prompt'ler mekanik olarak daha düşük CLIP puanlarına sahiptir.
- **Prompt oyun.** prompt'ye "yüksek kalite, 4k, başyapıt"ın dahil edilmesi, görüntü-metin bağlamayı iyileştirmeden CLIP puanını artırır.

CMMD (Jayasumana ve diğerleri, 2024) bunlardan bazılarını düzeltir: Inception yerine CLIP özelliklerini kullanır, Fréchet yerine maksimum ortalama tutarsızlığını kullanır. İnce kalite farklılıklarını tespit etmede daha iyi.

### İnsan tercihi — temel gerçek

prompt'lerden oluşan bir havuz seçin. Model A ve model B ile oluşturun. Çiftleri insanlara (veya güçlü bir Yüksek Lisans jürisine) gösterin. Kazançları Elo veya Bradley-Terry skoruna toplayın. Benchmark'ler:

- **PartiPrompt'ler (Google)**: 1.600 farklı prompt, 12 kategori.
- **HPSv2**: 107 bin insan ek açıklaması, yaygın olarak otomatik proxy olarak kullanılır.
- **ImageReward**: 137k prompt-görüntü tercih çifti, MIT lisanslı.
- **PickScore**: Pick-a-Pic 2,6M tercihleri üzerine eğitilmiştir.
- **Chatbot-Arena tarzı görüntü arenaları**: https://imagearena.ai/ ve diğerleri.

Arıza modları:
- **Yargıç farklılığı.** Uzman olmayanların uzmanlardan farklı tercihleri vardır. Her ikisini de kullanın.
- **Prompt dağıtımı.** Özenle seçilmiş prompt'ler bir aileyi tercih eder. Daima belgeleyin.
- **Yüksek Lisans jürisi ödül hacklemesi.** GPT-4 jürisi güzel ama yanlış çıktılara kanıyor. İnsanla üçgen yapın.

## Birlikte kullanın

Bir üretim değerlendirme raporu şunları içermelidir:

1. Uzatılmış bir gerçek dağılıma (örnek kalitesi) karşı 10-30 bin örnek üzerinde FID.
2. Aynı numunelerde CLIP puanı / CMMD ile prompt'leri (bağlılık).
3. Kör bir arenada önceki modele kıyasla kazanma oranı (genel tercih).
4. Arıza modu analizi: Bilinen sorunlar (el anatomisi, metin oluşturma, tutarlı nesne sayısı) için işaretlenen 50 rastgele örneklenmiş çıktı.

Herhangi bir ölçüm yalandır. Üç doğrulayıcı ölçüm + niteliksel inceleme bir iddiadır.

## İnşa Et

`code/main.py`, sentetik "özellik vektörleri" üzerinde FID, CLIP puanı benzeri ve Elo toplamayı uygular (Başlangıç özelliklerinin yerine geçenler olarak 4 boyutlu vektörleri kullanırız). Şunu görüyorsunuz:

- Küçük bir N ve büyük bir N üzerinde FID hesaplaması — sapma.
- Özellik havuzları arasındaki kosinüs benzerliği olarak "CLIP puanı".
- Sentetik bir tercih akışından Elo güncelleme kuralı.

### Adım 1: Dört satırda FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Adım 2: CLIP tarzı kosinüs benzerliği

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Adım 3: Elo toplama

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Tuzaklar

- **N=1000'de FID.** Sezgisel yöntem N=10k altında güvenilir değildir. Düşük N FID'yi bildiren makaleler oyun amaçlıdır.
- **FID'nin çözünürlükler arasında karşılaştırılması.** Inception'ın 299×299 yeniden boyutlandırması özellik dağılımını değiştirir. Yalnızca eşleşen çözünürlükte karşılaştırın.
- **Bir tohum rapor ediliyor.** Minimum 3 tohum çalıştırın. Rapor std.
- **Negatif prompt'ler yoluyla CLIP puanı enflasyonu.** Bazı boru hatları, prompt'yi aşırı takarak CLIP'i güçlendirir. Görsel doygunluğu kontrol edin.
- **prompt'den gelen Elo yanlılığı örtüşüyor.** Her iki model de eğitim sırasında bir benchmark prompt görürse, Elo anlamsızdır. Uzatılmış prompt setlerini kullanın.
- **İnsanlar ücretli kalabalığı çarpık olarak değerlendiriyor.** Üretken, MTurk yorumcuları daha genç / teknoloji dostu olanı çarpıtıyor. İşe alınan sanat/tasarım uzmanlarıyla bir araya gelin.

## Kullan onu

2026'daki üretim değerlendirme protokolü:

| Sütun | Asgari | Önerilen |
|--------|---------|-------------|
| Örnek kalitesi | FID 10.000'e karşı ertelenen gerçek | + 5k'de CMMD + kategori başına alt kümede FID |
| Prompt bağlılık | 30k'da CLIP puanı | + HPSv2 + ImageReward + VQA tarzı soru yanıtlama |
| Tercih | 200 kör çift ile taban çizgisi karşılaştırması | + 2000 eşleştirilmiş insan + Yüksek Lisans jürisi + Chatbot Arena |
| Arıza analizi | 50 elle işaretlenmiş | 500 elle işaretlenen + otomatik güvenlik sınıflandırıcı |

Tek bir raporda dört sütunun tamamı = iddia. Herhangi biri tek başına = pazarlama.

## Gönderin

`outputs/skill-eval-report.md`'yi kaydedin. Skill, yeni bir model kontrol noktası + temel çizgisini alır ve tam bir değerlendirme planının çıktısını alır: örnek boyutları, ölçümler, hata modu araştırmaları, imzalama kriterleri.

## Egzersizler

1. **Kolay.** `code/main.py`'yi çalıştırın. Aynı sentetik dağılımlarda N=100 ve N=1000'deki FID'yi karşılaştırın. Önyargı büyüklüğünü bildirin.
2. **Orta.** CMMD'yi sentetik CLIP tarzı özelliklerden uygulayın (formül için bkz. Jayasumana ve diğerleri, 2024). Kalite farklılıklarına karşı hassasiyeti FID ile karşılaştırın.
3. **Zor.** HPSv2 kurulumunu kopyalayın: Pick-a-Pic alt kümesinden 1000 görüntü-prompt çifti alın, tercihlere göre küçük bir CLIP tabanlı puanlayıcıya ince ayar yapın ve bunun uzatılmış bir setle uyumunu ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| FID | "Fréchet Başlangıç ​​Mesafesi" | Gaussian'ın Fréchet mesafesi gerçek ve gen Başlangıç ​​özelliklerine uyuyor. |
| KLİP puanı | "Metin-görüntü benzerliği" | CLIP görüntüsü ile embedding metni arasındaki kosinüs benzerliği. |
| CMMD | "FID'nin değiştirilmesi" | CLIP özellikli MMD; daha az önyargılı, Gauss varsayımı yok. |
| IS | "Başlangıç ​​puanı" | Deney KL(p(y|x) || p(y)); modern modellerle zayıf korelasyona sahiptir, kullanımdan kaldırılmıştır. |
| HPSv2 / ImageReward / PickScore | "Öğrenilmiş tercih proxy'leri" | İnsan tercihlerine göre eğitilmiş küçük modeller; otomatik yargıç olarak kullanılır. |
| Elo | "Satranç değerlendirmesi" | Bradley-Terry ikili galibiyetlerin toplamı. |
| PartiPrompt'ler | "benchmark prompt seti" | 12 kategoride Google tarafından seçilen 1.600 prompt. |
| FD-DINO | "Kendi kendine destekli değiştirme" | DINOv2 özelliklerini kullanan FD; ImageNet dışı alanlar için daha iyidir. |

## Üretim notu: değerlendirme de bir inference iş yüküdür

FID'yi 10 bin örnek üzerinde çalıştırmak, 10 bin görüntü oluşturmak anlamına gelir. Tek bir L4 üzerinde 1024²'de 50 adımlı bir SDXL tabanı için bu, ~11 saatlik tek istek inference anlamına gelir. Değerlendirme bütçeleri gerçektir ve çerçeveleme tam olarak çevrimdışı inference senaryosudur (verimliliği en üst düzeye çıkarın, TTFT'yi göz ardı edin):

- **Zor toplu işlem yapın, gecikmeyi unutun.** Çevrimdışı değerlendirme = belleğe sığan en büyük boyutta statik toplu işlem. 80 GB H100 üzerinde `num_images_per_prompt=8` ile `pipe(...).images`, tekli isteğe göre 4-6 kat daha hızlı duvar saatinde çalışır.
- **Gerçek özellikleri önbelleğe alın.** Gerçek referans seti üzerinden Inception (FID) veya CLIP (CLIP-score, CMMD) özellik çıkarma *bir kez* çalıştırılır ve `.npz` olarak saklanır. Değerlendirme başına yeniden hesaplama yapmayın.

CI / regresyon kapıları için: PR başına 500 örnekli bir alt kümede FID + CLIP skorunu çalıştırın (~30 dakika); her gece tam 10k FID + HPSv2 + Elo çalıştırın.

## Daha Fazla Okuma

- [Heusel ve ark. (2017). İki Zaman Ölçeği Güncelleme Kuralıyla Eğitilen GAN'lar Yerel Nash Dengesine (FID) Yakınsıyor](https://arxiv.org/abs/1706.08500) — FID makalesi.
- [Jayasumana ve ark. (2024). FID'yi Yeniden Düşünmek: Görüntü Oluşturma için Daha İyi Bir Değerlendirme Metriğine Doğru (CMMD)](https://arxiv.org/abs/2401.09603) — CMMD.
-[Radford ve ark. (2021). Doğal Dil Denetiminden (CLIP) Aktarılabilir Görsel Modellerin Öğrenilmesi](https://arxiv.org/abs/2103.00020) — CLIP.
- [Wu ve ark. (2023). HPSv2: Kapsamlı Bir İnsan Tercihi Puanı](https://arxiv.org/abs/2306.09341) — HPSv2.
- [Xu ve ark. (2023). ImageReward: Metinden Görüntü Oluşturmaya Yönelik İnsan Tercihlerini Öğrenmek ve Değerlendirmek](https://arxiv.org/abs/2304.05977) — ImageReward.
- [Yu ve ark. (2023). İçerik Açısından Zengin Metin-Görüntü Oluşturma için Otoregresif Modelleri Ölçeklendirme (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) — PartiPrompts.
- [Stein ve ark. (2023). Üretken model değerlendirme ölçümlerindeki kusurların ortaya çıkarılması](https://arxiv.org/abs/2306.04675) — hata modu araştırması.
