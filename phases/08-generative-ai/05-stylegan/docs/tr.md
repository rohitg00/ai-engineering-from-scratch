# StyleGAN

> Çoğu jeneratör `z`'yi her katmana aynı anda karıştırır. StyleGAN bunu parçalara ayırdı: önce `z`'yi orta düzey bir `w` ile eşleyin, ardından AdaIN aracılığıyla `w`'yi her çözünürlük seviyesinde *enjekte edin*. Bu tek değişiklik gizli alanı çözdü ve fotogerçekçi yüzleri yedi yıl boyunca çözülmüş bir sorun haline getirdi.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 8 · 03 (GAN'lar), Aşama 4 · 08 (Normalleştirme), Aşama 3 · 07 (CNN'ler)
**Süre:** ~45 dakika

## Sorun

Bir DCGAN, `z`'yi, aktarılmış evrişim yığını yoluyla bir görüntüye eşler. Sorun: `z` birbirine karışmış her şeyi (poz, aydınlatma, kimlik, arka plan) kontrol ediyor. `z`'nin bir ekseni boyunca hareket edin, dördü de değişir. Modele "aynı kişi, farklı poz" diye soramazsınız çünkü temsil bu şekilde hesaba katılmaz.

Karras ve ark. (2019, NVIDIA) şunu önerdi: `z`'yi doğrudan dönüşüm katmanlarına beslemeyi bırakın. Ağ girişi olarak sabit bir `4×4×512` tensör besleyin. `z ∈ Z → w ∈ W`'yi eşleyen 8 katmanlı bir MLP öğrenin. *Uyarlanabilir örnek normalleştirme* (AdaIN) yoluyla `w`'yi her çözünürlükte enjekte edin: her dönüşüm özellik haritasını normalleştirin, ardından `w`'nin afin projeksiyonlarına göre ölçeklendirin ve kaydırın. Stokastik ayrıntılar (cilt gözenekleri, saç telleri) için katman başına gürültü ekleyin.

Sonuç: `W`, "üst düzey stil" (poz, kimlik) ve "kaliteli stil" (ışıklandırma, renk) için kabaca dik eksenlere sahiptir. Düşük çözünürlük seviyeleri için A görüntüsünün `w`'sini ve yüksek çözünürlük düzeyleri için B görüntüsünün `w`'sini kullanarak iki görüntü arasında stilleri değiştirebilirsiniz. Bu, düzenlemenin, alanlar arası stilizasyonun ve tüm "StyleGAN-inversiyon" araştırma serisinin kilidini açtı.

## Konsept

![StyleGAN: haritalama ağı + AdaIN + katman başına gürültü](../assets/stylegan.svg)

**Ağ haritalama.** `f: Z → W`, 8 katmanlı bir MLP. `Z = N(0, I)^512`. `W`, Gaussian olmaya zorlanmaz; verilere uyarlanmış bir şekil öğrenir.

**Sentez ağı.** Öğrenilmiş bir sabit olan `4×4×512`'den başlar. Her çözünürlük bloğu: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`. Çözünürlükler çift: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

burada `y_scale` ve `y_bias`, `w`'nin afin projeksiyonlarından gelir. Özellik haritasına göre normalleştirin, ardından yeniden biçimlendirin. Buradaki "Stil" özellik haritasının birinci ve ikinci derece istatistikleridir.

**Katman başına gürültü.** Her özellik haritasına, kanal başına öğrenilen bir faktörle ölçeklenen tek kanallı Gauss gürültüsü eklendi. Küresel yapıyı etkilemeden stokastik ayrıntıları kontrol eder.

**Kesme numarası.** inference'de `z` örneğini alın, `w = mapping(z)`'yi hesaplayın, ardından `w' = ŵ + ψ·(w - ŵ)`'yi hesaplayın; burada `ŵ`, birçok örnek üzerinden ortalama `w`'dir. `ψ < 1` kalite için çeşitlilikten ödün verir. Hemen hemen her StyleGAN demosu `ψ ≈ 0.7`'yi kullanır.

## StilGAN 1 → 2 → 3

| Sürüm | Yıl | Yenilik |
|---------|------|------------|
| StilGAN | 2019 | Haritalama ağı + AdaIN + gürültü + aşamalı büyüme. |
| StilGAN2 | 2020 | Ağırlık demodülasyonu AdaIN'in yerini alır (artifact damlacıklarını düzeltir); atlama/artık mimari; yol uzunluğu düzenlemesi. |
| StilGAN3 | 2021 | Takma ad içermeyen evrişim + eşdeğer çekirdekler; Dokunun piksel ızgarasına yapışmasını ortadan kaldırır. |
| StilGAN-XL | 2022 | Sınıf koşullu, 1024², ImageNet. |
| R3GAN | 2024 | Daha güçlü itibara sahip yeniden markalamalar; FFHQ-1024'te 20 kat daha az parametreyle difüzyon açığını kapatır. |

2026'da StyleGAN3, (a) yüksek FPS'de dar alanlı fotogerçekçilik, (b) az çekim alan uyarlaması (100 görüntülü yeni bir dataset üzerinde eğitim, haritalamayı dondur), (c) ters çevirme tabanlı düzenleme (gerçek bir fotoğrafı yeniden oluşturan `w`'yi bulun, ardından bu `w`'yi düzenleyin) için varsayılan olmaya devam ediyor. Açık alanlı metinden resme dönüştürme için bu araç değil, yayılmadır.

## İnşa Et

`code/main.py`, 1 boyutlu bir oyuncak "style-GAN lite" uygular: öğrenilen bir sabit vektörü alan ve onu `w`'den türetilmiş ölçek/önyargı ve katman başına gürültü ile modüle eden bir sentez işlevi olan bir haritalama MLP'si. `w`'nin afin modülasyon yoluyla enjekte edilmesinin, `z`'nin jeneratör girişine birleştirilmesiyle eşleştiğini veya ondan daha iyi olduğunu gösterir.

### Adım 1: ağı eşleme

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### 2. Adım: uyarlanabilir örnek normalleştirmesi

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

Özellik başına harita ölçeği ve sapma, doğrusal projeksiyon aracılığıyla `w`'den gelir.

### Adım 3: katman başına gürültü

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Kanal başına Sigma öğrenilebilir.

## Tuzaklar

- **Damlacık artifacts.** StyleGAN 1, özellik haritalarında damlacık damlacıkları üretti çünkü AdaIN ortalamayı sıfırladı. StyleGAN 2'nin ağırlık demodülasyonu, bunun yerine evrişim ağırlıklarını ölçeklendirerek sorunu düzeltir.
- **Doku yapışması.** StilGAN 1 ve 2 dokuları nesne koordinatlarını değil piksel koordinatlarını takip ediyordu (enterpolasyon sırasında görünür). StyleGAN 3'ün takma ad içermeyen evrişimleri bunu pencereli sinc filtreleriyle düzeltir.
- **Mod kapsamı.** Kesilme `ψ < 0.7` temiz görünüyor ancak örnekleri dar bir koniden geliyor; Çeşitliliğe ihtiyacınız varsa `ψ = 1.0` kullanın.
- **Ters çevirme kayıplıdır.** Gerçek bir fotoğrafı `W`'ye çevirmek genellikle optimizasyon veya bir kodlayıcı (e4e, ReStyle, HyperStyle) aracılığıyla yapılır. Sonuçlar birçok yinelemede farklılık gösterir.

## Kullan onu

| Kullanım örneği | Yaklaşım |
|----------|----------|
| Fotogerçekçi insan yüzleri (anime, ürün, dar) | StyleGAN3 FFHQ / özel ince ayar |
| Fotoğraftan yüz düzenleme | e4e inversiyon + StyleSpace / InterFaceGAN yönleri |
| Yüz değiştirme / yeniden canlandırma | StyleGAN + kodlayıcı + karıştırma |
| Avatar boru hatları | Düşük verili ince ayar için StyleGAN3 ve ADA |
| Birkaç resimden alan adı uyarlaması | Haritalama ağını dondurun, senteze ince ayar yapın |
| Çok modlu veya metin koşullu oluşturma | Yapmayın — difüzyon kullanmayın |

Cevabın "bir kişinin yüzünün fotoğrafı" olduğu ürün sınıfı demolarda StyleGAN, aynı kalite çubuğu için inference maliyeti (tek ileri geçiş, 4090'da <10 ms) ve keskinlik açısından yayılmayı geride bırakıyor.

## Gönderin

`outputs/skill-stylegan-inversion.md`'yi kaydedin. Skill gerçek bir fotoğraf çeker ve çıktı verir: ters çevirme yöntemi (e4e / ReStyle / HyperStyle), beklenen gizli kayıp, düzenleme bütçesi (`W`'de artifact'lerden önce ne kadar ileri gidebilirsiniz) ve bilinen iyi düzenleme yönlerinin bir listesi (yaş, ifade, poz).

## Egzersizler

1. **Kolay.** `code/main.py`'yi `adain_on=True` ve `adain_on=False` ile çalıştırın. Sabit bir latent ile tedirgin bir latent için çıktıların yayılmasını karşılaştırın.
2. **Orta.** Karıştırma düzenlemesini uygulayın: bir eğitim grubu için `w_a`, `w_b`'yi hesaplayın ve sentezin ilk yarısı için `w_a`'yi ve ikinci yarısı için `w_b`'yi uygulayın. Kod çözücü çözülmüş stilleri öğreniyor mu?
3. **Zor.** Önceden eğitilmiş bir StyleGAN3 FFHQ modelini (ffhq-1024.pkl) alın. Etiketli örnekler üzerinde bir SVM eğiterek "gülümseme"yi kontrol eden `w` yönünü bulun; Kimlik sürüklenmeden önce ne kadar ileri gidebileceğinizi bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Haritalama ağı | "MLP" | `f: Z → W`, 8 katman, gizli geometriyi veri istatistiklerinden ayırır. |
| W alanı | "Stil alanı" | Haritalama ağının çıktısı; kabaca çözüldü. |
| AdaIN | "Uyarlanabilir örnek normu" | Özellik haritasını normalleştirin, ardından `w` projeksiyonuna göre ölçekleyin + kaydırın. |
| Kesme numarası | "Psi" | `w = mean + ψ·(w - mean)`, ψ<1 çeşitlilik yerine kaliteyi tercih eder. |
| Yol uzunluğu düzenlemesi | "PL kaydı" | `w`'de birim değişiklik başına görüntüdeki büyük değişiklikleri cezalandırır; `W`'yi daha pürüzsüz hale getirir. |
| Ağırlık demodülasyonu | "StyleGAN2 düzeltmesi" | Aktivasyonlar yerine dönüşüm ağırlıklarını normalleştirin; artifact damlacıklarını öldürür. |
| Takma ad içermez | "StyleGAN3'ün numarası" | Pencereli filtreler; Dokunun piksel ızgarasına yapışmasını ortadan kaldırır. |
| Ters Çevirme | "Gerçek bir görüntü için w'yi bulun" | `x → w`'yi `G(w) ≈ x` şeklinde optimize edin veya kodlayın. |

## Üretim notu: StyleGAN neden hala 2026'da gönderiliyor

4090 üzerindeki StyleGAN3, 10 ms'nin altında bir 1024² FFHQ yüzü oluşturur — `num_steps = 1`, VAE kod çözme yok, çapraz dikkat geçişi yok. Üretim açısından bu, herhangi bir görüntü oluşturucu için taban gecikmesidir. Aynı çözünürlükte 50 adımlı SDXL + VAE kod çözme ardışık düzeni ~3 saniyedir. Bu **300 kat boşluk** anlamına geliyor ve dar alanlı ürünler (avatar hizmetleri, kimlik belgesi hatları, stok yüzü oluşturma) için TCO'da kazanıyor.

İki operasyonel sonuç:

- **Zamanlayıcı yok, toplu işleyici yok.** Hedef doluluktaki statik toplu iş en uygunudur. Sürekli toplu işlem (LLM'ler ve dağıtım için gereklidir), her istek aynı FLOP'ları aldığından sıfır fayda sağlar.
- **Kesme `ψ` güvenlik düğmesidir.** `ψ < 0.7`, haritalama ağı aralığının dar bir konisinden örnekler alır. Bu, servis katmanının örnek varyansının üzerinde sahip olduğu tek kaldıraçtır. `ψ`'yi en yüksek yükte indirin, premium kullanıcılar için yükseltin.

## Daha Fazla Okuma

- [Karras ve ark. (2019). GAN'lar için Stil Tabanlı Bir Oluşturucu Mimarisi](https://arxiv.org/abs/1812.04948) — StyleGAN.
- [Karras ve ark. (2020). StyleGAN'ın Görüntü Kalitesini Analiz Etme ve İyileştirme](https://arxiv.org/abs/1912.04958) — StyleGAN2.
- [Karras ve ark. (2021). Takma Adsız Üretken Çekişmeli Ağlar](https://arxiv.org/abs/2106.12423) — StyleGAN3.
- [Tov ve ark. (2021). StyleGAN Görüntü İşleme için Kodlayıcı Tasarlama](https://arxiv.org/abs/2102.02766) — e4e ters çevirme.
- [Sauer ve ark. (2022). StyleGAN-XL: StyleGAN'ı Geniş Çeşitli Dataset'lere Ölçeklendirme](https://arxiv.org/abs/2202.00273) — StyleGAN-XL.
- [Huang ve ark. (2024). R3GAN: GAN öldü; yaşasın GAN!](https://arxiv.org/abs/2501.05441) — modern minimal GAN ​​tarifi.
